import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  PROVIDER_ASSISTANT_MAX_MESSAGE_CHARACTERS,
  PROVIDER_ASSISTANT_MAX_REQUEST_BYTES,
  parseProviderAssistantPatchRequest,
  parseProviderAssistantPostRequest,
} from "../../app/api/provider/assistant/provider-assistant-http-boundary";

function read(relativePath: string) {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

function request(body: string, headers?: HeadersInit) {
  return new Request("http://localhost/api/provider/assistant", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  });
}

function occurrences(source: string, needle: string) {
  return source.split(needle).length - 1;
}

const core = read("app/api/provider/assistant/assistant-route-core.ts");
const visible = read("app/api/provider/assistant/assistant-route-visible.ts");
const route = read("app/api/provider/assistant/route.ts");
const providerAssistant = read("lib/provider-assistant.ts");
const visibleAi = read("lib/klyx-visible-ai.ts");
const klyxAi = read("lib/klyx-ai.ts");
const openAiProvider = read("lib/brain/llm/openai-provider.ts");
const baseline = read("supabase/migrations/20260814000000_klyx_canonical_baseline.sql");

describe("Provider Assistant security boundary", () => {
  it("bounds POST/PATCH JSON before business parsing", async () => {
    expect(PROVIDER_ASSISTANT_MAX_REQUEST_BYTES).toBe(32 * 1024);
    expect(PROVIDER_ASSISTANT_MAX_MESSAGE_CHARACTERS).toBe(1000);

    await expect(
      parseProviderAssistantPostRequest(request('{"message":'))
    ).resolves.toMatchObject({
      ok: false,
      status: 400,
      code: "KLYX_PROVIDER_ASSISTANT_INVALID_JSON",
    });

    await expect(
      parseProviderAssistantPostRequest(
        request(JSON.stringify({ message: 42 }))
      )
    ).resolves.toMatchObject({
      ok: false,
      status: 400,
      code: "KLYX_PROVIDER_ASSISTANT_INVALID_MESSAGE",
    });

    await expect(
      parseProviderAssistantPostRequest(
        request(
          JSON.stringify({
            message: "x".repeat(
              PROVIDER_ASSISTANT_MAX_MESSAGE_CHARACTERS + 1
            ),
          })
        )
      )
    ).resolves.toMatchObject({
      ok: false,
      status: 400,
      code: "KLYX_PROVIDER_ASSISTANT_MESSAGE_TOO_LONG",
    });

    await expect(
      parseProviderAssistantPostRequest(
        request(JSON.stringify({ message: "Bonjour" }), {
          "content-length": String(
            PROVIDER_ASSISTANT_MAX_REQUEST_BYTES + 1
          ),
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      status: 413,
      code: "KLYX_PROVIDER_ASSISTANT_REQUEST_TOO_LARGE",
    });

    await expect(
      parseProviderAssistantPostRequest(
        request(
          JSON.stringify({
            message: "Bonjour",
            padding: "x".repeat(PROVIDER_ASSISTANT_MAX_REQUEST_BYTES),
          })
        )
      )
    ).resolves.toMatchObject({
      ok: false,
      status: 413,
      code: "KLYX_PROVIDER_ASSISTANT_REQUEST_TOO_LARGE",
    });

    await expect(
      parseProviderAssistantPatchRequest(request("not-json"))
    ).resolves.toMatchObject({
      ok: false,
      status: 400,
      code: "KLYX_PROVIDER_ASSISTANT_INVALID_JSON",
    });

    await expect(
      parseProviderAssistantPatchRequest(
        request(
          JSON.stringify({
            draftId: "draft-1",
            action: "send",
          })
        )
      )
    ).resolves.toMatchObject({
      ok: false,
      status: 400,
      code: "KLYX_PROVIDER_ASSISTANT_INVALID_ACTION",
    });
  });

  it("authenticates and consumes the durable shared AI quota before DB or LLM work", () => {
    expect(core.match(/getAuthenticatedProfile\(request\)/g)?.length).toBe(3);
    expect(core.match(/requireAccountType\(profile, "provider"\)/g)?.length).toBe(3);
    expect(core).toContain("API_RATE_LIMIT_POLICIES.aiRespond");
    expect(core).toContain("await consumeApiRateLimit(");
    expect(core).toContain("apiRateLimitExceededResponse(policy, rateLimit)");
    expect(core).toContain("rateLimitResponseHeaders(policy, rateLimit)");

    const auth = core.indexOf("await getAuthenticatedProfile(request)", core.indexOf("export async function POST"));
    const role = core.indexOf('requireAccountType(profile, "provider")', auth);
    const quota = core.indexOf("await consumeApiRateLimit(", role);
    const parse = core.indexOf("await parseProviderAssistantPostRequest(request)", quota);
    const missionPlan = core.indexOf("await buildProviderIncomePlanResult(", parse);
    const analysis = core.indexOf("analyzeProviderAssistantMessage(", parse);
    const hourlyRate = core.indexOf("await getHourlyRate(profile.id)", analysis);

    expect(auth).toBeGreaterThan(-1);
    expect(role).toBeGreaterThan(auth);
    expect(quota).toBeGreaterThan(role);
    expect(parse).toBeGreaterThan(quota);
    expect(missionPlan).toBeGreaterThan(parse);
    expect(analysis).toBeGreaterThan(parse);
    expect(hourlyRate).toBeGreaterThan(analysis);
  });

  it("never performs an unbounded JSON parse in the exposed provider wrapper", () => {
    expect(core).not.toContain("request.json()");
    expect(visible).not.toContain("requestCopy.json()");
    expect(core).toContain("parseProviderAssistantPostRequest(request)");
    expect(core).toContain("parseProviderAssistantPatchRequest(request)");
    expect(visible).toContain("parseProviderAssistantPostRequest(requestCopy)");
  });

  it("allows at most one model pass per Provider Assistant POST", () => {
    const unknownGate = core.indexOf('result.intent === "unknown"');
    const unknownModelCall = core.indexOf("await improveUnknownProviderReply", unknownGate);
    const wrapperUnknownGate = visible.indexOf('responseBody.intent === "unknown"');
    const visibleModelCall = visible.indexOf("await generateKlyxVisibleAiReply", wrapperUnknownGate);

    expect(unknownGate).toBeGreaterThan(-1);
    expect(unknownModelCall).toBeGreaterThan(unknownGate);
    expect(wrapperUnknownGate).toBeGreaterThan(-1);
    expect(visibleModelCall).toBeGreaterThan(wrapperUnknownGate);
    expect(occurrences(core, "await generateKlyxAiReply({")).toBe(1);
    expect(occurrences(visible, "await generateKlyxVisibleAiReply({")).toBe(1);
    expect(occurrences(visibleAi, "await generateKlyxAiReply({")).toBe(1);
    expect(occurrences(klyxAi, ".generate({")).toBe(1);
    expect(openAiProvider).not.toContain("retry");
  });

  it("keeps Visible AI cosmetic and excludes the draft database identifier from the prompt", () => {
    expect(visible).toContain("...responseBody");
    expect(visible).toContain("reply: visibleReply.text");
    expect(visible).toContain("aiMode: visibleReply.mode");
    expect(visible).not.toContain("draftId: responseBody.draftId");
    expect(core).not.toContain("draftId: null");
    expect(visible).toContain("headers: response.headers");

    expect(visibleAi).toContain("ne change aucun fait verrouillé");
    expect(visibleAi).toContain(
      "ne change aucun montant, date, heure, lieu, statut ou action"
    );
    expect(visibleAi).toContain(
      "ne prétends jamais qu'une action a été exécutée"
    );
    expect(visibleAi).toContain("if (!safety.safe)");
    expect(visibleAi).toContain('mode: "fallback"');
    expect(visibleAi).toContain("text: deterministicReply");

    expect(visible).not.toContain("OPENAI_API_KEY");
    expect(core).not.toContain("OPENAI_API_KEY");
    expect(openAiProvider).toContain("process.env.OPENAI_API_KEY");
    expect(openAiProvider).toContain("new AbortController()");
    expect(openAiProvider).toContain("MAX_TIMEOUT_MS");
  });

  it("keeps draft creation and PATCH mutations owned by the authenticated provider", () => {
    expect(core).toContain("profile_id: profile.id");
    expect(core).toContain('.eq("id", draftId)');
    expect(core).toContain('.eq("profile_id", profile.id)');
    expect(core).toContain('draft.status !== "draft"');
    expect(core).toContain('draft.draft_type !== "availability"');
    expect(core).toContain(
      "Les réponses et devis restent des brouillons à copier manuellement."
    );
    expect(core).toContain('.eq("user_id", profile.id)');
    expect(core).toContain("dayOfWeek < 0");
    expect(core).toContain("dayOfWeek > 6");
    expect(core).toContain("endTime <= startTime");

    expect(providerAssistant).toContain("requiresConfirmation: true");
  });

  it("keeps simultaneous availability apply effects bounded by the canonical slot uniqueness constraint", () => {
    expect(core).toContain('.from("availability_slots")');
    expect(core).toContain(".delete()");
    expect(core).toContain(".insert({");
    expect(baseline).toContain(
      'CONSTRAINT "availability_unique_slot" UNIQUE ("user_service_id", "day_of_week", "start_time", "end_time")'
    );
  });

  it("keeps raw server failures behind the sanitizing public route", () => {
    expect(route).toContain("secureApiErrorResponse");
    expect(route).toContain("response.status < 500");
    expect(route).toContain('route: "/api/provider/assistant"');
    expect(route).toContain('secureBoundary("GET", coreGet, request)');
    expect(route).toContain('secureBoundary("POST", corePost, request)');
    expect(route).toContain('secureBoundary("PATCH", corePatch, request)');
  });
});
