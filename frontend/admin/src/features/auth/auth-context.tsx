import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type PropsWithChildren,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import { adminSessionKey, adminTokenKey, authService } from "./auth-service";
import type { AuthUser, LoginRequest } from "./auth-types";

type AuthContextValue = {
    user: AuthUser | null;
    loading: boolean;
    isAuthenticated: boolean;
    login: (request: LoginRequest) => Promise<void>;
    logout: () => void;
    refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): AuthUser | null {
    try {
        return JSON.parse(localStorage.getItem(adminSessionKey) ?? "null") as AuthUser | null;
    } catch {
        return null;
    }
}

export function AdminAuthProvider({ children }: PropsWithChildren) {
    const queryClient = useQueryClient();
    const [user, setUser] = useState<AuthUser | null>(readStoredUser);
    const [loading, setLoading] = useState(Boolean(localStorage.getItem(adminTokenKey)));

    const logout = useCallback(() => {
        localStorage.removeItem(adminTokenKey);
        localStorage.removeItem(adminSessionKey);
        setUser(null);
        queryClient.clear();
    }, [queryClient]);

    const refresh = useCallback(async () => {
        if (!localStorage.getItem(adminTokenKey)) {
            localStorage.removeItem(adminSessionKey);
            setLoading(false);
            setUser(null);
            return;
        }

        try {
            const current = await authService.me();
            if (!current.isAdmin) throw new Error("Administrator access is required.");
            localStorage.setItem(adminSessionKey, JSON.stringify(current));
            setUser(current);
        } catch {
            logout();
        } finally {
            setLoading(false);
        }
    }, [logout]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const login = useCallback(async (request: LoginRequest) => {
        const response = await authService.login(request);
        if (!response.user.isAdmin) throw new Error("Administrator access is required.");
        localStorage.setItem(adminTokenKey, response.token);
        localStorage.setItem(adminSessionKey, JSON.stringify(response.user));
        setUser(response.user);
        await queryClient.invalidateQueries();
    }, [queryClient]);

    const value = useMemo<AuthContextValue>(() => ({
        user,
        loading,
        isAuthenticated: Boolean(user),
        login,
        logout,
        refresh,
    }), [loading, login, logout, refresh, user]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAdminAuth() {
    const value = useContext(AuthContext);
    if (!value) throw new Error("useAdminAuth must be used inside AdminAuthProvider.");
    return value;
}
