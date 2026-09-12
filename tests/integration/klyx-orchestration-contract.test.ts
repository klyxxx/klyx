import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const core = read("lib/klyx-orchestration.ts");
const server = read("lib/klyx-orchestration-server.ts");
const brain = read("app/api/brain/recommend/route.ts");
const providerCore = read("app/api/provider/assistant/assistant-route-core.ts");
const providerVisible = read("app/api/provider/assistant/assistant-route-visible.ts");
const incomeRoute = read("app/api/provider/orchestration/income/route.ts");

describe("KLYX orchestration contract", () => {
  it("centralizes client service decisions in the deterministic orchestration core", () => {
    expect(brain).toContain("orchestrateServiceRequest");
    expect(brain).toContain("estimateServiceTotal");
    expect(brain).toContain("serviceBudgetMatch");
    expect(brain).toContain("durationHours");
    expect(core).toContain("solutions");
    expect(core).toContain("recommended: index === 0");
    expect(core).toContain("slice(0, clamp(limit, 1, 3))");
  });

  it("does not let the legacy search budget filter override duration-aware orchestration", () => {
    expect(brain).toContain("Le budget n'est volontairement pas envoyé");
    expect(brain).not.toContain('params.set("budget"');
    expect(core).toContain("price * durationHours");
  });

  it("builds provider income candidates only from live KLYX/provider data", () => {
    expect(server).toContain('GET as getProviderJobs');
    expect(server).toContain('.from("user_services")');
    expect(server).toContain('.from("service_profiles")');
    expect(server).toContain('.from("availability_slots")');
    expect(server).toContain('.from("provider_service_zones")');
    expect(server).toContain("providerZonesCoverBelgianLocality");
    expect(server).toContain("distanceBetweenLocalitiesKm");
    expect(server).toContain("confirmedMissions");
  });

  it("never presents a client budget ceiling as provider income", () => {
    expect(core).toContain("configuredMissionAmount");
    expect(core).toContain("providerRate");
    expect(core).toContain("clientBudgetMax");
    expect(core).toContain("configured > candidate.clientBudgetMax");
    expect(core).not.toContain("providerEstimate ?? clientBudget");
    expect(core).not.toContain("client_budget_ceiling");
    expect(server).not.toContain("potentialAmount");
  });

  it("keeps income planning read-only and outside provider assistant drafts", () => {
    expect(providerCore).toContain('intent: "mission_plan" as const');
    expect(providerCore).toContain('result.intent !== "mission_plan"');
    expect(providerCore).toContain("buildProviderIncomeOrchestration");
    expect(providerVisible).toContain('responseBody.intent === "mission_plan"');
    expect(providerVisible).toContain("must never be rewritten by a model");
  });

  it("exposes a reusable structured provider income endpoint without mutating jobs", () => {
    expect(incomeRoute).toContain("buildProviderIncomeOrchestration");
    expect(incomeRoute).toContain('requireAccountType(profile, "provider")');
    expect(incomeRoute).not.toMatch(/\.insert\(|\.update\(|\.delete\(/);
    expect(incomeRoute).toContain("maximumDistanceKm");
  });

  it("keeps every engaging action behind explicit confirmation and refusal penalty off", () => {
    expect(core).toContain("automaticAcceptance: false");
    expect(core).toContain("automaticOffer: false");
    expect(core).toContain("automaticBooking: false");
    expect(core).toContain("automaticPayment: false");
    expect(core).toContain("refusalPenalty: false");
    expect(core).toContain("providerPriceChanged: false");
    expect(core).toContain("requiresUserConfirmation: true");
  });
});
