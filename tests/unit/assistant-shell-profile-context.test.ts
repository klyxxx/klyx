import { describe, expect, it } from "vitest";

import { resolveAssistantShellProfileContext } from "@/lib/assistant-shell-profile-context";

describe("AssistantShell active profile authority", () => {
  const client = {
    id: "mohamed-client",
    accountType: "client",
  };
  const provider = {
    id: "youssouf-provider",
    accountType: "provider",
  };

  it("never falls back to the first profile when activeProfileId is missing", () => {
    expect(
      resolveAssistantShellProfileContext({
        profiles: [provider, client],
        activeProfileId: null,
      })
    ).toBeNull();

    expect(
      resolveAssistantShellProfileContext({
        profiles: [provider, client],
        activeProfileId: "missing-profile",
      })
    ).toBeNull();
  });

  it("cannot turn an authoritative client profile into a provider shell", () => {
    expect(
      resolveAssistantShellProfileContext({
        profiles: [provider, client],
        activeProfileId: client.id,
      })
    ).toEqual({
      activeProfileId: client.id,
      accountType: "client",
    });
  });

  it("cannot turn an authoritative provider profile into a client shell", () => {
    expect(
      resolveAssistantShellProfileContext({
        profiles: [client, provider],
        activeProfileId: provider.id,
      })
    ).toEqual({
      activeProfileId: provider.id,
      accountType: "provider",
    });
  });

  it("fails closed on malformed or ambiguous active profile data", () => {
    expect(
      resolveAssistantShellProfileContext({
        profiles: [{ id: client.id, accountType: "admin" }],
        activeProfileId: client.id,
      })
    ).toBeNull();

    expect(
      resolveAssistantShellProfileContext({
        profiles: [client, { ...provider, id: client.id }],
        activeProfileId: client.id,
      })
    ).toBeNull();
  });
});
