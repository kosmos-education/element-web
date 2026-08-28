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

### Restricting the Spotlight to the user's own rooms

`SCAT-43`. The unified search used to be a general discovery tool: it could browse the public room
directory, browse public spaces, switch the homeserver being queried (and add arbitrary ones), join a
room by its address, and create a public room. All of that is removed — the search now only returns
rooms the user can already reach.

What it returns now:

- rooms the user is a member of, invites included (`findVisibleRooms`, which additionally skips space
  rooms so that only rooms are ever returned);
- rooms of the active space that the user has not joined yet, via the unchanged `useSpaceResults`
  hook ("Other rooms in <space>").

Plus the unchanged conveniences: recently viewed, recent searches, and the "Messages" entry that
hands over to message search — deliberately kept, it is not a technical feature.

What was removed from `SpotlightDialog.tsx`:

- the whole filter mechanism. `Filter.ts` is deleted: with both `PublicRooms` and `PublicSpaces` gone
  the enum had no members left, so the `initialFilter` prop, the filter chip, the Backspace handler
  that cleared it and `getRoomTypes()` all went with it. `Section` and `IBaseResult.filter`
  disappeared too — a result is now just a room;
- the public directory: `usePublicRoomDirectory` (deleted), the "Suggestions" section, the public
  room result rendering with its View / Join / Ask to join button, and `PublicRoomResultDetails`
  (deleted). `canAskToJoin()` and the `feature_ask_to_join` handling in `viewRoom()` went with them;
- the server picker `NetworkDropdown` (deleted), and with it the only consumer of
  `utils/DirectoryUtils.ts` (deleted);
- the "Join <address>" section triggered by typing `#room:server`;
- the "result may be hidden" section and its "Create a new public room" button;
- the "Spaces" section: neither joined spaces nor the meta-spaces (Home, Favourites, People, Orphans)
  are results any more.

Outside the dialog:

- `shouldShowComponent()` in `apps/web/src/customisations/helpers/UIComponents.ts` now returns `false`
  for `UIComponent.ExploreRooms`. This is the single choke point for the "Explore rooms" button, so
  one edit covers all four of its render sites (`RoomListSearchViewModel`, `LeftPanel`,
  `LegacyRoomListHeader`, `LegacyRoomList`). Note that `UIComponent.*` are **not** settings — they are
  only reachable through the Module API or this function, so putting `UIComponent.exploreRooms` in
  `config.json` under `setting_defaults` would have had no effect;
- `HomePage` also has an "Explore rooms" button that is not gated by that flag, but it sits in the
  branch that is skipped whenever `embedded_pages.home_url` is configured, which is the case for our
  deployments. It was therefore left untouched;
- `Action.ViewRoomDirectory` is kept, but `MatrixChat` no longer forces a filter on it, so it just
  opens the simplified search. It stays reachable from the `#/directory` route and from
  `RoomView`'s 3pid-invite rejection path, neither of which can reach a directory any more;
- `SpaceCreateMenu` loses its "search public spaces" button, and `OpenSpotlightPayload` is deleted:
  with `initialFilter` gone nothing dispatched a payload any more, every caller uses
  `dis.fire(Action.OpenSpotlight)`.

Upstream i18n keys left in the catalogue although now unused: `spotlight_dialog|public_rooms_label`,
`public_spaces_label`, `failed_querying_public_rooms`, `failed_querying_public_spaces`,
`result_may_be_hidden_warning`, `cant_find_room_helpful_hint`, `create_new_room_button`,
`join_button_text`, `remove_filter` and `spaces_title`. `linkifyAndSanitizeHtml` in `Linkify.ts` lost
its only caller with `PublicRoomResultDetails`; it is tagged `@knipignore` rather than deleted, being
a generic upstream utility.

Tests: the `SpotlightDialog` suite dropped the blocks covering removed features (filters supplied or
selected, clearing a filter, the `via` server passed when joining from the directory, the nsfw
filter, the `/publicRooms` error state, knock rooms, and the meta-space snapshots) and gained a single
`offers no filter entry at all` guard asserting that none of the three filter entries — people,
public rooms, public spaces — can reappear. The three meta-space snapshots were obsolete and were
pruned. Deleting `usePublicRoomDirectory` and `PublicRoomResultDetails` took their own suites with
them.

The Playwright specs were brought in line too. `apps/web/playwright/e2e/spotlight/spotlight.spec.ts`
lost the public directory tests (known / unknown / world readable rooms, other homeservers) and the
people tests (`startDM` helper, finding users, group DMs, opening the group chat dialog), together
with the bot and public-room fixtures they needed. It keeps "should find joined rooms" and keyboard
navigation — the latter now relies on a second joined room fixture sharing a name prefix, so one query
still yields two results — and gains two guards: "should offer no filter to select" and "should not
offer to join a room by its address".

`apps/web/playwright/pages/Spotlight.ts` loses its own `Filter` enum and its `filter()` method, which
had no caller left. That enum was independent from the app's own `Filter`, which is why deleting the
latter had not broken the specs at type level.

Two knock specs discovered their room through the public directory and were adjusted: the tail of
`create-knock-room.spec.ts` no longer asserts the room shows up in a directory search (the knock join
rule itself is still asserted), and `knock-into-room.spec.ts` drops "should knock into the public
knock room via spotlight" entirely. The other knock journeys are untouched.

These specs run in the Docker CI, not locally, so they have not been executed against this change —
only type-checked and linted.

### Removing people search from the Spotlight

The unified search (Spotlight) used to let users search for people in the user directory and start
DMs with them. The original `SCAT-14` customization only disabled the click (`disabled` attribute on
people results) and removed the "start group chat" section, but the "People" entry, the directory
search and the people results were still present. Ce `disabled` est devenu du code mort une fois
les résultats « personne » supprimés ; le prop correspondant a été retiré d'`Option.tsx` en
SCAT-44.

People search is now fully removed in
`apps/web/src/components/views/dialogs/spotlight/SpotlightDialog.tsx`. `SCAT-14` first neutralized it
by short-circuiting the relevant code paths; `SCAT-43` then deleted the code left behind, so the
removal is now structural rather than guarded at runtime:

- `Filter.People` no longer exists in `apps/web/src/components/views/dialogs/spotlight/Filter.ts`.
  The type system now makes a people filter unrepresentable, which replaces the previous runtime
  safety net (an initial `Filter.People` used to be coerced to `null`);
- the `People` and `Suggestions` members of the `Section` enum are gone, along with the member result
  type (`IMemberResult`, `isMemberResult`, `toMemberResult`), the member result rendering and
  `findVisibleRoomMembers`;
