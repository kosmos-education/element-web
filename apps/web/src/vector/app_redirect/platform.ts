/*
Copyright 2026 Kosmos

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export type MobilePlatform = "android" | "ios";

/**
 * Système de l'appareil qui consulte la page, ou `undefined` si on ne sait pas trancher.
 *
 * Depuis iPadOS 13, un iPad se présente comme un Mac : seule la présence d'un écran tactile
 * l'en distingue, d'où `maxTouchPoints`.
 */
export function detectPlatform(userAgent: string, maxTouchPoints: number): MobilePlatform | undefined {
    if (/android/i.test(userAgent)) return "android";
    if (/iPad|iPhone|iPod/.test(userAgent)) return "ios";
    if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return "ios";

    return undefined;
}
