/*
Copyright 2026 Kosmos

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useCallback, useContext, useMemo } from "react";
import { AutoHideScrollbar } from "@element-hq/web-shared-components";
import { Button } from "@vector-im/compound-web";
import { ChatSolidIcon, PopOutIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../languageHandler";
import QRCode from "../views/elements/QRCode";
import SdkConfig from "../../SdkConfig";
import { SDKContext } from "../../contexts/SDKContext";
import { UPDATE_TOP_LEVEL_SPACES } from "../../stores/spaces";
import { useEventEmitterState } from "../../hooks/useEventEmitter";

/**
 * Page d'accueil de La Bulle (SCAT-53).
 *
 * Remplace les deux mécanismes d'accueil d'Element — la page intégrée et la page
 * HTML statique servie via `embedded_pages.home_url` — par une page applicative
 * aux couleurs de La Bulle. Le contenu est éditorial : il ne dépend ni du compte
 * de l'utilisateur ni des salons auxquels il a accès, et est donc identique pour
 * tout le monde.
 */
/**
 * Adresse de la page publique qui renvoie vers le magasin d'applications (SCAT-58),
 * encodée dans le QR code. Elle est dérivée de l'adresse consultée — même convention
 * que `getVectorConfig` pour `config.json` — afin de rester juste sur tous les
 * déploiements, y compris servis sous un sous-chemin, sans paramétrage.
 */
function getAppRedirectUrl(): string {
    return new URL("app/", window.location.href).toString();
}

const LaBulleHomePage: React.FC = (): JSX.Element => {
    const sdkContext = useContext(SDKContext);
    const appRedirectUrl = useMemo(getAppRedirectUrl, []);
    // Premier espace de la barre latérale gauche : un utilisateur peut en avoir
    // plusieurs, on retient celui du haut. `spacePanelSpaces` est déjà trié et
    // filtré comme le panneau, les deux restent donc d'accord. La liste se remplit
    // après la connexion, souvent une fois la page d'accueil déjà affichée, d'où
    // l'abonnement plutôt qu'une simple lecture.
    const firstSpace = useEventEmitterState(
        sdkContext.spaceStore,
        UPDATE_TOP_LEVEL_SPACES,
        () => sdkContext.spaceStore.spacePanelSpaces[0],
    );

    const onStartChatting = useCallback((): void => {
        if (!firstSpace) return;
        sdkContext.spaceStore.setActiveSpace(firstSpace.roomId);
    }, [firstSpace, sdkContext]);

    return (
        <AutoHideScrollbar className="mx_AutoHideScrollbar mx_HomePage mx_HomePage_laBulle" as="main">
            <div className="mx_HomePage_laBulle_wrapper">
                <div className="mx_HomePage_laBulle_content">
                    <h1 className="mx_HomePage_laBulle_title">{_t("home_page|welcome_title")}</h1>
                    <p className="mx_HomePage_laBulle_intro">{_t("home_page|welcome_description")}</p>

                    <div className="mx_HomePage_laBulle_actions">
                        {/* Sans espace, l'action n'aurait nulle part où mener : on la masque. */}
                        {firstSpace && (
                            <Button kind="primary" size="md" Icon={ChatSolidIcon} onClick={onStartChatting}>
                                {_t("home_page|start_chatting")}
                            </Button>
                        )}
                        <Button
                            as="a"
                            kind="secondary"
                            size="md"
                            Icon={PopOutIcon}
                            href={SdkConfig.get("help_url")}
                            target="_blank"
                            rel="noreferrer noopener"
                        >
                            {_t("home_page|how_it_works")}
                        </Button>
                    </div>
                </div>

                <aside className="mx_HomePage_laBulle_download">
                    <h2 className="mx_HomePage_laBulle_download_title">{_t("home_page|download_title")}</h2>
                    <div className="mx_HomePage_laBulle_download_card">
                        <QRCode data={appRedirectUrl} width={256} className="mx_HomePage_laBulle_download_qr" />
                        <p className="mx_HomePage_laBulle_download_hint">{_t("home_page|download_hint")}</p>
                    </div>
                </aside>
            </div>
        </AutoHideScrollbar>
    );
};

export default LaBulleHomePage;
