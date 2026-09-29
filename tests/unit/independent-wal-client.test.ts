import { describe, expect, it, vi } from "vitest";

import {
  acknowledgeIndependentWalJobWithConfig,
  resolveIndependentWalConfig,
  writeIndependentWalJobWithConfig,
  type IndependentWalRuntimeConfig,
} from "@/lib/independent-wal-client";

const config: IndependentWalRuntimeConfig = {
  baseUrl: "https://wal.example.test",
  hmacSecret: "klyx-wal-test-secret-abcdefghijklmnopqrstuvwxyz-0123456789",
  encryptionKeyBase64: Buffer.alloc(32, 9).toString("base64"),
  keyId: "test-v1",
};

describe("independent WAL client", () => {
  it("fails closed when production has no independent WAL configuration", () => {
    expect(() =>
      resolveIndependentWalConfig({
        NODE_ENV: "production",
        KLYX_INDEPENDENT_WAL_REQUIRED: "false",
      })
    ).toThrow("KLYX_INDEPENDENT_WAL_CONFIG_REQUIRED");

    expect(() =>
      resolveIndependentWalConfig({
        VERCEL_ENV: "production",
        KLYX_INDEPENDENT_WAL_REQUIRED: "false",
      })
    ).toThrow("KLYX_INDEPENDENT_WAL_CONFIG_REQUIRED");
  });

  it("allows an unconfigured WAL only outside production when not explicitly required", () => {
    expect(
      resolveIndependentWalConfig({
        NODE_ENV: "test",
        KLYX_INDEPENDENT_WAL_REQUIRED: "false",
      })
    ).toBeNull();
  });

  it("prewrites an encrypted idempotent envelope and acknowledges replication", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(input), init });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const envelope = await writeIndependentWalJobWithConfig({
      job: {
        jobType: "financial_reconciliation",
        idempotencyKey: "reconcile:1",
        payload: { bookingId: "booking-1", privateEvidence: "never-plaintext" },
      },
      config,
      deps: {
        fetchImpl,
        sleepImpl: async () => undefined,
        now: 1_790_000_000_000,
        nonce: "abcdefghijklmnop",
        iv: Buffer.alloc(12, 5),
      },
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toContain(envelope.operationId);
    expect(String(requests[0].init?.body)).not.toContain("never-plaintext");
    expect(new Headers(requests[0].init?.headers).get("x-klyx-wal-signature")).toMatch(/^[0-9a-f]{64}$/);

    await acknowledgeIndependentWalJobWithConfig({
      operationId: envelope.operationId,
      config,
      deps: {
        fetchImpl,
        sleepImpl: async () => undefined,
        now: 1_790_000_000_001,
        nonce: "qrstuvwxyzABCDEF",
      },
    });
    expect(requests).toHaveLength(2);
    expect(requests[1].url).toContain("/replicated");
  });
});
