/*
Copyright 2024 New Vector Ltd.
Copyright 2021-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type WebSearch as WebSearchEvent } from "@matrix-org/analytics-events/types/typescript/WebSearch";
import { type HierarchyRoom, type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { normalize } from "matrix-js-sdk/src/utils";
import React, { type ChangeEvent, type JSX, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ChatIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { KeyBindingAction } from "../../../../accessibility/KeyboardShortcuts";
import {
    findNextSiblingElement,
    RovingStateActionType,
    RovingTabIndexContext,
    RovingTabIndexProvider,
} from "../../../../accessibility/RovingTabIndex";
import { mediaFromMxc } from "../../../../customisations/Media";
import { Action } from "../../../../dispatcher/actions";
import defaultDispatcher from "../../../../dispatcher/dispatcher";
import { type ViewRoomPayload } from "../../../../dispatcher/payloads/ViewRoomPayload";
import { useRecentSearches } from "../../../../hooks/spotlight/useRecentSearches";
import { useSpaceResults } from "../../../../hooks/useSpaceResults";
import { getKeyBindingsManager } from "../../../../KeyBindingsManager";
import { _t } from "../../../../languageHandler";
import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import { PosthogAnalytics } from "../../../../PosthogAnalytics";
import { SettingLevel } from "../../../../settings/SettingLevel";
import SettingsStore from "../../../../settings/SettingsStore";
import { BreadcrumbsStore } from "../../../../stores/BreadcrumbsStore";
import { type RoomNotificationState } from "../../../../stores/notifications/RoomNotificationState";
import { RoomNotificationStateStore } from "../../../../stores/notifications/RoomNotificationStateStore";
import { compareRoomsByRecency } from "../../../../utils/room/sortRoomsByRecency";
import { SDKContextClass } from "../../../../contexts/SDKContextClass";
import DMRoomMap from "../../../../utils/DMRoomMap";
import BaseAvatar from "../../avatars/BaseAvatar";
import DecoratedRoomAvatar from "../../avatars/DecoratedRoomAvatar";
import AccessibleButton from "../../elements/AccessibleButton";
import Spinner from "../../elements/Spinner";
import { NotificationBadge } from "../../rooms/NotificationBadge/NotificationBadge";
import BaseDialog from "../BaseDialog";
import { Option } from "./Option";
import { RoomResultContextMenus } from "./RoomResultContextMenus";
import { RoomContextDetails } from "../../rooms/RoomContextDetails";
import { TooltipOption } from "./TooltipOption";
import { isLocalRoom } from "../../../../utils/localRoom/isLocalRoom";
import { useFeatureEnabled } from "../../../../hooks/useSettings";
import { transformSearchTerm } from "../../../../utils/SearchInput";

const MAX_RECENT_SEARCHES = 10;
const SECTION_LIMIT = 50; // only show 50 results per section for performance reasons
const AVATAR_SIZE = "24px";

interface IProps {
    initialText?: string;
    onFinished(this: void): void;
}

function nodeIsForRecentlyViewed(node?: HTMLElement): boolean {
    return node?.id?.startsWith("mx_SpotlightDialog_button_recentlyViewed_") === true;
}

interface IRoomResult {
    room: Room;
    query?: string[]; // extra fields to query match, stored as lowercase
}

const toRoomResult = (room: Room): IRoomResult => {
    const myUserId = MatrixClientPeg.safeGet().getUserId();
    const otherUserId = DMRoomMap.shared().getUserIdForRoomId(room.roomId);

    if (otherUserId) {
        // kosmos: la création de DM est bloquée, mais un DM hérité doit rester trouvable :
        // il est listé avec les salons, et cherchable par le nom de l'autre membre.
        const otherMembers = room.getMembers().filter((it) => it.userId !== myUserId);
        const query = [
            ...otherMembers.map((it) => it.name.toLowerCase()),
            ...otherMembers.map((it) => it.userId.toLowerCase()),
        ].filter(Boolean);
        return { room, query };
    }

    return { room };
};

export const useWebSearchMetrics = (numResults: number, queryLength: number, viaSpotlight: boolean): void => {
    useEffect(() => {
        if (!queryLength) return;

        // send metrics after a 1s debounce
        const timeoutId = window.setTimeout(() => {
            PosthogAnalytics.instance.trackEvent<WebSearchEvent>({
                eventName: "WebSearch",
                viaSpotlight,
                numResults,
                queryLength,
            });
        }, 1000);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [numResults, queryLength, viaSpotlight]);
};

const findVisibleRooms = (cli: MatrixClient, msc3946ProcessDynamicPredecessor: boolean): Room[] => {
    return cli.getVisibleRooms(msc3946ProcessDynamicPredecessor).filter((room) => {
        // Do not show local rooms
        if (isLocalRoom(room)) return false;

        // kosmos: la recherche ne remonte que des salons — les espaces ne sont pas des résultats
        if (room.isSpaceRoom()) return false;

        // TODO we may want to put invites in their own list
        return room.getMyMembership() === KnownMembership.Join || room.getMyMembership() == KnownMembership.Invite;
    });
};

const roomAriaUnreadLabel = (room: Room, notification: RoomNotificationState): string | undefined => {
    if (notification.hasMentions) {
        return _t("a11y|n_unread_messages_mentions", {
            count: notification.count,
        });
    } else if (notification.hasUnreadCount) {
        return _t("a11y|n_unread_messages", {
            count: notification.count,
        });
    } else if (notification.isUnread) {
        return _t("a11y|unread_messages");
    } else {
        return undefined;
    }
};

const SpotlightDialog: React.FC<IProps> = ({ initialText = "", onFinished }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const cli = MatrixClientPeg.safeGet();
    const rovingContext = useContext(RovingTabIndexContext);
    const [query, _setQuery] = useState(initialText);
    const [recentSearches, clearRecentSearches] = useRecentSearches();
    const msc3946ProcessDynamicPredecessor = useFeatureEnabled("feature_dynamic_room_predecessors");

    const trimmedQuery = useMemo(() => query.trim(), [query]);

    const possibleResults = useMemo<IRoomResult[]>(
        () => findVisibleRooms(cli, msc3946ProcessDynamicPredecessor).map(toRoomResult),
        [cli, msc3946ProcessDynamicPredecessor],
    );

    const results = useMemo<IRoomResult[]>(() => {
        if (!trimmedQuery) return [];

        const lcQuery = trimmedQuery.toLowerCase();
        const normalizedQuery = normalize(trimmedQuery);

        const matches = possibleResults.filter(
            (entry) =>
                entry.room.normalizedName?.includes(normalizedQuery) ||
                entry.room.getCanonicalAlias()?.toLowerCase().includes(lcQuery) ||
                entry.query?.some((q) => q.includes(lcQuery)),
        );

        // Sort results by most recent activity
        const myUserId = cli.getSafeUserId();
        return matches.sort(
            (a, b) => compareRoomsByRecency(a.room, b.room, myUserId),
        );
    }, [trimmedQuery, cli, possibleResults]);

    useWebSearchMetrics(results.length, query.length, true);

    const activeSpace = SDKContextClass.instance.spaceStore.activeSpaceRoom;
    const [spaceResults, spaceResultsLoading] = useSpaceResults(activeSpace ?? undefined, query);

    const setQuery = (e: ChangeEvent<HTMLInputElement>): void => {
        const newQuery = transformSearchTerm(e.currentTarget.value);
        _setQuery(newQuery);
    };
    useEffect(() => {
        setTimeout(() => {
            const node = rovingContext.state.nodes[0];
            if (node) {
                rovingContext.dispatch({
                    type: RovingStateActionType.SetFocus,
                    payload: { node },
                });
                node?.scrollIntoView?.({
                    block: "nearest",
                });
            }
        });
        // we intentionally ignore changes to the rovingContext for the purpose of this hook
        // we only want to reset the focus whenever the results change
        // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, [results]);

    const viewRoom = (room: { roomId: string }, persist = false, viaKeyboard = false): void => {
        if (persist) {
            const recents = new Set(SettingsStore.getValue("SpotlightSearch.recentSearches", null).reverse());
            // remove & add the room to put it at the end
            recents.delete(room.roomId);
            recents.add(room.roomId);

            SettingsStore.setValue(
                "SpotlightSearch.recentSearches",
                null,
                SettingLevel.ACCOUNT,
                Array.from(recents).reverse().slice(0, MAX_RECENT_SEARCHES),
            );
        }

        defaultDispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            metricsTrigger: "WebUnifiedSearch",
            metricsViaKeyboard: viaKeyboard,
            room_id: room.roomId,
        });

        onFinished();
    };

    // kosmos: l'exploration des salons et espaces publics est retirée — il ne reste que
    // le renvoi vers la recherche dans les messages.
    const otherSearchesSection = (
        <div
            className="mx_SpotlightDialog_section mx_SpotlightDialog_otherSearches"
            role="group"
            aria-labelledby="mx_SpotlightDialog_section_otherSearches"
        >
            <h4 id="mx_SpotlightDialog_section_otherSearches">
                {trimmedQuery
                    ? _t("spotlight_dialog|heading_with_query", { query })
                    : _t("spotlight_dialog|heading_without_query")}
            </h4>
            <div>
                <Option
                    id="mx_SpotlightDialog_button_searchMessages"
                    onClick={() => {
                        defaultDispatcher.dispatch({
                            action: Action.FocusMessageSearch,
                            initialText: trimmedQuery,
                        });
                        onFinished();
                    }}
                >
                    <ChatIcon />
                    {_t("spotlight_dialog|messages_label")}
                </Option>
            </div>
        </div>
    );

    let content: JSX.Element;
    if (trimmedQuery) {
        const resultMapper = (result: IRoomResult): JSX.Element => {
            const notification = RoomNotificationStateStore.instance.getRoomState(result.room);
            const unreadLabel = roomAriaUnreadLabel(result.room, notification);
            const ariaProperties = {
                "aria-label": unreadLabel ? `${result.room.name} ${unreadLabel}` : result.room.name,
                "aria-describedby": `mx_SpotlightDialog_button_result_${result.room.roomId}_details`,
            };
            return (
                <Option
                    id={`mx_SpotlightDialog_button_result_${result.room.roomId}`}
                    key={result.room.roomId}
                    onClick={(ev) => {
                        viewRoom({ roomId: result.room.roomId }, true, ev?.type !== "click");
                    }}
                    endAdornment={<RoomResultContextMenus room={result.room} />}
                    {...ariaProperties}
                >
                    <DecoratedRoomAvatar room={result.room} size={AVATAR_SIZE} tooltipProps={{ tabIndex: -1 }} />
                    {result.room.name}
                    <NotificationBadge notification={notification} />
                    <RoomContextDetails
                        id={`mx_SpotlightDialog_button_result_${result.room.roomId}_details`}
                        className="mx_SpotlightDialog_result_details"
                        room={result.room}
                    />
                </Option>
            );
        };

        let roomsSection: JSX.Element | undefined;
        if (results.length) {
            roomsSection = (
                <div
                    className="mx_SpotlightDialog_section mx_SpotlightDialog_results"
                    role="group"
                    aria-labelledby="mx_SpotlightDialog_section_rooms"
                >
                    <h4 id="mx_SpotlightDialog_section_rooms">{_t("common|rooms")}</h4>
                    <div>{results.slice(0, SECTION_LIMIT).map(resultMapper)}</div>
                </div>
            );
        }

        let spaceRoomsSection: JSX.Element | undefined;
        if (spaceResults.length && activeSpace) {
            spaceRoomsSection = (
                <div
                    className="mx_SpotlightDialog_section mx_SpotlightDialog_results"
                    role="group"
                    aria-labelledby="mx_SpotlightDialog_section_spaceRooms"
                >
                    <h4 id="mx_SpotlightDialog_section_spaceRooms">
                        {_t("spotlight_dialog|other_rooms_in_space", { spaceName: activeSpace.name })}
                    </h4>
                    <div>
                        {spaceResults.slice(0, SECTION_LIMIT).map(
                            (room: HierarchyRoom): JSX.Element => (
                                <Option
                                    id={`mx_SpotlightDialog_button_result_${room.room_id}`}
                                    key={room.room_id}
                                    onClick={(ev) => {
                                        viewRoom({ roomId: room.room_id }, true, ev?.type !== "click");
                                    }}
                                >
                                    <BaseAvatar
                                        name={room.name}
                                        idName={room.room_id}
                                        url={
                                            room.avatar_url
                                                ? mediaFromMxc(room.avatar_url).getSquareThumbnailHttp(
                                                      parseInt(AVATAR_SIZE, 10),
                                                  )
                                                : null
                                        }
                                        size={AVATAR_SIZE}
                                    />
                                    {room.name || room.canonical_alias}
                                    {room.name && room.canonical_alias && (
                                        <div className="mx_SpotlightDialog_result_details">{room.canonical_alias}</div>
                                    )}
                                </Option>
                            ),
                        )}
                        {spaceResultsLoading && <Spinner />}
                    </div>
                </div>
            );
        }

        // kosmos: sections retirées — annuaire public (« Suggestions » + NetworkDropdown),
        // jonction par alias « #salon:serveur », « le résultat peut être masqué » avec la
        // création de salon public, et la section « Espaces ».
        content = (
            <>
                {roomsSection}
                {spaceRoomsSection}
                {otherSearchesSection}
            </>
        );
    } else {
        let recentSearchesSection: JSX.Element | undefined;
        if (recentSearches.length) {
            recentSearchesSection = (
                <div
                    className="mx_SpotlightDialog_section mx_SpotlightDialog_recentSearches"
                    role="group"
                    // Firefox sometimes makes this element focusable due to overflow,
                    // so force it out of tab order by default.
                    tabIndex={-1}
                    aria-labelledby="mx_SpotlightDialog_section_recentSearches"
                >
                    <h4>
                        <span id="mx_SpotlightDialog_section_recentSearches">
                            {_t("spotlight_dialog|recent_searches_section_title")}
                        </span>
                        <AccessibleButton kind="link" onClick={clearRecentSearches}>
                            {_t("action|clear")}
                        </AccessibleButton>
                    </h4>
                    <div>
                        {recentSearches.map((room) => {
                            const notification = RoomNotificationStateStore.instance.getRoomState(room);
                            const unreadLabel = roomAriaUnreadLabel(room, notification);
                            const ariaProperties = {
                                "aria-label": unreadLabel ? `${room.name} ${unreadLabel}` : room.name,
                                "aria-describedby": `mx_SpotlightDialog_button_recentSearch_${room.roomId}_details`,
                            };
                            return (
                                <Option
                                    id={`mx_SpotlightDialog_button_recentSearch_${room.roomId}`}
                                    key={room.roomId}
                                    onClick={(ev) => {
                                        viewRoom({ roomId: room.roomId }, true, ev?.type !== "click");
                                    }}
                                    endAdornment={<RoomResultContextMenus room={room} />}
                                    {...ariaProperties}
                                >
                                    <DecoratedRoomAvatar
                                        room={room}
                                        size={AVATAR_SIZE}
                                        tooltipProps={{ tabIndex: -1 }}
                                    />
                                    {room.name}
                                    <NotificationBadge notification={notification} />
                                    <RoomContextDetails
                                        id={`mx_SpotlightDialog_button_recentSearch_${room.roomId}_details`}
                                        className="mx_SpotlightDialog_result_details"
                                        room={room}
                                    />
                                </Option>
                            );
                        })}
                    </div>
                </div>
            );
        }

        content = (
            <>
                <div
                    className="mx_SpotlightDialog_section mx_SpotlightDialog_recentlyViewed"
                    role="group"
                    aria-labelledby="mx_SpotlightDialog_section_recentlyViewed"
                >
                    <h4 id="mx_SpotlightDialog_section_recentlyViewed">
                        {_t("spotlight_dialog|recently_viewed_section_title")}
                    </h4>
                    <div>
                        {BreadcrumbsStore.instance.rooms
                            .filter((r) => r.roomId !== SDKContextClass.instance.roomViewStore.getRoomId())
                            .map((room) => (
                                <TooltipOption
                                    id={`mx_SpotlightDialog_button_recentlyViewed_${room.roomId}`}
                                    title={room.name}
                                    key={room.roomId}
                                    onClick={(ev) => {
                                        viewRoom({ roomId: room.roomId }, false, ev.type !== "click");
                                    }}
                                >
                                    <DecoratedRoomAvatar room={room} size="32px" tooltipProps={{ tabIndex: -1 }} />
                                    {room.name}
                                </TooltipOption>
                            ))}
                    </div>
                </div>

                {recentSearchesSection}
                {otherSearchesSection}
            </>
        );
    }

    const onDialogKeyDown = (ev: KeyboardEvent | React.KeyboardEvent): void => {
        const navigationAction = getKeyBindingsManager().getNavigationAction(ev);
        switch (navigationAction) {
            case KeyBindingAction.FilterRooms:
                ev.stopPropagation();
                ev.preventDefault();
                onFinished();
                break;
        }

        let node: HTMLElement | undefined;
        const accessibilityAction = getKeyBindingsManager().getAccessibilityAction(ev);
        switch (accessibilityAction) {
            case KeyBindingAction.Escape:
                ev.stopPropagation();
                ev.preventDefault();
                onFinished();
                break;
            case KeyBindingAction.ArrowUp:
            case KeyBindingAction.ArrowDown:
                ev.stopPropagation();
                ev.preventDefault();

                if (rovingContext.state.activeNode && rovingContext.state.nodes.length > 0) {
                    let nodes = rovingContext.state.nodes;
                    if (!query) {
                        // If the current selection is not in the recently viewed row then only include the
                        // first recently viewed so that is the target when the user is switching into recently viewed.
                        const keptRecentlyViewedRef = nodeIsForRecentlyViewed(rovingContext.state.activeNode)
                            ? rovingContext.state.activeNode
                            : nodes.find(nodeIsForRecentlyViewed);
                        // exclude all other recently viewed items from the list so up/down arrows skip them
                        nodes = nodes.filter((ref) => ref === keptRecentlyViewedRef || !nodeIsForRecentlyViewed(ref));
                    }

                    const idx = nodes.indexOf(rovingContext.state.activeNode);
                    node = findNextSiblingElement(
                        nodes,
                        idx + (accessibilityAction === KeyBindingAction.ArrowUp ? -1 : 1),
                    );
                }
                break;

            case KeyBindingAction.ArrowLeft:
            case KeyBindingAction.ArrowRight:
                // only handle these keys when we are in the recently viewed row of options
                if (
                    !query &&
                    rovingContext.state.activeNode &&
                    rovingContext.state.nodes.length > 0 &&
                    nodeIsForRecentlyViewed(rovingContext.state.activeNode)
                ) {
                    // we only intercept left/right arrows when the field is empty, and they'd do nothing anyway
                    ev.stopPropagation();
                    ev.preventDefault();

                    const nodes = rovingContext.state.nodes.filter(nodeIsForRecentlyViewed);
                    const idx = nodes.indexOf(rovingContext.state.activeNode);
                    node = findNextSiblingElement(
                        nodes,
                        idx + (accessibilityAction === KeyBindingAction.ArrowLeft ? -1 : 1),
                    );
                }
                break;
        }

        if (node) {
            rovingContext.dispatch({
                type: RovingStateActionType.SetFocus,
                payload: { node },
            });
            node?.scrollIntoView({
                block: "nearest",
            });
        }
    };

    const onKeyDown = (ev: React.KeyboardEvent): void => {
        const action = getKeyBindingsManager().getAccessibilityAction(ev);

        switch (action) {
            case KeyBindingAction.Enter:
                ev.stopPropagation();
                ev.preventDefault();
                rovingContext.state.activeNode?.click();
                break;
        }
    };

    const activeDescendant = rovingContext.state.activeNode?.id;

    return (
        <>
            <div id="mx_SpotlightDialog_keyboardPrompt">
                {_t(
                    "spotlight_dialog|keyboard_scroll_hint",
                    {},
                    {
                        arrows: () => (
                            <>
                                <kbd>↓</kbd>
                                <kbd>↑</kbd>
                                {!query && <kbd>←</kbd>}
                                {!query && <kbd>→</kbd>}
                            </>
                        ),
                    },
                )}
            </div>

            <BaseDialog
                className="mx_SpotlightDialog"
                onFinished={onFinished}
                hasCancel={false}
                onKeyDown={onDialogKeyDown}
                screenName="UnifiedSearch"
                aria-label={_t("spotlight_dialog|search_dialog")}
            >
                <div className="mx_SpotlightDialog_searchBox mx_textinput">
                    <input
                        ref={inputRef}
                        autoFocus
                        type="text"
                        autoComplete="off"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck="false"
                        placeholder={_t("action|search")}
                        value={query}
                        onChange={setQuery}
                        onKeyDown={onKeyDown}
                        aria-owns="mx_SpotlightDialog_content"
                        aria-activedescendant={activeDescendant}
                        aria-label={_t("action|search")}
                        aria-describedby="mx_SpotlightDialog_keyboardPrompt"
                    />
                </div>

                <div
                    ref={scrollContainerRef}
                    id="mx_SpotlightDialog_content"
                    role="listbox"
                    aria-activedescendant={activeDescendant}
                    aria-describedby="mx_SpotlightDialog_keyboardPrompt"
                >
                    {content}
                </div>
            </BaseDialog>
        </>
    );
};

const RovingSpotlightDialog: React.FC<IProps> = (props) => {
    return <RovingTabIndexProvider>{() => <SpotlightDialog {...props} />}</RovingTabIndexProvider>;
};

export default RovingSpotlightDialog;
