import { useQueryClient } from "@tanstack/react-query";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type PropsWithChildren,
} from "react";

import { customerTokenKey } from "../../shared/api/api-client";
import { getCurrentCustomer, loginCustomer, registerCustomer } from "./auth-api";
import type {
    AuthResponse,
    AuthUser,
    LoginRequest,
    RegisterRequest,
} from "./auth-types";

const sessionKey = "easycart-customer-session";

type AuthContextValue = {
    user: AuthUser | null;
    isAuthenticated: boolean;
    loading: boolean;
    login: (request: LoginRequest) => Promise<void>;
    register: (request: RegisterRequest) => Promise<void>;
    logout: () => void;
    refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): AuthUser | null {
    try {
        return JSON.parse(localStorage.getItem(sessionKey) ?? "null") as
            | AuthUser
            | null;
    } catch {
        return null;
    }
}

export function AuthProvider({ children }: PropsWithChildren) {
    const queryClient = useQueryClient();
    const [user, setUser] = useState<AuthUser | null>(readStoredUser);
    const [loading, setLoading] = useState(
        Boolean(localStorage.getItem(customerTokenKey)),
    );

    const save = useCallback(
        async (response: AuthResponse) => {
            localStorage.setItem(customerTokenKey, response.token);
            localStorage.setItem(sessionKey, JSON.stringify(response.user));
            setUser(response.user);
            await queryClient.invalidateQueries();
            window.dispatchEvent(new Event("easycart-auth-changed"));
        },
        [queryClient],
    );

    const logout = useCallback(() => {
        localStorage.removeItem(customerTokenKey);
        localStorage.removeItem(sessionKey);
        setUser(null);
        queryClient.clear();
        window.dispatchEvent(new Event("easycart-auth-changed"));
    }, [queryClient]);

    const refresh = useCallback(async () => {
        if (!localStorage.getItem(customerTokenKey)) {
            localStorage.removeItem(sessionKey);
            setUser(null);
            setLoading(false);
            return;
        }

        try {
            const current = await getCurrentCustomer();
            localStorage.setItem(sessionKey, JSON.stringify(current));
            setUser(current);
        } catch {
            localStorage.removeItem(customerTokenKey);
            localStorage.removeItem(sessionKey);
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
        const onChange = () => void refresh();
        window.addEventListener("easycart-auth-changed", onChange);
        return () => window.removeEventListener("easycart-auth-changed", onChange);
    }, [refresh]);

    const value = useMemo<AuthContextValue>(
        () => ({
            user,
            isAuthenticated: Boolean(user),
            loading,
            login: async (request) => save(await loginCustomer(request)),
            register: async (request) => save(await registerCustomer(request)),
            logout,
            refresh,
        }),
        [loading, logout, refresh, save, user],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const value = useContext(AuthContext);
    if (!value) throw new Error("useAuth must be used inside AuthProvider.");
    return value;
}
