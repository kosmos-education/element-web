/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach, type MockedObject } from "vitest";
import React from "react";
import { render, screen, waitFor } from "test-utils-rtl";
import { type MatrixClient, SSOAction } from "matrix-js-sdk/src/matrix";
import { getMockClientWithEventEmitter, mockPlatformPeg, unmockClientPeg, unmockPlatformPeg } from "test-utils";

import SoftLogout from "./SoftLogout";
import SdkConfig from "../../../SdkConfig";
import type BasePlatform from "../../../BasePlatform";
import { SSO_HOMESERVER_URL_KEY } from "../../../BasePlatform";
import * as Lifecycle from "../../../Lifecycle";
import * as LoginModule from "../../../Login";
import { type URLParams } from "../../../vector/url_utils.ts";
import { markSoftLogoutSsoAttempt, SOFT_LOGOUT_SSO_RETRY_DELAY_MS } from "../../../utils/softLogoutSsoGuard.ts";

const fragmentAfterLogin = "/room/!room:server";

// SCAT-76: an expired session (session_lifetime) must restart SSO by itself instead of asking the user
// to click the SSO button, without ever looping when the SSO round trip does not log them back in.
describe("<SoftLogout />", () => {
    let client: MockedObject<MatrixClient>;
    let platform: MockedObject<BasePlatform>;

    const getComponent = (urlParams: URLParams = {}, onTokenLoginCompleted = vi.fn()) =>
        render(
            <SoftLogout
                urlParams={urlParams}
                fragmentAfterLogin={fragmentAfterLogin}
                onTokenLoginCompleted={onTokenLoginCompleted}
            />,
        );

    const mockFlows = (...types: string[]) =>
        client.loginFlows.mockResolvedValue({ flows: types.map((type) => ({ type })) });

    beforeEach(() => {
        sessionStorage.clear();
        localStorage.clear();
        SdkConfig.reset();
        SdkConfig.put({ sso_redirect_options: { immediate: true } });
        platform = mockPlatformPeg({ startSingleSignOn: vi.fn() });
        client = getMockClientWithEventEmitter({
            loginFlows: vi.fn(),
            getUserId: vi.fn().mockReturnValue("@user:server"),
            getDeviceId: vi.fn().mockReturnValue("DEVICE"),
            getHomeserverUrl: vi.fn().mockReturnValue("https://synapse"),
            getIdentityServerUrl: vi.fn().mockReturnValue(undefined),
            getSsoLoginUrl: vi.fn().mockReturnValue("https://synapse/sso"),
        });
        mockFlows("m.login.sso");
        vi.spyOn(Lifecycle, "isSoftLogout").mockReturnValue(true);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        unmockClientPeg();
        unmockPlatformPeg();
        sessionStorage.clear();
        localStorage.clear();
    });

    it("restarts SSO automatically when the homeserver only offers SSO", async () => {
        getComponent();

        await waitFor(() =>
            expect(platform.startSingleSignOn).toHaveBeenCalledWith(
                client,
                "sso",
                fragmentAfterLogin,
                undefined,
                SSOAction.LOGIN,
            ),
        );
        expect(screen.queryByRole("button", { name: /single sign-on/i })).not.toBeInTheDocument();
    });

    it("restarts CAS automatically when the homeserver only offers CAS", async () => {
        mockFlows("m.login.cas");
        getComponent();

        await waitFor(() =>
            expect(platform.startSingleSignOn).toHaveBeenCalledWith(
                client,
                "cas",
                fragmentAfterLogin,
                undefined,
                SSOAction.LOGIN,
            ),
        );
    });

    it("shows the soft logout screen when immediate SSO redirect is not enabled", async () => {
        SdkConfig.reset();
        getComponent();

        await screen.findByRole("button", { name: /single sign-on/i });
        expect(platform.startSingleSignOn).not.toHaveBeenCalled();
    });

    it("shows the soft logout screen when the homeserver also offers password login", async () => {
        mockFlows("m.login.password", "m.login.sso");
        getComponent();

        await screen.findByRole("button", { name: /single sign-on/i });
        expect(platform.startSingleSignOn).not.toHaveBeenCalled();
    });

    it("does not restart SSO twice within the retry delay", async () => {
        markSoftLogoutSsoAttempt(Date.now() - 1000);
        getComponent();

        await screen.findByRole("button", { name: /single sign-on/i });
        expect(platform.startSingleSignOn).not.toHaveBeenCalled();
    });

    it("restarts SSO again once the retry delay has elapsed", async () => {
        markSoftLogoutSsoAttempt(Date.now() - SOFT_LOGOUT_SSO_RETRY_DELAY_MS - 1000);
        getComponent();

        await waitFor(() => expect(platform.startSingleSignOn).toHaveBeenCalled());
    });

    it("does not restart SSO after a failed token login, to avoid looping", async () => {
        localStorage.setItem(SSO_HOMESERVER_URL_KEY, "https://synapse");
        vi.spyOn(LoginModule, "sendLoginRequest").mockRejectedValue(new Error("M_LIMIT_EXCEEDED"));

        getComponent({ legacy_sso: { loginToken: "token" } });

        await screen.findByRole("button", { name: /single sign-on/i });
        expect(platform.startSingleSignOn).not.toHaveBeenCalled();
    });

    it("keeps the device and forgets the last attempt after a successful token login", async () => {
        markSoftLogoutSsoAttempt();
        localStorage.setItem(SSO_HOMESERVER_URL_KEY, "https://synapse");
        const credentials = { userId: "@user:server", deviceId: "DEVICE", accessToken: "new", homeserverUrl: "" };
        const sendLoginRequest = vi.spyOn(LoginModule, "sendLoginRequest").mockResolvedValue(credentials);
        vi.spyOn(Lifecycle, "hydrateSession").mockResolvedValue(client);
        const onTokenLoginCompleted = vi.fn();

        getComponent({ legacy_sso: { loginToken: "token" } }, onTokenLoginCompleted);

        await waitFor(() => expect(onTokenLoginCompleted).toHaveBeenCalled());
        expect(sendLoginRequest).toHaveBeenCalledWith("https://synapse", undefined, "m.login.token", {
            token: "token",
            device_id: "DEVICE",
        });
        expect(sessionStorage.getItem("mx_kosmos_soft_logout_sso_attempt")).toBeNull();
        expect(platform.startSingleSignOn).not.toHaveBeenCalled();
    });

    // SCAT-77: when the screen does show up (loop guard, failed token login), it tells the user that their
    // session has expired, without the "Clear personal data" section about encryption keys.
    describe("expired session screen", () => {
        beforeEach(() => {
            SdkConfig.reset();
            SdkConfig.put({ brand: "La Bulle" });
        });

        it("explains that the session has expired", async () => {
            getComponent();

            await screen.findByRole("button", { name: /single sign-on/i });
            expect(screen.getByRole("heading", { level: 1, name: "Your session has expired" })).toBeInTheDocument();
            expect(screen.getByText(/your La Bulle session has a limited duration/)).toBeInTheDocument();
            expect(screen.queryByText("You're signed out")).not.toBeInTheDocument();
        });

        it("does not offer to clear personal data", async () => {
            getComponent();

            await screen.findByRole("button", { name: /single sign-on/i });
            expect(screen.queryByText("Clear personal data")).not.toBeInTheDocument();
            expect(screen.queryByText(/encryption keys/)).not.toBeInTheDocument();
            expect(screen.queryByRole("button", { name: "Clear all data" })).not.toBeInTheDocument();
        });
    });
});
