/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// SCAT-76: when a session is soft-logged-out (expired access token), Element restarts SSO automatically
// instead of showing the soft logout screen. This guard prevents a redirect loop between Element, the
// homeserver and the SSO provider when the round trip does not log the user back in (token login refused,
// SSO provider returning without a login token…): an automatic redirect is attempted at most once per
// retry delay in a given tab. It lives in sessionStorage so that it survives the SSO redirects.

const LAST_ATTEMPT_STORAGE_KEY = "mx_kosmos_soft_logout_sso_attempt";

/** Minimum delay between two automatic SSO redirects after a soft logout, in a given tab. */
export const SOFT_LOGOUT_SSO_RETRY_DELAY_MS = 2 * 60 * 1000;

/**
 * Whether an automatic SSO redirect may be started for a soft-logged-out session.
 * @param now the current timestamp, in milliseconds.
 */
export function canAutoRedirectToSsoAfterSoftLogout(now = Date.now()): boolean {
    const lastAttempt = Number(sessionStorage.getItem(LAST_ATTEMPT_STORAGE_KEY));
    return !lastAttempt || now - lastAttempt >= SOFT_LOGOUT_SSO_RETRY_DELAY_MS;
}

/**
 * Remember that an automatic SSO redirect is being started for a soft-logged-out session.
 * @param now the current timestamp, in milliseconds.
 */
export function markSoftLogoutSsoAttempt(now = Date.now()): void {
    sessionStorage.setItem(LAST_ATTEMPT_STORAGE_KEY, String(now));
}

/** Forget the last automatic SSO redirect, once the user is logged back in. */
export function clearSoftLogoutSsoAttempt(): void {
    sessionStorage.removeItem(LAST_ATTEMPT_STORAGE_KEY);
}
