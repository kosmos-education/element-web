# Kosmos customizations

## Context

This version of element is aimed to run with the "Skolengo EN" Education Management System.
It is meant to be used only by some specific populations within schools : teachers, administration and schooling personnel.
The features accessible in the affixed matrix server are limited by choice, so these customizations are made to adjust the front-end to these impossibilities.

## Features

### Removing access to space creation

Users won't be allowed to create Spaces so we took off the buttons to do so.

### Removing access to creation of 1-1 chats

Our users have pre-created rooms to chat in, we don't allow the creation of 1-1 chats.

**v1.12.21+ note:** the compose button (new chat / new room / new video room) moved to
`packages/shared-components/src/room-list/RoomListHeaderView/RoomListHeaderView.tsx` —
the `displayComposeMenu` / `useComposeIcon` block was removed entirely from that file.

### Removing visible access to room creation

As for 1-1 chats, room creation is highly restricted so we took off the most obvious buttons to reduce frustration.

**v1.12.21+ note:** the creation buttons in the empty room list state moved to
`packages/shared-components/src/room-list/RoomListView/RoomListEmptyStateView.tsx` —
the `description` prop and the `<Button>` children were removed from the default (no active filter) branch.
The "people" filter chip is hidden via `apps/web/src/viewmodels/room-list/RoomListViewModel.ts`
(filtered from `filterIds` alongside favourite/low-priority).

### Removing people search from the Spotlight

The unified search (Spotlight) used to let users search for people in the user directory and start
DMs with them. The original `SCAT-14` customization only disabled the click (`disabled` attribute on
people results) and removed the "start group chat" section, but the "People" entry, the directory
search and the people results were still present.

People search is now fully removed in
`apps/web/src/components/views/dialogs/spotlight/SpotlightDialog.tsx`:

- the "People" entry (`mx_SpotlightDialog_button_startChat`) is no longer rendered in the
  "other searches" list — there is no UI path left to activate the `Filter.People` filter;
- an initial `Filter.People` (`initialFilter` prop) is coerced to `null` so no programmatic open can
  re-enable it (no caller currently uses it, this is a safety net);
- the user directory / profile lookups (`useUserDirectory` / `useProfileInfo`, fed by
  `searchPeople` / `searchProfileInfo`) are disabled — their `useDebouncedCallback` is passed `false`;
- the `peopleSection` (existing DMs) and `suggestionsSection` (directory matches) are no longer
  rendered.

The unit tests in `apps/web/test/unit-tests/components/views/dialogs/SpotlightDialog-test.tsx` were
updated accordingly (people-search expectations replaced by assertions that no person is searched,
listed or DM-ed).

### Removing visible mentions of encryption

We designed the solution in order to avoid needing to encrypt the server, so to avoid confusion and concern
among our users, we chose to take off the mentions on unencrypted messages and rooms.

### Removing Polls and Extensions entries

Both are not configured in the server but the buttons were still there doing nothing.

### Removing infinite loader on verification pill

The server doesn't allow this call so the loader was infinite in the right panel.

### Adding an entry directing to the FAQ

In the Space Panel, we added a button directing to the FAQ set in the help_url configuration parameter.

### Branding the favicon

Changing the favicon logos to ours.

### Adding a specific error message when uploading files

When a users tries to upload a file exceeding their quota (size per week for example), the error messages now mentions it.

### Restoring the "Sign out" button in the user menu

