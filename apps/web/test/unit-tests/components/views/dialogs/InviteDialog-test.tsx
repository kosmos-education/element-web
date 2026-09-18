/*
 Copyright 2026 Element Creations Ltd.

 SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen } from "jest-matrix-react";

import InviteDialog from "../../../../../src/components/views/dialogs/InviteDialog";
import { InviteKind } from "../../../../../src/components/views/dialogs/InviteDialogTypes";
import UserIdentifierCustomisations from "../../../../../src/customisations/UserIdentifier";
import SdkConfig from "../../../../../src/SdkConfig";
import { SDKContextClass } from "../../../../../src/contexts/SDKContextClass";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import { getMockClientWithEventEmitter, mockClientMethodsUser, mkStubRoom } from "../../../../test-utils";

describe("InviteDialog", () => {
    const roomId = "!room:example.com";
    const userId = "@alice:example.com";

    const renderDialog = (): void => {
        const client = getMockClientWithEventEmitter({
            ...mockClientMethodsUser(userId),
            getRoom: jest.fn(),
            getRooms: jest.fn().mockReturnValue([]),
            getVisibleRooms: jest.fn().mockReturnValue([]),
            getAccountData: jest.fn(),
            isRoomEncrypted: jest.fn().mockReturnValue(false),
            getIdentityServerUrl: jest.fn(),
            getClientWellKnown: jest.fn().mockReturnValue({}),
        });
        client.getRoom.mockReturnValue(mkStubRoom(roomId, "Salon Direction", client));
        // @ts-ignore simplified test stub
        SDKContextClass.instance._client = client;
        jest.spyOn(DMRoomMap, "shared").mockReturnValue({
            getUniqueRoomsWithIndividuals: jest.fn().mockReturnValue({}),
        } as unknown as DMRoomMap);

        render(<InviteDialog kind={InviteKind.Invite} roomId={roomId} onFinished={jest.fn()} />);
    };

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("shows the upstream help text when no customisation is active", () => {
        renderDialog();

        expect(screen.getByText(userId)).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "share this room" })).toBeInTheDocument();
    });

    // Kosmos (SCAT-65) : l'exemple d'identifiant Matrix est injecté en dur par l'amont, sans
    // passer par la customisation qui le masque (SCAT-40).
    it("shows neither the identifier nor the share link when the identifier is hidden", () => {
        jest.spyOn(UserIdentifierCustomisations, "getDisplayUserIdentifier").mockReturnValue(null);

        renderDialog();

        expect(screen.getByText("Invite someone using their name or username.")).toBeInTheDocument();
        expect(screen.queryByText(userId)).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "share this room" })).not.toBeInTheDocument();
    });

    // Kosmos (SCAT-65) : le lien du texte d'aide est le quatrième point d'entrée du partage de
    // lien de salon, oublié par SCAT-48.
    it("drops the share link when hide_share_room is set", () => {
        SdkConfig.add({ hide_share_room: true });

        try {
            renderDialog();

            expect(screen.getByText("Invite someone using their name or username.")).toBeInTheDocument();
            expect(screen.queryByRole("link", { name: "share this room" })).not.toBeInTheDocument();
        } finally {
            SdkConfig.reset();
        }
    });
});
