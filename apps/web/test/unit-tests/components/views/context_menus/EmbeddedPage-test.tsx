/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import fetchMock from "@fetch-mock/jest";
import { render, screen, waitFor } from "jest-matrix-react";
import { mocked } from "jest-mock";

import { _t } from "../../../../../src/languageHandler";
import EmbeddedPage from "../../../../../src/components/structures/EmbeddedPage";

jest.mock("../../../../../src/languageHandler", () => ({
    _t: jest.fn(),
}));

describe("<EmbeddedPage />", () => {
    it.each([`"`, `'`, `&#27;`, `&#34;`])("should translate _t strings [%s]", async (character) => {
        mocked(_t).mockReturnValue("Przeglądaj pokoje");
        fetchMock.get("https://home.page", {
            body: `<h1>_t(${character}Explore rooms${character})</h1>`,
        });

        const { asFragment } = render(<EmbeddedPage url="https://home.page" />);
        await screen.findByText("Przeglądaj pokoje");
        expect(_t).toHaveBeenCalledWith("Explore rooms");
        expect(asFragment()).toMatchSnapshot();
    });

    it("should show error if unable to load", async () => {
        mocked(_t).mockReturnValue("Couldn't load page");
        fetchMock.get("https://other.page", {
            status: 404,
        });

        const { asFragment } = render(<EmbeddedPage url="https://other.page" />);
        await screen.findByText("Couldn't load page");
        expect(_t).toHaveBeenCalledWith("cant_load_page");
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render nothing if no url given", () => {
        const { asFragment } = render(<EmbeddedPage />);
        expect(asFragment()).toMatchSnapshot();
    });

    it("should sanitise input", async () => {
        fetchMock.get("https://other.page", `<h1>Foo</h1><iframe src="https://home.page" />`);

        const { asFragment } = render(<EmbeddedPage url="https://other.page" />);
        await expect(screen.findByText("Foo")).resolves.toBeVisible();
        expect(screen.queryByRole("iframe")).not.toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should preserve inline SVG icons", async () => {
        fetchMock.get(
            "https://svg.page",
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="48"></rect><path d="M68 76V64H52"></path></svg>`,
        );

        const { container } = render(<EmbeddedPage url="https://svg.page" />);
        await waitFor(() => expect(container.querySelector("svg")).toBeInTheDocument());
        const svg = container.querySelector("svg")!;
        expect(svg.getAttribute("viewBox")).toBe("0 0 96 96");
        expect(container.querySelector("svg path")).toBeInTheDocument();
    });

    it("should preserve inline <style> blocks and class attributes", async () => {
        fetchMock.get(
            "https://styled.page",
            `<style>.fill-pink { fill: #f0f; }</style><div class="room-content"><span class="fill-pink">Hello</span></div>`,
        );

        const { container } = render(<EmbeddedPage url="https://styled.page" />);
        await waitFor(() => expect(container.querySelector("style")).toBeInTheDocument());
        expect(container.querySelector("style")!.textContent).toContain(".fill-pink");
        expect(container.querySelector(".room-content .fill-pink")).toBeInTheDocument();
    });
});
