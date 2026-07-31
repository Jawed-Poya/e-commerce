const AdminSessionKey = "easycart-admin-session";

export function getOfflineOwnerKey(): string | null {
    try {
        const session = JSON.parse(localStorage.getItem(AdminSessionKey) ?? "null") as {
            userId?: string;
            branchId?: number | null;
        } | null;
        if (!session?.userId) return null;
        return `${session.userId}:${session.branchId ?? "company"}`;
    } catch {
        return null;
    }
}
