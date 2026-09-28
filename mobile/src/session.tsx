import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import {
  getMobileBootstrap,
  type MobileBootstrap,
  type MobileProfile,
} from "./klyx-core";
import {
  clearSelectedProfileId,
  getSelectedProfileId,
  setSelectedProfileId as persistSelectedProfileId,
} from "./profile-selection";
import { supabase } from "./supabase";

type SessionContextValue = {
  session: Session | null;
  bootstrap: MobileBootstrap | null;
  selectedProfile: MobileProfile | null;
  loading: boolean;
  error: string | null;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  selectProfile(profileId: string): Promise<void>;
  refreshBootstrap(): Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function KlyxSessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [bootstrap, setBootstrap] = useState<MobileBootstrap | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshBootstrap = useCallback(async () => {
    const next = await getMobileBootstrap();
    const remembered = await getSelectedProfileId();
    const selected = next.profiles.some((item) => item.id === remembered)
      ? remembered
      : next.canonicalProfileId;

    setBootstrap(next);
    setSelectedProfileId(selected);

    if (selected) {
      await persistSelectedProfileId(selected);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!session) {
      setBootstrap(null);
      setSelectedProfileId(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    void refreshBootstrap()
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "KLYX Core indisponible.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshBootstrap, session?.access_token]);

  const selectedProfile = useMemo(
    () =>
      bootstrap?.profiles.find((item) => item.id === selectedProfileId) ?? null,
    [bootstrap, selectedProfileId]
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      bootstrap,
      selectedProfile,
      loading,
      error,
      async signIn(email, password) {
        setError(null);
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      },
      async signOut() {
        await clearSelectedProfileId();
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) throw signOutError;
      },
      async selectProfile(profileId) {
        if (!bootstrap?.profiles.some((item) => item.id === profileId)) {
          throw new Error("Profil KLYX invalide.");
        }
        setSelectedProfileId(profileId);
        await persistSelectedProfileId(profileId);
      },
      refreshBootstrap,
    }),
    [bootstrap, error, loading, refreshBootstrap, selectedProfile, session]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useKlyxSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useKlyxSession must be used inside KlyxSessionProvider");
  }
  return context;
}
