# Diff fonctionnel Element Web — v1.12.8 → v1.12.22

Synthèse fonctionnelle réalisée à partir des _release notes_ GitHub officielles
([element-hq/element-web](https://github.com/element-hq/element-web/releases)).
Le bruit technique interne (migrations d'icônes SVG/Compound, refactors MVVM,
corrections de tests) a été volontairement écarté pour ne conserver que les
évolutions ayant un impact fonctionnel visible.

---

## 🟢 Fonctionnalités ajoutées

### Liste des salons _(chantier majeur de la période)_

De loin l'évolution la plus importante, portée principalement par
@florianduros et @MidhunSureshR :

- **Sections personnalisées** : création, édition, suppression de sections dans la liste des salons _(v1.12.16 → v1.12.22)_
- **Glisser-déposer** des salons dans les sections _(v1.12.19)_
- **Panneaux repliables** : la liste peut être repliée, clic sur le séparateur pour ré-étendre à la dernière largeur _(v1.12.14)_
- **Tout replier / tout étendre** les sections, avec icône dédiée dans l'en-tête _(v1.12.18, v1.12.22)_
- **Tri par non-lus** (unread sorting) _(v1.12.10)_
- **Bascule d'aperçu des messages** dans l'en-tête de la liste _(v1.12.10)_
- **Notifications et marqueurs d'activité** sur les en-têtes de sections _(v1.12.16, v1.12.22)_
- Refonte visuelle : meilleur contraste, suppression du gras sur le salon sélectionné, nouveau design du séparateur servant de bordure _(v1.12.11, v1.12.12, v1.12.22)_

### Appels (Element Call)

- **Nouveau design picture-in-picture** pour Element Call _(v1.12.13)_
- **Tuiles d'appel dans la timeline** : appel démarré, appel décliné, meilleur alignement en layouts moderne/bulle _(v1.12.19)_
- **Notifications OS natives** pour les appels Element entrants + refonte des toasts d'appel entrant, bouton renommé « Décliner » _(v1.12.18, v1.12.19)_

### Menu utilisateur & statut

- **Refonte complète du menu utilisateur** _(v1.12.19)_, avec **statut utilisateur** affiché dans le menu, sur l'icône de profil et dans la timeline _(v1.12.18, v1.12.22)_
- **Nouvelle boîte de dialogue de confirmation de déconnexion** + retour sur la page d'accueil au logout _(v1.12.18, v1.12.21)_

### Sécurité / chiffrement

- **« Partager l'historique chiffré » promu hors des labs** (fonctionnalité stable) _(v1.12.18)_
- Support MSC4362 : **événements d'état chiffrés** _(v1.12.8)_
- **Blocage d'invitations** MSC4380 en support stable _(v1.12.12)_
- **Confirmation avant d'inviter des utilisateurs inconnus** dans un salon/DM _(v1.12.18)_
- **Masquage des noms d'utilisateurs bannis derrière un spoiler** _(v1.12.12 / v1.12.14)_
- Rappel périodique si l'appareil reste non-vérifié ; toast « Vérifier cet appareil » même sans salon chiffré _(v1.12.18, v1.12.21)_
- Refonte de la gestion de la visibilité de l'historique (badges, bannière, valeur par défaut « invited » pour DM/nouveaux salons) _(v1.12.8 → v1.12.11)_

### Aperçus de liens (URL previews)

- **Refonte des aperçus de liens** _(v1.12.18)_
- Désactivation par message via un indice, désactivation si le homeserver le désactive _(v1.12.18, v1.12.22)_
- Masquage des spoilers dans les notifications bureau _(v1.12.16)_

### OIDC / connexion

- Support MSC4191 (paramètre de gestion de compte) et MSC4312 (stage `m.oauth`) _(v1.12.9)_
- Bascule OIDC vers `response_mode=fragment` avec repli `query` _(v1.12.16)_
- **Connexion par QR code** (MSC4108 v2024, en labs) + régénération du QR s'il expire _(v1.12.18, v1.12.22)_

### API Modules _(pour développeurs d'extensions)_

Nombreux ajouts : API permissions de widgets, boutons d'en-tête de salon/widget,
composant login, **API Composer**, mécanisme d'upload de fichiers, montée
jusqu'à Module API 1.14.0 _(v1.12.13 → v1.12.21)_

### Divers

- Application locale des règles de rétention MSC1763 _(v1.12.22)_
- Support de l'événement `m.recent_emoji` (emojis récents synchronisés) _(v1.12.21)_
- `additional_creators` dans `/upgraderoom` (MSC4289) _(v1.12.10)_
- Téléchargement local des logs même sans URL de rageshake configurée _(v1.12.9)_
- Nom de marque configurable dans les noms de fichiers d'export de conversation _(v1.12.21)_

---

## 🔴 Supprimé / retiré / renommé

- **Bannière « L'historique peut être partagé »** supprimée, remplacée par une **icône dans l'en-tête du salon** + badge dans le panneau d'info _(v1.12.10)_
- **Statut/résumés Server ACL retirés de la timeline** _(v1.12.11)_
- **Fonctionnalité labs « Report to Moderators » (MSC3215) supprimée** _(v1.12.19)_
- **Low Bandwidth déplacé des paramètres vers les devtools** _(v1.12.16)_
- **Signalement d'erreur automatique** : suppression des rageshakes automatiques (UTD, key backup non configuré) et de la feature labs `automaticErrorReporting` _(v1.12.11, v1.12.13)_
- Config `element_call.participant_limit` supprimée _(v1.12.8)_
- Réglage `UIFeature.BulkUnverifiedSessionsReminder` supprimé _(v1.12.11)_
- Annonces de sortie (nouveaux sons & room list) retirées _(v1.12.8)_
- **Liens sans protocole désormais interdits** dans le texte _(v1.12.16)_
- Bouton toast d'appel entrant **renommé** vers « Décliner » _(v1.12.19)_

---

## ⚠️ Notes de contexte

- **v1.12.15** : release technique uniquement (correctif du workflow de release Desktop), identique à la v1.12.14.
- **v1.12.17** et **v1.12.20** : purement des correctifs (OIDC desktop / photo de profil du menu), aucune nouveauté fonctionnelle.
