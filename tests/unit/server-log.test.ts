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
      "logs only allowlisted Stripe-style error metadata",
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
          "sk_live_should_never_be_logged";
        const error = Object.assign(
          new Error(
            `Stripe failure ${secret}`
          ),
          {
            type:
              "invalid_request_error",
            code:
              "account_invalid",
            param: "account",
            statusCode: 400,
            raw: {
              message:
                `Raw ${secret}`,
            },
          }
        );

        logServerError({
          event:
            "stripe_connect_account_failed",
          route:
            "/api/stripe/connect/create-account",
          method: "POST",
          status: 500,
          code:
            "stripe_connect_account_failed",
          error,
        });

        const serialized =
          String(
            spy.mock.calls[0][0]
          );
        const payload =
          JSON.parse(serialized);

        expect(serialized)
          .not.toContain(secret);
        expect(serialized)
          .not.toContain(error.message);
        expect(payload)
          .toMatchObject({
            errorType:
              "invalid_request_error",
            errorCode:
              "account_invalid",
            errorParam: "account",
            errorStatusCode: 400,
          });
      }
    );

    it(
      "rejects unsafe arbitrary error metadata",
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

        logServerError({
          event: "unsafe_error",
          error: {
            type:
              "invalid request with spaces",
            code:
              "secret=value",
            param:
              "account\nprivate",
          },
        });

        const payload =
          JSON.parse(
            String(
              spy.mock.calls[0][0]
            )
          );

        expect(payload.errorType)
          .toBeUndefined();
        expect(payload.errorCode)
          .toBeUndefined();
        expect(payload.errorParam)
          .toBeUndefined();
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
