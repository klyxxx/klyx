export type AssistantShellAccountType = "client" | "provider";

export type AssistantShellProfileContext = {
  activeProfileId: string;
  accountType: AssistantShellAccountType;
};

type ProfileCandidate = {
  id?: unknown;
  accountType?: unknown;
};

type ProfilesCandidate = {
  profiles?: unknown;
  activeProfileId?: unknown;
};

export function resolveAssistantShellProfileContext(
  value: unknown
): AssistantShellProfileContext | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as ProfilesCandidate;
  const activeProfileId =
    typeof candidate.activeProfileId === "string"
      ? candidate.activeProfileId.trim()
      : "";

  if (!activeProfileId || !Array.isArray(candidate.profiles)) {
    return null;
  }

  const matches = candidate.profiles.filter((profile): profile is ProfileCandidate => {
    if (!profile || typeof profile !== "object") return false;
    return (profile as ProfileCandidate).id === activeProfileId;
  });

  if (matches.length !== 1) return null;

  const accountType = matches[0].accountType;
  if (accountType !== "client" && accountType !== "provider") {
    return null;
  }

  return {
    activeProfileId,
    accountType,
  };
}
