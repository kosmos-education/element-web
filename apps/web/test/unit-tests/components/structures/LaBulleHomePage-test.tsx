/*
Copyright 2026 Kosmos

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen, fireEvent } from "jest-matrix-react";
import { type Room } from "matrix-js-sdk/src/matrix";

// Avant l'import du composant : le helper installe le mock de « qrcode », que QRCode.tsx
// capture au chargement.
import { mockQRCodeRender, resetQRCodeMock, waitForQRCodeRender } from "../../../test-utils/qrcode";
import { toDataURL } from "qrcode";
import LaBulleHomePage from "../../../../src/components/structures/LaBulleHomePage";
import { SDKContext } from "../../../../src/contexts/SDKContext";
import { SDKContextClass } from "../../../../src/contexts/SDKContextClass";
import SdkConfig from "../../../../src/SdkConfig";

describe("<LaBulleHomePage/>", () => {
    let sdkContext: SDKContextClass;

    const renderPage = (): ReturnType<typeof render> =>
        render(
            <SDKContext.Provider value={sdkContext}>
                <LaBulleHomePage />
            </SDKContext.Provider>,
        );

    const givenSpaces = (...spaces: Room[]): void => {
        jest.spyOn(sdkContext.spaceStore, "spacePanelSpaces", "get").mockReturnValue(spaces);
    };

    beforeEach(() => {
        localStorage.clear();
        SdkConfig.reset();
        sdkContext = new SDKContextClass();
        mockQRCodeRender();
    });

    afterEach(() => {
        resetQRCodeMock();
    });

    it("welcomes the user to La Bulle", () => {
        givenSpaces();
        renderPage();
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("La Bulle");
    });

    it("presents the four rooms of a school, without making them clickable", () => {
        givenSpaces();
        const { container } = renderPage();

        const rooms = container.querySelectorAll(".mx_HomePage_laBulle_room");
        expect(rooms).toHaveLength(4);
        expect([...rooms].map((room) => room.querySelector(".mx_HomePage_laBulle_room_name")?.textContent)).toEqual([
            "Générale, an open communication room",
            "Vie scolaire",
            "SURNAME First name & Vie scolaire",
            "PPMS",
        ]);
        rooms.forEach((room) => {
            expect(room.querySelector("a, button")).toBeNull();
            // Les pastilles sont décoratives : le nom du salon les suit immédiatement.
            expect(room.querySelector("img")).toHaveAttribute("aria-hidden", "true");
        });
    });

    it("links to the configured help page in a new tab", () => {
        givenSpaces();
        SdkConfig.put({ help_url: "https://example.org/aide" });
        renderPage();

        const link = screen.getByRole("link", { name: "How does it work?" });
        expect(link).toHaveAttribute("href", "https://example.org/aide");
        expect(link).toHaveAttribute("target", "_blank");
    });

    it("switches to the first space of the space panel", () => {
        const first = { roomId: "!first:example.org" } as Room;
        const second = { roomId: "!second:example.org" } as Room;
        givenSpaces(first, second);
        const setActiveSpace = jest.spyOn(sdkContext.spaceStore, "setActiveSpace").mockImplementation(() => {});

        renderPage();
        fireEvent.click(screen.getByRole("button", { name: "Start a conversation" }));

        expect(setActiveSpace).toHaveBeenCalledWith("!first:example.org");
    });

    it("encodes the app redirect page of the current deployment in the QR code", async () => {
        givenSpaces();
        renderPage();
        await waitForQRCodeRender();

        expect(jest.mocked(toDataURL)).toHaveBeenCalledWith(`${window.location.origin}/app/`, expect.anything());
    });

    it("points the download link at the same page as the QR code", () => {
        givenSpaces();
        renderPage();

        const link = screen.getByRole("link", { name: "find all of Skolengo" });
        expect(link).toHaveAttribute("href", `${window.location.origin}/app/`);
        expect(link).toHaveAttribute("target", "_blank");
    });

    it("hides the conversation button while no space is available", () => {
        givenSpaces();
        renderPage();
        expect(screen.queryByRole("button", { name: "Start a conversation" })).not.toBeInTheDocument();
    });
});
