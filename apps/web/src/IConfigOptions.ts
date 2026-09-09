/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2022 The Matrix.org Foundation C.I.C.
Copyright 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ResolveDefaults, type WebConfigJson } from "shared-types";

import { type ValidatedServerConfig } from "./utils/ValidatedServerConfig";
import { type DEFAULTS } from "./SdkConfig.ts";

/**
 * Bug reports are enabled but must only be locally
 * downloadable.
 */
export const BugReportEndpointURLLocal = "local";

export interface ConfigOptions extends WebConfigJson {
    /**
     * This is not a real config field, we're just abusing the config structure to pass around a validated server config
     */
    validated_server_config?: ValidatedServerConfig;

    /**
     * Kosmos: identifiants d'onglets (`UserTab`) à masquer dans la modale de paramétrage utilisateur.
     * Ex. ["USER_SESSION_MANAGER_TAB", "USER_SECURITY_TAB"]. Absent/vide ⇒ aucun onglet masqué.
     */
    disable_settings_tabs?: string[];
    /**
     * Kosmos: liste blanche des codes de langue (`fr`, `en`, ...) proposés dans les sélecteurs de langue
     * (paramètres utilisateur et écran de connexion). Absent/vide ⇒ toutes les langues restent proposées.
     */
    available_languages?: string[];
    /**
     * Kosmos: masque l'identifiant technique du salon (alias Matrix, ex. `#salon:homeserver`)
     * affiché sous le nom du salon dans le panneau latéral d'information.
     * Absent/false ⇒ comportement amont inchangé.
     */
    hide_room_alias?: boolean;
    /**
     * Kosmos: identifiants d'onglets (`RoomSettingsTab`) à masquer dans la modale de paramétrage
     * du salon. Ex. ["ROOM_VOIP_TAB", "ROOM_POLL_HISTORY_TAB", "ROOM_ADVANCED_TAB"].
     * Absent/vide ⇒ aucun onglet masqué.
     */
    disable_room_settings_tabs?: string[];
    /**
     * Kosmos: masque la section « Adresses du salon » (adresses publiées et adresses locales)
     * de l'onglet Général de la modale de paramétrage du salon.
     * Absent/false ⇒ comportement amont inchangé.
     */
    hide_room_addresses?: boolean;
    /**
     * Kosmos: masque la section « Chiffrement » de l'onglet « Sécurité et vie privée » de la
     * modale de paramétrage du salon. Absent/false ⇒ comportement amont inchangé.
     */
    hide_room_encryption_section?: boolean;
    /**
     * Kosmos: masque l'option « Signaler » du menu contextuel d'un message, qui envoie un
     * signalement de contenu à l'administrateur du serveur d'accueil.
     * Absent/false ⇒ comportement amont inchangé.
     */
    hide_report_content?: boolean;
    /**
     * Kosmos: masque l'action « Signaler le salon » : le bouton du panneau latéral d'information
     * du salon et la bascule de signalement du dialogue de refus d'invitation.
     * Absent/false ⇒ comportement amont inchangé.
     */
    hide_report_room?: boolean;
    /**
     * Kosmos: masque le partage d'un lien vers un message : l'option « Partager » du menu
     * contextuel d'un message et l'option « Copier le lien vers le fil » du menu contextuel
     * d'un fil de discussion. Absent/false ⇒ comportement amont inchangé.
     */
    hide_share_content?: boolean;
    /**
     * Kosmos: masque le partage d'un lien vers un salon sur ses trois points d'entrée : le
     * panneau latéral d'information, le menu d'un salon de la liste et le menu contextuel
     * d'un résultat du Spotlight. Absent/false ⇒ comportement amont inchangé.
     */
    hide_share_room?: boolean;
    /**
     * Kosmos: masque l'entrée « Partager le profil » du panneau latéral d'information d'un
     * utilisateur, qui ouvre le dialogue de partage d'un lien vers son profil.
     * Absent/false ⇒ comportement amont inchangé.
     */
    hide_share_user?: boolean;
    /**
     * Kosmos: masque l'entrée « Exporter la conversation » du panneau latéral d'information du
     * salon, qui ouvre le dialogue d'export de l'historique.
     * Absent/false ⇒ comportement amont inchangé.
     */
    hide_export_chat?: boolean;
    /**
     * Kosmos: masque l'option « Afficher la source » du menu contextuel d'un message, qui ouvre
     * le dialogue affichant le JSON brut de l'événement Matrix.
     * Absent/false ⇒ comportement amont inchangé.
     */
    hide_view_source?: boolean;
    /**
     * Kosmos: masque la ligne « Ignorer » / « Ne plus ignorer » du panneau latéral d'information
     * d'un utilisateur, qui masque côté client tous les messages du membre.
     * Absent/false ⇒ comportement amont inchangé.
     */
    hide_ignore_user?: boolean;
    /**
     * Kosmos: réglages propres au déploiement La Bulle.
     * `message_retention_days` : durée de conservation des messages, en jours, annoncée dans
     * l'avertissement affiché au-dessus de la zone de saisie d'un salon.
     * Absent ⇒ aucun avertissement affiché.
     */
    kosmos?: {
        message_retention_days?: number;
    };
}

/**
 * Type representing the effective config.json structure after DEFAULTS has been merged in
 */
export type IConfigOptions = ResolveDefaults<ConfigOptions, typeof DEFAULTS>;
