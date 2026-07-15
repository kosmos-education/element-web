/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import {
    type IPushRule,
    type IPushRules,
    RuleId,
    LOCAL_NOTIFICATION_SETTINGS_PREFIX,
    MatrixEvent,
    PushRuleActionName,
    TweakName,
    ConditionKind,
} from "matrix-js-sdk/src/matrix";
import { secureRandomString } from "matrix-js-sdk/src/randomstring";
import { fireEvent, render, screen, waitForElementToBeRemoved } from "jest-matrix-react";
import { mocked } from "jest-mock";
import userEvent from "@testing-library/user-event";
import { PushProcessor } from "matrix-js-sdk/src/pushprocessor";

import Notifications from "../../../../../src/components/views/settings/Notifications";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import { clearAllModals, getMockClientWithEventEmitter, mockClientMethodsUser } from "../../../../test-utils";

// don't pollute test output with error logs from mock rejections
jest.mock("matrix-js-sdk/src/logger");

// Avoid indirectly importing any eagerly created stores that would require extra setup
jest.mock("../../../../../src/Notifier");

const masterRule: IPushRule = {
    actions: [PushRuleActionName.DontNotify],
    conditions: [],
    default: true,
    enabled: false,
    rule_id: RuleId.Master,
};
const oneToOneRule: IPushRule = {
    conditions: [
        { kind: ConditionKind.RoomMemberCount, is: "2" },
        { kind: ConditionKind.EventMatch, key: "type", pattern: "m.room.message" },
    ],
    actions: [PushRuleActionName.Notify, { set_tweak: TweakName.Highlight, value: false }],
    rule_id: ".m.rule.room_one_to_one",
    default: true,
    enabled: true,
} as IPushRule;
const encryptedOneToOneRule: IPushRule = {
    conditions: [
        { kind: ConditionKind.RoomMemberCount, is: "2" },
        { kind: ConditionKind.EventMatch, key: "type", pattern: "m.room.encrypted" },
    ],
    actions: [
        PushRuleActionName.Notify,
        { set_tweak: TweakName.Sound, value: "default" },
        { set_tweak: TweakName.Highlight, value: false },
    ],
    rule_id: ".m.rule.encrypted_room_one_to_one",
    default: true,
    enabled: true,
} as IPushRule;
const groupRule = {
    conditions: [{ kind: ConditionKind.EventMatch, key: "type", pattern: "m.room.message" }],
    actions: [
        PushRuleActionName.Notify,
        { set_tweak: TweakName.Sound, value: "default" },
        { set_tweak: TweakName.Highlight, value: false },
    ],
    rule_id: ".m.rule.message",
    default: true,
    enabled: true,
};
const encryptedGroupRule: IPushRule = {
    conditions: [{ kind: ConditionKind.EventMatch, key: "type", pattern: "m.room.encrypted" }],
    actions: [PushRuleActionName.DontNotify],
    rule_id: ".m.rule.encrypted",
    default: true,
    enabled: true,
} as IPushRule;

const bananaRule = {
    actions: [PushRuleActionName.Notify, { set_tweak: TweakName.Highlight, value: false }],
    pattern: "banana",
    rule_id: "banana",
    default: false,
    enabled: true,
} as IPushRule;

