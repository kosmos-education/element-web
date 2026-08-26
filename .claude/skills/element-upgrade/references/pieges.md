# Pièges rencontrés lors des montées de version

Chacun a coûté du temps au moins une fois. Ils ne se reproduiront pas à l'identique, mais leur
_forme_ revient : ce sont des endroits où le rebase réussit et où quelque chose casse quand même.

## Le thème

### Un import supprimé en amont casse le build (v1.12.26)

`res/css/_compound.pcss` a disparu ; les entrypoints La Bulle l'importaient encore et webpack
échouait sur les deux thèmes.

**Réflexe** : les entrypoints du thème La Bulle sont des forks de `light.pcss` / `dark.pcss`.
Comparer la liste d'imports avec celle des thèmes amont à chaque montée :

```bash
diff <(cat apps/web/res/themes/dark/css/dark.pcss) \
     <(cat apps/web/res/themes/la-bulle-dark/css/la-bulle-dark.pcss)
```

L'écart attendu se limite aux imports La Bulle. Toute autre divergence est à examiner.

### Des surcharges deviennent silencieusement inopérantes (v1.12.26)

`.mx_LeftPanel_newRoomList` et `.mx_SpacePanel.newUi` ont disparu : l'amont avait déplacé son fond
blanc sur `.mx_SpacePanel` lui-même et retiré le `!important` du conteneur de liste. Nos règles
compilaient toujours, sans plus rien peindre.

**Réflexe** : lancer `scripts/audit-selecteurs-theme.py` après le rebase, systématiquement. Quand
une classe est orpheline, chercher où la règle native a migré :

```bash
git show <TAG_CIBLE>:apps/web/res/css/structures/_SpacePanel.pcss | grep -n background
```

Vérifier aussi si le `!important` d'origine subsiste : notre surcharge n'en a besoin que si l'amont
en pose un.

### Le mode sombre ne charge pas les fichiers du mode clair

`la-bulle-dark.pcss` repart du dark d'Element et n'importe ni `_la-bulle-vars.pcss` ni
`_la-bulle-overrides.pcss`. Une règle préfixée `.cpd-theme-dark` placée dans le fichier clair est
du **code mort**. C'est ce piège qui a laissé passer deux défauts de contraste en recette.

**Réflexe** : toute règle destinée au sombre vit dans `la-bulle-dark/`. Recetter les deux thèmes.

### Les attributs stables plutôt que les classes hachées

Les composants de `packages/shared-components` utilisent des CSS modules aux classes hachées, qui
changent à chaque build. Nos surcharges s'accrochent donc à des attributs stables
(`data-testid="room-name"`, `[data-layout="bubble"][data-self="true"]`, `[data-color]`). Ces
attributs sont un contrat implicite avec l'amont : les revérifier fait partie des marqueurs ⚠️ de
`docs/kosmos-customizations.md`.

Quand plusieurs textes d'une même zone sont concernés, repointer une variable CSS sur un scope
englobant plutôt que surcharger `color` élément par élément : cela évite les courses à la
spécificité contre des classes hachées.

## Le rebase

### `git add -A` embarque les fichiers non suivis

Pendant un rebase, `git add -A` indexe aussi les répertoires non suivis présents dans l'arbre
(artefacts de diagnostic, `dist/`…), qui se retrouvent dans un commit rejoué et donc dans
l'historique de la branche. Les en purger ensuite demande une réécriture d'historique.

**Réflexe** : indexer explicitement les fichiers résolus. Vérifier `git status` avant de commencer
et commiter ou ignorer ce qui traîne.

### Les branches de lot portent des doublons antérieurs

Les branches `kosmos/SCAT-*` non fusionnées ont souvent été rebasées entre-temps et embarquent une
copie ré-hashée d'un travail déjà intégré à la release — parfois dans un état **plus ancien**
(par exemple le thème avant son renommage). `git cherry` ne les détecte pas comme doublons,
puisque les patchs diffèrent.

**Réflexe** : `scripts/commits-de-branche.sh` avant toute intégration. Si la branche est en retard,
cherry-pick ciblé des seuls commits fonctionnels.

## Les tests

### L'amont co-localise et migre vers Vitest

Des fichiers de `apps/web/test/` disparaissent au profit de `apps/web/src/Foo.test.ts`. Le conflit
apparaît en « supprimé chez eux / modifié chez nous » : entériner la suppression et **porter** nos
assertions vers le nouveau fichier, en idiome Vitest.

### Un test amont peut contredire une customisation

Exemple : un test vérifiant l'apparition du bouclier E2E dans le composer, alors que nous retirons
toute mention du chiffrement. Ce n'est pas une régression, c'est un test à aligner — comme l'ont
été les autres avant lui. Le commenter en citant le ticket de la customisation, pour que le
prochain lecteur ne le « répare » pas.

### Les espions qui fuient entre tests

En portant un test vers Vitest, ne pas oublier le `afterEach` de restauration
(`vi.restoreAllMocks()`) : un espion laissé en place fait échouer un test _suivant_, ce qui égare
le diagnostic.

### Distinguer un échec amont d'une régression

`scripts/worktree-controle.sh` tranche en quelques minutes. Sans lui, on corrige des tests qui
dépendent du fuseau horaire de la machine.

## Le code

### Les nettoyages en cascade

Retirer nos suppressions rend des imports et composants orphelins : `tsc` les signale, il faut les
nettoyer. Mais le nettoyage se propage parfois à du code amont (supprimer une prop force à
supprimer un hook exporté, qui force à supprimer ses aides…). **S'arrêter à la frontière du code
amont** : l'écart avec l'upstream coûte plus cher au prochain rebase que quelques éléments morts.
Documenter le choix.

### Les contournements deviennent obsolètes

Les overrides pnpm et autres contournements ajoutés pour une version donnée survivent par inertie.
Les revalider à chaque montée : retirer, rebuilder sans cache, constater. Un fichier de config
identique à l'amont, c'est un conflit de moins la prochaine fois.

### Les renommages d'API amont

`getOidcClientMetadata` → `getOAuthClientMetadata`, camelCase → snake_case, `SdkContextClass` →
`SDKContextClass`, `RecentAlgorithm` → `compareRoomsByRecency`… Quand un fichier lourdement
customisé a été refondu en amont, il est parfois plus sûr de repartir de **notre** version du
fichier et d'y réappliquer les renommages amont, plutôt que de résoudre une dizaine de conflits.
Vérifier ensuite qu'aucun symbole obsolète ne subsiste.
