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
import { isAxiosError } from "axios";

import { authService } from "./auth-service";
import {
    type AdminUnauthorizedEventDetail,
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
        const token = getAdminToken();
        if (!token) {
            resetSessionState();
            return;
        }

        setLoading(true);
        try {
            const current = await authService.me();
            if (!current.isAdmin) {
                clearAdminSession(token);
                setUser(null);
                queryClient.clear();
                return;
            }

            localStorage.setItem(adminSessionKey, JSON.stringify(current));
            setUser(current);
        } catch (error) {
            const status = isAxiosError(error) ? error.response?.status : undefined;

            // Only a real authentication/authorization failure invalidates the
            // token. Timeouts and temporary backend outages keep the session.
            if ((status === 401 || status === 403) && clearAdminSession(token)) {
                setUser(null);
                queryClient.clear();
            }
        } finally {
            setLoading(false);
        }
    }, [queryClient, resetSessionState]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    useEffect(() => {
        const handleUnauthorized = (event: Event) => {
            const failedToken = (
                event as CustomEvent<AdminUnauthorizedEventDetail>
            ).detail?.token;

            if (!failedToken || getAdminToken() !== failedToken) {
                return;
            }

            resetSessionState();
        };

        window.addEventListener(adminUnauthorizedEvent, handleUnauthorized);
        return () =>
            window.removeEventListener(adminUnauthorizedEvent, handleUnauthorized);
    }, [resetSessionState]);

    const login = useCallback(async (request: LoginRequest) => {
        const response = await authService.login(request);
        if (!response.user.isAdmin) {
            throw new Error("Administrator access is required.");
        }

        // Drop data cached for a previous account without refetching protected
        // queries during the token transition. invalidateQueries() here caused
        // intermittent 401 responses that removed the newly saved token.
        queryClient.clear();
        saveAdminSession(response.token, response.user);
        setUser(response.user);
        setLoading(false);
    }, [queryClient]);

    const value = useMemo<AuthContextValue>(() => ({
        user,
        loading,
        isAuthenticated: Boolean(user && getAdminToken()),
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