const pushRules: IPushRules = {
    global: {
        underride: [
            {
                conditions: [{ kind: ConditionKind.EventMatch, key: "type", pattern: "m.call.invite" }],
                actions: [
                    PushRuleActionName.Notify,
                    { set_tweak: TweakName.Sound, value: "ring" },
                    { set_tweak: TweakName.Highlight, value: false },
                ],
                rule_id: ".m.rule.call",
                default: true,
                enabled: true,
            },
            oneToOneRule,
            encryptedOneToOneRule,
            groupRule,
            encryptedGroupRule,
            {
                conditions: [
                    { kind: ConditionKind.EventMatch, key: "type", pattern: "im.vector.modular.widgets" },
                    { kind: ConditionKind.EventMatch, key: "content.type", pattern: "jitsi" },
                    { kind: ConditionKind.EventMatch, key: "state_key", pattern: "*" },
                ],
                actions: [PushRuleActionName.Notify, { set_tweak: TweakName.Highlight, value: false }],
                rule_id: ".im.vector.jitsi",
                default: true,
                enabled: true,
            },
        ],
        sender: [],
        room: [
            {
                actions: [PushRuleActionName.DontNotify],
                rule_id: "!zJPyWqpMorfCcWObge:matrix.org",
                default: false,
                enabled: true,
            },
        ],
        content: [
            bananaRule,
            {
                actions: [
                    PushRuleActionName.Notify,
                    { set_tweak: TweakName.Sound, value: "default" },
                    { set_tweak: TweakName.Highlight },
                ],
                pattern: "kadev1",
                rule_id: ".m.rule.contains_user_name",
                default: true,
                enabled: true,
            },
        ],
        override: [
            {
                conditions: [],
                actions: [PushRuleActionName.DontNotify],
                rule_id: ".m.rule.master",
                default: true,
                enabled: false,
            },
            {
                conditions: [{ kind: ConditionKind.EventMatch, key: "content.msgtype", pattern: "m.notice" }],
                actions: [PushRuleActionName.DontNotify],
                rule_id: ".m.rule.suppress_notices",
                default: true,
                enabled: true,
            },
            {
                conditions: [
                    { kind: ConditionKind.EventMatch, key: "type", pattern: "m.room.member" },
                    { kind: ConditionKind.EventMatch, key: "content.membership", pattern: "invite" },
                    { kind: ConditionKind.EventMatch, key: "state_key", pattern: "@kadev1:matrix.org" },
                ],
                actions: [
                    PushRuleActionName.Notify,
                    { set_tweak: TweakName.Sound, value: "default" },
                    { set_tweak: TweakName.Highlight, value: false },
                ],
                rule_id: ".m.rule.invite_for_me",
                default: true,
                enabled: true,
            },
            {
                conditions: [{ kind: ConditionKind.EventMatch, key: "type", pattern: "m.room.member" }],
                actions: [PushRuleActionName.DontNotify],
                rule_id: ".m.rule.member_event",
                default: true,
                enabled: true,
            },
            {
                conditions: [{ kind: "contains_display_name" }],
                actions: [
                    PushRuleActionName.Notify,
                    { set_tweak: TweakName.Sound, value: "default" },
                    { set_tweak: TweakName.Highlight },
                ],
                rule_id: ".m.rule.contains_display_name",
                default: true,
                enabled: true,
            },
            {
                conditions: [
                    { kind: ConditionKind.EventMatch, key: "content.body", pattern: "@room" },
                    { kind: "sender_notification_permission", key: "room" },
                ],
                actions: [PushRuleActionName.Notify, { set_tweak: TweakName.Highlight, value: true }],
                rule_id: ".m.rule.roomnotif",
                default: true,
                enabled: true,
            },
            {
                conditions: [
                    { kind: ConditionKind.EventMatch, key: "type", pattern: "m.room.tombstone" },
                    { kind: ConditionKind.EventMatch, key: "state_key", pattern: "" },
                ],
                actions: [PushRuleActionName.Notify, { set_tweak: TweakName.Highlight, value: true }],
                rule_id: ".m.rule.tombstone",
                default: true,
                enabled: true,
            },
            {
                conditions: [{ kind: ConditionKind.EventMatch, key: "type", pattern: "m.reaction" }],
                actions: [PushRuleActionName.DontNotify],
                rule_id: ".m.rule.reaction",
                default: true,
                enabled: true,
            },
        ],
    },
    device: {},
} as IPushRules;

const flushPromises = async () => await new Promise((resolve) => window.setTimeout(resolve));

