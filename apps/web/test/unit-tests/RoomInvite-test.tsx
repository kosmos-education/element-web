/*
 Copyright 2026 Element Creations Ltd.

 SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen } from "jest-matrix-react";
import { type Room } from "matrix-js-sdk/src/matrix";

import { showAnyInviteErrors } from "../../src/RoomInvite";
import Modal from "../../src/Modal";
import UserIdentifierCustomisations from "../../src/customisations/UserIdentifier";
import type MultiInviter from "../../src/utils/MultiInviter";
import { InviteState } from "../../src/utils/MultiInviter";
import { getMockClientWithEventEmitter, mockClientMethodsUser } from "../test-utils";
import { DirectoryMember } from "../../src/utils/direct-messages";

describe("showAnyInviteErrors", () => {
    const roomId = "!room:example.com";

    /** Rend la description passée au dialogue d'erreur, pour inspecter la tuile qu'elle contient. */
    const renderErrorDialog = (): void => {
        const client = getMockClientWithEventEmitter({
            ...mockClientMethodsUser(),
            getUser: jest.fn().mockReturnValue(null),
        });
        const room = { roomId, name: "Salon Direction", client } as unknown as Room;
        const inviter = {
            fatal: false,
            getErrorText: jest.fn().mockReturnValue("L’utilisateur est déjà dans ce salon"),
        } as unknown as MultiInviter;
        const userMap = new Map([
            ["@alice:example.com", new DirectoryMember({ user_id: "@alice:example.com", display_name: "Alice" })],
        ]);

        const createDialog = jest.spyOn(Modal, "createDialog").mockReturnValue({} as never);
        showAnyInviteErrors({ "@alice:example.com": InviteState.Error }, room, inviter, userMap);

        const { description } = createDialog.mock.calls[0][1] as { description: React.ReactNode };
        render(<div>{description}</div>);
    };

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("shows the identifier supplied by the customisation", () => {
        renderErrorDialog();

        expect(screen.getByText("Alice")).toBeInTheDocument();
        expect(screen.getByText("@alice:example.com")).toBeInTheDocument();
    });

    // Kosmos (SCAT-65) : cette tuile affichait `user.userId` en dur, sans passer par la
    // customisation qui masque l'identifiant Matrix (SCAT-40).
    it("shows no identifier when the customisation hides it", () => {
        jest.spyOn(UserIdentifierCustomisations, "getDisplayUserIdentifier").mockReturnValue(null);

        renderErrorDialog();

        expect(screen.getByText("Alice")).toBeInTheDocument();
        expect(screen.queryByText("@alice:example.com")).not.toBeInTheDocument();
        expect(screen.getByText("L’utilisateur est déjà dans ce salon")).toBeInTheDocument();
    });
});
