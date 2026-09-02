/*
Copyright 2026 Kosmos

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect } from "vitest";

import { getStrings } from "./strings";

describe("getStrings()", () => {
    it("retains the first language it knows", () => {
        expect(getStrings(["es"]).heading).toContain("Skolengo");
        expect(getStrings(["nl", "de", "en"]).step2).toBe("Öffne die App und melde dich an");
    });

    it("ignores the region", () => {
        expect(getStrings(["de-AT"]).backToSite).toBe("Weiter zur Website");
    });

    it("falls back to French when no language matches", () => {
        expect(getStrings(["nl", "pt"]).backToSite).toBe("Continuer sur le site web");
        expect(getStrings([]).backToSite).toBe("Continuer sur le site web");
    });
});
