import { describe, expect, it, vi } from "vitest";

import {
  KLYX_RESEND_FROM,
  sendResendEmail,
} from "../../lib/email/resend-core";

function successfulFetchMock() {
  return vi.fn(
    async (..._args: Parameters<typeof fetch>) =>
      new Response(null, { status: 200 })
  );
}

describe("KLYX Resend delivery core", () => {
  it("skips safely without a server API key and never calls fetch", async () => {
    const fetchMock = successfulFetchMock();

    const result = await sendResendEmail(
      {
        to: "provider@example.com",
        subject: "Nouvelle demande",
        text: "Test KLYX",
      },
      {
        apiKey: null,
        fetchImpl: fetchMock,
      }
    );

    expect(result).toEqual({
      ok: false,
      status: "skipped",
      provider: "resend",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses support@klyx.be as the KLYX sender", async () => {
    const fetchMock = successfulFetchMock();

    const result = await sendResendEmail(
      {
        to: "provider@example.com",
        subject: "Nouvelle demande",
        text: "Test KLYX",
      },
      {
        apiKey: "re_test_key",
        fetchImpl: fetchMock,
      }
    );

    expect(result.status).toBe("sent");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.resend.com/emails"
    );

    const requestInit = fetchMock.mock.calls[0]?.[1];
    const payload = JSON.parse(String(requestInit?.body)) as {
      from?: string;
      to?: string[];
    };

    expect(KLYX_RESEND_FROM).toBe("KLYX <support@klyx.be>");
    expect(payload.from).toBe(KLYX_RESEND_FROM);
    expect(payload.to).toEqual(["provider@example.com"]);
  });

  it("returns a failure result instead of throwing when Resend fails", async () => {
    const fetchMock = vi.fn(
      async (..._args: Parameters<typeof fetch>) =>
        new Response(null, { status: 503 })
    );

    await expect(
      sendResendEmail(
        {
          to: "provider@example.com",
          subject: "Nouvelle demande",
          text: "Test KLYX",
        },
        {
          apiKey: "re_test_key",
          fetchImpl: fetchMock,
        }
      )
    ).resolves.toEqual({
      ok: false,
      status: "failed",
      provider: "resend",
      httpStatus: 503,
    });
  });
});
