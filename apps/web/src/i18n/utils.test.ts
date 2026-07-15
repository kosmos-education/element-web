/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, afterEach } from "vitest";
import fetchMock from "@fetch-mock/vitest";

import { getAllLanguagesWithLabels } from "./utils";
import SdkConfig from "../SdkConfig";

describe("getAllLanguagesWithLabels", () => {
    it("should handle unknown language sanely", async () => {
        fetchMock.modifyRoute("languages", {
            response: {
                en: "en_EN.json",
                de: "de_DE.json",
                qq: "qq.json",
            },
        });
        await expect(getAllLanguagesWithLabels()).resolves.toMatchInlineSnapshot(`
                [
                  {
                    "label": "English",
                    "labelInTargetLanguage": "English",
                    "value": "en",
                  },
                  {
                    "label": "German",
                    "labelInTargetLanguage": "Deutsch",
                    "value": "de",
                  },
                  {
                    "label": "qq",
                    "labelInTargetLanguage": "qq",
                    "value": "qq",
                  },
                ]
            `);
    });
    // SCAT-42 : la liste blanche `available_languages` (config.json) restreint les langues proposées.
    afterEach(() => {
        SdkConfig.reset();
    });

    it("should restrict languages to the available_languages config allow-list", async () => {
        fetchMock.modifyRoute("languages", {
            response: {
                en: "en_EN.json",
                de: "de_DE.json",
            },
        });
        SdkConfig.add({ available_languages: ["en"] });
        await expect(getAllLanguagesWithLabels()).resolves.toEqual([
            {
                label: "English",
                labelInTargetLanguage: "English",
                value: "en",
            },
        ]);
    });

    it("should keep all languages when available_languages is absent or empty", async () => {
        fetchMock.modifyRoute("languages", {
            response: {
                en: "en_EN.json",
                de: "de_DE.json",
            },
        });
        SdkConfig.add({ available_languages: [] });
        const langs = await getAllLanguagesWithLabels();
        expect(langs.map((l) => l.value)).toEqual(["en", "de"]);
    });
});
