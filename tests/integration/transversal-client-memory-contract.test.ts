import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(file: string) {
  return fs
    .readFileSync(path.join(process.cwd(), file), "utf8")
    .replace(/\r\n/g, "\n");
}

const sharedMemory = read("lib/client-memory-context.ts");
const requestAnalysis = read(
  "app/api/requests/analyze/analyze-route-core.ts"
);
const agentPlans = read("app/api/agent/plans/route.ts");
const clientAgent = read("lib/client-agent.ts");
const assistant = read("app/api/ai/respond/route.ts");
const aiProvider = read("lib/klyx-ai.ts");
const brainMemory = read("app/api/brain/memory-context/route.ts");
const brainResponder = read("app/api/brain/respond/route.ts");
const memoryProfile = read("app/api/memory/profile/route.ts");

describe("KLYX transversal client memory", () => {
  it("centralizes the authorized memory read policy", () => {
    expect(sharedMemory).toContain("loadClientMemoryContext");
    expect(sharedMemory).toContain('.from("user_preferences")');
    expect(sharedMemory).toContain('.from("client_memory_profiles")');
    expect(sharedMemory).toContain("preferences?.ai_memory_enabled");
    expect(sharedMemory).toContain("memoryProfile?.memory_enabled ?? true");
    expect(sharedMemory).toContain("memory.enabled && memory.available && wantsMemory(text)");
  });

  it("keeps sensitive private notes out of the conversational memory summary", () => {
    expect(sharedMemory).toContain("buildClientMemorySummary");
    expect(sharedMemory).toContain("Ville habituelle");
    expect(sharedMemory).toContain("Budget habituel maximum");
    expect(sharedMemory).toContain("Langues préférées");
    expect(sharedMemory).not.toContain("access_notes");
  });

  it("uses the same policy in request analysis, Brain, assistant and agent", () => {
    expect(requestAnalysis).toContain("loadClientMemoryContext");
    expect(requestAnalysis).toContain("canUseClientMemory(text, memory)");
    expect(brainMemory).toContain("loadClientMemoryContext");
    expect(brainResponder).toContain("loadClientMemoryContext");
    expect(brainResponder).toContain("canUseClientMemory(message, memory)");
    expect(brainResponder).not.toContain('.from("user_preferences")');
    expect(assistant).toContain("loadClientMemoryContext");
    expect(assistant).toContain("canUseClientMemory(message, memory)");
    expect(agentPlans).toContain("loadClientMemoryContext");
  });

  it("reports exact memory influence instead of claiming memory use on intent alone", () => {
    expect(clientAgent).toContain('memoryFields.push("preferred_service_slugs")');
    expect(clientAgent).toContain('memoryFields.push("default_city")');
    expect(clientAgent).toContain('memoryFields.push("default_budget")');
    expect(clientAgent).toContain('memoryFields.push("scheduling_notes")');
    expect(clientAgent).toContain("memoryUsed: memoryFields.length > 0");
    expect(requestAnalysis).toContain("const memoryUsed = memoryFields.length > 0");
    expect(brainResponder).toContain('memoryFields.push("preferred_service_slugs")');
    expect(brainResponder).toContain('memoryFields.push("default_city")');
    expect(brainResponder).toContain('memoryFields.push("scheduling_notes")');
    expect(brainResponder).toContain('memoryFields.push("default_budget")');
    expect(brainResponder).toContain("const memoryApplied = memoryApplication.memoryFields.length > 0");
    expect(agentPlans).toContain("memoryMessage:");
    expect(assistant).toContain("memoryMessage:");
    expect(brainResponder).toContain("memoryMessage:");
  });

  it("audits memory usage without copying memory values into the audit event", () => {
    expect(sharedMemory).toContain("recordClientMemoryUsage");
    expect(sharedMemory).toContain('event_type: "memory_used"');
    expect(sharedMemory).toContain("used_fields: usedFields");
    expect(sharedMemory).not.toContain("event_value: memory");
    expect(requestAnalysis).toContain('surface: "request_analysis"');
    expect(brainResponder).toContain('surface: "brain"');
    expect(agentPlans).toContain('surface: "agent"');
    expect(assistant).toContain('surface: "assistant"');
  });

  it("makes Brain memory influence explicit to the client", () => {
    expect(brainResponder).toContain(
      "J’ai utilisé uniquement les habitudes que tu m’as autorisé à mémoriser"
    );
    expect(brainResponder).toContain(
      "KLYX a utilisé les habitudes autorisées de ta mémoire pour compléter cette demande."
    );
    expect(brainResponder).toContain("memoryFields: memoryApplication.memoryFields");
  });

  it("only exposes authorized memory to OpenAI when the user explicitly asks for it", () => {
    expect(assistant).toContain('profile?.accountType === "client"');
    expect(assistant).toContain("requestedMemorySummary = buildClientMemorySummary(memory)");
    expect(assistant).toContain('reply.mode === "openai" && requestedMemorySummary.length > 0');
    expect(aiProvider).toContain("memorySummary?: string[]");
    expect(aiProvider).toContain("Mémoire KLYX autorisée");
    expect(aiProvider).toContain("utiliser uniquement le contexte mémoire explicitement fourni par KLYX");
  });

  it("preserves opt-out, deletion and audit erasure controls", () => {
    expect(memoryProfile).toContain("export async function DELETE");
    expect(memoryProfile).toContain('.from("client_memory_profiles")');
    expect(memoryProfile).toContain('.from("user_memory_events")');
    expect(memoryProfile).toContain("ai_memory_enabled: false");
    expect(brainMemory).toContain("uniquement quand tu le demandes");
  });
});
