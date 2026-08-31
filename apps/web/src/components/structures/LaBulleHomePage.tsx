/*
Copyright 2026 Kosmos

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { AutoHideScrollbar } from "@element-hq/web-shared-components";

import { _t } from "../../languageHandler";

/**
 * Page d'accueil de La Bulle (SCAT-53).
 *
 * Remplace les deux mécanismes d'accueil d'Element — la page intégrée et la page
 * HTML statique servie via `embedded_pages.home_url` — par une page applicative
 * aux couleurs de La Bulle. Le contenu est éditorial : il ne dépend ni du compte
 * de l'utilisateur ni des salons auxquels il a accès, et est donc identique pour
 * tout le monde.
 */
const LaBulleHomePage: React.FC = (): JSX.Element => {
    return (
        <AutoHideScrollbar className="mx_AutoHideScrollbar mx_HomePage mx_HomePage_laBulle" as="main">
            <div className="mx_HomePage_laBulle_wrapper">
                <div className="mx_HomePage_laBulle_content">
                    <h1 className="mx_HomePage_laBulle_title">{_t("home_page|welcome_title")}</h1>
                    <p className="mx_HomePage_laBulle_intro">{_t("home_page|welcome_description")}</p>
                </div>
            </div>
        </AutoHideScrollbar>
    );
};

export default LaBulleHomePage;
