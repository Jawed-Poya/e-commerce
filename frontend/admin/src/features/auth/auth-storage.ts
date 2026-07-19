export const adminTokenKey = "easycart-admin-token";
export const adminSessionKey = "easycart-admin-session";
export const adminUnauthorizedEvent = "easycart-admin-unauthorized";

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

export function clearAdminSession() {
    localStorage.removeItem(adminTokenKey);
    localStorage.removeItem(adminSessionKey);
    localStorage.removeItem(legacyAdminTokenKey);
}
