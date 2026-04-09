import { createContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { loginRequest } from "@/services/authService";
import type { AuthUser, LoginPayload, LoginResponse } from "@/types/auth";

const STORAGE_KEY = "nexus.session";

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<LoginResponse>;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const rawSession = window.localStorage.getItem(STORAGE_KEY);

    if (rawSession) {
      try {
        const session = JSON.parse(rawSession) as AuthUser;
        setUser(session);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }

    setIsLoading(false);
  }, []);

  const login = async (payload: LoginPayload) => {
    const response = await loginRequest(payload);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(response));
    setUser(response);
    return response;
  };

  const logout = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      logout,
    }),
    [isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
