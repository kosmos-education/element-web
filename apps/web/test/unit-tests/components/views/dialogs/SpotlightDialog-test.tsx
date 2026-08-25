/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { mocked } from "jest-mock";
import {
    type IProtocol,
    type IPublicRoomsChunkRoom,
    type MatrixClient,
    type Room,
    type RoomMember,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import sanitizeHtml from "sanitize-html";
import { fireEvent, render, screen } from "jest-matrix-react";

import SpotlightDialog from "../../../../../src/components/views/dialogs/spotlight/SpotlightDialog";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import { LocalRoom, LOCAL_ROOM_ID_PREFIX } from "../../../../../src/models/LocalRoom";
import { startDmOnFirstMessage } from "../../../../../src/utils/direct-messages";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import { flushPromisesWithFakeTimers, mkRoom, stubClient } from "../../../../test-utils";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../../../src/settings/SettingLevel";
import defaultDispatcher from "../../../../../src/dispatcher/dispatcher";
import SdkConfig from "../../../../../src/SdkConfig";
import { Action } from "../../../../../src/dispatcher/actions";

jest.useFakeTimers();

jest.mock("../../../../../src/utils/Feedback");

jest.mock("../../../../../src/utils/direct-messages", () => ({
    // @ts-ignore
    ...jest.requireActual("../../../../../src/utils/direct-messages"),
    startDmOnFirstMessage: jest.fn(),
}));

jest.mock("../../../../../src/dispatcher/dispatcher", () => ({
    register: jest.fn(),
    dispatch: jest.fn(),
}));

interface IUserChunkMember {
    user_id: string;
    display_name?: string;
    avatar_url?: string;
}

interface MockClientOptions {
    userId?: string;
    homeserver?: string;
    thirdPartyProtocols?: Record<string, IProtocol>;
    rooms?: IPublicRoomsChunkRoom[];
    members?: RoomMember[];
    users?: IUserChunkMember[];
}

function mockClient({
    userId = "testuser",
    homeserver = "example.tld",
    thirdPartyProtocols = {},
    rooms = [],
    members = [],
    users = [],
}: MockClientOptions = {}): MatrixClient {
    stubClient();
    const cli = MatrixClientPeg.safeGet();
    cli.getUserId = jest.fn(() => userId);
    cli.getDomain = jest.fn(() => homeserver);
    cli.getHomeserverUrl = jest.fn(() => homeserver);
    cli.getThirdpartyProtocols = jest.fn(() => Promise.resolve(thirdPartyProtocols));
    cli.publicRooms = jest.fn((options) => {
        const searchTerm = options?.filter?.generic_search_term?.toLowerCase();
        const chunk = rooms.filter(
            (it) =>
                !searchTerm ||
                it.room_id.toLowerCase().includes(searchTerm) ||
                it.name?.toLowerCase().includes(searchTerm) ||
                sanitizeHtml(it?.topic || "", { allowedTags: [] })
                    .toLowerCase()
                    .includes(searchTerm) ||
                it.canonical_alias?.toLowerCase().includes(searchTerm) ||
                it.aliases?.find((alias) => alias.toLowerCase().includes(searchTerm)),
        );
        return Promise.resolve({
            chunk,
            total_room_count_estimate: chunk.length,
        });
    });
    cli.searchUserDirectory = jest.fn(({ term, limit }) => {
        const searchTerm = term?.toLowerCase();
        const results = users.filter(
            (it) =>
                !searchTerm ||
                it.user_id.toLowerCase().includes(searchTerm) ||
                it.display_name?.toLowerCase().includes(searchTerm),
        );
        return Promise.resolve({
            results: results.slice(0, limit ?? +Infinity),
            limited: !!limit && limit < results.length,
        });
    });
    cli.getProfileInfo = jest.fn(async (userId) => {
        const member = members.find((it) => it.userId === userId);
        if (member) {
            return Promise.resolve({
                displayname: member.rawDisplayName,
                avatar_url: member.getMxcAvatarUrl(),
            });
        } else {
            return Promise.reject();
        }
    });
    return cli;
}

describe("Spotlight Dialog", () => {
    const testPerson: IUserChunkMember = {
        user_id: "@janedoe:matrix.org",
        display_name: "Jane Doe",
        avatar_url: undefined,
    };

    const testPublicRoom: IPublicRoomsChunkRoom = {
        room_id: "!room247:matrix.org",
        name: "Room #247",
        topic: "We hope you'll have a <b>shining</b> experience!",
        world_readable: false,
        num_joined_members: 1,
        guest_can_join: false,
    };

    const testDMRoomId = "!testDM:example.com";
    const testDMUserId = "@alice:matrix.org";

    let testRoom: Room;
    let testDM: Room;
    let testLocalRoom: LocalRoom;

    let mockedClient: MatrixClient;

    beforeEach(() => {
        SdkConfig.reset();
        localStorage.clear();
        SettingsStore.reset();
        mockedClient = mockClient({ rooms: [testPublicRoom], users: [testPerson] });
        testRoom = mkRoom(mockedClient, "!test23:example.com");
        mocked(testRoom.getMyMembership).mockReturnValue(KnownMembership.Join);
        testLocalRoom = new LocalRoom(LOCAL_ROOM_ID_PREFIX + "test23", mockedClient, mockedClient.getUserId()!);
        testLocalRoom.updateMyMembership(KnownMembership.Join);
        mocked(mockedClient.getVisibleRooms).mockReturnValue([testRoom, testLocalRoom]);

        jest.spyOn(DMRoomMap, "shared").mockReturnValue({
            getUserIdForRoomId: jest.fn(),
        } as unknown as DMRoomMap);

        testDM = mkRoom(mockedClient, testDMRoomId);
        testDM.name = "Chat with Alice";
        mocked(testDM.getMyMembership).mockReturnValue(KnownMembership.Join);

        mocked(DMRoomMap.shared().getUserIdForRoomId).mockImplementation((roomId: string) => {
            if (roomId === testDMRoomId) {
                return testDMUserId;
            }
            return undefined;
        });

        mocked(mockedClient.getVisibleRooms).mockReturnValue([testRoom, testLocalRoom, testDM]);
    });

    describe("when MSC3946 dynamic room predecessors is enabled", () => {
        beforeEach(async () => {
            await SettingsStore.setValue("feature_dynamic_room_predecessors", null, SettingLevel.DEVICE, true);
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it("should call getVisibleRooms with MSC3946 dynamic room predecessors", async () => {
            render(<SpotlightDialog onFinished={() => null} />);
            jest.advanceTimersByTime(200);
            await flushPromisesWithFakeTimers();
            expect(mockedClient.getVisibleRooms).toHaveBeenCalledWith(true);
        });
    });

    // kosmos: la recherche ne propose plus aucun filtre — ni personnes (SCAT-14),
    // ni salons ou espaces publics (SCAT-43). Garde-fou contre une réintroduction.
    it("offers no filter entry at all", async () => {
        render(<SpotlightDialog initialText={testPerson.display_name} onFinished={() => null} />);
        jest.advanceTimersByTime(200);
        await flushPromisesWithFakeTimers();

        expect(document.querySelector("#mx_SpotlightDialog_button_startChat")).not.toBeInTheDocument();
        expect(document.querySelector("#mx_SpotlightDialog_button_explorePublicRooms")).not.toBeInTheDocument();
        expect(document.querySelector("#mx_SpotlightDialog_button_explorePublicSpaces")).not.toBeInTheDocument();
        // et aucune puce de filtre ne peut donc s'afficher
        expect(document.querySelector("div.mx_SpotlightDialog_filter")).not.toBeInTheDocument();
    });

    describe("searching for rooms", () => {
        let options: NodeListOf<Element>;

        beforeAll(async () => {
            render(<SpotlightDialog initialText="test23" onFinished={() => null} />);
            // search is debounced
            jest.advanceTimersByTime(200);
            await flushPromisesWithFakeTimers();

            const content = document.querySelector("#mx_SpotlightDialog_content")!;
            options = content.querySelectorAll("li.mx_SpotlightDialog_option");
        });

        it("should find Rooms", () => {
            // kosmos: 1 salon + la seule entrée restante des « autres recherches » (Messages).
            // Était 4 : les entrées « salons publics » et « espaces publics » ont été retirées (SCAT-43),
            // et le résultat DM l'avait été par SCAT-14.
            expect(options).toHaveLength(2);
            expect(options[0]!.innerHTML).toContain(testRoom.name);
        });

        it("should not find LocalRooms", () => {
            expect(options).toHaveLength(2);
            expect(options[0]!.innerHTML).not.toContain(testLocalRoom.name);
        });
    });

    // kosmos: people search is fully disabled — no directory query, no people results, no DM creation
    it("never searches for people nor starts a DM", async () => {
        mocked(mockedClient.searchUserDirectory).mockResolvedValue({
            results: [
                { user_id: "@user1:server", display_name: "User Alpha", avatar_url: "mxc://1/avatar" },
                { user_id: "@user2:server", display_name: "User Beta", avatar_url: "mxc://2/avatar" },
            ],
            limited: false,
        });

        render(<SpotlightDialog initialText="User" onFinished={() => null} />);
        // search is debounced
        jest.advanceTimersByTime(200);
        await flushPromisesWithFakeTimers();

        // the user directory is never queried and no person is listed
        expect(mockedClient.searchUserDirectory).not.toHaveBeenCalled();
        const content = document.querySelector("#mx_SpotlightDialog_content")!;
        expect(content.innerHTML).not.toContain("User Alpha");
        expect(content.innerHTML).not.toContain("User Beta");
        expect(startDmOnFirstMessage).not.toHaveBeenCalled();
    });

    it("should allow jumping into message search", async () => {
        const onFinished = jest.fn();
        render(<SpotlightDialog initialText="search term" onFinished={onFinished} />);
        jest.advanceTimersByTime(200);
        await flushPromisesWithFakeTimers();

        fireEvent.click(screen.getByText("Messages"));

        expect(defaultDispatcher.dispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                action: Action.FocusMessageSearch,
                initialText: "search term",
            }),
        );
    });

    describe("keyboard prompt query checks", () => {
        it("should show left and right arrow keys in keyboard hint when there is no query", async () => {
            render(<SpotlightDialog onFinished={() => null} />);
            jest.advanceTimersByTime(200);
            await flushPromisesWithFakeTimers();

            const keyboardPrompt = document.querySelector("#mx_SpotlightDialog_keyboardPrompt");
            expect(keyboardPrompt).toBeInTheDocument();
            expect(keyboardPrompt?.textContent).toContain("←");
            expect(keyboardPrompt?.textContent).toContain("→");
        });

        it("should not show left and right arrow keys in keyboard hint when query is present", async () => {
            render(<SpotlightDialog initialText="test query" onFinished={() => null} />);
            jest.advanceTimersByTime(200);
            await flushPromisesWithFakeTimers();

            const keyboardPrompt = document.querySelector("#mx_SpotlightDialog_keyboardPrompt");
            expect(keyboardPrompt).toBeInTheDocument();
            expect(keyboardPrompt?.textContent).not.toContain("←");
            expect(keyboardPrompt?.textContent).not.toContain("→");
        });
    });
});
