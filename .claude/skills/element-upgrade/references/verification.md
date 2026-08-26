# Vérification d'une montée de version

## Les trois suites de tests

Le dépôt en a **trois**, portées par des runners différents. `pnpm test:unit` à la racine n'en
lance qu'une : croire qu'elle couvre tout est l'erreur classique.

| Suite               | Commande                                          | Runner                             | Couvre                                                    |
| ------------------- | ------------------------------------------------- | ---------------------------------- | --------------------------------------------------------- |
| Racine              | `pnpm test:unit`                                  | Vitest (node)                      | `apps/web/src/**/*.test.ts` co-localisés, utilitaires     |
| Composants partagés | `pnpm --dir packages/shared-components test:unit` | Vitest **navigateur** (Playwright) | `packages/shared-components/src/**` + baselines visuelles |
| Applicative         | `cd apps/web && pnpm exec jest`                   | Jest (jsdom)                       | `apps/web/test/**`                                        |

L'amont migre progressivement de Jest vers Vitest en co-localisant les tests à côté des sources
(`src/Foo.ts` → `src/Foo.test.ts`). À chaque montée, une partie de `apps/web/test/` disparaît donc
au profit de `apps/web/src/`. Nos alignements de tests sont à re-héberger, et à réexprimer en
idiome Vitest (`vi.` au lieu de `jest.`, `vi.mocked` au lieu de `mocked`).

La suite navigateur exige un binaire Playwright ; s'il manque :

```bash
pnpm exec playwright install chromium-headless-shell
```

## Régénérer les artefacts mis de côté pendant le rebase

```bash
cd apps/web && pnpm exec jest -u                              # snapshots jest
pnpm --dir packages/shared-components exec vitest run -u      # snapshots + baselines visuelles
pnpm install --no-frozen-lockfile                             # lockfile
```

Ne régénérer qu'après avoir stabilisé le code : un snapshot régénéré trop tôt fige un état faux et
masque la régression qu'il aurait dû révéler.

## Types

```bash
pnpm --dir apps/web exec tsc --noEmit
```

Filtrer le bruit de `node_modules/matrix-js-sdk` : le SDK est typé depuis ses sources et remonte
des erreurs qui appartiennent à l'amont. Vérifier avant de conclure (voir `worktree-controle.sh`).

## Lint

Les noms de cibles changent d'une version à l'autre — vérifier `package.json` plutôt que de se fier
à la mémoire. En v1.12.26 :

```bash
pnpm lint:fmt          # oxfmt --check   (ex-lint:prettier)
pnpm lint:fmt:fix      # correction automatique
pnpm lint:js           # oxlint
pnpm -r lint:style     # stylelint, sur res/css/** uniquement — PAS res/themes/**
```

Le formateur refuse les commentaires `//` dans les fichiers `.pcss` : utiliser `/* */`.

`pnpm -r lint:style` ne couvre pas `res/themes/`, donc pas le thème La Bulle : une erreur de
syntaxe y passera le lint et cassera le build webpack. C'est le build qui fait foi.

## Build

Reproduire la séquence de `scripts/docker-package.sh`, seule voie de déploiement Kosmos. Le cache
nx doit être désactivé, sinon les packages partagés ne sont pas réellement reconstruits et un
`dist/` périmé masque le problème :

```bash
NX_SKIP_NX_CACHE=true pnpm -r --filter "./packages/**" build
NX_SKIP_NX_CACHE=true pnpm --dir apps/web build
```

Vérifier ensuite que les artefacts Kosmos sont bien émis :

```bash
ls apps/web/webapp/bundles/*/theme-la-bulle-*.css   # feuilles du thème
ls apps/web/webapp/modules/                          # modules Kosmos
ls apps/web/webapp/kosmos-icons/                     # favicon
```

Comparer la taille des feuilles La Bulle à celle des thèmes amont **du même build** : un écart de
quelques kilo-octets (nos surcharges) est normal, un rapport de 1 à 5 signale un build de dev
comparé à un build de prod, pas une perte de CSS.

Contrôler enfin que la version dérive bien du nom de branche (`kosmos/release/vX.Y.Z` →
`X.Y.Z-kosmos`) : c'est `scripts/docker-package.sh` qui l'extrait par expression régulière.

## Échecs amont connus

Ces échecs ne viennent pas du fork et se reproduisent sur le tag vierge. Les confirmer avec
`worktree-controle.sh` à chaque montée plutôt que de les tenir pour acquis — l'amont finit par
les corriger.

- `src/DateUtils.test.ts`, `src/viewmodels/room/timeline/DateSeparatorViewModel.test.ts`,
  `src/utils/createMatrixClient.test.ts` — dépendants du fuseau horaire et de la locale de la
  machine.
- `node_modules/matrix-js-sdk/src/rendezvous/MSC4108SignInWithQR.ts` — 3 erreurs de typage.

## Recette visuelle

Elle revient à l'humain, mais le skill doit la préparer en listant ce qui est à contrôler. Lancer
l'app avec `./scripts/dev-element.sh`, puis vérifier en thème La Bulle **clair et sombre** — le
sombre ne charge pas les fichiers du clair, une règle correcte en clair peut être absente en
sombre :

1. thème La Bulle par défaut, sélecteur d'apparence limité aux deux thèmes, pas de bouton
   « Contraste élevé » ;
2. fonds périvenche des panneaux latéraux, avatars de salons carrés arrondis, initiales blanches ;
3. contrastes des pastilles de filtre et de non-lus ;
4. bulle « moi » et son texte secondaire (heure, « (modifié) ») lisibles ;
5. absence des boutons de création d'espace, de salon et de chat 1-1, du bouton Compose et du
   filtre « Personnes » ;
6. Spotlight sans recherche de personnes, bouton « Se déconnecter » présent, entrée FAQ dans le
   Space Panel, favicon Kosmos, aucune mention de chiffrement ;
7. customisations du lot en cours, le cas échéant.
