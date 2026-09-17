/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType, MatrixEvent, PendingEventOrdering, Room } from "matrix-js-sdk/src/matrix";

import { hasVisibleMessageContextMenuOptions } from "../../../../../src/components/views/context_menus/messageContextMenuOptions";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import SdkConfig from "../../../../../src/SdkConfig";
import { stubClient } from "../../../../test-utils";

const roomId = "!room:example.com";
const me = "@me:example.com";
const someoneElse = "@other:example.com";

/**
 * Kosmos (SCAT-64) : le bouton « … » de la barre d'actions ouvrait un panneau vide dès que les
 * masquages du lot 2 retiraient la totalité des entrées du menu. Ce prédicat décide désormais de
 * son affichage.
 */
describe("hasVisibleMessageContextMenuOptions", () => {
    let room: Room;

    /** Les trois clés du lot 2 qui peuvent vider le menu à elles seules. */
    const hideAllKosmosOptions = (): void => {
        SdkConfig.add({
            hide_view_source: true,
            hide_share_content: true,
            hide_report_content: true,
        });
    };

    /** Événement d'appartenance « X a ajouté Y », le cas remonté en recette. */
    const membershipEvent = (): MatrixEvent =>
        new MatrixEvent({
            type: EventType.RoomMember,
            sender: someoneElse,
            room_id: roomId,
            state_key: someoneElse,
            event_id: "$membership",
            content: { membership: "join" },
        });

    const setRedactionRight = (allowed: boolean): void => {
        jest.spyOn(room.currentState, "maySendRedactionForEvent").mockReturnValue(allowed);
    };

    beforeEach(() => {
        jest.restoreAllMocks();
        SdkConfig.reset();

        const client = stubClient();
        jest.spyOn(client, "getUserId").mockReturnValue(me);
        jest.spyOn(client, "getSafeUserId").mockReturnValue(me);

        room = new Room(roomId, MatrixClientPeg.safeGet(), me, {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        jest.spyOn(MatrixClientPeg.safeGet(), "getRoom").mockReturnValue(room);
        setRedactionRight(false);
    });

    afterEach(() => {
        SdkConfig.reset();
    });

    it("reports no option on a state event once the lot 2 options are hidden", () => {
        hideAllKosmosOptions();

        expect(hasVisibleMessageContextMenuOptions({ mxEvent: membershipEvent() })).toBe(false);
    });

    it("reports an option when view source is still available", () => {
        // Sans surcharge Kosmos, « Afficher la source » est toujours rendue en amont.
        expect(hasVisibleMessageContextMenuOptions({ mxEvent: membershipEvent() })).toBe(true);
    });

    it("reports an option when the user may redact the event", () => {
        hideAllKosmosOptions();
        setRedactionRight(true);

        expect(hasVisibleMessageContextMenuOptions({ mxEvent: membershipEvent() })).toBe(true);
    });

    it("reports an option when a permalink can be shared", () => {
        SdkConfig.add({ hide_view_source: true, hide_report_content: true });

        expect(
            hasVisibleMessageContextMenuOptions({
                mxEvent: membershipEvent(),
                permalink: "https://matrix.to/#/$membership",
            }),
        ).toBe(true);
    });

    it("reports an option when the event can be reported", () => {
        SdkConfig.add({ hide_view_source: true, hide_share_content: true });

        // L'événement vient de quelqu'un d'autre : « Signaler » reste proposée.
        expect(hasVisibleMessageContextMenuOptions({ mxEvent: membershipEvent() })).toBe(true);
    });

    it("reports an option when the tile hides a widget preview", () => {
        hideAllKosmosOptions();

        expect(hasVisibleMessageContextMenuOptions({ mxEvent: membershipEvent(), isWidgetHidden: true })).toBe(true);
    });

    it("reports an option when a reply chain can be collapsed", () => {
        hideAllKosmosOptions();

        expect(hasVisibleMessageContextMenuOptions({ mxEvent: membershipEvent(), canCollapseReplyChain: true })).toBe(
            true,
        );
    });

    it("reports an option when a bridge supplied an external url", () => {
        hideAllKosmosOptions();

        const event = new MatrixEvent({
            type: EventType.RoomMember,
            sender: someoneElse,
            room_id: roomId,
            state_key: someoneElse,
            event_id: "$bridged",
            content: { membership: "join", external_url: "https://example.com/source" },
        });

        expect(hasVisibleMessageContextMenuOptions({ mxEvent: event })).toBe(true);
    });
});
