/*
Copyright 2026 Kosmos

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "jest-matrix-react";

import { MessageRetentionBanner } from "../../../../../src/components/views/rooms/MessageRetentionBanner";
import SdkConfig from "../../../../../src/SdkConfig";

// Kosmos (SCAT-61) : avertissement de conservation des messages, piloté par
// `kosmos.message_retention_days` dans config.json.
describe("<MessageRetentionBanner />", () => {
    afterEach(() => {
        SdkConfig.reset();
    });

    it("renders nothing when no retention duration is configured", () => {
        const { container } = render(<MessageRetentionBanner />);

        expect(container).toBeEmptyDOMElement();
    });

    it("announces the configured duration in the plural", () => {
        SdkConfig.add({ kosmos: { message_retention_days: 90 } });

        render(<MessageRetentionBanner />);

        expect(screen.getByText(/disappear after 90 days/)).toBeInTheDocument();
    });

    it("announces a single day in the singular", () => {
        SdkConfig.add({ kosmos: { message_retention_days: 1 } });

        render(<MessageRetentionBanner />);

        expect(screen.getByText(/disappear after 1 day\./)).toBeInTheDocument();
    });

    it("cannot be dismissed", () => {
        SdkConfig.add({ kosmos: { message_retention_days: 90 } });

        render(<MessageRetentionBanner />);

        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it.each([0, -1, 1.5, "90" as unknown as number])(
        "renders nothing for the unusable duration %p",
        (message_retention_days) => {
            SdkConfig.add({ kosmos: { message_retention_days } });

            const { container } = render(<MessageRetentionBanner />);

            expect(container).toBeEmptyDOMElement();
        },
    );
});
