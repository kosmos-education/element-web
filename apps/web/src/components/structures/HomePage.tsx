/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import LaBulleHomePage from "./LaBulleHomePage";

interface IProps {
    /**
     * Conservé pour ne pas modifier la chaîne MatrixChat → LoggedInView, mais sans
     * effet : la page d'accueil de La Bulle est la même à la première connexion.
     */
    justRegistered?: boolean;
}

/**
 * Page d'accueil. Kosmos (SCAT-54) : la page intégrée d'Element et la page HTML
 * statique (`embedded_pages.home_url`) sont remplacées par la page La Bulle, qui
 * s'affiche désormais quel que soit le paramétrage.
 */
const HomePage: React.FC<IProps> = (): JSX.Element => {
    return <LaBulleHomePage />;
};

export default HomePage;
