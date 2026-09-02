/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import "./index.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";

import { getVectorConfig } from "../getconfig";
import { getStrings } from "./strings.ts";

function onBackToElementClick(): void {
    sessionStorage.setItem("skip_mobile_redirect", "true");
    window.location.href = "../";
}

// NEVER pass user-controlled content to this function! Hardcoded strings only please.
function renderConfigError(message: string): void {
    const contactMsg =
        "If this is unexpected, please contact your system administrator or technical support representative.";
    message = `<h2>Error loading La Bulle</h2><p>${message}</p><p>${contactMsg}</p>`;

    const toHide = document.getElementsByClassName("mx_HomePage_container");
    const errorContainers = document.getElementsByClassName(
        "mx_HomePage_errorContainer",
    ) as HTMLCollectionOf<HTMLDivElement>;

    for (const e of toHide) {
        // We have to clear the content because .style.display='none'; doesn't work
        // due to an !important in the CSS.
        e.innerHTML = "";
    }
    for (const e of errorContainers) {
        e.style.display = "block";
        e.innerHTML = message;
    }
}

/** Pointe un badge de magasin vers son application, ou le retire faute d'adresse. */
function setStoreLink(linkId: string, badgeId: string, url: string | undefined, label: string): void {
    const link = document.getElementById(linkId) as HTMLAnchorElement | null;
    if (!link) return;

    if (!url) {
        link.remove();
        return;
    }

    link.href = url;
    link.setAttribute("aria-label", label);
    document.getElementById(badgeId)?.setAttribute("alt", label);
}

function translatePage(): ReturnType<typeof getStrings> {
    const strings = getStrings(navigator.languages ?? [navigator.language]);

    document.getElementById("heading")!.textContent = strings.heading;
    document.getElementById("intro")!.textContent = strings.intro;
    document.getElementById("step1_heading")!.textContent = strings.step1;
    document.getElementById("step2_heading")!.textContent = strings.step2;
    document.getElementById("back_to_element_button")!.textContent = strings.backToSite;

    return strings;
}

async function initPage(): Promise<void> {
    const strings = translatePage();
    document.getElementById("back_to_element_button")!.onclick = onBackToElementClick;

    const config = await getVectorConfig("..");
    const mobileBuilds = config?.["mobile_builds"];

    if (!mobileBuilds?.ios && !mobileBuilds?.android) {
        return renderConfigError("Invalid configuration: no mobile application specified.");
    }

    setStoreLink("app_store_link", "app_store_badge", mobileBuilds.ios ?? undefined, strings.appStore);
    setStoreLink("play_store_link", "play_store_badge", mobileBuilds.android ?? undefined, strings.playStore);
}

void initPage();
