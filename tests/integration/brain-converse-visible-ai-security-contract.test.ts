import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  BRAIN_RESPOND_MAX_MESSAGE_CHARACTERS,
  BRAIN_RESPOND_MAX_REQUEST_BYTES,
  parseBrainRespondRequest,
} from "../../lib/brain/respond-http-boundary";
import {
  assessKlyxVisibleAiCandidate,
} from "../../lib/klyx-visible-ai-safety";

function read(relativePath: string) {
  return fs
    .readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n");
}

function post(body: string, headers?: HeadersInit) {
  return new Request("http://localhost/api/brain/converse", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  });
}

const route = read("app/api/brain/converse/route.ts");
const respondRoute = read("app/api/brain/respond/route.ts");
const apiAuth = read("lib/api-auth.ts");
const visibleAi = read("lib/klyx-visible-ai.ts");
const klyxAi = read("lib/klyx-ai.ts");
const openAiProvider = read("lib/brain/llm/openai-provider.ts");

describe("KLYX unified Brain converse security boundary", () => {
  it("keeps the certified bounded parser as the only body inspection boundary", () => {
    expect(route).not.toContain("request.clone().json()");
    expect(route).not.toContain("await request.json()");
    expect(route).toContain("const boundedInspectionRequest = request.clone();");
    expect(route).toContain(
      "await parseBrainRespondRequest(boundedInspectionRequest)"
    );
    expect(respondRoute).toContain("await parseBrainRespondRequest(request)");
  });

  it("keeps service requests on the deterministic transaction-safe Brain", () => {
    expect(route).toContain('route.intent === "service_need"');
    expect(route).toContain("withoutKlyxLlmShadow");
    expect(route).toContain("deterministicPost(capabilityRequest)");
    expect(route).toContain("KLYX_CONFIRMATION_BOUNDARY");
    expect(route).toContain("getKlyxGuidedQuestion");
    expect(route).toContain("await generateKlyxVisibleAiReply({");
    expect(route).toContain("headers: response.headers");

    expect(respondRoute).toContain("API_RATE_LIMIT_POLICIES.brainRespond");
    expect(respondRoute).toContain("await consumeApiRateLimit(");
    expect(respondRoute).toContain("secureApiErrorResponse({");
  });

  it("limits capability projection to the unified Brain endpoint and never changes cookies", () => {
    expect(apiAuth).toContain(
      'const ASSISTANT_CAPABILITY_HEADER = "x-klyx-assistant-capability"'
    );
    expect(apiAuth).toContain('pathname !== "/api/brain/converse"');
    expect(apiAuth).toContain("projectCapability(");
    expect(apiAuth).toContain("canonicalProfile");
    expect(apiAuth).not.toContain("cookies().set");
    expect(route).toContain("capabilityHeaders");
    expect(route).toContain('capability: "client"');
    expect(route).toContain("providerCapabilityRequest(request)");
  });

  it("applies the durable Brain rate limit to non-service intents as well", () => {
    expect(route).toContain("API_RATE_LIMIT_POLICIES.brainRespond");
    expect(route).toContain("await consumeApiRateLimit(");
    expect(route).toContain("canonicalProfile.id");
    expect(route).toContain("apiRateLimitExceededResponse(policy, rateLimit)");
    expect(route).toContain("rateLimitResponseHeaders(policy, rateLimit)");
  });

  it("inherits the certified 32 KiB / 4,000-character parser", async () => {
    expect(BRAIN_RESPOND_MAX_REQUEST_BYTES).toBe(32 * 1024);
    expect(BRAIN_RESPOND_MAX_MESSAGE_CHARACTERS).toBe(4000);

    await expect(
      parseBrainRespondRequest(post('{"message":'))
    ).resolves.toMatchObject({
      ok: false,
      status: 400,
      code: "KLYX_BRAIN_INVALID_JSON",
    });

    await expect(
      parseBrainRespondRequest(post(JSON.stringify({ message: 42 })))
    ).resolves.toMatchObject({
      ok: false,
      status: 400,
      code: "KLYX_BRAIN_INVALID_MESSAGE",
    });

    await expect(
      parseBrainRespondRequest(
        post(
          JSON.stringify({
            message: "x".repeat(BRAIN_RESPOND_MAX_MESSAGE_CHARACTERS + 1),
          })
        )
      )
    ).resolves.toMatchObject({
      ok: false,
      status: 400,
      code: "KLYX_BRAIN_MESSAGE_TOO_LONG",
    });

    await expect(
      parseBrainRespondRequest(
        post(JSON.stringify({ message: "Bonjour" }), {
          "content-length": String(BRAIN_RESPOND_MAX_REQUEST_BYTES + 1),
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      status: 413,
      code: "KLYX_BRAIN_REQUEST_TOO_LARGE",
    });
  });

  it("keeps Visible AI cosmetic for transactional service replies", () => {
    expect(visibleAi).toContain("deterministic application result");
    expect(visibleAi).toContain("ne change aucun fait verrouillé");
    expect(visibleAi).toContain(
      "ne change aucun montant, date, heure, lieu, statut ou action"
    );
    expect(visibleAi).toContain(
      "ne prétends jamais qu'une action a été exécutée"
    );
    expect(visibleAi).toContain("if (!safety.safe)");
    expect(visibleAi).toContain('mode: "fallback"');

    const lockedFacts = {
      city: "Bruxelles",
      date: "2026-09-10",
      time: "14:30",
      budget: 50,
      missing: [],
      ready: true,
    };
    const deterministicReply =
      "Demande à Bruxelles le 2026-09-10 à 14:30, budget 50 EUR. Vérifie avant de confirmer.";

    expect(
      assessKlyxVisibleAiCandidate({
        candidate:
          "Votre réservation est confirmée à Paris le 11/09/2026 à 16h00 et le paiement de 60 EUR est effectué.",
        deterministicReply,
        lockedFacts,
      }).safe
    ).toBe(false);
  });

  it("keeps OpenAI secrets server-side", () => {
    expect(visibleAi).toContain('import "server-only"');
    expect(klyxAi).toContain('import "server-only"');
    expect(route).not.toContain("OPENAI_API_KEY");
    expect(visibleAi).not.toContain("OPENAI_API_KEY");
    expect(klyxAi).not.toContain("OPENAI_API_KEY");
    expect(openAiProvider).toContain("process.env.OPENAI_API_KEY");
  });
});