describe("<Notifications />", () => {
    const getComponent = () => render(<Notifications />);

    // get component, wait for async data and force a render
    const getComponentAndWait = async () => {
        const component = getComponent();
        await waitForElementToBeRemoved(() => component.queryAllByRole("progressbar"));
        return component;
    };

    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(),
        getPushRules: jest.fn(),
        getPushers: jest.fn(),
        getThreePids: jest.fn(),
        setPusher: jest.fn(),
        removePusher: jest.fn(),
        setPushRuleEnabled: jest.fn(),
        setPushRuleActions: jest.fn(),
        getRooms: jest.fn().mockReturnValue([]),
        getAccountData: jest.fn().mockImplementation((eventType) => {
            if (eventType.startsWith(LOCAL_NOTIFICATION_SETTINGS_PREFIX.name)) {
                return new MatrixEvent({
                    type: eventType,
                    content: {
                        is_silenced: false,
                    },
                });
            }
        }),
        setAccountData: jest.fn(),
        sendReadReceipt: jest.fn(),
        supportsThreads: jest.fn().mockReturnValue(true),
        isInitialSyncComplete: jest.fn().mockReturnValue(false),
        addPushRule: jest.fn().mockResolvedValue({}),
        deletePushRule: jest.fn().mockResolvedValue({}),
    });
    mockClient.getPushRules.mockResolvedValue(pushRules);

    beforeEach(async () => {
        let i = 0;
        mocked(secureRandomString).mockImplementation(() => {
            return "testid_" + i++;
        });

        mockClient.getPushRules.mockClear().mockResolvedValue(pushRules);
        mockClient.getPushers.mockClear().mockResolvedValue({ pushers: [] });
        mockClient.getThreePids.mockClear().mockResolvedValue({ threepids: [] });
        mockClient.setPusher.mockReset().mockResolvedValue({});
        mockClient.removePusher.mockClear().mockResolvedValue({});
        mockClient.setPushRuleActions.mockReset().mockResolvedValue({});
        mockClient.pushRules = pushRules;
        mockClient.getPushRules.mockClear().mockResolvedValue(pushRules);
        mockClient.addPushRule.mockClear();
        mockClient.deletePushRule.mockClear();
        // @ts-expect-error
        mockClient.pushProcessor = new PushProcessor(mockClient);

        userEvent.setup();

        await clearAllModals();
    });

    it("renders spinner while loading", async () => {
        getComponent();
        expect(screen.getByTestId("spinner")).toBeInTheDocument();
    });

    it("renders error message when fetching push rules fails", async () => {
        mockClient.getPushRules.mockRejectedValue({});
        await getComponentAndWait();
        expect(screen.getByTestId("error-message")).toBeInTheDocument();
    });
    it("renders error message when fetching pushers fails", async () => {
        mockClient.getPushers.mockRejectedValue({});
        await getComponentAndWait();
        expect(screen.getByTestId("error-message")).toBeInTheDocument();
    });
    it("renders error message when fetching threepids fails", async () => {
        mockClient.getThreePids.mockRejectedValue({});
        await getComponentAndWait();
        expect(screen.getByTestId("error-message")).toBeInTheDocument();
    });

    describe("main notification switches", () => {
        it("renders only enable notifications switch when notifications are disabled", async () => {
            const disableNotificationsPushRules = {
                global: {
                    ...pushRules.global,
                    override: [{ ...masterRule, enabled: true }],
                },
            } as unknown as IPushRules;
            mockClient.getPushRules.mockClear().mockResolvedValue(disableNotificationsPushRules);
            const { container } = await getComponentAndWait();

            expect(container).toMatchSnapshot();
        });
        it("renders switches correctly", async () => {
            await getComponentAndWait();

            expect(screen.getByLabelText("Enable notifications for this account")).toBeInTheDocument();
            expect(screen.getByLabelText("Enable notifications for this device")).toBeInTheDocument();
            expect(screen.getByLabelText("Enable desktop notifications for this session")).toBeInTheDocument();
            expect(screen.getByLabelText("Show message in desktop notification")).toBeInTheDocument();
            expect(screen.getByLabelText("Enable audible notifications for this session")).toBeInTheDocument();
        });

        // Customisation Kosmos (SCAT-42) : les interrupteurs de notifications par e-mail sont retirés
        // de l'onglet — les tests associés ont donc été supprimés.

        it("toggles master switch correctly", async () => {
            await getComponentAndWait();

            // master switch is on
            expect(screen.getByLabelText("Enable notifications for this account")).toBeChecked();
            fireEvent.click(screen.getByLabelText("Enable notifications for this account"));

            await flushPromises();

            expect(mockClient.setPushRuleEnabled).toHaveBeenCalledWith("global", "override", ".m.rule.master", true);
        });

        it("toggles and sets settings correctly", async () => {
            await getComponentAndWait();
            let audioNotifsToggle!: HTMLInputElement;

            const update = () => {
                audioNotifsToggle = screen.getByLabelText("Enable audible notifications for this session");
            };
            update();

            expect(audioNotifsToggle).toBeChecked();
            expect(SettingsStore.getValue("audioNotificationsEnabled")).toEqual(true);

            fireEvent.click(audioNotifsToggle);
            update();

            expect(audioNotifsToggle).not.toBeChecked();
            expect(SettingsStore.getValue("audioNotificationsEnabled")).toEqual(false);
        });
    });

    // Customisation Kosmos (SCAT-42) : l'onglet Notifications est limité aux 5 options du haut.
    // Les blocs de tests portant sur les catégories de règles push, les mots-clés et le bouton
    // « Tout marquer comme lu » ont été retirés car ces sections ne sont plus rendues.
});
