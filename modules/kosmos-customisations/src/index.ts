/*
Copyright 2026 Kosmos

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Api, Module, ModuleFactory } from "@element-hq/element-web-module-api";

/**
 * Module de customisations Kosmos pour Element Web.
 *
 * Regroupe les personnalisations d'interface Kosmos qui passent par le Module API,
 * afin de garder le code spécifique isolé du code d'Element (rebase-friendly).
 *
 * - Masque l'identifiant Matrix (userId, ex. « @user:homeserver ») dans toute
 *   l'application en surchargeant le point d'extension `UserIdentifier`
 *   (`getDisplayUserIdentifier` renvoie `null`).
 */
class KosmosCustomisationsModule implements Module {
    public static readonly moduleApiVersion = "^1.0.0";

    public constructor(private readonly api: Api) {}

    public async load(): Promise<void> {
        this.api._registerLegacyUserIdentifierCustomisations({
            getDisplayUserIdentifier: () => null,
        });
    }
}

export default KosmosCustomisationsModule satisfies ModuleFactory;
