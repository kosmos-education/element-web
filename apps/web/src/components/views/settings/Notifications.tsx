/*
Copyright 2024 New Vector Ltd.
Copyright 2016-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEventHandler, type JSX } from "react";
import {
    type IAnnotatedPushRule,
    type IPusher,
    type PushRuleKind,
    RuleId,
    type IThreepid,
    type LocalNotificationSettings,
    type EmptyObject,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { Form, SettingsToggleInput } from "@vector-im/compound-web";

import Spinner from "../elements/Spinner";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import {
    ContentRules,
    type IContentRules,
    VectorPushRulesDefinitions,
    VectorState,
    type VectorPushRuleDefinition,
} from "../../../notifications";
import { _t, type TranslatedString } from "../../../languageHandler";
import SettingsStore from "../../../settings/SettingsStore";
import { SettingLevel } from "../../../settings/SettingLevel";
import Modal from "../../../Modal";
import ErrorDialog from "../dialogs/ErrorDialog";
import { getLocalNotificationAccountDataEventType } from "../../../utils/notifications";
import { SettingsSubsection } from "./shared/SettingsSubsection";
import SettingsFlag from "../elements/SettingsFlag";
import { onSubmitPreventDefault } from "../../../utils/form.ts";
import { keywordRuleId } from "../../../models/notificationsettings/keywordRuleId.ts";

// TODO: this "view" component still has far too much application logic in it,
// which should be factored out to other files.

enum Phase {
    Loading = "loading",
    Ready = "ready",
    Persisting = "persisting", // technically a meta-state for Ready, but whatever
    // unrecoverable error - eg can't load push rules
    Error = "error",
    // error saving individual rule
    SavingError = "savingError",
}

enum RuleClass {
    Master = "master",

    // The vector sections map approximately to UI sections
    VectorGlobal = "vector_global",
    VectorMentions = "vector_mentions",
    VectorOther = "vector_other",
    Other = "other", // unknown rules, essentially
}

const KEYWORD_RULE_ID = "_keywords"; // used as a placeholder "Rule ID" throughout this component
const KEYWORD_RULE_CATEGORY = RuleClass.VectorMentions;

// This array doesn't care about categories: it's just used for a simple sort
const RULE_DISPLAY_ORDER: string[] = [
    // Global
    RuleId.DM,
    RuleId.EncryptedDM,
    RuleId.Message,
    RuleId.EncryptedMessage,

    // Mentions
    RuleId.ContainsUserName,
    RuleId.AtRoomNotification,
    RuleId.ContainsDisplayName,

    // Other
    RuleId.InviteToSelf,
    RuleId.IncomingCall,
    RuleId.SuppressNotices,
    RuleId.Tombstone,
];

interface IVectorPushRule {
    ruleId: RuleId | typeof KEYWORD_RULE_ID | string;
    rule?: IAnnotatedPushRule;
    description: TranslatedString | string;
    vectorState: VectorState;
    // loudest vectorState of a rule and its synced rules
    // undefined when rule has no synced rules
    syncedVectorState?: VectorState;
}

interface IState {
    phase: Phase;

    // Optional stuff is required when `phase === Ready`
    masterPushRule?: IAnnotatedPushRule;
    vectorKeywordRuleInfo?: IContentRules;
    vectorPushRules?: {
        [category in RuleClass]?: IVectorPushRule[];
    };
    pushers?: IPusher[];
    threepids?: IThreepid[];

    deviceNotificationsEnabled: boolean;

    clearingNotifications: boolean;

    ruleIdsWithError: Record<RuleId | string, boolean>;
}
const findInDefaultRules = (
    ruleId: RuleId | string,
    defaultRules: {
        [k in RuleClass]: IAnnotatedPushRule[];
    },
): IAnnotatedPushRule | undefined => {
    for (const category in defaultRules) {
        const rule: IAnnotatedPushRule | undefined = defaultRules[category as RuleClass].find(
            (rule) => rule.rule_id === ruleId,
        );
        if (rule) {
            return rule;
        }
    }
};

// Vector notification states ordered by loudness in ascending order
const OrderedVectorStates = [VectorState.Off, VectorState.On, VectorState.Loud];

/**
 * Find the 'loudest' vector state assigned to a rule
 * and it's synced rules
 * If rules have fallen out of sync,
 * the loudest rule can determine the display value
 * @param defaultRules
 * @param rule - parent rule
 * @param definition - definition of parent rule
 * @returns VectorState - the maximum/loudest state for the parent and synced rules
 */
