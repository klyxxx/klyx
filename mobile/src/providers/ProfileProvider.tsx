import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  type ActiveProfile,
  loadProfiles,
  selectProfile,
} from "@/src/lib/klyx-api";
import { useAuth } from "@/src/providers/AuthProvider";

type ProfileContextValue = {
  loading: boolean;
  profiles: ActiveProfile[];
  activeProfile: ActiveProfile | null;
  refresh(): Promise<void>;
  switchProfile(profileId: string): Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<ActiveProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) {
      setProfiles([]);
      setActiveProfileId(null);
      return;
    }

    setLoading(true);
    try {
      const payload = await loadProfiles();
      setProfiles(payload.profiles);
      setActiveProfileId(payload.activeProfileId);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  const value = useMemo<ProfileContextValue>(
    () => ({
      loading,
      profiles,
      activeProfile:
        profiles.find((profile) => profile.id === activeProfileId) ?? null,
      refresh,
      async switchProfile(profileId) {
        await selectProfile(profileId);
        setActiveProfileId(profileId);
      },
    }),
    [activeProfileId, loading, profiles, refresh]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfiles() {
  const value = useContext(ProfileContext);
  if (!value) throw new Error("ProfileProvider missing");
  return value;
}
