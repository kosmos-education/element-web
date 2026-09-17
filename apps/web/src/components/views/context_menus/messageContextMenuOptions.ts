/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventStatus, EventType, type MatrixEvent, RelationType, M_POLL_START } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import SdkConfig from "../../../SdkConfig";
import SettingsStore from "../../../settings/SettingsStore";
import { isUrlPermitted } from "../../../HtmlUtils";
import { isContentActionable } from "../../../utils/EventUtils";
import { isPollEnded } from "../messages/MPollBody";
import { getForwardableEvent } from "../../../events/forward/getForwardableEvent";
import { getShareableLocationEvent } from "../../../events/location/getShareableLocationEvent";
import { TimelineRenderingType } from "../../../contexts/RoomContext";

/**
 * Inputs needed to tell whether {@link MessageContextMenu} would render at least one option
 * when opened from the action bar's overflow button.
 */
export interface MessageContextMenuOptionsState {
    /** Event the menu would be opened for. */
    mxEvent: MatrixEvent;
    /** Permalink to the event, when the caller can build one. */
    permalink?: string;
    /** Whether the tile currently hides a widget preview that could be unhidden. */
    isWidgetHidden?: boolean;
    /** Whether the tile sits in a reply chain that can be collapsed. */
    canCollapseReplyChain?: boolean;
    /** How the surrounding timeline is rendered, used to spot thread roots. */
    timelineRenderingType?: TimelineRenderingType;
}

/**
 * Kosmos (SCAT-64) : `MessageContextMenu` peut ne rendre aucune entrée une fois retirées celles
 * que masque `config.json` — « Afficher la source » (SCAT-50), « Partager » (SCAT-48) et
 * « Signaler » (SCAT-47). Sur un événement d'état, pour un utilisateur sans droit de suppression,
 * il ne reste alors rien, et le bouton « … » de la barre d'actions ouvrait un panneau vide.
 *
 * Ce prédicat reproduit les gardes de `MessageContextMenu.render()` pour le seul cas d'ouverture
 * depuis ce bouton, où `rightClick` vaut `false` : copier, citer, répondre, réagir, modifier et
 * épingler y sont exclus d'office, ce qui réduit l'ensemble à examiner.
 *
 * Il est délibérément *conservateur* : au moindre doute il renvoie `true`, pour ne jamais masquer
 * un bouton qui aurait ouvert un menu utile.
 *
 * ⚠️ Ces conditions sont dupliquées depuis `MessageContextMenu.render()`. Toute entrée ajoutée ou
 * retirée là-bas doit l'être ici. La suite « overflow button invariant » de
 * `MessageContextMenu-test.tsx` verrouille cet invariant en comparant ce prédicat au menu
 * réellement rendu.
 */
export function hasVisibleMessageContextMenuOptions({
    mxEvent,
    permalink,
    isWidgetHidden = false,
    canCollapseReplyChain = false,
    timelineRenderingType,
}: MessageContextMenuOptionsState): boolean {
    const cli = MatrixClientPeg.safeGet();
    const room = cli.getRoom(mxEvent.getRoomId());

    // « Afficher la source » : rendue sans condition en amont, seul `hide_view_source` la retire.
    if (!SdkConfig.get("hide_view_source")) return true;

    // « Signaler » : sur les messages des autres, sauf si `hide_report_content` la retire.
    if (mxEvent.getSender() !== cli.getUserId() && !SdkConfig.get("hide_report_content")) return true;

    // « Partager » : nécessite un permalien, sauf si `hide_share_content` la retire.
    if (permalink && !SdkConfig.get("hide_share_content")) return true;

    // « Supprimer » — et « Terminer le sondage », qui dépend du même droit.
    const canRedact =
        !!room?.currentState.maySendRedactionForEvent(mxEvent, cli.getSafeUserId()) &&
        mxEvent.getType() !== EventType.RoomServerAcl &&
        mxEvent.getType() !== EventType.RoomEncryption;
    const eventStatus = mxEvent.status;
    const isSent = !eventStatus || eventStatus === EventStatus.SENT;
    if (isSent && canRedact) return true;
    if (M_POLL_START.matches(mxEvent.getType()) && canRedact && !isPollEnded(mxEvent, cli)) return true;

    // « Renvoyer les réactions non envoyées ».
    const hasUnsentReactions = !!room?.getPendingEvents().some((e) => {
        const relation = e.getRelation();
        return (
            relation?.rel_type === RelationType.Annotation &&
            relation.event_id === mxEvent.getId() &&
            e.status === EventStatus.NOT_SENT
        );
    });
    if (!mxEvent.isRedacted() && hasUnsentReactions) return true;

    // « Ouvrir dans OpenStreetMap » et « Transférer ».
    if (getShareableLocationEvent(mxEvent, cli)) return true;
    if (isContentActionable(mxEvent) && getForwardableEvent(mxEvent, cli)) return true;

    // « Afficher l'aperçu » et « Réduire les réponses », portées par la tuile.
    if (isWidgetHidden) return true;
    if (canCollapseReplyChain) return true;

    // « Lien d'origine » posé par une passerelle.
    const externalUrl = mxEvent.getContent().external_url;
    if (typeof externalUrl === "string" && isUrlPermitted(externalUrl)) return true;

    // « Voir l'événement lié », réservée au mode développeur.
    if (mxEvent.getAssociatedId() && SettingsStore.getValue("developerMode")) return true;

    // « Voir dans le salon », sur la racine d'un fil affiché hors de la conversation.
    const isThread =
        timelineRenderingType === TimelineRenderingType.Thread ||
        timelineRenderingType === TimelineRenderingType.ThreadsList;
    if (isThread && mxEvent.getThread()?.rootEvent === mxEvent) return true;

    return false;
}
