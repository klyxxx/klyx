import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { clearWebSession, syncWebSession } from "@/src/lib/klyx-api";
import { supabase } from "@/src/lib/supabase";

type AuthContextValue = {
  ready: boolean;
  session: Session | null;
  user: User | null;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  const adoptSession = useCallback(async (next: Session | null) => {
    setSession(next);
    if (next) await syncWebSession(next);
  }, []);

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      try {
        await adoptSession(data.session);
      } finally {
        if (mounted) setReady(true);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        void adoptSession(nextSession).catch(() => undefined);
      }
    );

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [adoptSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      session,
      user: session?.user ?? null,
      async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error || !data.session) throw error ?? new Error("Connexion impossible.");
        await adoptSession(data.session);
      },
      async signOut() {
        const remoteSignOut = clearWebSession().catch(() => undefined);
        try {
          await supabase.auth.signOut();
        } finally {
          setSession(null);
          await remoteSignOut;
        }
      },
    }),
    [adoptSession, ready, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider missing");
  return value;
}
