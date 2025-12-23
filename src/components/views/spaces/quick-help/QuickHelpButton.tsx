/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

/**
 * This component is the trigger button for the QuickHelp component.
 *
 * Mostly copied from ThreadsActivityCentreButton.tsx
 */
import React, {type ComponentProps, type JSX, type Ref} from "react";
import {IconButton, Text, Tooltip} from "@vector-im/compound-web";
import {InfoSolidIcon} from "@vector-im/compound-design-tokens/assets/web/icons";
import classNames from "classnames";


import {_t} from "../../../../languageHandler";

interface QuickHelpButtonProps extends ComponentProps<typeof IconButton> {
    displayButtonLabel?: boolean,
    ref?: Ref<HTMLButtonElement>;
}

export const QuickHelpButton = function QuickHelpButton({
                                    displayButtonLabel,
                                    ref,
                                    ...props
                                }: QuickHelpButtonProps): JSX.Element {
    // Disable tooltip when the label is displayed
    const openTooltip = displayButtonLabel ? false : undefined;

    return (
        <Tooltip label={_t("common|help")} placement="right" open={openTooltip}>

            <IconButton
                aria-label={_t("common|help")}
                className={classNames("mx_QuickHelpButton", {expanded: displayButtonLabel})}
                {...props}
                ref={ref}
            >
                <>
                    <InfoSolidIcon className="mx_QuickHelpButton_Icon" />
                    {displayButtonLabel && (
                        <Text
                            className="mx_QuickHelpButton_Text"
                            as="span"
                            size="md"
                            title={_t("common|help")}
                        >
                            {_t("common|help")}
                        </Text>)
                    }
                </>
            </IconButton>
        </Tooltip>
    );
};
