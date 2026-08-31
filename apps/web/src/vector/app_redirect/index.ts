/*
Copyright 2026 Kosmos

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { getVectorConfig } from "../getconfig";
import { detectPlatform } from "./platform";

/** Page vers laquelle se rabattre quand l'appareil n'a pas pu être déterminé. */
const MOBILE_GUIDE_PATH = "../mobile_guide/";

/**
 * Cible du QR code de la page d'accueil (SCAT-58) : envoie l'appareil qui vient de scanner
 * vers le magasin d'applications correspondant, sans écran intermédiaire.
 */
async function redirect(): Promise<void> {
    const platform = detectPlatform(navigator.userAgent, navigator.maxTouchPoints);

    if (platform) {
        const config = await getVectorConfig("..");
        const storeUrl = config?.["mobile_builds"]?.[platform];
        if (storeUrl) {
            window.location.replace(storeUrl);
            return;
        }
    }

    // Appareil indéterminé, ou magasin non paramétré pour cet appareil : le guide mobile
    // d'Element propose les liens de téléchargement et le retour vers le site.
    window.location.replace(MOBILE_GUIDE_PATH);
}

void redirect();
