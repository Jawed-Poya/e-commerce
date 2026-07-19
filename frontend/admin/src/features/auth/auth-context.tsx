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

import { authService } from "./auth-service";
import {
    adminSessionKey,
    adminUnauthorizedEvent,
    clearAdminSession,
    getAdminToken,
    saveAdminSession,
} from "./auth-storage";
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
    const [loading, setLoading] = useState(Boolean(getAdminToken()));

    const resetSessionState = useCallback(() => {
        clearAdminSession();
        setUser(null);
        setLoading(false);
        queryClient.clear();
    }, [queryClient]);

    const logout = useCallback(() => {
        resetSessionState();
    }, [resetSessionState]);

    const refresh = useCallback(async () => {
        if (!getAdminToken()) {
            resetSessionState();
            return;
        }

        setLoading(true);
        try {
            const current = await authService.me();
            if (!current.isAdmin) {
                throw new Error("Administrator access is required.");
            }

            localStorage.setItem(adminSessionKey, JSON.stringify(current));
            setUser(current);
        } catch {
            resetSessionState();
        } finally {
            setLoading(false);
        }
    }, [resetSessionState]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    useEffect(() => {
        const handleUnauthorized = () => resetSessionState();
        window.addEventListener(adminUnauthorizedEvent, handleUnauthorized);
        return () => window.removeEventListener(adminUnauthorizedEvent, handleUnauthorized);
    }, [resetSessionState]);

    const login = useCallback(async (request: LoginRequest) => {
        const response = await authService.login(request);
        if (!response.user.isAdmin) {
            throw new Error("Administrator access is required.");
        }

        saveAdminSession(response.token, response.user);
        setUser(response.user);
        setLoading(false);
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