- the user directory / profile lookups are no longer wired at all — the `useUserDirectory` and
  `useProfileInfo` imports and their `useDebouncedCallback(false, …)` calls are removed. Both hooks
  are left in the tree: they are upstream code, still covered by their own unit tests, and
  `IProfileInfo` is referenced elsewhere;
- the "result may be hidden" block specific to the people filter is removed, together with the
  "copy your invite link" button (`ownInviteLink`, `copyPlaintext`, `makeUserPermalink`);
- member sorting (`buildActivityScores` / `buildMemberScores` / `compareMembers`) and the
  directory/profile loading spinner conditions are removed.

One behavioural fix comes with this cleanup: `toRoomResult()` used to route DM rooms to
`Section.People`, a section that `SCAT-14` had stopped rendering — a legacy DM room was therefore
indexed but never displayed. DM rooms are now routed to `Section.Rooms`, and remain searchable by the
other member's display name or user ID. Creating new DMs is blocked upstream, so this only concerns
rooms that predate the block.

The unit tests in `apps/web/test/unit-tests/components/views/dialogs/SpotlightDialog-test.tsx` were
updated accordingly. The `SCAT-14` guard test asserting that an initial people filter is ignored was
dropped (unrepresentable now that `Filter.People` is gone); the test asserting that the user directory
is never queried is kept, without the filter prop. The three snapshots are unchanged, which confirms
the deleted code was genuinely dead.

Not covered here: the Playwright e2e specs in `apps/web/playwright/e2e/spotlight/spotlight.spec.ts`
still exercise people search (`startDM` helper and ~8 tests) and have been stale since `SCAT-14`.
They use their own string-based `Filter` enum from `apps/web/playwright/pages/Spotlight.ts`, so they
are unaffected at type level by this cleanup, but they cannot pass against the customized build.

### Removing visible mentions of encryption

We designed the solution in order to avoid needing to encrypt the server, so to avoid confusion and concern
among our users, we chose to take off the mentions on unencrypted messages and rooms.

### Removing Polls and Extensions entries

Both are not configured in the server but the buttons were still there doing nothing.

### Removing infinite loader on verification pill

The server doesn't allow this call so the loader was infinite in the right panel.

En pratique, `UserInfoHeaderView.tsx` ne rend plus du tout `UserInfoHeaderVerificationView` —
la section de vérification est retirée, pas seulement son indicateur de chargement. Les props
`devices` et `hideVerificationSection` restent déclarées et transmises par `UserInfo.tsx` :
elles ne servent plus à rien, mais les supprimer entraînerait la suppression en cascade du
hook `useDevices` et de ses aides dans du code amont. On les conserve volontairement pour
limiter l'écart avec l'amont et faciliter les rebases (choix acté en SCAT-44).

### Adding an entry directing to the FAQ

In the Space Panel, we added a button directing to the FAQ set in the help_url configuration parameter.

### Branding the favicon

Changing the favicon logos to ours.

### Adding a specific error message when uploading files

When a users tries to upload a file exceeding their quota (size per week for example), the error messages now mentions it.

### Masquer le toast « Vérifiez cet appareil » (SCAT-32)

Le serveur n'autorise pas la vérification d'appareil : le toast invitant à vérifier la session
est donc sans issue. `apps/web/src/device-listener/DeviceListenerCurrentDevice.ts` traite l'état
`verify_this_session` comme « pas de toast ». À distinguer de la pill de vérification du panneau
droit (section précédente), qui est un autre point d'affichage.

⚠️ **Au prochain rebase upstream** : l'amont fait régulièrement évoluer cette campagne de
vérification. Le test associé a été co-localisé et migré vers Vitest en v1.12.26
(`apps/web/src/DeviceListener.test.ts`).

### Relancer le SSO immédiat en soft-logout (SCAT-37)

Une session soft-logout conserve son jeton (devenu inutilisable) dans le stockage local, ce qui
laissait `hasPossibleToken = true` et neutralisait l'auto-redirection SSO
(`sso_redirect_options.immediate`) : l'utilisateur arrivant sur `#/start_sso` depuis Skolengo
restait bloqué sur l'écran de soft-logout. `apps/web/src/vector/app.tsx` traite désormais une
session soft-logout comme « pas de jeton ». Tests dans `apps/web/src/vector/app.test.ts`
(Vitest depuis la v1.12.26).

### Restaurer le rendu de la page d'accueil embarquée (SCAT-38)

`EmbeddedPage.tsx` étend l'allowlist du sanitizer aux balises et attributs SVG
(`EMBEDDED_SVG_TAGS` / `EMBEDDED_SVG_ATTRS`) et autorise `<style>`, la page embarquée étant
fournie par l'exploitant (même niveau de confiance que `config.json`). La casse des attributs
est préservée, sans quoi `viewBox` devient `viewbox` et le SVG ne s'affiche plus.

⚠️ En v1.12.26, `sanitize-html` type `allowedTags` / `allowedAttributes` en `false | …`
(`false` = tout autoriser) : ces options sont renormalisées avant d'être étendues.

### Éviter le dialogue d'erreur au retour dans un salon

Au retour dans un salon, la position de scroll sauvegardée peut cibler un événement que le
serveur ne renvoie plus (purge, redaction), ce qui affichait un dialogue d'erreur bloquant.
Deux garde-fous complémentaires :

- `RoomView.tsx` ne restaure la position sauvegardée que si l'événement est encore connu
  localement ;
- `TimelinePanel.tsx` retombe silencieusement sur la live timeline lorsqu'un chargement **non
  explicite** (non surligné) échoue. Ce repli est volontairement restreint à l'événement
  réellement introuvable (`M_NOT_FOUND` / 404) : toute autre erreur (permission, réseau, 5xx)
  doit rester visible. Intercepter toutes les erreurs laissait par ailleurs le panneau droit
  monté au retour dans un salon ayant affiché un appel (constaté en v1.12.26).

### Désactiver les source maps en production sans Sentry

`apps/web/webpack.config.ts` ne génère de source maps en production que si `SENTRY_DSN` est
défini, pour ne pas exposer les sources sur les déploiements Kosmos.

### Restriction des langues et des écrans de paramétrage (lot 2)

Ces customisations sont pilotées par `config.json` (gitignoré) sauf mention contraire :

