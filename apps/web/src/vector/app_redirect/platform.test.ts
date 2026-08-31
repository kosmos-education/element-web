/*
Copyright 2026 Kosmos

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect } from "vitest";

import { detectPlatform } from "./platform";

describe("detectPlatform()", () => {
    it.each([
        [
            "Android phone",
            "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
        ],
        ["Android tablet on Firefox", "Mozilla/5.0 (Android 13; Tablet; rv:127.0) Gecko/127.0 Firefox/127.0"],
    ])("detects %s", (_name, userAgent) => {
        expect(detectPlatform(userAgent, 5)).toBe("android");
    });

    it.each([
        [
            "iPhone",
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
        ],
        [
            "iPad on iOS 12",
            "Mozilla/5.0 (iPad; CPU OS 12_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1",
        ],
    ])("detects %s", (_name, userAgent) => {
        expect(detectPlatform(userAgent, 5)).toBe("ios");
    });

    it("detects an iPad claiming to be a Mac", () => {
        const userAgent =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
        expect(detectPlatform(userAgent, 5)).toBe("ios");
    });

    it("leaves an actual Mac undetermined", () => {
        const userAgent =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
        expect(detectPlatform(userAgent, 0)).toBeUndefined();
    });

    it("leaves a desktop browser undetermined", () => {
        const userAgent =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
        expect(detectPlatform(userAgent, 0)).toBeUndefined();
    });
});