const maximumVectorState = (
    defaultRules: {
        [k in RuleClass]: IAnnotatedPushRule[];
    },
    rule: IAnnotatedPushRule,
    definition: VectorPushRuleDefinition,
): VectorState | undefined => {
    if (!definition.syncedRuleIds?.length) {
        return undefined;
    }
    const vectorState = definition.syncedRuleIds.reduce<VectorState>((maxVectorState, ruleId) => {
        // already set to maximum
        if (maxVectorState === VectorState.Loud) {
            return maxVectorState;
        }
        const syncedRule = findInDefaultRules(ruleId, defaultRules);
        if (syncedRule) {
            const syncedRuleVectorState = definition.ruleToVectorState(syncedRule);
            // if syncedRule is 'louder' than current maximum
            // set maximum to louder vectorState
            if (
                syncedRuleVectorState &&
                OrderedVectorStates.indexOf(syncedRuleVectorState) > OrderedVectorStates.indexOf(maxVectorState)
            ) {
                return syncedRuleVectorState;
            }
        }
        return maxVectorState;
    }, definition.ruleToVectorState(rule)!);

    return vectorState;
};

/**
 * The old, deprecated notifications tab view, only displayed if the user has the labs flag disabled.
 */
export default class Notifications extends React.PureComponent<EmptyObject, IState> {
    private settingWatchers: string[] = [];

    public constructor(props: EmptyObject) {
        super(props);

        this.state = {
            phase: Phase.Loading,
            deviceNotificationsEnabled: SettingsStore.getValue("deviceNotificationsEnabled") ?? true,
            clearingNotifications: false,
            ruleIdsWithError: {},
        };
    }

    private get isInhibited(): boolean {
        // Caution: The master rule's enabled state is inverted from expectation. When
        // the master rule is *enabled* it means all other rules are *disabled* (or
        // inhibited). Conversely, when the master rule is *disabled* then all other rules
        // are *enabled* (or operate fine).
        return !!this.state.masterPushRule?.enabled;
    }

    public componentDidMount(): void {
        this.settingWatchers = [
            SettingsStore.watchSetting("deviceNotificationsEnabled", null, (...[, , , , value]) => {
                this.setState({ deviceNotificationsEnabled: value! });
            }),
        ];

        // noinspection JSIgnoredPromiseFromCall
        this.refreshFromServer();
        this.refreshFromAccountData();
    }

    public componentWillUnmount(): void {
        this.settingWatchers.forEach((watcher) => SettingsStore.unwatchSetting(watcher));
    }

    public componentDidUpdate(prevProps: Readonly<EmptyObject>, prevState: Readonly<IState>): void {
        if (this.state.deviceNotificationsEnabled !== prevState.deviceNotificationsEnabled) {
            this.persistLocalNotificationSettings(this.state.deviceNotificationsEnabled);
        }
    }

    private async refreshFromServer(): Promise<void> {
        try {
            const newState = (
                await Promise.all([this.refreshRules(), this.refreshPushers(), this.refreshThreepids()])
            ).reduce((p, c) => Object.assign(c, p), {});

            this.setState<
                keyof Pick<
                    IState,
                    "phase" | "vectorKeywordRuleInfo" | "vectorPushRules" | "pushers" | "threepids" | "masterPushRule"
                >
            >({
                ...newState,
                phase: Phase.Ready,
            });
        } catch (e) {
            logger.error("Error setting up notifications for settings: ", e);
            this.setState({ phase: Phase.Error });
        }
    }

