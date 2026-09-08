import { describe, expect, it } from "vitest";

import {
  buildEmailProviderIdempotencyKey,
  nextEmailDeliveryAttempt,
} from "../../lib/email/delivery-idempotency";
import {
  KLYX_RESEND_FROM,
  sendResendEmail,
} from "../../lib/email/resend-core";

describe("transactional email provider idempotency", () => {
  it("reuses the provider attempt for stale sending but advances after a known failure", () => {
    expect(nextEmailDeliveryAttempt("sending", 3)).toBe(3);
    expect(nextEmailDeliveryAttempt("failed", 3)).toBe(4);
    expect(nextEmailDeliveryAttempt("sending", Number.NaN)).toBe(1);
  });

  it("builds deterministic opaque keys scoped to the delivery attempt", () => {
    const deduplicationKey = "booking:example-id:payment-succeeded:client";
    const first = buildEmailProviderIdempotencyKey(deduplicationKey, 1);
    const repeated = buildEmailProviderIdempotencyKey(deduplicationKey, 1);
    const retry = buildEmailProviderIdempotencyKey(deduplicationKey, 2);

    expect(first).toBe(repeated);
    expect(retry).not.toBe(first);
    expect(first).toMatch(/^klyx-email-[a-f0-9]{64}$/);
    expect(first).not.toContain(deduplicationKey);
    expect(first.length).toBeLessThanOrEqual(256);
  });

  it("passes the idempotency key to Resend without changing sender or content", async () => {
    let capturedInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      capturedInit = init;
      return new Response(null, { status: 200 });
    };
    const idempotencyKey = buildEmailProviderIdempotencyKey(
      "booking:example-id:requested:provider",
      1
    );

    const result = await sendResendEmail(
      {
        to: "delivered@resend.dev",
        subject: "KLYX controlled audit",
        text: "Controlled transactional email audit.",
        idempotencyKey,
      },
      {
        apiKey: "re_test_key",
        fetchImpl,
      }
    );

    const headers = new Headers(capturedInit?.headers);
    const body = JSON.parse(String(capturedInit?.body)) as {
      from: string;
      to: string[];
      subject: string;
      text: string;
    };

    expect(result).toMatchObject({ ok: true, status: "sent", provider: "resend" });
    expect(headers.get("Idempotency-Key")).toBe(idempotencyKey);
    expect(headers.get("Authorization")).toBe("Bearer re_test_key");
    expect(body).toEqual({
      from: KLYX_RESEND_FROM,
      to: ["delivered@resend.dev"],
      subject: "KLYX controlled audit",
      text: "Controlled transactional email audit.",
    });
  });

  it("keeps non-deduplicated sends compatible by omitting the provider key", async () => {
    let capturedInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      capturedInit = init;
      return new Response(null, { status: 200 });
    };

    await sendResendEmail(
      {
        to: "delivered@resend.dev",
        subject: "KLYX compatibility audit",
        text: "Compatibility check.",
      },
      {
        apiKey: "re_test_key",
        fetchImpl,
      }
    );

    expect(new Headers(capturedInit?.headers).has("Idempotency-Key")).toBe(false);
  });
});
