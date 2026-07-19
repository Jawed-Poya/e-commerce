export const adminTokenKey = "easycart-admin-token";
export const adminSessionKey = "easycart-admin-session";
export const adminUnauthorizedEvent = "easycart-admin-unauthorized";

export interface AdminUnauthorizedEventDetail {
    token: string;
}

const legacyAdminTokenKey = "token";

export function getAdminToken() {
    const token = localStorage.getItem(adminTokenKey);
    if (token) return token;

    const legacyToken = localStorage.getItem(legacyAdminTokenKey);
    if (!legacyToken) return null;

    localStorage.setItem(adminTokenKey, legacyToken);
    localStorage.removeItem(legacyAdminTokenKey);
    return legacyToken;
}

export function saveAdminSession(token: string, user: unknown) {
    localStorage.setItem(adminTokenKey, token);
    localStorage.setItem(adminSessionKey, JSON.stringify(user));
    localStorage.removeItem(legacyAdminTokenKey);
}

/**
 * Clears the session only when the current token matches the token that failed.
 * This prevents a delayed 401 from an old request from deleting a newly issued
 * token after a successful login.
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