Upstream removed the "Sign out" entry from the user menu in v1.12.19 (PR
[element-hq/element-web#32812](https://github.com/element-hq/element-web/pull/32812), commit
`d4f419d1b5`, "Refactor and redesign user menu"). The menu moved to a shared-component + ViewModel
architecture and logout was relocated to the settings (`UserProfileSettings.tsx`). Losing the
one-click sign out from the menu is not acceptable for us (`SCAT-36`), so the entry is restored.

The `signOut` action is re-added across the two layers:

- `packages/shared-components/src/menus/UserMenu/UserMenu.tsx`: `signOut` added to the snapshot
  `actions` type and to the `UserMenuViewActions` interface; a critical (red) `MenuItem`
  (`SignOutIcon`, `kind="critical"`) is rendered below a `Separator` at the bottom of the actions
  section, gated on `actions.signOut`;
- `packages/shared-components/src/i18n/strings/{en_EN,fr}.json`: new key `user_menu|sign_out`
  ("Sign out" / "Se déconnecter"). Note the pre-existing `action|sign_out` key was repurposed
  upstream to "Remove this device" and must **not** be reused for logout;
- `apps/web/src/viewmodels/menus/UserMenuViewModel.ts`: `signOut: isAuthenticated` in the snapshot
  and a `signOut()` method that opens a simple `QuestionDialog` confirmation
  (`user_menu|sign_out` / `user_menu|sign_out_confirm`, `danger: true`) and, on confirmation,
  dispatches `{ action: "logout" }`. We deliberately do **not** use the upstream `LogoutDialog`
  (`shouldShowLogoutDialog`): our deployment has no E2EE, so its wording about recovery keys and
  "removing this device" is confusing and irrelevant.
- `apps/web/src/i18n/strings/{en_EN,fr}.json`: `user_menu|sign_out` and `user_menu|sign_out_confirm`
  keys for the confirmation dialog (separate i18n store from the shared component).

Stories (`UserMenu.stories.tsx`) and unit tests (`UserMenu.test.tsx` snapshots,
`apps/web/test/viewmodels/menus/UserMenuViewModel-test.ts`) were updated accordingly. Guests do not
see the entry (`signOut` is gated on authentication).

### Build pipeline : rebuild des packages partagés

Les packages sous `packages/**` (`shared-components`, `module-api`) sont consommés par
webpack lors du build de `apps/web` **via leur artefact buildé** (`dist/`), pas directement
via leurs sources. La raison : le champ `exports` de leur `package.json` pointe vers
`./dist/...`, et le target nx `apps/web build` (`apps/web/project.json`) n'a **pas** de
`dependsOn: ["^build"]` — contrairement aux targets `test:unit` ou `lint:types`. Webpack
embarque donc le `dist/` existant dans le contexte, tel quel, sans jamais rebuilder les
packages.

Conséquence : toute customisation faite dans `packages/shared-components/src/` (suppression
du bouton Compose, des boutons de création, du filtre People…) **n'a aucun effet** sur
l'app déployée tant que le package n'est pas rebuildé. Ne pas se fier au `dist/` local,
qui peut dater d'un état antérieur aux modifications.

**Correctif Kosmos** — `scripts/docker-package.sh` rebuilde systématiquement **tous** les
packages partagés avant `apps/web` :

```bash
NX_SKIP_NX_CACHE=true pnpm -r --filter "./packages/**" build
VERSION=$DIST_VERSION pnpm --dir apps/web build
```

`NX_SKIP_NX_CACHE=true` force un build frais à chaque CI (aucun `dist/` servi depuis le
cache nx). Ce script est la **seule voie de build pour les déploiements Kosmos** (image
Docker → Nexus pour l'intégration k8s, `.tgz` pour la prod VM).

⚠️ **Au prochain rebase upstream** : vérifier que `apps/web/project.json` n'a toujours
pas acquis de `dependsOn: ["^build"]` sur son target `build`. Si c'est le cas, la ligne
`NX_SKIP_NX_CACHE=true pnpm -r --filter "./packages/**" build` dans `docker-package.sh`
reste inoffensive (double build) mais peut être retirée.

### Neutral placeholder text in the message composer

Since upstream v1.12.21, the default composer placeholder keys (`composer|placeholder`, `composer|placeholder_reply`, `composer|placeholder_thread`) now explicitly mention "unencrypted" in their text (e.g. "Send an unencrypted message…"). To stay consistent with our goal of hiding encryption mentions, `MessageComposer.tsx` now always uses the `_encrypted` variants of those keys (`composer|placeholder_encrypted`, etc.), which carry neutral wording regardless of the room's actual encryption status. The corresponding `fr.json` overrides and the Jest unit tests (`MessageComposer-test.tsx`, `test-utils/composer.ts`) were updated accordingly.

### Thème natif Skolengo (IndigoEMS)

Deux thèmes PCSS natifs ont été créés pour habiller Element aux couleurs de la marque Skolengo,
sur la base de la palette **IndigoEMS** (confirmée par échantillonnage des maquettes de l'UI) :

| Identifiant | Sélecteur affiché | Feuille CSS émise |
|---|---|---|
| `skolengo-light` | Skolengo | `theme-skolengo-light.css` |
| `skolengo-dark` | Skolengo Sombre | `theme-skolengo-dark.css` |

**Structure des fichiers :**

```
apps/web/res/themes/
├── skolengo-light/css/
│   ├── skolengo-light.pcss      # entrypoint (fork de light.pcss)
│   ├── _skolengo-vars.pcss      # overrides de variables PostCSS legacy ($)
│   ├── _skolengo-tokens.pcss   # échelle indigo clair + tokens --cpd-color-*
│   └── _skolengo-overrides.pcss # surcharges sélecteurs app (fonds panneaux, partagé clair+sombre)
└── skolengo-dark/css/
    ├── skolengo-dark.pcss       # entrypoint (fork de dark.pcss)
    └── _skolengo-tokens.pcss   # échelle indigo inversée (mode sombre)
```

**Palette IndigoEMS — valeurs clés :**

- Accent vif (boutons, pastilles) : `#5851fb` (indigo-900 en mode clair)
- Surfaces périvenche (room list, space panel, panneau droit) : `#edf1ff`/`#f6f8ff` (indigo-300/200)
- Bulle de message propre : `#dde5ff` (indigo-400)
- Texte d'accent (liens, texte action) : `#4135ce` (indigo-1100)
- Barre de titre / fond d'accent foncé : `#170c5c` (indigo-1400)

**Points d'enregistrement (à vérifier à chaque rebase upstream) :**

1. `apps/web/webpack.config.ts` — `cssThemes` : entrées `theme-skolengo-light` et `theme-skolengo-dark`.
2. `apps/web/src/theme.ts` — `DEFAULT_THEME = "skolengo-light"` ; `BUILTIN_THEMES` liste uniquement
   les deux thèmes Skolengo (masque light/dark/high-contrast du sélecteur).
3. `apps/web/src/settings/Settings.tsx` — `theme.default = "skolengo-light"`.
4. `apps/web/src/settings/watchers/ThemeWatcher.ts` — `themeBasedOnSystem()` route vers
   `skolengo-dark`/`skolengo-light` au lieu de `dark`/`light` ; `isUserOnDarkTheme()` inclut
   `skolengo-dark`.
5. `config.json` — `default_theme: "skolengo-light"` (le bloc `custom_themes` a été supprimé).

**Comportement :**

- `setTheme` dans `theme.ts` détecte `"light"` dans le nom du thème (`skolengo-light.includes("light")`)
  et assigne la classe `cpd-theme-light` (Compound tokens mode clair). Même logique pour `skolengo-dark`
  → `cpd-theme-dark`.
- Le suivi du thème système OS bascule automatiquement entre `skolengo-light` et `skolengo-dark`.
- Réglages → Apparence ne propose que les deux thèmes Skolengo.

**Typographie — Open Sans :**

Le thème Skolengo utilise **Open Sans** à la place d'Inter (police par défaut d'Element) :

- `apps/web/src/theme.ts` : imports `@fontsource/open-sans/{400,500,600,700}.css` (remplacent les
  imports Inter — `@fontsource/inter` reste en dépendance car encore utilisé par `mobile_guide` et
  Storybook `shared-components`).
- `_skolengo-tokens.pcss` (clair + sombre) : `--cpd-font-family-sans: "Open Sans", …` dans la
  couche `compound-tokens` → s'applique à tous les composants Compound-web.
- `_skolengo-vars.pcss` : `$font-family: "Open Sans", …` pour les composants legacy (PostCSS).
- `apps/web/res/css/views/rooms/wysiwyg_composer/components/_FormattingButtons.pcss:64` :
  référence désormais `var(--cpd-font-family-sans)` au lieu de `Inter` codé en dur.

⚠️ **Au prochain rebase upstream** : vérifier que `_FormattingButtons.pcss` n'a pas réintroduit
`font-family: Inter` ; vérifier que `theme.ts` n'a pas réimporté `@fontsource/inter` dans le
contexte de l'app principale.

**Fonds périvenche des panneaux latéraux :**

Depuis la v1.12.21, la nouvelle UI (`feature_new_room_list`) code en dur
`--cpd-color-bg-canvas-default` (blanc) sur les conteneurs latéraux via les sélecteurs
`.mx_LeftPanel_newRoomList`, `.mx_SpacePanel.newUi`, `.mx_RoomListPanel`, `.mx_RightPanel`.
Les variables legacy `$roomlist-bg-color` / `$spacePanel-bg-color` de `_skolengo-vars.pcss`
ne pilotent plus que l'ancienne UI (jamais rendue) et n'ont **aucun effet**.

La correction est dans `_skolengo-overrides.pcss` (importé depuis les deux entrypoints après
`_components.pcss`) : on applique directement `background-color: var(--cpd-color-indigo-300)`
sur ces sélecteurs. On ne redéfinit PAS le token global pour préserver la timeline blanche,
la barre de recherche distincte et les en-têtes de section sticky.

⚠️ **Au prochain rebase upstream** : vérifier que les sélecteurs `.mx_LeftPanel_newRoomList` /
`.mx_SpacePanel.newUi` / `.mx_RoomListPanel` / `.mx_RightPanel` n'ont pas été renommés en amont,
et que `.mx_LeftPanel_newRoomList` porte toujours un `!important` sur son `background-color`
(`apps/web/res/css/structures/_LeftPanel.pcss`).

**Avatars — forme et couleurs :**

Les avatars de **salons** (liste + en-tête) sont rendus en **carré arrondi** (border-radius 25 %).
Les avatars d'auteurs dans les messages de la timeline restent **ronds**.
La surcharge est dans `_skolengo-overrides.pcss` via `--cpd-avatar-radius: 25% !important` sur
les sélecteurs `.mx_RoomListItemView .mx_BaseAvatar`, `.mx_RoomHeader > *:first-child.mx_BaseAvatar`
(avatar enfant direct — cas fréquent sans présence) et `.mx_RoomHeader > *:first-child .mx_BaseAvatar`
(avatar dans le wrapper `WithPresenceIndicator` — DM avec présence activée).

Point technique en-tête : `WithPresenceIndicator` renvoie un **Fragment** (aucun nœud DOM) quand
il n'y a pas de présence → l'avatar devient l'**enfant direct** de `.mx_RoomHeader`, pas un
descendant ; d'où la nécessité des deux variantes du sélecteur.

Les fonds d'avatars (`--cpd-color-bg-decorative-1..6`) utilisent les couleurs **saturées EMS-900**
(identiques aux `text-decorative`), avec des **initiales blanches** (`--cpd-avatar-color: #fff !important`
dans `_skolengo-overrides.pcss`). Les `--cpd-color-text-decorative-*` sont conservés inchangés
car ils servent à colorer les **noms d'auteurs** dans la timeline (ils ne passent pas par
`--cpd-avatar-color`).

L'avatar de l'**utilisateur courant** (haut du space panel, `UserMenu`) est rendu par Compound
`<Avatar>` directement — sans classe `.mx_BaseAvatar`. On le cible via `.mx_UserMenu [data-color]`
(attribut stable, survit au hash CSS module). Sans effet sur une photo uploadée.

⚠️ **Au prochain rebase upstream** : vérifier que `.mx_RoomListItemView` n'a pas été renommé,
que `RoomAvatar` passe toujours `type="round"` pour les salons non-space, et que
`WithPresenceIndicator` renvoie toujours un Fragment quand `presence` est null/undefined.

**Noms de salons et titre d'en-tête :**

- Les noms des salons dans la liste sont **plus foncés et légèrement plus gras** (`text-primary` +
  `font-weight-medium`) via `.mx_RoomListItemView [data-testid="room-name"]` dans `_skolengo-overrides.pcss`.
  `data-testid="room-name"` est le seul sélecteur stable sur cet élément (la classe CSS module est hashée).
- Le **titre du salon dans l'en-tête** (`.mx_RoomHeader_heading`) est rendu en `font-weight-bold`.

⚠️ **Au prochain rebase upstream** : vérifier que `RoomListItemContent.tsx` porte toujours
`data-testid="room-name"` sur le div du nom du salon.

**Espaces (space panel) — liseré et alignement :**

Le `selectionWrapper` en mode narrow (barre repliée) reçoit `padding:1px; border:3px solid transparent`
dans `_skolengo-overrides.pcss`. Cela reproduit l'équilibre 4px constant (inactif : 1px pad + 3px bord
transparent = 4px ; actif : la règle native `.mx_SpaceButton_active.mx_SpaceButton_narrow` (0,4,0) pose
`border:3px solid $primary-content` + `padding:1px` = 4px) sans `!important`, de sorte que l'icône ne
« danse » pas lors d'un switch d'espace.