    private async refreshFromAccountData(): Promise<void> {
        const cli = MatrixClientPeg.safeGet();
        const settingsEvent = cli.getAccountData(getLocalNotificationAccountDataEventType(cli.deviceId));
        if (settingsEvent) {
            const notificationsEnabled = !(settingsEvent.getContent() as LocalNotificationSettings).is_silenced;
            await SettingsStore.setValue("deviceNotificationsEnabled", null, SettingLevel.DEVICE, notificationsEnabled);
        }
    }

    private persistLocalNotificationSettings(enabled: boolean): Promise<EmptyObject> {
        const cli = MatrixClientPeg.safeGet();
        return cli.setAccountData(getLocalNotificationAccountDataEventType(cli.deviceId), {
            is_silenced: !enabled,
        });
    }

    private async refreshRules(): Promise<Partial<IState>> {
        const ruleSets = await MatrixClientPeg.safeGet().getPushRules();
        const categories: Record<string, RuleClass> = {
            [RuleId.Master]: RuleClass.Master,

            [RuleId.DM]: RuleClass.VectorGlobal,
            [RuleId.EncryptedDM]: RuleClass.VectorGlobal,
            [RuleId.Message]: RuleClass.VectorGlobal,
            [RuleId.EncryptedMessage]: RuleClass.VectorGlobal,

            [RuleId.ContainsDisplayName]: RuleClass.VectorMentions,
            [RuleId.ContainsUserName]: RuleClass.VectorMentions,
            [RuleId.AtRoomNotification]: RuleClass.VectorMentions,

            [RuleId.InviteToSelf]: RuleClass.VectorOther,
            [RuleId.IncomingCall]: RuleClass.VectorOther,
            [RuleId.SuppressNotices]: RuleClass.VectorOther,
            [RuleId.Tombstone]: RuleClass.VectorOther,

            // Everything maps to a generic "other" (unknown rule)
        };

        const defaultRules: {
            [k in RuleClass]: IAnnotatedPushRule[];
        } = {
            [RuleClass.Master]: [],
            [RuleClass.VectorGlobal]: [],
            [RuleClass.VectorMentions]: [],
            [RuleClass.VectorOther]: [],
            [RuleClass.Other]: [],
        };

        for (const k in ruleSets.global) {
            // noinspection JSUnfilteredForInLoop
            const kind = k as PushRuleKind;

            for (const r of ruleSets.global[kind]!) {
                const rule: IAnnotatedPushRule = Object.assign(r, { kind });
                const category = categories[rule.rule_id] ?? RuleClass.Other;

                if (rule.rule_id[0] === ".") {
                    defaultRules[category].push(rule);
                }
            }
        }

        const preparedNewState: Partial<IState> = {};
        if (defaultRules.master.length > 0) {
            preparedNewState.masterPushRule = defaultRules.master[0];
        } else {
            // XXX: Can this even happen? How do we safely recover?
            throw new Error("Failed to locate a master push rule");
        }

        // Parse keyword rules
        preparedNewState.vectorKeywordRuleInfo = ContentRules.parseContentRules(ruleSets);

        // Prepare rendering for all of our known rules
        preparedNewState.vectorPushRules = {};
        const vectorCategories = [RuleClass.VectorGlobal, RuleClass.VectorMentions, RuleClass.VectorOther];
        for (const category of vectorCategories) {
            preparedNewState.vectorPushRules[category] = [];
            for (const rule of defaultRules[category]) {
                const definition: VectorPushRuleDefinition = VectorPushRulesDefinitions[rule.rule_id];
                const vectorState = definition.ruleToVectorState(rule)!;
                preparedNewState.vectorPushRules[category].push({
                    ruleId: rule.rule_id,
                    rule,
                    vectorState,
                    syncedVectorState: maximumVectorState(defaultRules, rule, definition),
                    description: _t(definition.description),
                });
            }

            // Quickly sort the rules for display purposes
            preparedNewState.vectorPushRules[category].sort((a, b) => {
                let idxA = RULE_DISPLAY_ORDER.indexOf(a.ruleId);
                let idxB = RULE_DISPLAY_ORDER.indexOf(b.ruleId);

                // Assume unknown things go at the end
                if (idxA < 0) idxA = RULE_DISPLAY_ORDER.length;
                if (idxB < 0) idxB = RULE_DISPLAY_ORDER.length;

                return idxA - idxB;
            });

            if (category === KEYWORD_RULE_CATEGORY) {
                preparedNewState.vectorPushRules[category].push({
                    ruleId: KEYWORD_RULE_ID,
                    description: _t("settings|notifications|messages_containing_keywords"),
                    vectorState: preparedNewState.vectorKeywordRuleInfo.vectorState,
                });
            }
        }

        return preparedNewState;
    }

