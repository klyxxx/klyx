import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const core = read("app/api/provider/assistant/assistant-route-core.ts");
const data = read("app/api/provider/assistant/provider-income-plan-data.ts");
const visible = read("app/api/provider/assistant/assistant-route-visible.ts");
const parser = read("lib/provider-income-plan.ts");
const i18n = read("lib/klyx-provider-assistant-i18n.ts");

describe("KLYX provider income-plan contract", () => {
  it("recognizes the income target before the legacy assistant intents", () => {
    const parse = core.indexOf("parseProviderIncomePlanRequest(message)");
    const legacy = core.indexOf("analyzeProviderAssistantMessage(", parse);

    expect(parse).toBeGreaterThan(-1);
    expect(legacy).toBeGreaterThan(parse);
    expect(parser).toContain("rankProviderIncomeCombinations(");
    expect(parser).toContain(".slice(0, Math.max(1, Math.min(3, limit)))");
  });

  it("builds recommendations only from live KLYX provider jobs and profile constraints", () => {
    expect(data).toContain('GET as getProviderJobs');
    expect(data).toContain("await getProviderJobs(request.clone())");
    expect(data).toContain('.from("user_services")');
    expect(data).toContain('.from("service_profiles")');
    expect(data).toContain('.from("availability_slots")');
    expect(data).toContain("locationMatches(");
    expect(data).toContain("availabilityContains(");
    expect(data).toContain("activeMissionConflicts(");
    expect(data).toContain("rankProviderIncomeCombinations(");
    expect(data).toContain('dataSource: "klyx_live"');
  });

  it("keeps mission planning strictly advisory and read-only", () => {
    expect(data).toContain("automaticAcceptance: false");
    expect(data).toContain("automaticOffer: false");
    expect(data).toContain("automaticBooking: false");
    expect(data).toContain("automaticPayment: false");
    expect(data).toContain("refusalPenalty: false");
    expect(data).toContain("providerPriceChanged: false");
    expect(data).not.toContain(".insert(");
    expect(data).not.toContain(".update(");
    expect(data).not.toContain(".delete(");
    expect(core).toContain('result.intent !== "mission_plan"');
  });

  it("never lets the visible LLM rewrite live job combinations", () => {
    expect(visible).toContain('responseBody.intent === "mission_plan"');
    expect(visible).toContain("missionPlanReply(responseBody.payload, deterministicReply)");
    expect(visible).toContain(".slice(0, 3)");

    const missionPlanBranch = visible.indexOf(
      'if (responseBody.intent === "mission_plan")'
    );
    const visibleAi = visible.indexOf("generateKlyxVisibleAiReply({");

    expect(missionPlanBranch).toBeGreaterThan(-1);
    expect(visibleAi).toBeGreaterThan(missionPlanBranch);
  });

  it("does not lower the provider rate to fit a client budget", () => {
    expect(data).toContain("providerEstimate > clientBudget");
    expect(data).toContain("return null;");
    expect(data).toContain('amountSource = providerEstimate !== null');
    expect(data).toContain('"provider_rate"');
    expect(data).toContain('"client_budget_ceiling"');
  });

  it("advertises the new capability without turning the assistant into a catalogue", () => {
    expect(i18n).toContain(
      "Je suis libre samedi, je veux gagner environ 100 €, trouve-moi des missions près de chez moi."
    );
    expect(i18n).toContain("Rien n’est appliqué ni envoyé sans ta confirmation.");
    expect(i18n).toContain("Aucune mission n’est acceptée automatiquement.");
  });
});
