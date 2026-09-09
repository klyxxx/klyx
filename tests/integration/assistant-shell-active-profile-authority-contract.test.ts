import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const shell = read("app/ui/AssistantShell.tsx");
const activeRoute = read("app/api/profiles/active/route.ts");

describe("AssistantShell active profile authority contract", () => {
  it("does not fall back to the first returned profile", () => {
    expect(shell).toContain("resolveAssistantShellProfileContext(data)");
    expect(shell).not.toContain("data.profiles?.[0]");
    expect(shell).not.toContain("profiles[0]");

    expect(activeRoute).toContain("profiles.some((profile) => profile.id === selectedProfileId)");
    expect(activeRoute).toContain(": null;");
    expect(activeRoute).not.toContain("profiles[0]");
    expect(activeRoute).not.toContain("getActiveProfile");
  });

  it("fails closed before every active-profile request and on request failure", () => {
    const neutralizeIndex = shell.indexOf("setProfileContext(null);");
    const fetchIndex = shell.indexOf('fetch("/api/profiles/active"');
    const failureIndex = shell.indexOf("if (!response.ok) return;");
    const catchNeutralIndex = shell.lastIndexOf("setProfileContext(null);");

    expect(neutralizeIndex).toBeGreaterThan(-1);
    expect(fetchIndex).toBeGreaterThan(neutralizeIndex);
    expect(failureIndex).toBeGreaterThan(fetchIndex);
    expect(catchNeutralIndex).toBeGreaterThan(failureIndex);
  });

  it("ignores stale async responses after a newer profile request", () => {
    expect(shell).toContain("profileRequestGenerationRef");
    expect(shell).toContain("profileRequestAbortRef.current?.abort()");
    expect(shell).toContain("const controller = new AbortController()");
    expect(shell).toContain("signal: controller.signal");
    expect(shell).toContain("generation !== profileRequestGenerationRef.current");

    const staleGuardIndex = shell.indexOf(
      "generation !== profileRequestGenerationRef.current"
    );
    const commitIndex = shell.indexOf("setProfileContext(nextContext);");
    expect(staleGuardIndex).toBeGreaterThan(-1);
    expect(commitIndex).toBeGreaterThan(staleGuardIndex);
  });

  it("keeps account type and active profile id atomic for MissionRail", () => {
    expect(shell).toContain(
      "useState<AssistantShellProfileContext | null>(null)"
    );
    expect(shell).not.toContain("setAccountType(");
    expect(shell).not.toContain("setActiveProfileId(");
    expect(shell).toContain("const accountType = profileContext?.accountType ?? null;");
    expect(shell).toContain(
      "const activeProfileId = profileContext?.activeProfileId ?? null;"
    );
    expect(shell).toContain("key={`desktop:${missionRailKey}`}");
    expect(shell).toContain("key={`mobile:${missionRailKey}`}");
    expect(shell).toContain("accountType={accountType}");
    expect(shell).toContain("activeProfileId={activeProfileId}");
  });
});
