/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */
import React, { type JSX, useState } from "react";
import { IconButton, Menu, MenuItem } from "@vector-im/compound-web";
import UserAddIcon from "@vector-im/compound-design-tokens/assets/web/icons/user-add";
import ChevronDownIcon from "@vector-im/compound-design-tokens/assets/web/icons/chevron-down";
import HomeIcon from "@vector-im/compound-design-tokens/assets/web/icons/home";
import PreferencesIcon from "@vector-im/compound-design-tokens/assets/web/icons/preferences";
import SettingsIcon from "@vector-im/compound-design-tokens/assets/web/icons/settings";
import { Flex } from "@element-hq/web-shared-components";

import { _t } from "../../../../languageHandler";
import {
    type RoomListHeaderViewState,
    useRoomListHeaderViewModel,
} from "../../../viewmodels/roomlist/RoomListHeaderViewModel";
import { RoomListOptionsMenu } from "./RoomListOptionsMenu";
import { ReleaseAnnouncement } from "../../../structures/ReleaseAnnouncement";

/**
 * The header view for the room list
 * The space name is displayed and a compose menu is shown if the user can create rooms
 */
export function RoomListHeaderView(): JSX.Element {
    const vm = useRoomListHeaderViewModel();

    return (
        <Flex
            as="header"
            className="mx_RoomListHeaderView"
            aria-label={_t("room|context_menu|title")}
            justify="space-between"
            align="center"
            data-testid="room-list-header"
        >
            <Flex className="mx_RoomListHeaderView_title" align="center" gap="var(--cpd-space-1x)">
                <h1 title={vm.title}>{vm.title}</h1>
                {vm.displaySpaceMenu && <SpaceMenu vm={vm} />}
            </Flex>
            <Flex align="center" gap="var(--cpd-space-2x)">
                <ReleaseAnnouncement
                    feature="newRoomList_sort"
                    header={_t("room_list|release_announcement|sort|title")}
                    description={_t("room_list|release_announcement|sort|description")}
                    closeLabel={_t("room_list|release_announcement|next")}
                    placement="bottom"
                >
                    <div className="mx_RoomListHeaderView_ReleaseAnnouncementAnchor">
                        <RoomListOptionsMenu vm={vm} />
                    </div>
                </ReleaseAnnouncement>
            </Flex>
        </Flex>
    );
}

interface SpaceMenuProps {
    /**
     * The view model for the room list header
     */
    vm: RoomListHeaderViewState;
}

/**
 * The space menu for the room list header
 */
function SpaceMenu({ vm }: SpaceMenuProps): JSX.Element {
    const [open, setOpen] = useState(false);

    return (
        <Menu
            open={open}
            onOpenChange={setOpen}
            title={vm.title}
            side="right"
            align="start"
            trigger={
                <IconButton className="mx_SpaceMenu_button" aria-label={_t("room_list|open_space_menu")} size="20px">
                    <ChevronDownIcon color="var(--cpd-color-icon-secondary)" />
                </IconButton>
            }
        >
            <MenuItem
                Icon={HomeIcon}
                label={_t("room_list|space_menu|home")}
                onSelect={vm.openSpaceHome}
                hideChevron={true}
            />
            {vm.canInviteInSpace && (
                <MenuItem
                    Icon={UserAddIcon}
                    label={_t("action|invite")}
                    onSelect={vm.inviteInSpace}
                    hideChevron={true}
                />
            )}
            <MenuItem
                Icon={PreferencesIcon}
                label={_t("common|preferences")}
                onSelect={vm.openSpacePreferences}
                hideChevron={true}
            />
            {vm.canAccessSpaceSettings && (
                <MenuItem
                    Icon={SettingsIcon}
                    label={_t("room_list|space_menu|space_settings")}
                    onSelect={vm.openSpaceSettings}
                    hideChevron={true}
                />
            )}
        </Menu>
    );
}
