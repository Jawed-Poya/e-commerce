export const adminTokenKey = "easycart-admin-token";
export const adminSessionKey = "easycart-admin-session";
export const adminUnauthorizedEvent = "easycart-admin-unauthorized";

export interface AdminUnauthorizedEventDetail {
    token: string;
}

const legacyAdminTokenKey = "token";

export function isUsableAdminToken(value: unknown): value is string {
    if (typeof value !== "string") return false;

    const token = value.trim();
    if (!token || token === "undefined" || token === "null") return false;

    // EasyCart issues a signed compact JWT: header.payload.signature.
    return token.split(".").length === 3;
}

function readToken(key: string) {
    const value = localStorage.getItem(key);
    if (isUsableAdminToken(value)) return value;

    if (value !== null) localStorage.removeItem(key);
    return null;
}

export function getAdminToken() {
    const token = readToken(adminTokenKey);
    if (token) return token;

    const legacyToken = readToken(legacyAdminTokenKey);
    if (!legacyToken) return null;

    localStorage.setItem(adminTokenKey, legacyToken);
    localStorage.removeItem(legacyAdminTokenKey);
    return legacyToken;
}

export function saveAdminSession(token: string, user: unknown) {
    if (!isUsableAdminToken(token)) {
        throw new Error("The server returned an invalid administrator token.");
    }

    localStorage.setItem(adminTokenKey, token.trim());
    localStorage.setItem(adminSessionKey, JSON.stringify(user));
    localStorage.removeItem(legacyAdminTokenKey);
}

/**
 * Clears the session only when the current token matches the token that failed.
 * This prevents a delayed response from an old request from deleting a newly
 * issued token after a successful login.
 */
export function clearAdminSession(expectedToken?: string) {
    if (expectedToken && getAdminToken() !== expectedToken) {
        return false;
    }

    localStorage.removeItem(adminTokenKey);
    localStorage.removeItem(adminSessionKey);
    localStorage.removeItem(legacyAdminTokenKey);
    return true;
}

export function dispatchAdminUnauthorized(token: string) {
    window.dispatchEvent(
        new CustomEvent<AdminUnauthorizedEventDetail>(adminUnauthorizedEvent, {
            detail: { token },
        }),
    );
}
