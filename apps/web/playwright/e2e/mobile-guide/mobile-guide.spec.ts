/*
Copyright 2025 New Vector Ltd.
Copyright 2026 Kosmos

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";

test.describe("Mobile Guide", { tag: "@screenshot" }, () => {
    test.use({
        config: {
            mobile_builds: {
                ios: "https://apps.apple.com/app/skolengo/id0000000000",
                android: "https://play.google.com/store/apps/details?id=fr.skolengo",
            },
        },
        viewport: { width: 390, height: 844 }, // iPhone 16e
    });

    test("should match the mobile_guide screenshot", async ({ page, axe }) => {
        await page.goto("/mobile_guide/");
        await expect(page.getByRole("link", { name: /App Store/i })).toBeVisible();
        await expect(page).toMatchScreenshot("mobile-guide.png");
        await expect(axe).toHaveNoViolations();
    });

    test("should offer both stores from the configuration", async ({ page }) => {
        await page.goto("/mobile_guide/");

        await expect(page.getByRole("link", { name: /App Store/i })).toHaveAttribute(
            "href",
            "https://apps.apple.com/app/skolengo/id0000000000",
        );
        await expect(page.getByRole("link", { name: /Google Play/i })).toHaveAttribute(
            "href",
            "https://play.google.com/store/apps/details?id=fr.skolengo",
        );
    });
});
