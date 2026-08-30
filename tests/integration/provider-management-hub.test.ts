import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("provider management hub", () => {
  it("keeps the provider landing simple and action oriented", () => {
    const source = read("app/provider/page.tsx");

    expect(source).toContain("Gérer mon activité");
    expect(source).toContain("Services & tarifs");
    expect(source).toContain("Missions");
    expect(source).toContain("Finances");
    expect(source).toContain("text-blue-600");
    expect(source).not.toContain("ProviderStudio");
    expect(source).not.toContain("text-violet-");
    expect(source).not.toContain("bg-violet-");
  });

  it("keeps the full existing studio available behind its dedicated route", () => {
    const source = read("app/provider/studio/page.tsx");

    expect(source).toContain('import ProviderStudio from "@/app/components/ProviderStudio"');
    expect(source).toContain("<ProviderStudio profileId={profile.id} />");
  });

  it("sends readiness service actions to the dedicated studio", () => {
    const source = read("app/components/ProviderReadinessStatus.tsx");

    expect(source.match(/href: "\/provider\/studio"/g)?.length).toBe(2);
  });
});
