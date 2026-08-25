/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type UIComponent, UIComponent as UIComponentEnum } from "../../settings/UIFeature";
import { ComponentVisibilityCustomisations } from "../ComponentVisibility";
import { ModuleApi } from "../../modules/Api.ts";

export function shouldShowComponent(component: UIComponent): boolean {
    // kosmos: l'annuaire public est retiré de la recherche (SCAT-43), donc le bouton
    // « Explorer les salons » n'a plus d'objet. On le neutralise ici, point de passage
    // unique de tous ses sites d'affichage (RoomListSearchViewModel, LeftPanel,
    // LegacyRoomListHeader, LegacyRoomList).
    if (component === UIComponentEnum.ExploreRooms) return false;

    return (
        ModuleApi.instance.customisations.shouldShowComponent(component) ??
        ComponentVisibilityCustomisations.shouldShowComponent?.(component) ??
        true
    );
}
