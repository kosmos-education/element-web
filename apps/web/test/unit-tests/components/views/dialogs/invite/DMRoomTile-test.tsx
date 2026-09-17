/*
 Copyright 2026 Element Creations Ltd.

 SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen } from "jest-matrix-react";

import { DMRoomTile } from "../../../../../../src/components/views/dialogs/invite/DMRoomTile.tsx";
import { DirectoryMember, ThreepidMember } from "../../../../../../src/utils/direct-messages.ts";
import UserIdentifierCustomisations from "../../../../../../src/customisations/UserIdentifier.ts";
import { getMockClientWithEventEmitter, mockClientMethodsUser } from "../../../../../test-utils";

describe("DMRoomTile", () => {
    beforeEach(() => {
        getMockClientWithEventEmitter({
            ...mockClientMethodsUser(),
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("shows the identifier supplied by the customisation", () => {
        render(<DMRoomTile member={new DirectoryMember({ user_id: "@alice:example.com", display_name: "Alice" })} />);

        expect(screen.getByText("@alice:example.com")).toBeInTheDocument();
    });

    // Kosmos (SCAT-65) : la customisation renvoie `null` pour masquer l'identifiant Matrix
    // (SCAT-40). Le repli amont sur `member.userId` le réaffichait malgré tout.
    it("shows no identifier when the customisation hides it", () => {
        jest.spyOn(UserIdentifierCustomisations, "getDisplayUserIdentifier").mockReturnValue(null);

        render(<DMRoomTile member={new DirectoryMember({ user_id: "@alice:example.com", display_name: "Alice" })} />);

        expect(screen.getByText("Alice")).toBeInTheDocument();
        expect(screen.queryByText("@alice:example.com")).not.toBeInTheDocument();
    });

    it("keeps the email caption when the customisation hides identifiers", () => {
        jest.spyOn(UserIdentifierCustomisations, "getDisplayUserIdentifier").mockReturnValue(null);

        render(<DMRoomTile member={new ThreepidMember("charlie@example.com")} />);

        expect(screen.getByText("charlie@example.com")).toBeInTheDocument();
    });
});