- **SCAT-40 — masquage de l'identifiant Matrix** : un module Kosmos
  (`modules/kosmos-customisations`, chargé au runtime via la clé `modules` de `config.json`)
  surcharge le point d'extension `UserIdentifier` (`getDisplayUserIdentifier` → `null`).
  Le menu utilisateur affiche un `userIdentifier` routé par cette surcharge, le `userId` réel
  restant utilisé pour la couleur d'avatar. Le module est buildé par `docker-package.sh` et
  copié dans `webapp/` par webpack.
- **SCAT-41** : masquage des entrées « Associer un nouvel appareil » et « Sécurité et
  confidentialité » du menu utilisateur.
- **SCAT-42** : masquage d'onglets de la modale de paramétrage (`disable_settings_tabs`),
  restriction des langues proposées (`available_languages`, filtre posé dans
  `apps/web/src/i18n/utils.ts`), onglet Notifications limité aux 5 premières options,
  masquage de l'URL du homeserver et du jeton d'accès, retrait du bouton « Rechercher une
  mise à jour » et de l'option « Afficher le contenu sensible (NSFW) ».
- **SCAT-43** : recherche restreinte aux salons accessibles (voir la section Spotlight).
- **SCAT-45 — masquage de l'identifiant du salon** : `hide_room_alias` (booléen). Lorsqu'il vaut
  `true`, `useRoomSummaryCardViewModel` renvoie `alias: ""`, ce qui vide la ligne
  `.mx_RoomSummaryCard_alias` affichée sous le nom du salon dans le panneau latéral
  d'information. Aucune modification de la vue : `RoomSummaryCardView` rend déjà ce bloc vide
  pour les salons sans alias (élément de hauteur nulle, donc pas d'espace résiduel), et les
  snapshots amont restent inchangés. Le point d'extension `AliasCustomisations` du Module API a
  été écarté volontairement : `RoomSummaryCardViewModel` lit `room.getCanonicalAlias()` en
  direct, et neutraliser `getDisplayAliasForAliasSet` aurait aussi affecté le routage d'URL de
  salon (`MatrixChat.tsx`) et `SpaceHierarchy`, hors périmètre.

- **SCAT-46 — modale de paramétrage du salon** : trois customisations.
  1. `disable_room_settings_tabs` (tableau d'identifiants `RoomSettingsTab`) : miroir exact de
     `disable_settings_tabs` côté salon, filtre posé en fin de `RoomSettingsDialog.getTabs()`.
     En production : `["ROOM_VOIP_TAB", "ROOM_POLL_HISTORY_TAB", "ROOM_ADVANCED_TAB"]`
     (onglets « Audio et vidéo », « Sondages » et « Avancé »). Le filtre est appliqué **après**
     les conditions amont (`element_call.disable`, `UIFeature.AdvancedSettings`, …), qui restent
     donc en place : la config Kosmos ne fait que retrancher.
  2. `hide_room_addresses` (booléen) : masque la `SettingsSection`
     « Adresses du salon » de l'onglet Général (`GeneralRoomSettingsTab`), qui porte à la fois
     « Adresses publiées » et « Adresses locales » (`AliasSettings`). La section entière est
     rendue conditionnellement, `AliasSettings` n'est donc plus monté du tout — aucun appel
     `getLocalAliases` / `getRoomDirectoryVisibility` inutile.
  3. **Avatar du salon en carré arrondi** dans l'onglet Général : règle CSS ajoutée aux deux
     thèmes La Bulle (`_la-bulle-overrides.pcss` et `_la-bulle-dark-overrides.pcss`), sur le
     sélecteur `.mx_RoomSettingsDialog .mx_AvatarSetting_avatar .mx_BaseAvatar`
     (`--cpd-avatar-radius: 25%`, même valeur que la liste des salons et l'en-tête).
     `AvatarSetting` étant partagé avec le profil utilisateur, la portée est restreinte par
     `.mx_RoomSettingsDialog` afin que l'avatar utilisateur reste rond.
  4. `hide_room_encryption_section` (booléen) : masque le `SettingsFieldset` « Chiffrement »
     de l'onglet « Sécurité et vie privée » (`SecurityRoomSettingsTab`), avec sa bascule
     « Chiffré », le message « une fois activé le chiffrement ne peut plus être désactivé »
     et le drapeau `blacklistUnverifiedDevices`. Le déploiement n'utilise pas le chiffrement
     de bout en bout : la section n'avait rien d'actionnable (voir aussi *Removing visible
     mentions of encryption*). Le `SettingsSection` parent est conservé, il porte encore les
     règles d'accès (`renderJoinRule`) et la visibilité de l'historique — pas de section vide.

- **SCAT-47 — actions de signalement** : deux clés booléennes, une par objet signalé.
  1. `hide_report_content` : masque l'option « Signaler » du menu contextuel d'un message
     (`MessageContextMenu`), qui ouvre `ReportEventDialog`. La garde s'ajoute à la condition
     amont existante (`mxEvent.getSender() !== me`), qui reste en place.
  2. `hide_report_room` : masque l'action « Signaler le salon » sur ses **deux** points
     d'entrée — le bouton `mx_RoomSummaryCard_bottomOptions` du panneau latéral d'information
     (`RoomSummaryCardView`, qui ouvre `ReportRoomDialog`) et la bascule « Signaler le salon »
     du dialogue de refus d'invitation (`DeclineAndBlockInviteDialog`, « Refuser et bloquer »),
     qui signale sans passer par le dialogue dédié. Dans ce dialogue, la bascule et sa zone de
     saisie de motif sont retirées ensemble ; `shouldReport` reste à `false`, donc `onFinished`
     transmet `false` et aucun signalement n'est émis.

  Les deux actions appellent l'API du serveur d'accueil (`client.reportEvent` →
  `POST /_matrix/client/v3/rooms/{roomId}/report/{eventId}` et `client.reportRoom` →
  `POST /_matrix/client/v3/rooms/{roomId}/report`) : le destinataire est l'administrateur du
  homeserver, pas un modérateur du salon. Ces signalements n'étant ni collectés ni traités sur
  nos déploiements, les boutons promettaient une prise en charge inexistante. Les dialogues
  `ReportEventDialog` et `ReportRoomDialog` sont conservés (simplement plus atteignables), ainsi
  que le paramètre amont `report_event.admin_message_md`, qui n'a plus de point d'affichage.
  Le Module API a été écarté : aucun point d'extension sur la composition du menu contextuel
  d'un message ni du panneau d'information du salon.

- **SCAT-48 — partage de lien** : deux clés booléennes, une par objet partagé.
  1. `hide_share_content` : masque le partage d'un lien vers un message sur ses **deux** points
     d'entrée — l'option « Partager » du menu contextuel d'un message (`MessageContextMenu`,
     bloc `permalinkButton`, qui ouvre `ShareDialog`) et l'option « Copier le lien vers le
     fil » du menu contextuel d'un fil (`ThreadListContextMenu`), qui copie directement le
     permalien sans passer par le dialogue. Attention : l'entrée du menu contextuel du message
     est rendue comme une balise `<a href={permalink} target="_blank">` — neutraliser son
     `onClick` ne suffit pas, le lien resterait cliquable ; c'est le bloc entier qui est masqué.
  2. `hide_share_room` : masque le partage d'un lien vers un salon sur ses **trois** points
     d'entrée — l'entrée « Copier le lien » du panneau latéral d'information
     (`RoomSummaryCardView`, qui ouvre `ShareDialog`), l'entrée « Copier le lien du salon » du
     menu « … » d'un salon de la liste (`RoomListItemViewModel`) et la même entrée dans le menu
     contextuel d'un résultat du Spotlight (`RoomGeneralContextMenu`, via
     `RoomResultContextMenus`). Les deux dernières passent par l'action de dispatcher
     `copy_room`, traitée dans `MatrixChat`.

  Pour la liste des salons, la garde se pose sur le calcul de `canCopyRoomLink` dans
  `RoomListItemViewModel` et **non** dans le rendu du menu : celui-ci vit dans le paquet
  partagé `packages/shared-components`, qu'on évite ainsi de modifier.

  Ces actions produisent un lien `matrix.to` destiné à être diffusé hors de l'application — le
  dialogue de partage propose d'ailleurs un QR code et des boutons de réseaux sociaux. Ce n'est
  pas un usage souhaité sur La Bulle, où l'invitation reste le chemin nominal pour donner accès
  à un salon. `ShareDialog` est conservé (simplement plus atteignable pour un message ou un
  salon), ainsi que les libellés i18n, fournis par l'amont. Le Module API a été écarté : aucun
  point d'extension sur la composition de ces menus.

  Deux paramètres amont existants réduisent le contenu du dialogue sans le supprimer :
  `UIFeature.shareQrCode` et `UIFeature.shareSocial`, tous deux à `true` par défaut et
  pilotables par `setting_defaults`. Ils ne suffisent pas au besoin, mais leur passage à
  `false` est un filet de sécurité utile si un point d'entrée était oublié.

  Restent hors périmètre, faute de besoin confirmé : le partage du profil d'un utilisateur
  (`UserInfoBasicOptionsViewModel`), le lien d'invitation invité d'un appel
  (`CallGuestLinkButton`) et le lien d'invitation d'un espace (`SpacePublicShare`). À noter
  aussi qu'un lien `matrix.to` reçu ou forgé reste résolu par le client : ces clés suppriment
  la production de liens depuis l'interface, pas leur exploitation.

- **SCAT-49 — export des conversations** : `hide_export_chat` (booléen) masque l'entrée
  « Exporter la conversation » du panneau latéral d'information du salon
  (`RoomSummaryCardView`, qui ouvre `ExportDialog`). Point d'entrée unique — la garde s'ajoute
  à la condition amont existante `!vm.isVideoRoom`, qui reste en place.

  L'export produit un fichier local (HTML, texte brut ou JSON) contenant l'historique du salon,
  pièces jointes incluses : une extraction hors application de messages d'établissement, sans
  traçabilité côté serveur, et dont le format JSON expose la structure technique des événements
  Matrix. `ExportDialog` est conservé (simplement plus atteignable), ainsi que les libellés
  i18n, fournis par l'amont. Le Module API a été écarté : aucun point d'extension sur la
  composition du panneau d'information du salon.

  Restent hors périmètre : l'export des journaux de débogage (`bug_reporting|download_logs`),
  qui n'est pas un export de conversation, et le téléchargement d'une pièce jointe depuis un
  message, qui reste un usage nominal.

- **SCAT-50 — affichage de la source d'un message** : `hide_view_source` (booléen) masque
  l'option « Afficher la source » du menu contextuel d'un message (`MessageContextMenu`, bloc
  `viewSourceButton`), qui ouvre le dialogue `ViewSource` affichant le JSON brut de l'événement
  Matrix. Outil de mise au point sans utilité pour les personnels d'établissement, et qui
  expose la structure technique du protocole.

  À noter que cette entrée n'est **pas** conditionnée au mode développeur en amont (le
  commentaire amont le dit explicitement : « This is specifically not behind the developerMode
  flag ») — elle est visible par tous, sur tous les messages. Les **deux autres** accès au même
  dialogue le sont, eux : la barre d'action du dialogue « Historique des modifications »
  (`EditHistoryMessage`) et le lien de repli d'une tuile en erreur de rendu
  (`TileErrorViewModel`) testent `SettingsStore.getValue("developerMode")`. Ce réglage de
  laboratoire est désactivé par défaut et l'onglet « Laboratoire » est masqué sur nos
  environnements (`show_labs_settings` à `false`, `USER_LABS_TAB` dans
  `disable_settings_tabs`) : ces deux accès sont inatteignables en l'état et n'ont pas été
  modifiés. ⚠️ Ne pas activer `developerMode` dans `setting_defaults`, sans quoi ils
  réapparaîtraient. Même remarque pour `showHiddenEventsInTimeline`, qui rend les événements
  techniques dans la timeline.

  `ViewSource` est conservé (simplement plus atteignable depuis le menu contextuel d'un
  message), ainsi que les libellés i18n, fournis par l'amont. Le Module API a été écarté :
  aucun point d'extension sur la composition du menu contextuel d'un message.

