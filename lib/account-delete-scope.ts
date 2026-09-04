export type KlyxAccountDeleteScope = "profile" | "account";

export type KlyxAccountDeletePlan = {
  scope: KlyxAccountDeleteScope;
  targetProfileId: string | null;
  replacementProfileId: string | null;
};

type ProfileIdentity = {
  id: string;
};

export function resolveKlyxAccountDeletePlan(
  profiles: readonly ProfileIdentity[],
  requestedProfileId?: string | null
): KlyxAccountDeletePlan | null {
  if (profiles.length === 0) {
    return {
      scope: "account",
      targetProfileId: null,
      replacementProfileId: null,
    };
  }

  const normalizedRequestedProfileId = requestedProfileId?.trim() || null;
  const targetProfile = normalizedRequestedProfileId
    ? profiles.find((profile) => profile.id === normalizedRequestedProfileId)
    : profiles[0];

  if (!targetProfile) {
    return null;
  }

  const replacementProfile = profiles.find(
    (profile) => profile.id !== targetProfile.id
  );

  if (replacementProfile) {
    return {
      scope: "profile",
      targetProfileId: targetProfile.id,
      replacementProfileId: replacementProfile.id,
    };
  }

  return {
    scope: "account",
    targetProfileId: targetProfile.id,
    replacementProfileId: null,
  };
}
