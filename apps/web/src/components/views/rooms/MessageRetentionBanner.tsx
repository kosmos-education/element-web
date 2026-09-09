/*
Copyright 2026 Kosmos

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactElement } from "react";

import { _t } from "../../../languageHandler";
import SdkConfig from "../../../SdkConfig";

/**
 * Kosmos : avertissement sur l'usage attendu de La Bulle et sur le caractère éphémère des
 * messages, affiché au-dessus du champ de saisie d'un salon (SCAT-61).
 *
 * La durée de conservation annoncée vient de `kosmos.message_retention_days` dans
 * `config.json`. L'avertissement est affiché en permanence et n'est pas fermable.
 *
 * @returns `null` lorsque la durée n'est pas configurée, ou n'est pas un nombre de jours
 * exploitable — plutôt que d'annoncer une durée absurde.
 */
export const MessageRetentionBanner: React.FC = (): ReactElement | null => {
    const days = SdkConfig.get("kosmos")?.message_retention_days;

    if (typeof days !== "number" || !Number.isInteger(days) || days <= 0) return null;

    return (
        <p className="mx_MessageRetentionBanner">{_t("composer|kosmos_message_retention_notice", { count: days })}</p>
    );
};