- **SCAT-51 — action « Ignorer » un utilisateur** : `hide_ignore_user` (booléen) masque la
  ligne « Ignorer » / « Ne plus ignorer » du panneau latéral d'information d'un utilisateur
  (`UserInfoBasicView`, composant `IgnoreToggleButton`). La garde porte sur le `Container` qui
  entoure le bouton, et **non** sur le bouton seul, pour ne pas laisser de conteneur vide dans
  le panneau ; la condition amont `!vm.isMe` reste en place.

  Ignorer un utilisateur masque, côté client uniquement, tous ses messages passés et futurs dans
  tous les salons partagés — la liste vit dans les données de compte (`m.ignored_user_list`) et
  suit l'utilisateur sur tous ses appareils. Sur La Bulle, les échanges sont professionnels,
  entre personnels d'établissement, dans des salons pré-créés : le filtrage individuel n'y a pas
  de place, et l'action est trompeuse (elle ne bloque rien côté serveur, l'auteur ignoré
  continue d'écrire sans le savoir). `IgnoreToggleButton` et sa vue-modèle sont conservés
  (simplement plus rendus), ainsi que les libellés i18n, fournis par l'amont. Le Module API a
  été écarté : aucun point d'extension sur la composition du panneau d'information d'un
  utilisateur.

  Deux autres accès à la liste des utilisateurs ignorés subsistent : l'onglet « Sécurité et vie
  privée » des paramètres (`MjolnirUserSettingsTab`), déjà masqué par `USER_SECURITY_TAB` dans
  `disable_settings_tabs` (SCAT-42), et les commandes de composition `/ignore` et `/unignore`,
  laissées actives. ⚠️ Conséquence pour l'exploitation : la ligne masquée portait aussi « Ne plus
  ignorer ». Un utilisateur ignoré par erreur avant la mise en place de la customisation ne peut
  plus être dé-ignoré depuis l'interface — `/unignore @utilisateur:serveur` est le chemin de
  secours, et c'est une des raisons pour lesquelles ces commandes ne sont pas retirées.

