import { describe, expect, it, vi } from "vitest";

import {
  fetchWithProviderRecovery,
  ProviderHttpRecoveryError,
} from "@/lib/provider-http-recovery";

describe("KLYX provider HTTP recovery", () => {
  it("retries replay-safe transient HTTP failures with bounded backoff", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response("busy", { status: 429 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const sleeps: number[] = [];

    const response = await fetchWithProviderRecovery(
      "https://provider.invalid/test",
      { method: "GET" },
      {
        provider: "test",
        operation: "read",
        replaySafety: "safe",
        maxAttempts: 3,
        baseDelayMs: 5,
        fetchImpl,
        sleepImpl: async (delayMs) => {
          sleeps.push(delayMs);
        },
      }
    );

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([5, 10]);
  });

  it("retries network ambiguity only when provider idempotency makes replay safe", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(new Response("accepted", { status: 202 }));

    const response = await fetchWithProviderRecovery(
      "https://provider.invalid/write",
      { method: "POST" },
      {
        provider: "test",
        operation: "idempotent_write",
        replaySafety: "idempotent",
        maxAttempts: 3,
        baseDelayMs: 0,
        fetchImpl,
        sleepImpl: async () => undefined,
      }
    );

    expect(response.status).toBe(202);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("never blindly replays an ambiguous side effect", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("timeout"));

    const error = await fetchWithProviderRecovery(
      "https://provider.invalid/side-effect",
      { method: "POST" },
      {
        provider: "twilio",
        operation: "send_sms",
        replaySafety: "ambiguous",
        maxAttempts: 5,
        fetchImpl,
      }
    ).catch((caught) => caught);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(error).toBeInstanceOf(ProviderHttpRecoveryError);
    expect(error.ambiguous).toBe(true);
    expect(error.reason).toBe("timeout_or_network");
  });

  it("fails closed after the bounded retry budget is exhausted", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("unavailable", { status: 503 }));

    await expect(
      fetchWithProviderRecovery(
        "https://provider.invalid/read",
        { method: "GET" },
        {
          provider: "test",
          operation: "read",
          replaySafety: "safe",
          maxAttempts: 3,
          baseDelayMs: 0,
          fetchImpl,
          sleepImpl: async () => undefined,
        }
      )
    ).rejects.toMatchObject({
      name: "ProviderHttpRecoveryError",
      reason: "retry_exhausted",
      ambiguous: false,
      attempts: 3,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
