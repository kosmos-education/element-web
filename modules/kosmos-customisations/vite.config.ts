/*
Copyright 2026 Kosmos

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergeConfig } from "vite";
import baseConfig from "@element-hq/element-web-module-api/vite.base.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default mergeConfig(baseConfig, {
    build: {
        lib: {
            entry: path.resolve(__dirname, "src/index.ts"),
            name: "kosmos-element-web-module-customisations",
            fileName: "index",
            formats: ["es"],
        },
    },
});