⚠️ **Au prochain rebase upstream** : `disable_settings_tabs`, `available_languages`,
`hide_room_alias`, `disable_room_settings_tabs`, `hide_room_addresses`,
`hide_room_encryption_section`, `hide_report_content`, `hide_report_room`,
`hide_share_content`, `hide_share_room`, `hide_export_chat`, `hide_view_source` et
`hide_ignore_user` sont déclarés dans
`apps/web/src/IConfigOptions.ts`, dont l'amont a fait un type dérivé du schéma généré
`WebConfigJson` — les champs Kosmos s'ajoutent dans `ConfigOptions`.

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

### Overrides pnpm

Le fork ne porte plus aucun override pnpm propre. L'override `restore-cursor: 3.1.0`, ajouté en
SCAT-31 pour contourner un conflit ESM/CJS qui bloquait le build nx, a été **revalidé puis retiré
en SCAT-44** : le build des packages partagés et de l'app passe sans lui en v1.12.26
(`NX_SKIP_NX_CACHE=true pnpm -r --filter "./packages/**" build`, puis build de `apps/web`).
`pnpm-workspace.yaml` est donc identique à celui de l'amont — à revérifier si un build nx
échoue à nouveau sur un `require()` d'un module ESM.

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

À noter : le fork ajoute bien un `^build` dans `apps/web/project.json`, mais sur le target
**`start`** (dev-server), pas sur `build` — ce qui ne change rien au raisonnement ci-dessus.

⚠️ **Au prochain rebase upstream** : vérifier que `apps/web/project.json` n'a toujours
pas acquis de `dependsOn: ["^build"]` sur son target `build`. Si c'est le cas, la ligne
`NX_SKIP_NX_CACHE=true pnpm -r --filter "./packages/**" build` dans `docker-package.sh`
reste inoffensive (double build) mais peut être retirée.
_Vérifié en v1.12.26 : toujours absent._

### Neutral placeholder text in the message composer

Since upstream v1.12.21, the default composer placeholder keys (`composer|placeholder`, `composer|placeholder_reply`, `composer|placeholder_thread`) now explicitly mention "unencrypted" in their text (e.g. "Send an unencrypted message…"). To stay consistent with our goal of hiding encryption mentions, `MessageComposer.tsx` now always uses the `_encrypted` variants of those keys (`composer|placeholder_encrypted`, etc.), which carry neutral wording regardless of the room's actual encryption status. The corresponding `fr.json` overrides and the Jest unit tests (`MessageComposer-test.tsx`, `test-utils/composer.ts`) were updated accordingly.

### Thème natif La Bulle (IndigoEMS)

> **Renommage (SCAT-33)** : ce thème s'appelait initialement « Skolengo ». Il a été renommé en
> **« La Bulle »** — identifiants, dossiers, fichiers `.pcss`, feuilles CSS émises et réglage
> par défaut. Les anciens identifiants `skolengo-light` / `skolengo-dark` encore stockés côté
> utilisateur sont migrés automatiquement (voir « Migration » plus bas). En revanche, le **logo
> reste le donut Skolengo** (`donut-skolengo.svg`, `alt="Skolengo"`) et les variables CSS internes
> `--skolengo-*` (invisibles) sont conservées telles quelles : « Skolengo » reste la marque ombrelle.