    private refreshPushers(): Promise<Partial<IState>> {
        return MatrixClientPeg.safeGet().getPushers();
    }

    private refreshThreepids(): Promise<Partial<IState>> {
        return MatrixClientPeg.safeGet().getThreePids();
    }

    private showSaveError(): void {
        Modal.createDialog(ErrorDialog, {
            title: _t("settings|notifications|error_saving"),
            description: _t("settings|notifications|error_saving_detail"),
        });
    }

    private onMasterRuleChanged: ChangeEventHandler<HTMLInputElement> = async (evt): Promise<void> => {
        const { checked } = evt.target;
        this.setState({ phase: Phase.Persisting });

        const masterRule = this.state.masterPushRule!;
        try {
            await MatrixClientPeg.safeGet().setPushRuleEnabled("global", masterRule.kind, masterRule.rule_id, !checked);
            await this.refreshFromServer();
        } catch (e) {
            this.setState({ phase: Phase.Error });
            logger.error("Error updating master push rule:", e);
            this.showSaveError();
        }
    };

    private renderTopSection(): JSX.Element {
        const masterSwitch = (
            <SettingsToggleInput
                checked={!this.isInhibited}
                name="notif-master-switch"
                label={_t("settings|notifications|enable_notifications_account")}
                helpMessage={_t("settings|notifications|enable_notifications_account_detail")}
                onChange={this.onMasterRuleChanged}
                disabled={this.state.phase === Phase.Persisting}
            />
        );

        // If all the rules are inhibited, don't show anything.
        if (this.isInhibited) {
            return <Form.Root onSubmit={onSubmitPreventDefault}>{masterSwitch}</Form.Root>;
        }

        // Customisation Kosmos (SCAT-42) : les interrupteurs de notifications par e-mail sont retirés
        // (l'onglet Notifications est limité aux 5 options du haut).
        return (
            <SettingsSubsection>
                <Form.Root onSubmit={onSubmitPreventDefault}>
                    {masterSwitch}

                    <SettingsFlag name="deviceNotificationsEnabled" level={SettingLevel.DEVICE} />

                    {this.state.deviceNotificationsEnabled && (
                        <>
                            <SettingsFlag name="notificationsEnabled" level={SettingLevel.DEVICE} />
                            <SettingsFlag name="notificationBodyEnabled" level={SettingLevel.DEVICE} />
                            <SettingsFlag name="audioNotificationsEnabled" level={SettingLevel.DEVICE} />
                        </>
                    )}
                </Form.Root>
            </SettingsSubsection>
        );
    }

    public render(): React.ReactNode {
        if (this.state.phase === Phase.Loading) {
            // Ends up default centered
            return <Spinner />;
        } else if (this.state.phase === Phase.Error) {
            return <p data-testid="error-message">{_t("settings|notifications|error_loading")}</p>;
        }

        // Customisation Kosmos (SCAT-42) : l'onglet Notifications est limité aux 5 options du haut.
        // Les catégories de règles push (Global/Mentions/Autres), les cibles push, les réglages
        // d'activité et le bouton « Tout marquer comme lu » sont retirés de l'interface.
        return <>{this.renderTopSection()}</>;
    }
}
