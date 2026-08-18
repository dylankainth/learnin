import React, { createContext, useContext, useEffect, useState, PropsWithChildren } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { api, setAuthToken } from "./api";
import type { User } from "./types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signup: (name: string, email: string, password: string, goal?: string) => Promise<{ needsEmailConfirmation: boolean }>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadProfile(session: Session): Promise<User> {
  setAuthToken(session.access_token);
  try {
    const { user: profile } = await api.me();
    return profile;
  } catch {
    // The on-auth-user-created DB trigger can lag the client by a beat right
    // after signup — fall back to what the session itself already knows.
    return {
      id: session.user.id,
      email: session.user.email ?? "",
      name: (session.user.user_metadata?.name as string | undefined) ?? "",
      goal: (session.user.user_metadata?.goal as string | undefined) ?? null,
    };
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) setUser(await loadProfile(session));
      if (mounted) setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        setUser(await loadProfile(session));
      } else {
        setAuthToken(null);
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function signup(name: string, email: string, password: string, goal?: string) {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name, goal } } });
    if (error) throw new Error(error.message);
    // If the project requires email confirmation, signUp succeeds but
    // returns no session until the user clicks the link in their inbox.
    return { needsEmailConfirmation: !data.session };
  }

  async function login(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  async function resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw new Error(error.message);
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
