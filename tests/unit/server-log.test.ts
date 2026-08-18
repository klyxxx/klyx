import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  logServerError,
  logServerInfo,
  logServerWarning,
} from "../../lib/server-log";

describe(
  "KLYX secure server logging",
  () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it(
      "writes structured info logs",
      () => {
        const spy =
          vi
            .spyOn(
              console,
              "info"
            )
            .mockImplementation(
              () => undefined
            );

        logServerInfo({
          event:
            "brain_request_completed",
          route:
            "/api/brain/respond",
          method:
            "post",
          status: 200,
          durationMs: 42,
        });

        expect(spy)
          .toHaveBeenCalledTimes(1);

        const payload =
          JSON.parse(
            String(
              spy.mock.calls[0][0]
            )
          );

        expect(payload)
          .toMatchObject({
            marker:
              "KLYX_SERVER_LOG_V1",
            level: "info",
            event:
              "brain_request_completed",
            route:
              "/api/brain/respond",
            method: "POST",
            status: 200,
            durationMs: 42,
          });

        expect(
          typeof payload.timestamp
        ).toBe("string");
      }
    );

    it(
      "never serializes error messages or stacks",
      () => {
        const spy =
          vi
            .spyOn(
              console,
              "error"
            )
            .mockImplementation(
              () => undefined
            );

        const secret =
          "super-sensitive-secret";

        const error =
          new Error(
            `Failure ${secret}`
          );

        logServerError({
          event:
            "stripe_checkout_failed",
          route:
            "/api/stripe/create-checkout-session",
          method: "POST",
          status: 500,
          code:
            "checkout_failed",
          error,
        });

        const serialized =
          String(
            spy.mock.calls[0][0]
          );

        expect(serialized)
          .not.toContain(secret);

        expect(serialized)
          .not.toContain(
            error.message
          );

        expect(serialized)
          .not.toContain(
            error.stack ?? ""
          );

        const payload =
          JSON.parse(serialized);

        expect(payload.errorName)
          .toBe("Error");
      }
    );

    it(
      "writes structured warning logs",
      () => {
        const spy =
          vi
            .spyOn(
              console,
              "warn"
            )
            .mockImplementation(
              () => undefined
            );

        logServerWarning({
          event:
            "provider_not_available",
          status: 409,
          code:
            "provider_unavailable",
        });

        const payload =
          JSON.parse(
            String(
              spy.mock.calls[0][0]
            )
          );

        expect(payload.level)
          .toBe("warn");

        expect(payload.status)
          .toBe(409);
      }
    );
  }
);