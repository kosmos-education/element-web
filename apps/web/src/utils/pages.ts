/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IConfigOptions } from "../IConfigOptions";
import { SnakedObject } from "./SnakedObject";

export function shouldUseLoginForWelcome(appConfig: IConfigOptions): boolean {
    const config = new SnakedObject(appConfig);
    const pagesConfig = config.get("embedded_pages");
    return pagesConfig ? new SnakedObject(pagesConfig).get("login_for_welcome") === true : false;
}