⚠️ **Au prochain rebase upstream** : vérifier que la règle native active `_SpacePanel.pcss:145-148`
conserve `padding: var(--activeBorder-transparent-gap)` (= 1px) + `border: 3px solid`. Si la valeur
change, l'équilibre est à recalibrer.

**Filtres de la liste et pastilles de non-lus :**

- Pastilles de filtre **désélectionnées** (Non-lus, Salons, Favoris, Mentions) : fond indigo-300 +
  liseré **indigo-800** via `[data-testid="primary-filters"] [role="option"]:not([aria-selected="true"])`.
  La bordure indigo-800 passe 3:1 contre le panneau indigo-300 dans les deux modes (crit. 3.3 RGAA AA) :
  clair `#747aff` vs `#edf1ff` = 3,12:1 ; sombre `#98a6ff` vs `#3425ac` = 4,6:1.
  La pastille **sélectionnée** est déjà conforme (indigo-900 + texte blanc) via
  `--cpd-color-bg-action-primary-rest`.
- Pastilles de **messages non lus** : fond **indigo-900** (`--cpd-color-icon-success-primary` repointé
  dans `[data-testid="notification-decoration"]`), texte blanc (déjà fourni par Compound via
  `--cpd-color-text-on-solid-primary` = `theme-bg`). Ratios RGAA AA : clair = blanc sur `#5851fb` = 5,27:1 ✓ ;
  sombre = `#101317` sur `#b2c0ff` (indigo-900 sombre) = 10,5:1 ✓. indigo-600 clair (`#b2c0ff`)
  était insuffisant (1,77:1 — non conforme).

