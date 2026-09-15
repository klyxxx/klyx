import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const shell = read("app/ui/AssistantShell.tsx");
const activeRoute = read("app/api/profiles/active/route.ts");

describe("AssistantShell roleless authority contract", () => {
  it("does not read or react to an active profile", () => {
    expect(shell).not.toContain("resolveAssistantShellProfileContext");
    expect(shell).not.toContain('fetch("/api/profiles/active"');
    expect(shell).not.toContain("KLYX_ACTIVE_PROFILE_CHANGED");
    expect(shell).not.toContain("profileContext");
    expect(shell).not.toContain("accountType");
    expect(shell).not.toContain("activeProfileId");
  });

  it("keeps the legacy active-profile endpoint available outside the primary shell", () => {
    expect(activeRoute).toContain(
      "profiles.some((profile) => profile.id === selectedProfileId)"
    );
    expect(activeRoute).toContain(": null;");
    expect(activeRoute).not.toContain("profiles[0]");
    expect(activeRoute).not.toContain("getActiveProfile");
  });

  it("binds desktop and mobile rails to the same assistant home", () => {
    expect(shell).toContain('<MissionRail homeHref="/assistant" locale={locale} />');
    expect(shell).toContain('homeHref="/assistant"');
    expect(shell).not.toContain("missionRailKey");
    expect(shell).not.toContain("getKlyxAccountHome");
  });
});
