import { afterEach, describe, expect, it, vi } from "vitest";

import { sumsubRequest } from "@/lib/sumsub";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("KLYX Sumsub provider recovery", () => {
  it("recovers automatically from transient Sumsub network failures for replay-safe token reads/writes", async () => {
    vi.stubEnv("SUMSUB_APP_TOKEN", "test-app-token");
    vi.stubEnv("SUMSUB_SECRET_KEY", "test-secret-key");

    const mockedFetch = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: "sumsub-token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    vi.stubGlobal("fetch", mockedFetch);

    const result = await sumsubRequest<{ token: string }>({
      method: "POST",
      path: "/resources/accessTokens/sdk",
      body: {
        userId: "provider-1",
        levelName: "basic-kyc",
      },
      replaySafety: "safe",
    });

    expect(result.token).toBe("sumsub-token");
    expect(mockedFetch).toHaveBeenCalledTimes(3);
  });
});
