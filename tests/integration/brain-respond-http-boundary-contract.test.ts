import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  BRAIN_RESPOND_MAX_MESSAGE_CHARACTERS,
  BRAIN_RESPOND_MAX_REQUEST_BYTES,
  parseBrainRespondRequest,
} from "../../lib/brain/respond-http-boundary";

function readRepoFile(file: string) {
  return fs
    .readFileSync(path.join(process.cwd(), file), "utf8")
    .replace(/\r\n/g, "\n");
}

const route = readRepoFile("app/api/brain/respond/route.ts");

function post(body: string, headers?: HeadersInit) {
  return new Request("http://localhost/api/brain/respond", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  });
}

describe("KLYX Brain respond HTTP boundary", () => {
  it("keeps authentication and profile-scoped conversation ownership without a permanent role gate", () => {
    expect(route).toContain("getAuthenticatedProfile(request)");
    expect(route).not.toContain("requireAccountType");
    expect(route).toContain('.from("brain_conversations")');
    expect(route).toContain('.eq("id", conversationId)');
    expect(route).toContain('.eq("user_id", userId)');
  });

  it("uses the existing durable Brain rate limit on the authenticated profile", () => {
    expect(route).toContain("API_RATE_LIMIT_POLICIES.brainRespond");
    expect(route).toContain("await consumeApiRateLimit(");
    expect(route).toContain("profile.id,");
    expect(route).toContain("apiRateLimitExceededResponse(policy, rateLimit)");
    expect(route).toContain("rateLimitResponseHeaders(policy, rateLimit)");

    expect(route.indexOf("await consumeApiRateLimit(")).toBeLessThan(
      route.indexOf("await parseBrainRespondRequest(request)")
    );
  });

  it("does not parse the request with an unbounded request.json call", () => {
    expect(route).toContain("await parseBrainRespondRequest(request)");
    expect(route).not.toContain("await request.json()");
  });

  it("accepts and normalizes a valid request", async () => {
    const result = await parseBrainRespondRequest(
      post(
        JSON.stringify({
          conversationId: "123e4567-e89b-12d3-a456-426614174000",
          message: "  Bonjour KLYX  ",
        })
      )
    );

    expect(result).toEqual({
      ok: true,
      value: {
        conversationId: "123e4567-e89b-12d3-a456-426614174000",
        message: "Bonjour KLYX",
      },
    });
  });

  it("rejects malformed JSON and non-object JSON as client errors", async () => {
    await expect(
      parseBrainRespondRequest(post('{"message":'))
    ).resolves.toMatchObject({
      ok: false,
      status: 400,
      code: "KLYX_BRAIN_INVALID_JSON",
    });

    await expect(
      parseBrainRespondRequest(post("[]"))
    ).resolves.toMatchObject({
      ok: false,
      status: 400,
      code: "KLYX_BRAIN_INVALID_PAYLOAD",
    });
  });

  it("rejects wrong message types, empty messages and messages over 4000 characters", async () => {
    expect(BRAIN_RESPOND_MAX_MESSAGE_CHARACTERS).toBe(4000);

    await expect(
      parseBrainRespondRequest(post(JSON.stringify({ message: 42 })))
    ).resolves.toMatchObject({
      ok: false,
      status: 400,
      code: "KLYX_BRAIN_INVALID_MESSAGE",
    });

    await expect(
      parseBrainRespondRequest(post(JSON.stringify({ message: "   " })))
    ).resolves.toMatchObject({
      ok: false,
      status: 400,
      code: "KLYX_BRAIN_INVALID_MESSAGE",
    });

    await expect(
      parseBrainRespondRequest(
        post(
          JSON.stringify({
            message: "a".repeat(BRAIN_RESPOND_MAX_MESSAGE_CHARACTERS + 1),
          })
        )
      )
    ).resolves.toMatchObject({
      ok: false,
      status: 400,
      code: "KLYX_BRAIN_MESSAGE_TOO_LONG",
    });
  });

  it("rejects invalid conversation identifiers before any ownership query", async () => {
    await expect(
      parseBrainRespondRequest(
        post(JSON.stringify({ conversationId: 123, message: "Bonjour" }))
      )
    ).resolves.toMatchObject({
      ok: false,
      status: 400,
      code: "KLYX_BRAIN_INVALID_CONVERSATION_ID",
    });

    await expect(
      parseBrainRespondRequest(
        post(JSON.stringify({ conversationId: "not-a-uuid", message: "Bonjour" }))
      )
    ).resolves.toMatchObject({
      ok: false,
      status: 400,
      code: "KLYX_BRAIN_INVALID_CONVERSATION_ID",
    });
  });

  it("rejects oversized bodies from both declared length and streamed bytes", async () => {
    expect(BRAIN_RESPOND_MAX_REQUEST_BYTES).toBe(32 * 1024);

    await expect(
      parseBrainRespondRequest(
        post("{}", {
          "content-length": String(BRAIN_RESPOND_MAX_REQUEST_BYTES + 1),
        })
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
            message: "Bonjour",
            padding: "x".repeat(BRAIN_RESPOND_MAX_REQUEST_BYTES),
          })
        )
      )
    ).resolves.toMatchObject({
      ok: false,
      status: 413,
      code: "KLYX_BRAIN_REQUEST_TOO_LARGE",
    });
  });

  it("keeps unexpected server and Supabase errors behind the secure API response", () => {
    expect(route).toContain("secureApiErrorResponse({");
    expect(route).toContain("status < 500 ? message : undefined");
    expect(route).toContain('message === "Conversation introuvable."');
  });
});
