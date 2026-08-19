import React, { createContext, useContext, useEffect, useState, PropsWithChildren } from "react";
import type { RecordModel } from "pocketbase";
import { pb, initAuthStore } from "./pocketbase";
import { setAuthToken } from "./api";
import type { User } from "./types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signup: (name: string, email: string, password: string, goal?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toUser(record: RecordModel): User {
  return {
    id: record.id,
    email: record.email as string,
    name: (record.name as string) ?? "",
    goal: (record.goal as string | null) ?? null,
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const removeListener = pb.authStore.onChange((token, record) => {
      setAuthToken(token || null);
      setUser(record ? toUser(record) : null);
    }, true);

    initAuthStore()
      .then(async () => {
        if (pb.authStore.isValid) {
          try {
            await pb.collection("users").authRefresh();
          } catch {
            pb.authStore.clear();
          }
        }
      })
      .finally(() => setLoading(false));

    return removeListener;
  }, []);

  async function signup(name: string, email: string, password: string, goal?: string) {
    await pb.collection("users").create({ email, password, passwordConfirm: password, name, goal });
    await pb.collection("users").authWithPassword(email, password);
  }

  async function login(email: string, password: string) {
    await pb.collection("users").authWithPassword(email, password);
  }

  async function logout() {
    pb.authStore.clear();
  }

  async function resetPassword(email: string) {
    await pb.collection("users").requestPasswordReset(email);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signup, login, logout, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