⚠️ **Au prochain rebase upstream** : vérifier que `RoomListPrimaryFilters.tsx` porte toujours
`data-testid="primary-filters"` et `role="option"`, et que `NotificationDecoration.tsx` porte
toujours `data-testid="notification-decoration"`.

**Accessibilité — contrastes RGAA AA (WCAG 2.1, niveau AA) :**

Tous les couples texte/fond du thème Skolengo ont été audités. Seuils : texte normal ≥ 4,5:1,
texte large/gras ≥ 3:1 (crit. 3.2), composants d'interface ≥ 3:1 (crit. 3.3).

Paires conformes et ratios clés :

| Élément | Fond (clair) | Ratio clair | Fond (sombre) | Ratio sombre |
|---|---|---|---|---|
| Initiales d'avatar | bg-decorative saturé | ~5,2:1 ✓ | bg-decorative saturé | ~5,2:1 ✓ |
| Chip filtre sélectionné | indigo-900 `#5851fb` | 5,27:1 ✓ | indigo-900 `#b2c0ff` | 10,5:1 ✓ |
| Chip filtre désélectionné (label) | indigo-300 `#edf1ff` | 14,9:1 ✓ | indigo-300 `#3425ac` | 9,0:1 ✓ |
| Pastille non-lus | indigo-900 `#5851fb` | 5,27:1 ✓ | indigo-900 `#b2c0ff` | 10,5:1 ✓ |
| Nom de salon / titre en-tête | indigo-300 | ≥14:1 ✓ | indigo-300 | ≥9:1 ✓ |
| Noms d'auteurs (timeline) | canvas blanc `#fff` | ~5,2:1 ✓ | canvas `#101317` | ~7:1 ✓ |
| Texte secondaire (aperçus, etc.) | indigo-300 | 4,65:1 ✓ | indigo-300 sombre | 5,9:1 ✓ |
| Bordure chip désélectionné (crit. 3.3) | vs panneau indigo-300 | 3,12:1 ✓ | vs panneau | 4,6:1 ✓ |

