/*
Copyright 2026 Element Creations Ltd.
Copyright 2026 Kosmos

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, beforeAll } from "vitest";
import { waitFor } from "@testing-library/dom";

vi.mock("../getconfig.ts", () => ({
    getVectorConfig: vi.fn().mockResolvedValue({
        mobile_builds: {
            ios: "https://apps.example.org/skolengo",
            android: "https://play.example.org/skolengo",
        },
    }),
}));

describe("mobile guide", () => {
    beforeAll(async () => {
        for (const id of ["heading", "intro", "step1_heading", "step2_heading"]) {
            const element = document.createElement("h1");
            element.id = id;
            document.body.append(element);
        }

        for (const [linkId, badgeId] of [
            ["app_store_link", "app_store_badge"],
            ["play_store_link", "play_store_badge"],
        ]) {
            const link = document.createElement("a");
            link.id = linkId;
            const badge = document.createElement("img");
            badge.id = badgeId;
            link.append(badge);
            document.body.append(link);
        }

        const backButton = document.createElement("a");
        backButton.id = "back_to_element_button";
        document.body.append(backButton);

        await import("./index.ts");
    });

    beforeEach(() => {
        sessionStorage.clear();
    });

    it("points both store badges at the configured applications", async () => {
        await waitFor(() =>
            expect(document.getElementById("app_store_link")).toHaveProperty(
                "href",
                "https://apps.example.org/skolengo",
            ),
        );
        expect(document.getElementById("play_store_link")).toHaveProperty("href", "https://play.example.org/skolengo");
    });

    it("translates the page", () => {
        expect(document.getElementById("heading")!.textContent).toBeTruthy();
        expect(document.getElementById("step1_heading")!.textContent).toBeTruthy();
    });

    it("should set skip_mobile_redirect in sessionStorage", async () => {
        expect(sessionStorage.getItem("skip_mobile_redirect")).toBeFalsy();
        const button = document.getElementById("back_to_element_button")!;
        await waitFor(() => expect(button.onclick).toBeTruthy());
        button.click();
        expect(sessionStorage.getItem("skip_mobile_redirect")).toBe("true");
    });
});
