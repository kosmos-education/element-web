---
name: element-upgrade
description: Monter le fork Element-Kosmos sur une nouvelle version upstream d'element-web, en rebasant la branche de livraison sur le tag amont et en réappliquant toutes les customisations de docs/kosmos-customizations.md. À utiliser dès que la demande touche à une montée de version d'Element (« passer en 1.12.x », « rebaser sur l'upstream », « nouvelle release Kosmos », « créer la branche kosmos/release/… »), à la réapplication ou au report des surcharges Kosmos sur une base amont plus récente, ou à la vérification qu'une customisation du thème La Bulle est toujours active après un changement de version — même si l'utilisateur ne nomme ni « rebase » ni « customisation ».
---

# Montée de version Element-Kosmos

Element-Kosmos est un **fork** d'`element-web` (`kosmos-education/element-web`). Sa branche de
livraison est toujours **exactement un tag upstream + une série de commits Kosmos linéaires** —
jamais un merge de l'amont. Une montée de version consiste donc à rejouer ces commits sur le
nouveau tag, puis à réparer ce que l'amont a déplacé sous nos pieds.

Le référentiel des customisations est `docs/kosmos-customizations.md`. Il est à la fois la
spécification de ce qu'il faut préserver et la liste des points de contrôle à revérifier
(marqueurs « ⚠️ Au prochain rebase upstream »). **Le tenir à jour fait partie du travail** :
c'est lui qui rendra la montée suivante possible.

## Le risque principal : les régressions silencieuses

Un rebase signale les conflits de contenu, mais reste muet sur trois familles de casse qui
constituent l'essentiel du travail réel :

1. **Les sélecteurs CSS devenus morts.** Le thème La Bulle surcharge des classes de l'app
   (`.mx_SpacePanel`, `.mx_RoomListPanel`…). Si l'amont en renomme une, la règle continue de
   compiler et devient simplement sans effet. Aucun test, aucun conflit ne le dira.
2. **Les tests déplacés ou supprimés en amont.** Nos alignements de tests disparaissent avec le
   fichier qui les portait ; la customisation reste, sa couverture non.
3. **Les API renommées.** Un fichier que nous surchargeons peut être refondu : l'automerge passe,
   mais notre patch ne s'applique plus au bon endroit.

La méthode ci-dessous existe pour attraper ces trois familles. Ne pas se contenter d'un rebase vert.

## Déroulé

Suivre l'ordre : chaque étape suppose la précédente. Tenir une todo list, la montée s'étale sur
plusieurs heures et les points de contrôle sont nombreux.

### 1. Cadrer l'écart

```bash
git fetch upstream --tags
git rev-list --count <TAG_ACTUEL>..<TAG_CIBLE>       # nombre de commits amont
git diff --shortstat <TAG_ACTUEL>..<TAG_CIBLE>       # ampleur
```

Lire les notes de release de **chaque** version intermédiaire (API GitHub :
`https://api.github.com/repos/element-hq/element-web/releases/tags/<TAG>`), en cherchant les
chantiers qui touchent nos zones : liste de salons, menu utilisateur, composer, thèmes, Spotlight,
build. Ce sont eux qui prédisent les conflits.

Puis détecter d'emblée ce qui a disparu en amont :

```bash
scripts/fichiers-disparus.sh <TAG_ACTUEL> <TAG_CIBLE> <BRANCHE_RELEASE_ACTUELLE>
```

Le résultat oriente tout le reste : un fichier de test supprimé signifie que l'alignement qu'il
portait est à re-héberger, pas à récupérer.

Enfin, sécuriser ce qui n'est pas versionné : `git status` peut révéler des documents utiles hors
suivi qui seraient perdus au changement de branche. Les commiter avant de continuer.

### 2. Créer le ticket Jira

Projet **SCAT** (« Skolengo - La Bulle »), type **Task**, composant **Surcharge technique Element**,
priorité `Minor`, pas de `fixVersions` (le projet n'en définit aucune). Résumé en français sur le
modèle des précédents : `Montée de version de Element en version X.Y.Z`. Lier en `Cloners` vers la
montée précédente. La clé obtenue préfixe les commits d'adaptation.

Détail des conventions et modèle de description : `references/jira.md`.

### 3. Rebaser

```bash
git checkout -b kosmos/release/<TAG_CIBLE> <BRANCHE_RELEASE_ACTUELLE>
git rebase --onto <TAG_CIBLE> <TAG_ACTUEL>
```

Le nom de branche n'est pas cosmétique : `scripts/docker-package.sh` en dérive la version du build
(`kosmos/release/v1.12.26` → `1.12.26-kosmos`). Respecter la forme `kosmos/release/vX.Y.Z`.

Politique de résolution :

- **Snapshots Jest, baselines visuelles `__vis__/**/*.png`, `pnpm-lock.yaml`** → prendre la version
  amont sans réfléchir, régénérer en fin de parcours. Les fusionner à la main est du temps perdu et
  produit des artefacts faux.
- **Fichiers supprimés en amont** (`DU`/`UD`) → entériner la suppression, sauf si le fichier a été
  déplacé : dans ce cas, porter le patch à son nouvel emplacement.
- **Conflits de contenu** → garder la structure amont et n'y réinjecter que l'intention Kosmos.
  C'est presque toujours la bonne réduction : l'amont a refondu, nous surchargeons.

`scripts/auto-rebase.sh` déroule le rebase en résolvant seul la première catégorie et s'arrête dès
qu'une décision est nécessaire, en listant les fichiers concernés. Le relancer après chaque
résolution manuelle.

Attention aux gros commits historiques qui mélangent plusieurs customisations (le « lot 1 » de
SCAT-14 touche ~28 fichiers) : les résoudre customisation par customisation en s'appuyant sur
`docs/kosmos-customizations.md`, pas globalement.

Ne pas utiliser `git add -A` pendant un rebase : il embarque les fichiers non suivis présents dans
l'arbre. Indexer explicitement les fichiers résolus.

### 4. Intégrer les branches de lot en cours

Des branches `kosmos/SCAT-<n>-<slug>` non fusionnées peuvent contenir des customisations à
embarquer. **Ne pas les rebaser en entier sans vérifier.** Elles portent souvent une copie
ré-hashée et _antérieure_ de travaux déjà présents dans la release : les rejouer régresserait la
branche.

```bash
scripts/commits-de-branche.sh <BRANCHE_RELEASE_ACTUELLE> <BRANCHE_LOT>   # commits absents de la release
git diff --stat <BRANCHE_RELEASE_ACTUELLE> <BRANCHE_LOT>                 # la branche est-elle en retard ?
```

Si le `diff --stat` montre des **suppressions** de fichiers que la release possède, la branche est
en retard : ne reprendre que ses commits fonctionnels propres, par cherry-pick ciblé sur la
nouvelle branche release. Sinon un rebase complet convient.

Laisser les branches d'origine intactes : elles restent une trace, et le cherry-pick n'a pas besoin
de les déplacer.

### 5. Adapter

Boucler sur `pnpm --dir apps/web exec tsc --noEmit` jusqu'à extinction des erreurs. Les résidus
typiques sont des imports et composants devenus orphelins parce que nos suppressions ont retiré
leur dernier appelant. Les nettoyer — mais **s'arrêter dès que le nettoyage se propage à du code
amont** : creuser l'écart avec l'upstream coûte plus cher au prochain rebase que quelques props
mortes. Documenter le choix plutôt que de forcer.

Puis, le contrôle qui rattrape les régressions silencieuses :

```bash
scripts/audit-selecteurs-theme.py
```

Il extrait les ancrages des fichiers de surcharge du thème — classes `mx_`, qualificatifs de
sélecteurs composés (`.mx_SpacePanel.newUi`, le cas le plus sournois puisque la moitié `mx_`
survit et masque la disparition de l'autre) et attributs `data-*` — puis vérifie que chacun
existe encore dans le code. Tout ancrage orphelin est une règle devenue inopérante : retrouver
son remplaçant amont avec `git show <TAG_CIBLE>:<fichier>` sur le PCSS d'origine, qui montre où
la règle native a migré.

Il distingue aussi les ancrages posés par la bibliothèque Compound et non par notre code
(`[data-color]`) : ceux-là sont un contrat avec la dépendance, à revérifier quand elle change
de version.

Reprendre ensuite **un par un** les marqueurs « ⚠️ Au prochain rebase upstream » de
`docs/kosmos-customizations.md`. Ils couvrent les attributs stables (`data-testid`), les
contrats de rendu et les valeurs CSS dont dépendent nos calages.

Regrouper le tout dans un commit `SCAT-<n> Adaptation post-rebase <TAG_ACTUEL> → <TAG_CIBLE>`.

### 6. Vérifier

Le dépôt a **trois** suites de tests distinctes ; `pnpm test:unit` n'en lance qu'une. Commandes
exactes, pièges et seuils : `references/verification.md`.

Point de méthode essentiel : certains échecs **préexistent en amont** (dépendances au fuseau
horaire, à la locale, erreurs de typage dans `matrix-js-sdk`). Ne jamais les attribuer au fork sans
preuve, ni les « corriger ». Le contrôle décisif est un worktree sur le tag vierge :

```bash
scripts/worktree-controle.sh <TAG_CIBLE> <COMMANDE_DE_TEST>
```

Si l'échec s'y reproduit à l'identique, il est amont — le dire explicitement dans le commit et le
ticket. Sinon, il vient de nous et doit être traité.

Terminer par le build de packaging réel, cache nx désactivé (c'est la seule voie de déploiement) :

```bash
NX_SKIP_NX_CACHE=true pnpm -r --filter "./packages/**" build
NX_SKIP_NX_CACHE=true pnpm --dir apps/web build
```

### 7. Documenter

Sans cette étape, la montée suivante repart de zéro.

- **`docs/kosmos-customizations.md`** : réancrer les sélecteurs qui ont bougé, corriger ce que la
  montée a démenti, et **consigner toute customisation rencontrée dans le code mais absente du
  document**. Une customisation non documentée est une customisation qui sera perdue.
- **`DIFF-FONCTIONNEL-<TAG_ACTUEL>-<TAG_CIBLE>.md`** : synthèse des release notes annotée des
  impacts Kosmos, sur le modèle du fichier de la montée précédente qu'elle remplace.
- **Commentaire de bilan sur le ticket** : méthode, pièges traités, état de vérification, reste à
  faire (recette visuelle, push, adaptation du `config.json` de déploiement).

Rendre compte fidèlement : dire quels tests échouent encore et pourquoi, ce qui n'a pas été fait et
ce qui reste à recetter. Une montée de version annoncée « verte » à tort coûte cher en recette.

## Ne pas faire à la place de l'utilisateur

Pousser la branche, taguer la livraison et lancer la CI sont des actions sortantes : les proposer,
pas les exécuter sans demande explicite. De même, la recette visuelle du thème (clair **et**
sombre — le sombre ne charge pas les fichiers du clair) revient à l'humain.

## Références

- `references/verification.md` — les trois suites de tests, les cibles de lint, le build, les
  échecs amont connus
- `references/pieges.md` — pièges rencontrés lors des montées précédentes et leur résolution
- `references/jira.md` — conventions du projet SCAT et modèle de ticket
