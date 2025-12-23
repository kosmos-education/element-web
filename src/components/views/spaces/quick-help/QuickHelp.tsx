/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

/**
 * This component appears above the Threads center to provide en easy access to the FAQ (the link of which can be configured).
 *
 * Mostly copied from ThreadsActivityCentre.tsx
 * Although this feature is way simpler than the ThreadsActivityCentre,
 * inlining the button didn't feel right.
 */
import React, {type JSX, useState} from 'react';
import {Menu} from "@vector-im/compound-web";

import {_t} from "../../../../languageHandler.tsx";
import ExternalLink from "../../elements/ExternalLink.tsx";
import SdkConfig from "../../../../SdkConfig.ts";
import {getKeyBindingsManager} from "../../../../KeyBindingsManager.ts";
import {KeyBindingAction} from "../../../../accessibility/KeyboardShortcuts.ts";
import {QuickHelpButton} from "./QuickHelpButton.tsx";

interface QuickHelpProps {
    displayButtonLabel: boolean
}

export function QuickHelp({displayButtonLabel}: QuickHelpProps): JSX.Element {
    const [open, setOpen] = useState(false);
    const brand = SdkConfig.get().brand;
    const faqText = _t(
        "setting|help_about|help_link",
        {
            brand,
        },
        {
            a: (sub: string) => <ExternalLink href={SdkConfig.get("help_url")}>{sub}</ExternalLink>,
        },
    );

    return (
        <div className="mx_QuickHelp_container"
             onKeyDown={(evt) => {
                 // Do nothing if the Menu is closed
                 if (!open) return;

                 const action = getKeyBindingsManager().getNavigationAction(evt);

                 // Block spotlight opening
                 if (action === KeyBindingAction.FilterRooms) {
                     evt.stopPropagation();
                 }
             }}
        >
            <Menu
                align="start"
                side="top"
                open={open}
                onOpenChange={(newOpen) => {
                    setOpen(newOpen);
                }}
                title={_t("common|help")}
                trigger={
                    <QuickHelpButton displayButtonLabel={displayButtonLabel} />
                }
            >
                <div className="mx_QuickHelp_dialog" onClick={() => setOpen(false)}>
                    <p>{faqText}</p>
                </div>
            </Menu>
        </div>
    )
}
