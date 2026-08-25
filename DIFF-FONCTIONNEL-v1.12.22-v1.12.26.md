# Diff fonctionnel Element Web — v1.12.22 → v1.12.26

Synthèse fonctionnelle réalisée à partir des _release notes_ GitHub officielles
([element-hq/element-web](https://github.com/element-hq/element-web/releases)),
versions v1.12.23 (30/06/2026), v1.12.24 (21/07/2026), v1.12.25 (05/08/2026) et
v1.12.26 (18/08/2026). Le bruit technique interne (refactors MVVM, migrations de
tests Jest → Vitest, corrections de lint) a été volontairement écarté pour ne
conserver que les évolutions ayant un impact fonctionnel visible.

Volume : **462 commits amont, 2 285 fichiers modifiés**.

---

## 🟢 Fonctionnalités ajoutées

### Statut utilisateur _(chantier majeur de la période)_

Amorcé en v1.12.22, le statut utilisateur devient une fonctionnalité de premier plan :

- **Statut personnalisé** défini par l'utilisateur _(v1.12.26)_
- Affichage du statut dans l'**autocomplétion**, les **en-têtes de DM**, les **cartes de résumé de salon** et la **liste des membres** _(v1.12.24)_
- **Statut « en appel » automatique**, lecture de l'événement `m.call` et possibilité de l'effacer soi-même _(v1.12.25, v1.12.26)_

⚠️ **Impact Kosmos** : le menu utilisateur affiche désormais un `SetStatusView`. Il
cohabite avec notre entrée « Se déconnecter » restaurée (SCAT-36) et avec le masquage
de l'identifiant Matrix (SCAT-40), tous deux reportés.

### Liste des salons

- **Sections accessibles à tous** : sortie de la phase expérimentale _(v1.12.23)_
- **En-têtes de sections collants** _(v1.12.23)_
- **Glisser-déposer pour réorganiser les sections**, toast de non-lus par section _(v1.12.23)_
- **Persistance de l'état développé/réduit** des sections _(v1.12.26)_
- Filtres **Favoris** et **Basse priorité** réactivés _(v1.12.24)_
- **Repli automatique du panneau gauche** pendant les appels et au redimensionnement _(v1.12.25)_
- Améliorations de performance _(v1.12.24)_

⚠️ **Impact Kosmos** : le composant d'en-tête (`RoomListHeaderView`) a évolué —
`areSectionsEnabled` pilote désormais le repli des sections et doit être conservé
alors même que nous retirons le menu de composition. Le filtre « Personnes » est
masqué dans `getVisibleFilterIds()`, où l'amont a extrait la logique de filtrage.

### Aperçus d'URL

- Implémentation des **bundles d'aperçu** (MSC4095) _(v1.12.24)_
- Aperçu affiché **au-dessus du compositeur** et **aperçus réduits dans la timeline** _(v1.12.24, v1.12.25)_
- Amélioration de l'apparence des aperçus de liens _(v1.12.23)_

### Appels (Element Call)

- **Tuiles d'appel en cours** et tuiles « tombstone » dans la timeline _(v1.12.24)_
- Démarrage directement en **mode picture-in-picture** _(v1.12.24)_
- **Découverte des transports RTC** pour les widgets _(v1.12.26)_

### Authentification et configuration

- **OAuth2 aligné sur la spec Matrix v1.18** _(v1.12.24)_ — l'enregistrement dynamique
  passe d'OIDC en camelCase à OAuth2 en snake_case
- Paramètre pour **désactiver la récupération du well-known client** _(v1.12.24)_
- **Message explicite en cas de rate-limiting** à l'inscription _(v1.12.26)_

⚠️ **Impact Kosmos** : `BasePlatform.getOidcClientMetadata()` devient
`getOAuthClientMetadata()` ; notre surcharge du `logo_uri` (favicon Kosmos) a été
reportée. Le paramètre `urlParams.oidc_fragment` / `oidc_query` devient `oauth2`,
ce qui touche notre correctif SCAT-37 sur le SSO en soft-logout.

### API Module

- Accès aux **paramètres d'application** _(v1.12.25)_
- Accès aux **fonctions d'aide au stockage** _(v1.12.26)_
- Aperçu personnalisé du compositeur _(v1.12.24)_
- **Image Docker dédiée aux modules** element-web _(v1.12.26)_

⚠️ **Impact Kosmos** : notre module `kosmos-customisations` (SCAT-40, surcharge du
point d'extension `UserIdentifier`) continue de fonctionner ; l'image Docker amont
pour les modules pourrait à terme simplifier notre chaîne de packaging.

### Divers

- Affichage « identité utilisateur » dans les outils de développement _(v1.12.23)_
- Amélioration de la disposition et des libellés des notifications _(v1.12.25)_
- Libellé « Éditer la section » → « Enregistrer » _(v1.12.25)_

---

## 🔴 Dépréciations et suppressions

- **MSC3391** (suppression de données de compte) et **MSC3852** (métadonnées d'appareil) : support retiré _(v1.12.25)_
- `res/css/_compound.pcss` supprimé — les thèmes ne l'importent plus

⚠️ **Impact Kosmos** : les entrypoints du thème La Bulle importaient ce fichier et le
build webpack échouait ; l'import a été retiré (SCAT-44).

---

## 🐛 Corrections notables

- Navigation au clavier dans la liste des salons _(v1.12.23)_
- Défilement tactile dans la liste des salons _(v1.12.25)_
- Récupération automatique après un crash du rendu _(v1.12.24)_
- Récupération de médias authentifiés pour « Enregistrer l'image sous » _(v1.12.24)_
- Limitation du bruit des notifications (évite les rafales sonores) _(v1.12.24)_
- Performance au démarrage sur les salons à fortes notifications _(v1.12.25)_
- Ouverture des alias et permaliens de salons dans l'application _(v1.12.26)_
- Cache-busting de `languages.json` _(v1.12.26)_
- Dimensionnement du badge de notification, alignement de la barre de défilement
  de la timeline, arrondi du dialogue d'aperçu de salon _(v1.12.26)_
- Feuille de coloration syntaxique du code en thème `dark-custom` _(v1.12.26)_

---

## Points de vigilance pour la recette Kosmos

Le refactor **« Timeline MVVM 1 — Shared TimelineView »** (v1.12.26) déplace une partie
de la timeline vers `packages/shared-components`, où les classes CSS sont hachées. Nos
surcharges du thème La Bulle sur la bulle « moi » reposent sur un scope stable
(`[data-layout="bubble"][data-self="true"]`), vérifié comme toujours présent — mais
c'est la zone la plus exposée de la montée de version et elle doit être recettée
visuellement en clair **et** en sombre.

Voir `docs/kosmos-customizations.md` pour les points d'accroche à revérifier, et
SCAT-44 pour le détail des adaptations réalisées.