Deux thèmes PCSS natifs ont été créés pour habiller Element aux couleurs de la marque Skolengo
(thème « La Bulle »), sur la base de la palette **IndigoEMS** (confirmée par échantillonnage des
maquettes de l'UI) :

| Identifiant      | Sélecteur affiché | Feuille CSS émise          |
| ---------------- | ----------------- | -------------------------- |
| `la-bulle-light` | La Bulle          | `theme-la-bulle-light.css` |
| `la-bulle-dark`  | La Bulle Sombre   | `theme-la-bulle-dark.css`  |

**Structure des fichiers :**

```
apps/web/res/themes/
├── la-bulle-light/css/
│   ├── la-bulle-light.pcss      # entrypoint (fork de light.pcss)
│   ├── _la-bulle-vars.pcss      # overrides de variables PostCSS legacy ($)
│   ├── _la-bulle-tokens.pcss   # échelle indigo clair + tokens --cpd-color-*
│   └── _la-bulle-overrides.pcss # surcharges sélecteurs app (fonds panneaux, partagé clair+sombre)
└── la-bulle-dark/css/
    ├── la-bulle-dark.pcss       # entrypoint (fork de dark.pcss)
    ├── _la-bulle-dark-vars.pcss # overrides de variables PostCSS legacy ($) du sombre
    ├── _la-bulle-dark-overrides.pcss # identité avatars/logo/contours d'espace + contrastes (sombre)
    └── _la-bulle-tokens.pcss   # échelle indigo inversée (mode sombre)
```

> **Attention — le mode sombre ne charge PAS les fichiers du mode clair.** `la-bulle-dark.pcss`
> repart du dark Element par défaut et n'importe ni `_la-bulle-vars.pcss` ni
> `_la-bulle-overrides.pcss`. Toute règle destinée au sombre doit vivre dans un fichier
> `la-bulle-dark/`. Une règle préfixée `.cpd-theme-dark` placée dans `_la-bulle-overrides.pcss`
> est **du code mort** : ce fichier n'est chargé que par `la-bulle-light.pcss`, où le body porte
> `cpd-theme-light`. C'est ce piège qui avait laissé passer deux défauts de contraste en sombre
> (retour de recette SCAT-33).
>
> `_la-bulle-dark-vars.pcss` doit rester importé **entre** `dark/css/_dark.pcss` (qui définit les
> variables PostCSS) et `res/css/_components.pcss` (qui les consomme) : `postcss-import` inline les
> fichiers dans l'ordre déclaré et la dernière définition avant usage gagne.

**Palette IndigoEMS — valeurs clés :**

- Accent vif (boutons, pastilles) : `#5851fb` (indigo-900 en mode clair)
- Surfaces périvenche (room list, space panel, panneau droit) : `#edf1ff`/`#f6f8ff` (indigo-300/200)
- Bulle de message propre : `#dde5ff` (indigo-400)
- Texte d'accent (liens, texte action) : `#4135ce` (indigo-1100)
- Barre de titre / fond d'accent foncé : `#170c5c` (indigo-1400)

**Points d'enregistrement (à vérifier à chaque rebase upstream) :**

1. `apps/web/webpack.config.ts` — `cssThemes` : entrées `theme-la-bulle-light` et `theme-la-bulle-dark`.
2. `apps/web/src/theme.ts` — `DEFAULT_THEME = "la-bulle-light"` ; `BUILTIN_THEMES` liste uniquement
   les deux thèmes La Bulle (masque light/dark du sélecteur). `migrateThemeName()`
   traduit les anciens identifiants `skolengo-*` au runtime (filet de sécurité si le réglage n'est
   pas encore migré). `HIGH_CONTRAST_THEMES` est **volontairement vide** : ne pas le repeupler
   sans variante HC La Bulle. Filtrer via `BUILTIN_THEMES` / `getOrderedThemes()` ne suffit pas —
   `ThemeChoicePanel.makeHighContrastTheme()` ré-injecte le thème en aval via
   `findHighContrastTheme("light")` (argument codé en dur), ce qui faisait réapparaître un bouton
   « Contraste élevé » appliquant un thème Element natif non marqué (retour de recette SCAT-33).
   Couvert par un test dans `ThemeChoicePanel-test.tsx`.
3. `apps/web/src/settings/Settings.tsx` — `theme.default = "la-bulle-light"`.
4. `apps/web/src/settings/watchers/ThemeWatcher.ts` — `themeBasedOnSystem()` route vers
   `la-bulle-dark`/`la-bulle-light` au lieu de `dark`/`light` ; `isUserOnDarkTheme()` inclut
   `la-bulle-dark`.
5. `apps/web/src/settings/SettingsStore.ts` — `migrateSkolengoThemeToLaBulle()` (appelée dans
   `runMigrations`) réécrit une fois pour toutes le réglage `theme` stocké `skolengo-*` → `la-bulle-*`
   (flag localStorage `mx_theme_skolengo_to_la_bulle_done`).

**Migration :** un utilisateur ayant déjà sélectionné l'ancien thème a `theme: "skolengo-light"`
(ou `-dark`) stocké dans ses réglages. Deux mécanismes complémentaires assurent la continuité :
`theme.ts#migrateThemeName` (runtime, pour trouver la bonne feuille de style) et
`SettingsStore#migrateSkolengoThemeToLaBulle` (persistante, pour que le sélecteur Apparence mette
bien en surbrillance le thème actif). Le `config.json` déployé ne fixe pas de `default_theme` ; la
valeur par défaut vient de `Settings.tsx` / `DEFAULT_THEME`.

**Comportement :**

- `setTheme` dans `theme.ts` détecte `"light"` dans le nom du thème (`la-bulle-light.includes("light")`)
  et assigne la classe `cpd-theme-light` (Compound tokens mode clair). Même logique pour `la-bulle-dark`
  → `cpd-theme-dark`.
- Le suivi du thème système OS bascule automatiquement entre `la-bulle-light` et `la-bulle-dark`.
- Réglages → Apparence ne propose que les deux thèmes La Bulle.
- **Sur un profil vierge, c'est « S'adapter au thème du système » qui est actif**, pas
  `la-bulle-light` : le réglage `use_system_theme` conserve le défaut upstream `true`
  (`Settings.tsx`). `DEFAULT_THEME` ne s'applique donc qu'une fois le suivi système désactivé.
  Le rendu reste conforme (`themeBasedOnSystem()` route vers `la-bulle-light`/`la-bulle-dark`),
  mais le panneau Apparence affiche les deux radios `disabled` et non cochés — comportement
  attendu, régulièrement remonté en recette (SCAT-33).
  À noter si l'on veut un jour forcer `la-bulle-light` : `use_system_theme` a
  `supportedLevels: LEVELS_DEVICE_ONLY_SETTINGS` (= `[DEVICE]`), donc le poser dans
  `setting_defaults` de `config.json` serait **silencieusement ignoré**. Il faut soit changer
  `default` dans `Settings.tsx`, soit ajouter `SettingLevel.CONFIG` aux `supportedLevels`.

**Fonds périvenche des panneaux latéraux :**

L'UI code en dur `--cpd-color-bg-canvas-default` (blanc) sur les conteneurs latéraux.
Les variables legacy `$roomlist-bg-color` / `$spacePanel-bg-color` de `_la-bulle-vars.pcss`
ne pilotent plus que l'ancienne UI (jamais rendue) et n'ont **aucun effet**.

La correction est dans `_la-bulle-overrides.pcss` (importé depuis les deux entrypoints après
`_components.pcss`) : on applique directement `background-color: var(--cpd-color-indigo-300)`
sur ces sélecteurs. On ne redéfinit PAS le token global pour préserver la timeline blanche,
la barre de recherche distincte et les en-têtes de section sticky.

**v1.12.26 — sélecteurs réancrés (SCAT-44)** : `.mx_LeftPanel_newRoomList` et
`.mx_SpacePanel.newUi` ont disparu en amont. Les surcharges visent désormais
`.mx_LeftPanel_roomListContainer` et `.mx_SpacePanel` (l'amont a déplacé son fond blanc
sur `.mx_SpacePanel` lui-même et ne pose plus de fond `!important` sur le conteneur de
la liste — d'où le retrait de notre `!important`). `.mx_RoomListPanel` et `.mx_RightPanel`
sont inchangés.

⚠️ **Au prochain rebase upstream** : vérifier que les sélecteurs
`.mx_LeftPanel_roomListContainer` / `.mx_SpacePanel` / `.mx_RoomListPanel` /
`.mx_RightPanel` n'ont pas été renommés, et sur quel sélecteur l'amont pose son fond
blanc (`apps/web/res/css/structures/_LeftPanel.pcss`, `_SpacePanel.pcss`). **Ce type de
règle ne produit jamais de conflit git : elle devient silencieusement inopérante.**
Le contrôle rapide consiste à extraire les classes `mx_` des deux fichiers
`*-overrides.pcss` et à vérifier que chacune existe encore dans `apps/web/src`,
`apps/web/res/css` et `packages/shared-components/src`.

**Avatars — forme et couleurs :**

Les avatars de **salons** (liste + en-tête) sont rendus en **carré arrondi** (border-radius 25 %).
Les avatars d'auteurs dans les messages de la timeline restent **ronds**.
La surcharge est dans `_la-bulle-overrides.pcss` via `--cpd-avatar-radius: 25% !important` sur
les sélecteurs `.mx_RoomListItemView .mx_BaseAvatar`, `.mx_RoomHeader > *:first-child.mx_BaseAvatar`
(avatar enfant direct — cas fréquent sans présence) et `.mx_RoomHeader > *:first-child .mx_BaseAvatar`
(avatar dans le wrapper `WithPresenceIndicator` — DM avec présence activée).

Point technique en-tête : `WithPresenceIndicator` renvoie un **Fragment** (aucun nœud DOM) quand
il n'y a pas de présence → l'avatar devient l'**enfant direct** de `.mx_RoomHeader`, pas un
descendant ; d'où la nécessité des deux variantes du sélecteur.

Les fonds d'avatars (`--cpd-color-bg-decorative-1..6`) utilisent les couleurs **saturées EMS-900**
(identiques aux `text-decorative`), avec des **initiales blanches** (`--cpd-avatar-color: #fff !important`
dans `_la-bulle-overrides.pcss`). Les `--cpd-color-text-decorative-*` sont conservés inchangés
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
  `font-weight-medium`) via `.mx_RoomListItemView [data-testid="room-name"]` dans `_la-bulle-overrides.pcss`.
  `data-testid="room-name"` est le seul sélecteur stable sur cet élément (la classe CSS module est hashée).
- Le **titre du salon dans l'en-tête** (`.mx_RoomHeader_heading`) est rendu en `font-weight-bold`.

⚠️ **Au prochain rebase upstream** : vérifier que `RoomListItemContent.tsx` porte toujours
`data-testid="room-name"` sur le div du nom du salon.

**En-têtes de section de la liste (« Favoris », « Discussions »…) :**

L'amont peint un fond **opaque** sur les en-têtes de section, car ils sont `position: sticky` et se
recouvrent en défilant : `.stickyRow` (`GroupedVirtualizedList.module.css`, lignes réelles) et
`.stickyBackground::before` (`RoomListSectionHeaderView.module.css`, calque « section courante »
épinglé). Les deux utilisent `--cpd-color-bg-canvas-default`, soit une bande **blanche** en travers
du périvenche du panneau. On repointe les deux sur `--skolengo-panel-bg` dans
`_la-bulle-overrides.pcss` : le fond reste opaque (exigence de l'amont) mais se fond dans la liste.

La **taille de police** des en-têtes passe de `body-sm` (13px) à `body-md` (15px), celle des tuiles de
salon, pour une échelle homogène dans la liste. Seuls `font-size` et `letter-spacing` sont surchargés
— la graisse (regular, ou semibold quand la section est non lue) reste celle de l'amont.

Ces deux classes sont des **CSS modules hashés** (`_stickyRow_3tgsb_23`) ; seule la sous-chaîne est
stable → sélecteurs en `[class*="stickyRow"]` / `[class*="stickyBackground"]` (même technique que
`[class*="icon-button"]` dans `_la-bulle-tokens.pcss`).

**Survol et sélection des tuiles de salon :**

Depuis que le panneau est en périvenche (`--skolengo-panel-bg` = `indigo-300` `#edf1ff`), les valeurs
globales de `_la-bulle-tokens.pcss` — survol `indigo-200` `#f6f8ff`, sélection `indigo-300` `#edf1ff` —
ne fonctionnent plus : la sélection est **strictement de la même couleur que le fond** (invisible, seul
le liseré de 4px trahissait le salon courant) et le survol est **plus clair** que le fond (effet
inversé). On descend chacun d'un cran, dans le seul scope de la liste (`nav.mx_RoomListPanel`) :

| Token                                    | Global (reste inchangé) | Liste des salons        |
| ---------------------------------------- | ----------------------- | ----------------------- |
| `--cpd-color-bg-action-tertiary-hovered`  | `indigo-200` `#f6f8ff`  | `indigo-400` `#dde5ff`  |
| `--cpd-color-bg-action-tertiary-selected` | `indigo-300` `#edf1ff`  | `indigo-500` `#c4d0ff`  |

Le scope est volontairement limité : ces tokens pilotent aussi les boutons/menus tertiaires du reste de
l'app, posés sur fond blanc, où les valeurs globales restent correctes. Le sélecteur est qualifié
`nav.` (RoomListPanel est rendu en `<nav>`) pour ne pas dupliquer `.mx_RoomListPanel` déjà utilisé plus
haut dans le fichier (stylelint `no-duplicate-selectors`). Contrastes RGAA AA : survolée comme
sélectionnée, la tuile passe son texte en `text-primary` `#1b1d22` → 12,9:1 sur `#c4d0ff`,
15,3:1 sur `#dde5ff` ✓.

**Mode sombre** : aucune de ces trois surcharges ne s'applique — `la-bulle-dark` ne repeint pas
`.mx_RoomListPanel`, le fond de la liste **est** déjà `--cpd-color-bg-canvas-default`, donc les
en-têtes s'y fondent nativement et les tokens Compound par défaut y sont déjà contrastés.

⚠️ **Au prochain rebase upstream** : vérifier que `.stickyRow` et `.stickyBackground` existent
toujours sous ces noms, et que `RoomListPanel.tsx` rend toujours un `<nav className="mx_RoomListPanel">`.

**Espaces (space panel) — liseré et alignement :**

Le `selectionWrapper` en mode narrow (barre repliée) reçoit `padding:1px; border:3px solid transparent`
dans `_la-bulle-overrides.pcss`. Cela reproduit l'équilibre 4px constant (inactif : 1px pad + 3px bord
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

| Élément                                                                         | Fond (clair)          | Ratio clair | Fond (sombre)          | Ratio sombre |
| ------------------------------------------------------------------------------- | --------------------- | ----------- | ---------------------- | ------------ |
| Initiales d'avatar                                                              | bg-decorative saturé  | ~5,2:1 ✓    | bg-decorative saturé   | ~5,2:1 ✓     |
| Chip filtre sélectionné                                                         | indigo-900 `#5851fb`  | 5,27:1 ✓    | indigo-900 `#b2c0ff`   | 10,5:1 ✓     |
| Chip filtre désélectionné (label)                                               | indigo-300 `#edf1ff`  | 14,9:1 ✓    | indigo-300 `#3425ac`   | 9,0:1 ✓      |
| Pastille non-lus                                                                | indigo-900 `#5851fb`  | 5,27:1 ✓    | indigo-900 `#b2c0ff`   | 10,5:1 ✓     |
| Nom de salon / titre en-tête                                                    | indigo-300            | ≥14:1 ✓     | indigo-300             | ≥9:1 ✓       |
| Noms d'auteurs (timeline)                                                       | canvas blanc `#fff`   | ~5,2:1 ✓    | canvas `#101317`       | ~7:1 ✓       |
| Texte secondaire (aperçus, etc.)                                                | indigo-300            | 4,65:1 ✓    | indigo-300 sombre      | 5,9:1 ✓      |
| Texte secondaire sur bulle « moi » (heure, « Message supprimé », « (modifié) ») | indigo-400 `#dde5ff`  | 5,19:1 ✓    | green-700 `#005a43`    | 4,66:1 ✓     |
| Bulle « moi » vs fond de timeline                                               | `#dde5ff` vs `#fff`   | 1,18:1 ⚠️   | `#005a43` vs `#101317` | 2,25:1 ⚠️    |
| Bordure chip désélectionné (crit. 3.3)                                          | vs panneau indigo-300 | 3,12:1 ✓    | vs panneau             | 4,6:1 ✓      |

Notes implémentation :

- **Noms d'auteurs en mode sombre** : `--cpd-color-text-decorative-1..6` dans
  `la-bulle-dark/_la-bulle-tokens.pcss` sont éclaircis (découplés de `bg-decorative`) pour passer
  4,5:1 sur le canvas sombre `#101317`. Les fonds d'avatar restent saturés (initiales blanches OK).
- **Texte secondaire sombre** : override `--cpd-color-text-secondary` → `gray-1200` (`#bdc3cc`)
  scoped sur `.mx_RoomListPanel`, `.mx_RightPanel`, `.mx_SpacePanel.newUi` dans le fichier sombre.
- **Texte secondaire sur bulle « moi »** : la bulle est indigo-400 `#dde5ff` en clair et
  green-700 `#005a43` en sombre (cf. ci-dessous). L'exigence s'inverse : fond clair → texte
  foncé, fond sombre → texte clair. Mécanisme : repointage de `--cpd-color-text-secondary`
  dans le scope `.mx_EventTile[data-layout="bubble"][data-self="true"]` — la **bulle entière**,
  et non le seul `.mx_MessageTimestamp` comme avant SCAT-33. Les autres textes secondaires de la
  bulle vivent dans `packages/shared-components` avec des classes CSS-module hashées, donc sans
  sélecteur stable à cibler un par un ; un seul scope couvre l'heure
  (`MessageTimestampView`), « Message supprimé » (`RedactedBodyView`) et « (modifié) »
  (`TextualBodyView .annotation`, 12px). On repointe une variable au lieu de surcharger `color`
  pour éviter tout conflit de spécificité avec ces classes hashées.
  `gray-1000` (`#595e67`) → 5,19:1 en clair (`_la-bulle-overrides.pcss`) ;
  `gray-1200` (`#bdc3cc`) → 4,66:1 en sombre (`_la-bulle-dark-overrides.pcss`).
- **Fond de la bulle « moi » en sombre** : Element pose `green-300` `#002513`, soit 1,13:1
  seulement avec le fond de timeline `#101317` — bulle quasi indiscernable. Relevé à `green-700`
  `#005a43` (2,25:1) dans `_la-bulle-dark-vars.pcss`. `green-800` `#007a62` atteindrait le seuil
  3:1 du crit. 3.3 mais ferait tomber le texte secondaire de la bulle à 2,99:1 ; `green-700` est
  le compromis retenu. À noter que la bulle « autre » d'Element en sombre (`gray-300` `#1d1f24`)
  est **elle aussi à 1,13:1** : le faible contraste des bulles en sombre est un comportement
  natif d'Element, pas une spécificité La Bulle.
- **Icônes des `IconButton` secondary (clair)** : les règles `[data-kind="secondary"]` de
  `_la-bulle-tokens.pcss` excluent `[class*="icon-button"]` et `[class*="destructive"]`.
  `<IconButton>` pose lui aussi `data-kind`, si bien que ces règles l'attrapaient et
  neutralisaient son `noBackground` : sur un `Toast`, Compound force l'icône en
  `--cpd-color-icon-on-solid-primary` (= `#ffffff` en clair) avec `!important` hors survol, d'où
  une croix blanche sur pastille blanche, invisible au repos (SCAT-33). L'exclusion de
  `destructive` est **explicite** et non laissée à une course à la spécificité : elle garantit le
  rouge critique quels que soient les sélecteurs ajoutés ensuite.
  Les bulles des autres (fond gris Compound) restent non affectées.
- En mode **clair** le texte secondaire des panneaux (4,65:1) est au seuil WCAG AA — conforme mais
  sans marge. Si une future évolution modifie le fond périvenche, à revalider.

⚠️ **Au prochain rebase upstream** : vérifier que `MessageTimestampView.module.css` consomme
toujours `var(--cpd-color-text-secondary)` et que le timestamp porte la classe stable
`.mx_MessageTimestamp` ; que la bulle « moi » reste `[data-layout="bubble"][data-self="true"]`
(`_EventBubbleTile.pcss`).

**Logo Skolengo :**

Le logo (`.mx_SpacePanel_logo`, `<img>` nu 36×36) est rendu sur fond blanc circulaire via
`.mx_SpacePanel .mx_SpacePanel_logo` avec `background-color:#fff; border-radius:50%; padding:4px;
box-sizing:border-box`.

**Itérations possibles :**

- Ajouter une variante HC `la-bulle-light-hc` et l'enregistrer dans `HIGH_CONTRAST_THEMES`.
- Remap optionnel des échelles EMS pour les états succès/erreur/info (comme dans l'ancien plan
  `config.json`), si l'on veut aligner aussi ces palettes sur les teintes EMS exactes.
- Les translucides `--cpd-color-alpha-*` ne sont pas teintés (impact visuel mineur).
