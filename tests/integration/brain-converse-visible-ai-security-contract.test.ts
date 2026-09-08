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

function occurrences(source: string, needle: string) {
  return source.split(needle).length - 1;
}

const route = read("app/api/brain/converse/route.ts");
const respondRoute = read("app/api/brain/respond/route.ts");
const visibleAi = read("lib/klyx-visible-ai.ts");
const klyxAi = read("lib/klyx-ai.ts");
const provider = read("lib/brain/llm/provider.ts");
const openAiProvider = read("lib/brain/llm/openai-provider.ts");
const shadow = read("lib/brain/llm/shadow.ts");

describe("KLYX Brain converse + Visible AI security boundary", () => {
  it("uses only the certified bounded parser before authoritative /respond", () => {
    expect(route).not.toContain("request.clone().json()");
    expect(route).toContain("const deterministicRequest = request.clone();");
    expect(route).toContain("await parseBrainRespondRequest(request)");
    expect(route).toContain("deterministicPost(deterministicRequest)");

    const boundedParse = route.indexOf(
      "await parseBrainRespondRequest(request)"
    );
    const capacityGuard = route.indexOf(
      "isKlyxAssistantMessageTooLong(message)"
    );
    const deterministicCall = route.indexOf(
      "deterministicPost(deterministicRequest)"
    );
    const errorGate = route.indexOf("!response.ok");
    const visibleAiCall = route.indexOf("await generateKlyxVisibleAiReply");

    expect(boundedParse).toBeGreaterThan(-1);
    expect(capacityGuard).toBeGreaterThan(boundedParse);
    expect(deterministicCall).toBeGreaterThan(capacityGuard);
    expect(errorGate).toBeGreaterThan(deterministicCall);
    expect(visibleAiCall).toBeGreaterThan(errorGate);

    expect(respondRoute).toContain("API_RATE_LIMIT_POLICIES.brainRespond");
    expect(respondRoute).toContain("await consumeApiRateLimit(");
    expect(respondRoute.indexOf("await consumeApiRateLimit(")).toBeLessThan(
      respondRoute.indexOf("await parseBrainRespondRequest(request)")
    );
  });

  it("keeps /respond authoritative even when wrapper parsing rejects", () => {
    const boundedParse = route.indexOf(
      "await parseBrainRespondRequest(request)"
    );
    const deterministicCall = route.indexOf(
      "deterministicPost(deterministicRequest)"
    );
    const parsedGate = route.indexOf("!parsedRequest.ok");
    const visibleAiCall = route.indexOf("await generateKlyxVisibleAiReply");

    expect(boundedParse).toBeLessThan(deterministicCall);
    expect(deterministicCall).toBeLessThan(parsedGate);
    expect(parsedGate).toBeLessThan(visibleAiCall);
    expect(route).toContain("return response;");
  });

  it("inherits the certified 32 KiB / 4,000-character parser for malformed and oversized input", async () => {
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
      parseBrainRespondRequest(
        post(JSON.stringify({ message: 42 }))
      )
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
        post(
          JSON.stringify({ message: "Bonjour" }),
          {
            "content-length": String(BRAIN_RESPOND_MAX_REQUEST_BYTES + 1),
          }
        )
      )
    ).resolves.toMatchObject({
      ok: false,
      status: 413,
      code: "KLYX_BRAIN_REQUEST_TOO_LARGE",
    });

    await expect(
      parseBrainRespondRequest(
        post(
          JSON.stringify({
            conversationId: "not-a-uuid",
            message: "Bonjour",
          })
        )
      )
    ).resolves.toMatchObject({
      ok: false,
      status: 400,
      code: "KLYX_BRAIN_INVALID_CONVERSATION_ID",
    });
  });

  it("propagates deterministic failures and useful rate-limit headers without invoking Visible AI", () => {
    expect(route).toContain("!response.ok");
    expect(route).toContain("return response;");
    expect(route).toContain("headers: response.headers");

    expect(respondRoute).toContain("apiRateLimitExceededResponse(policy, rateLimit)");
    expect(respondRoute).toContain("rateLimitResponseHeaders(policy, rateLimit)");
    expect(respondRoute).toContain("secureApiErrorResponse({");
    expect(respondRoute).toContain('.eq("id", conversationId)');
    expect(respondRoute).toContain('.eq("user_id", userId)');
    expect(respondRoute).toContain('message === "Conversation introuvable."');

    const deterministicCall = route.indexOf(
      "deterministicPost(deterministicRequest)"
    );
    const errorGate = route.indexOf("!response.ok");
    const visibleAiCall = route.indexOf("await generateKlyxVisibleAiReply");
    expect(errorGate).toBeGreaterThan(deterministicCall);
    expect(errorGate).toBeLessThan(visibleAiCall);
  });

  it("allows at most one Visible AI provider pass per successful deterministic request", () => {
    expect(route).toContain("withoutKlyxLlmShadow");
    expect(shadow).toContain("shadowSuppression.getStore() === true");
    expect(shadow).toContain("withoutKlyxLlmShadow");

    expect(occurrences(route, "generateKlyxVisibleAiReply({")).toBe(1);
    expect(occurrences(visibleAi, "generateKlyxAiReply({")).toBe(1);
    expect(occurrences(klyxAi, ".generate({")).toBe(1);
    expect(route).not.toContain("getKlyxLlmProvider");
  });

  it("keeps Visible AI cosmetic and falls back instead of repairing or re-prompting unsafe output", () => {
    expect(visibleAi).toContain("deterministic application result");
    expect(visibleAi).toContain("ne change aucun fait verrouillé");
    expect(visibleAi).toContain("ne change aucun montant, date, heure, lieu, statut ou action");
    expect(visibleAi).toContain("ne prétends jamais qu'une action a été exécutée");
    expect(visibleAi).toContain('ai.mode !== "openai" || !ai.text.trim()');
    expect(visibleAi).toContain("if (!safety.safe)");
    expect(visibleAi).toContain('mode: "fallback"');
    expect(visibleAi).toContain("text: deterministicReply");

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

  it("keeps provider secrets server-side and sends only bounded conversational context", () => {
    expect(visibleAi).toContain('import "server-only"');
    expect(klyxAi).toContain('import "server-only"');
    expect(provider).toContain('import "server-only"');
    expect(openAiProvider).toContain('import "server-only"');

    expect(route).not.toContain("OPENAI_API_KEY");
    expect(visibleAi).not.toContain("OPENAI_API_KEY");
    expect(klyxAi).not.toContain("OPENAI_API_KEY");
    expect(openAiProvider).toContain("process.env.OPENAI_API_KEY");

    expect(visibleAi).toContain("input.message.trim().slice(0, 1200)");
    expect(visibleAi).toContain("lockedFacts.slice(0, 1400)");
    expect(visibleAi).toContain("deterministicReply.slice(0, 1400)");
    expect(visibleAi).not.toContain("supabaseAdmin");
  });

  it("keeps provider timeout/failure fail-closed to deterministic wording", () => {
    expect(openAiProvider).toContain("new AbortController()");
    expect(openAiProvider).toContain("controller.abort()");
    expect(openAiProvider).toContain("MAX_TIMEOUT_MS");
    expect(klyxAi).toContain("} catch {");
    expect(klyxAi).toContain('mode: "fallback"');
    expect(visibleAi).toContain("text: deterministicReply");
  });
});