Notes implémentation :

- **Noms d'auteurs en mode sombre** : `--cpd-color-text-decorative-1..6` dans
  `skolengo-dark/_skolengo-tokens.pcss` sont éclaircis (découplés de `bg-decorative`) pour passer
  4,5:1 sur le canvas sombre `#101317`. Les fonds d'avatar restent saturés (initiales blanches OK).
- **Texte secondaire sombre** : override `--cpd-color-text-secondary` → `gray-1200` (`#bdc3cc`)
  scoped sur `.mx_RoomListPanel`, `.mx_RightPanel`, `.mx_SpacePanel.newUi` dans le fichier sombre.
- En mode **clair** le texte secondaire (4,65:1) est au seuil WCAG AA — conforme mais sans marge.
  Si une future évolution modifie le fond périvenche, à revalider.

**Logo Skolengo :**

Le logo (`.mx_SpacePanel_logo`, `<img>` nu 36×36) est rendu sur fond blanc circulaire via
`.mx_SpacePanel .mx_SpacePanel_logo` avec `background-color:#fff; border-radius:50%; padding:4px;
box-sizing:border-box`.

**Itérations possibles :**

- Ajouter une variante HC `skolengo-light-hc` et l'enregistrer dans `HIGH_CONTRAST_THEMES`.
- Remap optionnel des échelles EMS pour les états succès/erreur/info (comme dans l'ancien plan
  `config.json`), si l'on veut aligner aussi ces palettes sur les teintes EMS exactes.
- Les translucides `--cpd-color-alpha-*` ne sont pas teintés (impact visuel mineur).
