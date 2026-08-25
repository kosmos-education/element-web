/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Visibility } from "matrix-js-sdk/src/matrix";
import { test as base, expect } from "../../element-web-test";
import type { Locator, Page } from "@playwright/test";
import { isDendrite } from "../../plugins/homeserver/dendrite";

/*
 * kosmos (SCAT-43): the Spotlight is restricted to rooms the user can already reach.
 *
 * The upstream suite covered the public room directory (known / unknown / world readable
 * rooms, other homeservers) and people search (finding users, starting DMs, group DMs).
 * Both features are gone — people search under SCAT-14, the public directory under
 * SCAT-43 — so those tests were removed along with the bot and public-room fixtures they
 * needed. What remains covers the search we still ship, plus a guard asserting that no
 * filter entry can reappear.
 */

function roomHeaderName(page: Page): Locator {
    return page.locator(".mx_RoomHeader_heading");
}

type RoomRef = { name: string; roomId: string };
const test = base.extend<{
    room1: RoomRef;
    room2: RoomRef;
}>({
    room1: async ({ app }, use) => {
        const name = "247";
        const roomId = await app.client.createRoom({ name, visibility: "private" as Visibility });
        await use({ name, roomId });
    },
    // A second joined room sharing a prefix with the first, so that a single query yields
    // two results — needed to exercise keyboard navigation between them.
    room2: async ({ app }, use) => {
        const name = "247 bis";
        const roomId = await app.client.createRoom({ name, visibility: "private" as Visibility });
        await use({ name, roomId });
    },
    context: async ({ context, homeserver }, use) => {
        // Restart the homeserver to wipe its in-memory db so we can reuse the same user ID without cross-signing prompts
        await homeserver.restart();
        await use(context);
    },
});

test.describe("Spotlight", () => {
    test.skip(isDendrite, "due to a Dendrite bug https://github.com/element-hq/dendrite/issues/3488");
    test.use({
        displayName: "Jim",
    });

    test.beforeEach(async ({ page, user, room1, room2 }) => {
        await page.goto(`/#/room/${room1.roomId}`);
        await expect(page.locator(".mx_RoomSublist_skeletonUI")).not.toBeAttached();
    });

    test("should offer no filter to select", async ({ page, app }) => {
        const spotlight = await app.openSpotlight();
        await page.waitForTimeout(500); // wait for the dialog to settle

        // Neither people (SCAT-14) nor public rooms / public spaces (SCAT-43)
        await expect(spotlight.dialog.locator("#mx_SpotlightDialog_button_startChat")).not.toBeAttached();
        await expect(spotlight.dialog.locator("#mx_SpotlightDialog_button_explorePublicRooms")).not.toBeAttached();
        await expect(spotlight.dialog.locator("#mx_SpotlightDialog_button_explorePublicSpaces")).not.toBeAttached();

        // Only the hand-over to message search is left in "other searches"
        await expect(spotlight.dialog.locator("#mx_SpotlightDialog_button_searchMessages")).toBeAttached();

        // With nothing to filter on, no filter chip can ever be applied
        await spotlight.searchBox.press("Enter");
        await expect(spotlight.dialog.locator(".mx_SpotlightDialog_filter")).not.toBeAttached();
    });

    test("should find joined rooms", async ({ page, app, room1 }) => {
        const spotlight = await app.openSpotlight();
        await page.waitForTimeout(500); // wait for the dialog to settle
        await spotlight.search(room1.name);
        const resultLocator = spotlight.results;
        await expect(resultLocator).toHaveCount(2); // "247" and "247 bis"
        await expect(resultLocator.first()).toContainText(room1.name);
        await resultLocator.first().click();
        await expect(page).toHaveURL(new RegExp(`#/room/${room1.roomId}`));
        await expect(roomHeaderName(page)).toContainText(room1.name);
    });

    test("should not offer to join a room by its address", async ({ page, app }) => {
        const spotlight = await app.openSpotlight();
        await page.waitForTimeout(500); // wait for the dialog to settle
        await spotlight.search("#some-room:example.org");
        await page.waitForTimeout(500);

        await expect(spotlight.dialog.locator("#mx_SpotlightDialog_button_joinRoomAlias")).not.toBeAttached();
        await expect(spotlight.dialog.locator("#mx_SpotlightDialog_button_createNewRoom")).not.toBeAttached();
    });

    test("should be able to navigate results via keyboard", async ({ page, app, room1 }) => {
        const spotlight = await app.openSpotlight();
        await page.waitForTimeout(500); // wait for the dialog to settle
        await spotlight.search(room1.name);

        let resultLocator = spotlight.results;
        await expect(resultLocator).toHaveCount(2);
        await expect(resultLocator.first()).toHaveAttribute("aria-selected", "true");
        await expect(resultLocator.last()).toHaveAttribute("aria-selected", "false");

        await spotlight.searchBox.press("ArrowDown");
        resultLocator = spotlight.results;
        await expect(resultLocator.first()).toHaveAttribute("aria-selected", "false");
        await expect(resultLocator.last()).toHaveAttribute("aria-selected", "true");

        await spotlight.searchBox.press("ArrowUp");
        resultLocator = spotlight.results;
        await expect(resultLocator.first()).toHaveAttribute("aria-selected", "true");
        await expect(resultLocator.last()).toHaveAttribute("aria-selected", "false");
    });
});
