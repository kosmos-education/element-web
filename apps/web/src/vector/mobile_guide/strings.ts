/*
Copyright 2026 Kosmos

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Traductions du guide mobile.
 *
 * Ce bundle est volontairement tenu à l'écart de l'application — il doit se charger vite
 * sur un téléphone — et n'a donc pas accès à `languageHandler` ni aux catalogues de
 * `i18n/`. Les quelques phrases de la page sont reprises ici, dans les langues déclarées
 * par `available_languages` de `config.json`.
 */
const STRINGS = {
    fr: {
        heading: "La Bulle est disponible sur votre application Skolengo",
        intro: "Communiquez encore plus efficacement avec vos collaborateurs.",
        step1: "Téléchargez l’application Skolengo",
        step2: "Lancez l’application et connectez-vous",
        appStore: "Télécharger dans l’App Store",
        playStore: "Disponible sur Google Play",
        backToSite: "Continuer sur le site web",
    },
    en: {
        heading: "La Bulle is available in your Skolengo app",
        intro: "Communicate even more effectively with your colleagues.",
        step1: "Download the Skolengo app",
        step2: "Open the app and sign in",
        appStore: "Download on the App Store",
        playStore: "Get it on Google Play",
        backToSite: "Continue to the website",
    },
    es: {
        heading: "La Bulle está disponible en tu aplicación Skolengo",
        intro: "Comunícate de forma aún más eficaz con tus compañeros.",
        step1: "Descarga la aplicación Skolengo",
        step2: "Abre la aplicación e inicia sesión",
        appStore: "Consíguelo en el App Store",
        playStore: "Disponible en Google Play",
        backToSite: "Continuar en el sitio web",
    },
    de: {
        heading: "La Bulle ist in deiner Skolengo-App verfügbar",
        intro: "Kommuniziere noch effizienter mit deinen Kolleginnen und Kollegen.",
        step1: "Lade die Skolengo-App herunter",
        step2: "Öffne die App und melde dich an",
        appStore: "Laden im App Store",
        playStore: "Jetzt bei Google Play",
        backToSite: "Weiter zur Website",
    },
} as const;

type Language = keyof typeof STRINGS;
export type Strings = (typeof STRINGS)[Language];

const DEFAULT_LANGUAGE: Language = "fr";

function isSupported(language: string): language is Language {
    return language in STRINGS;
}

/**
 * Textes de la page dans la première langue du navigateur que nous connaissions.
 * Les régions sont ignorées : `de-AT` retient l'allemand.
 */
export function getStrings(languages: readonly string[]): Strings {
    for (const language of languages) {
        const withoutRegion = language.split("-")[0].toLowerCase();
        if (isSupported(withoutRegion)) return STRINGS[withoutRegion];
    }

    return STRINGS[DEFAULT_LANGUAGE];
}
