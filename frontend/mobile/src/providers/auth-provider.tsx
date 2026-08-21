import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { ApiError } from '@/lib/api';
import { commerceApi } from '@/lib/commerce-api';
import {
  clearStoredSession,
  clearToken,
  getStoredSession,
  getToken,
  setStoredSession,
  setToken,
} from '@/lib/storage';
import type { AuthResponse, AuthUser } from '@/types/domain';

type RegisterInput = {
  firstName: string;
  lastName: string | null;
  phone: string;
  email: string | null;
  password: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  googleSignIn: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const saveAuth = useCallback(async (response: AuthResponse) => {
    await Promise.all([setToken(response.token), setStoredSession(response.user)]);
    setUser(response.user);
    await queryClient.invalidateQueries();
  }, [queryClient]);

  const logout = useCallback(async () => {
    await Promise.all([clearToken(), clearStoredSession()]);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const refresh = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    const cached = await getStoredSession<AuthUser>();
    if (cached) setUser(cached);

    try {
      const current = await commerceApi.currentUser();
      await setStoredSession(current);
      setUser(current);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await Promise.all([clearToken(), clearStoredSession()]);
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    isAuthenticated: Boolean(user),
    login: async (identifier, password) => saveAuth(await commerceApi.login(identifier, password)),
    register: async (input) => saveAuth(await commerceApi.register(input)),
    googleSignIn: async (credential) => saveAuth(await commerceApi.googleSignIn(credential)),
    logout,
    refresh,
  }), [loading, logout, refresh, saveAuth, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
