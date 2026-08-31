import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("KLYX provider home completion", () => {
  it("keeps one primary readiness action and secondary management out of the main hierarchy", () => {
    const providerHome = read("app/provider/page.tsx");
    const readiness = read("app/components/ProviderReadinessStatus.tsx");

    expect(providerHome).toContain("<ProviderReadinessStatus />");
    expect(providerHome).toContain("SECONDARY_LINKS");
    expect(providerHome).toContain("<details");
    expect(providerHome).toContain('href: "/provider/services/new"');
    expect(providerHome).toContain('href: "/provider/assistant"');
    expect(providerHome).not.toContain("MANAGEMENT_ITEMS");
    expect(providerHome).not.toContain("lg:grid-cols-3");

    expect(readiness).toContain('fetch("/api/provider/studio"');
    expect(readiness).toContain('fetch("/api/provider/zones"');
    expect(readiness).toContain("nextMandatoryItem");
    expect(readiness).toContain('href: "/provider/jobs"');
    expect(readiness).toContain('t("nextAction")');
    expect(readiness).toContain("<details");
    expect(readiness).not.toContain("xl:grid-cols-4");
  });

  it("keeps service proposals functional while removing the legacy violet hero", () => {
    const serviceProposal = read("app/provider/services/new/page.tsx");

    expect(serviceProposal).toContain('fetch("/api/provider/service-proposals"');
    expect(serviceProposal).toContain('method: "POST"');
    expect(serviceProposal).toContain("KLYX_PROVIDER_SERVICE_PROPOSAL_CATEGORIES");
    expect(serviceProposal).toContain("#2563EB");
    expect(serviceProposal).not.toContain("violet");
    expect(serviceProposal).not.toContain("linear-gradient");
  });

  it("localizes the new provider next-action language", () => {
    const readinessI18n = read("lib/klyx-provider-readiness-i18n.ts");

    expect(readinessI18n).toContain('"nextAction"');
    expect(readinessI18n).toContain('"viewMissions"');
    expect(readinessI18n).toContain('"details"');
    expect(readinessI18n).toContain('nextAction: "Prochaine action"');
    expect(readinessI18n).toContain('viewMissions: "Voir mes missions"');
  });
});
