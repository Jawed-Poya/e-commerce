import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
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
import { saveTenantSlug } from "@/features/tenancy/tenant-storage";

type AuthContextValue = {
    user: AuthUser | null;
    loading: boolean;
    isAuthenticated: boolean;
    login: (request: LoginRequest) => Promise<void>;
    logout: () => void;
    refresh: () => Promise<void>;
};

type ValidateSessionOptions = {
    expectedToken?: string;
    showLoader?: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): AuthUser | null {
    try {
        return JSON.parse(
            localStorage.getItem(adminSessionKey) ?? "null",
        ) as AuthUser | null;
    } catch {
        return null;
    }
}

function authenticationErrorMessage(error: unknown) {
    if (!isAxiosError(error)) {
        return error instanceof Error
            ? error.message
            : "Administrator login could not be verified.";
    }

    if (error.response?.status === 401) {
        return "The server issued a token but did not accept it. Restart the API and verify the JWT issuer, audience, and signing key.";
    }

    if (error.response?.status === 403) {
        return "This account is authenticated but is not allowed to use the admin panel.";
    }

    return (
        (error.response?.data as { message?: string } | undefined)?.message ??
        "Administrator login could not be verified."
    );
}

export function AdminAuthProvider({ children }: PropsWithChildren) {
    const queryClient = useQueryClient();
    const [user, setUser] = useState<AuthUser | null>(readStoredUser);
    const [loading, setLoading] = useState(Boolean(getAdminToken()));
    const backgroundValidationRef = useRef<Promise<void> | null>(null);

    const clearSessionState = useCallback(
        (expectedToken?: string) => {
            if (!clearAdminSession(expectedToken)) return false;

            setUser(null);
            setLoading(false);
            queryClient.clear();
            return true;
        },
        [queryClient],
    );

    const logout = useCallback(() => {
        clearSessionState();
    }, [clearSessionState]);

    const validateSession = useCallback(
        async ({
            expectedToken,
            showLoader = true,
        }: ValidateSessionOptions = {}) => {
            const token = getAdminToken();

            if (!token) {
                if (!expectedToken) clearSessionState();
                return;
            }

            // Ignore a validation request created for an older login session.
            if (expectedToken && token !== expectedToken) return;

            if (showLoader) setLoading(true);

            try {
                const current = await authService.me();

                // A login may have changed while /auth/me was in flight.
                if (getAdminToken() !== token) return;

                if (!current.isAdmin) {
                    clearSessionState(token);
                    return;
                }

                saveTenantSlug(current.tenantSlug);
                localStorage.setItem(adminSessionKey, JSON.stringify(current));
                setUser(current);
                await queryClient.invalidateQueries({ queryKey: ["tenant"] });
            } catch (error) {
                const status = isAxiosError(error)
                    ? error.response?.status
                    : undefined;

                // Only the dedicated session-validation endpoint can invalidate
                // the current login. A 401 from dashboard/inventory/etc. first
                // comes through this method and cannot log the user out directly.
                if (status === 401 || status === 403) {
                    clearSessionState(token);
                }
            } finally {
                if (showLoader && (getAdminToken() === token || !getAdminToken())) {
                    setLoading(false);
                }
            }
        },
        [clearSessionState],
    );

    const refresh = useCallback(async () => {
        await validateSession({ showLoader: true });
    }, [validateSession]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    useEffect(() => {
        const handleUnauthorized = (event: Event) => {
            const failedToken = (
                event as CustomEvent<AdminUnauthorizedEventDetail>
            ).detail?.token;

            if (!failedToken || getAdminToken() !== failedToken) return;

            // Several queries may fail together. Verify the session only once.
            // The feature request that returned 401 never clears localStorage by
            // itself; /auth/me is the source of truth for session validity.
            if (!backgroundValidationRef.current) {
                backgroundValidationRef.current = validateSession({
                    expectedToken: failedToken,
                    showLoader: false,
                }).finally(() => {
                    backgroundValidationRef.current = null;
                });
            }
        };

        window.addEventListener(adminUnauthorizedEvent, handleUnauthorized);
        return () =>
            window.removeEventListener(
                adminUnauthorizedEvent,
                handleUnauthorized,
            );
    }, [validateSession]);

    const login = useCallback(
        async (request: LoginRequest) => {
            const response = await authService.login(request);
            if (!response.user.isAdmin) {
                throw new Error("Administrator access is required.");
            }

            queryClient.clear();
            setLoading(true);

            try {
                // Store the token so the verification request can authenticate,
                // but do not expose an authenticated UI until /auth/me confirms it.
                saveAdminSession(response.token, response.user);
                const confirmedUser = await authService.me();

                if (getAdminToken() !== response.token) {
                    throw new Error("The administrator session changed during login.");
                }

                if (!confirmedUser.isAdmin) {
                    throw new Error("Administrator access is required.");
                }

                saveTenantSlug(confirmedUser.tenantSlug);
                localStorage.setItem(
                    adminSessionKey,
                    JSON.stringify(confirmedUser),
                );
                setUser(confirmedUser);
                await queryClient.invalidateQueries({ queryKey: ["tenant"] });
            } catch (error) {
                clearSessionState(response.token);
                throw new Error(authenticationErrorMessage(error));
            } finally {
                setLoading(false);
            }
        },
        [clearSessionState, queryClient],
    );

    const value = useMemo<AuthContextValue>(
        () => ({
            user,
            loading,
            isAuthenticated: Boolean(user && getAdminToken()),
            login,
            logout,
            refresh,
        }),
        [loading, login, logout, refresh, user],
    );

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}

export function useAdminAuth() {
    const value = useContext(AuthContext);
    if (!value) {
        throw new Error("useAdminAuth must be used inside AdminAuthProvider.");
    }
    return value;
}
