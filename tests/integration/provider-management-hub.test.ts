import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// KLYX_PROVIDER_MANAGEMENT_HUB_UX_CONTRACT

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("provider management hub", () => {
  it("keeps the provider landing focused on one next action", () => {
    const source = read("app/provider/page.tsx");

    expect(source).toContain("Votre activité");
    expect(source).toContain(
      "KLYX vous montre ce qui demande votre attention maintenant."
    );
    expect(source).toContain("<ProviderReadinessStatus />");
    expect(source).toContain("Gérer autre chose");
    expect(source).toContain("SECONDARY_LINKS");
    expect(source).toContain("Services & tarifs");
    expect(source).toContain("#2563EB");
    expect(source).not.toContain("MANAGEMENT_ITEMS");
    expect(source).not.toContain("lg:grid-cols-3");
    expect(source).not.toContain("ProviderStudio");
    expect(source).not.toContain("function SummaryCard(");
    expect(source).not.toContain("bg-[linear-gradient");
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
