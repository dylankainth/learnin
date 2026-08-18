import React, { createContext, useContext, useEffect, useState, PropsWithChildren } from "react";
import * as SecureStore from "expo-secure-store";
import { api, setAuthToken } from "./api";
import type { User } from "./types";

const TOKEN_KEY = "learnin_token";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signup: (name: string, email: string, password: string, goal?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (token) {
        setAuthToken(token);
        try {
          const { user: me } = await api.me();
          setUser(me);
        } catch {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          setAuthToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  async function persistSession(token: string, nextUser: User) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    setAuthToken(token);
    setUser(nextUser);
  }

  async function signup(name: string, email: string, password: string, goal?: string) {
    const { token, user: newUser } = await api.auth.signup({ name, email, password, goal });
    await persistSession(token, newUser);
  }

  async function login(email: string, password: string) {
    const { token, user: existingUser } = await api.auth.login({ email, password });
    await persistSession(token, existingUser);
  }

  async function logout() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setAuthToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signup, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
