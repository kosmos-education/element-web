/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { mocked } from "jest-mock";
import { type MatrixClient, type Room, RoomMember, type User } from "matrix-js-sdk/src/matrix";
import { logRoles, render, screen } from "jest-matrix-react";

import { createTestClient, mkStubRoom } from "../../../../../test-utils";
import {
    type UserInfoBasicState,
    useUserInfoBasicViewModel,
} from "../../../../../../src/components/viewmodels/right_panel/user_info/UserInfoBasicViewModel";
import { UserInfoBasicView } from "../../../../../../src/components/views/right_panel/user_info/UserInfoBasicView";
import MatrixClientContext from "../../../../../../src/contexts/MatrixClientContext";
import SdkConfig from "../../../../../../src/SdkConfig";

const defaultRoomPermissions = {
    canEdit: true,
    canInvite: true,
    modifyLevelMax: -1,
};
jest.mock("../../../../../../src/components/viewmodels/right_panel/user_info/UserInfoBasicViewModel", () => ({
    useUserInfoBasicViewModel: jest.fn(),
    useRoomPermissions: () => defaultRoomPermissions,
}));

describe("<UserInfoBasic />", () => {
    const defaultValue: UserInfoBasicState = {
        powerLevels: {},
        roomPermissions: defaultRoomPermissions,
        pendingUpdateCount: 0,
        isMe: false,
        isRoomDMForMember: false,
        showDeactivateButton: true,
        onSynapseDeactivate: jest.fn(),
        startUpdating: jest.fn(),
        stopUpdating: jest.fn(),
    };

    const defaultRoomId = "!fkfk";
    const defaultUserId = "@user:example.com";

    const defaultMember = new RoomMember(defaultRoomId, defaultUserId);
    let defaultRoom: Room;

    let defaultProps: { member: User | RoomMember; room: Room };
    let matrixClient: MatrixClient;

    const renderComponent = (props = defaultProps) => {
        return render(
            <MatrixClientContext.Provider value={matrixClient}>
                <UserInfoBasicView {...props} />
            </MatrixClientContext.Provider>,
        );
    };
    beforeEach(() => {
        matrixClient = createTestClient();
        defaultRoom = mkStubRoom(defaultRoomId, defaultRoomId, matrixClient);
        defaultProps = {
            member: defaultMember,
            room: defaultRoom,
        };
    });

    it("should display the defaut values", () => {
        mocked(useUserInfoBasicViewModel).mockReturnValue(defaultValue);
        const { container } = renderComponent();
        logRoles(container);
        expect(container).toMatchSnapshot();
    });

    it("should not show ignore button if user is me", () => {
        const state: UserInfoBasicState = { ...defaultValue, isMe: true };
        mocked(useUserInfoBasicViewModel).mockReturnValue(state);
        renderComponent();

        const ignoreButton = screen.queryByRole("button", { name: "Ignore" });
        expect(ignoreButton).not.toBeInTheDocument();
    });

    // Kosmos (SCAT-51) : action masquée via config.json `hide_ignore_user`.
    describe("ignore user", () => {
        it("shows the ignore button by default", () => {
            mocked(useUserInfoBasicViewModel).mockReturnValue(defaultValue);
            renderComponent();

            expect(screen.getByRole("button", { name: "Ignore" })).toBeInTheDocument();
        });

        it("hides the ignore button when hide_ignore_user is set", () => {
            SdkConfig.add({ hide_ignore_user: true });
            mocked(useUserInfoBasicViewModel).mockReturnValue(defaultValue);

            try {
                renderComponent();

                expect(screen.queryByRole("button", { name: "Ignore" })).not.toBeInTheDocument();
                // le bloc voisin reste présent
                expect(screen.getByRole("button", { name: "Deactivate user" })).toBeInTheDocument();
            } finally {
                SdkConfig.reset();
            }
        });
    });

    it("should not show deactivate button", () => {
        const state: UserInfoBasicState = { ...defaultValue, showDeactivateButton: false };
        mocked(useUserInfoBasicViewModel).mockReturnValue(state);
        renderComponent();

        const deactivateButton = screen.queryByRole("button", { name: "Deactivate user" });
        expect(deactivateButton).not.toBeInTheDocument();
    });

    it("should not show powerlevels selector for dm", () => {
        const state: UserInfoBasicState = { ...defaultValue, isRoomDMForMember: true };
        mocked(useUserInfoBasicViewModel).mockReturnValue(state);
        const { container } = renderComponent();

        logRoles(container);
        const powserlevel = screen.queryByRole("option", { name: "Default" });
        expect(powserlevel).not.toBeInTheDocument();
    });

    it("should show spinner if pending update is > 0", () => {
        const state: UserInfoBasicState = { ...defaultValue, pendingUpdateCount: 2 };
        mocked(useUserInfoBasicViewModel).mockReturnValue(state);
        renderComponent();

        const spinner = screen.getByTestId("spinner");
        expect(spinner).toBeInTheDocument();
    });
});
