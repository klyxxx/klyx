import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  INTERNAL_API_ERROR_MESSAGE,
  secureApiErrorResponse,
} from "../../lib/api-error";

describe(
  "KLYX secure API errors",
  () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it(
      "never exposes a 5xx error message or stack",
      async () => {
        const logSpy = vi
          .spyOn(
            console,
            "error"
          )
          .mockImplementation(
            () => undefined
          );
        const secret =
          "sensitive-token-value";
        const error = new Error(
          `Stripe failed with ${secret}`
        );

        const response =
          secureApiErrorResponse({
            error,
            event:
              "stripe_checkout_failed",
            route:
              "/api/stripe/create-checkout-session",
            method: "POST",
            code:
              "stripe_checkout_failed",
            status: 500,
            publicMessage:
              error.message,
          });

        const body =
          (await response.json()) as {
            error: string;
            code: string;
            requestId: string;
          };
        const serializedLog =
          String(
            logSpy.mock.calls[0][0]
          );

        expect(response.status)
          .toBe(500);
        expect(body.error)
          .toBe(
            INTERNAL_API_ERROR_MESSAGE
          );
        expect(body.code)
          .toBe(
            "stripe_checkout_failed"
          );
        expect(body.requestId)
          .toMatch(
            /^[0-9a-f-]{36}$/i
          );
        expect(
          response.headers.get(
            "cache-control"
          )
        ).toBe("no-store");
        expect(
          JSON.stringify(body)
        ).not.toContain(secret);
        expect(serializedLog)
          .not.toContain(secret);
        expect(serializedLog)
          .not.toContain(
            error.stack ?? ""
          );
      }
    );

    it(
      "keeps an explicit public 4xx message",
      async () => {
        vi.spyOn(
          console,
          "error"
        ).mockImplementation(
          () => undefined
        );

        const response =
          secureApiErrorResponse({
            error: new Error(
              "Session manquante."
            ),
            event:
              "booking_create_rejected",
            route:
              "/api/bookings/create",
            method: "POST",
            code:
              "authentication_required",
            status: 401,
            publicMessage:
              "Session manquante.",
          });

        const body =
          (await response.json()) as {
            error: string;
          };

        expect(response.status)
          .toBe(401);
        expect(body.error)
          .toBe(
            "Session manquante."
          );
      }
    );

    it(
      "keeps safe workflow flags while masking a 5xx failure",
      async () => {
        vi.spyOn(
          console,
          "error"
        ).mockImplementation(
          () => undefined
        );

        const response =
          secureApiErrorResponse({
            error: new Error(
              "sensitive payment failure"
            ),
            event:
              "split_payment_failed",
            route:
              "/api/bookings/split-missions/test/payment-plan",
            method: "GET",
            code:
              "split_payment_failed",
            status: 500,
            details: {
              automaticPayment:
                false,
              explicitPaymentConfirmationRequired:
                true,
            },
          });

        const body =
          (await response.json()) as {
            error: string;
            automaticPayment: boolean;
            explicitPaymentConfirmationRequired: boolean;
          };

        expect(body.error)
          .toBe(
            INTERNAL_API_ERROR_MESSAGE
          );
        expect(
          body.automaticPayment
        ).toBe(false);
        expect(
          body.explicitPaymentConfirmationRequired
        ).toBe(true);
      }
    );

    it(
      "normalizes invalid statuses and codes",
      async () => {
        vi.spyOn(
          console,
          "error"
        ).mockImplementation(
          () => undefined
        );

        const response =
          secureApiErrorResponse({
            error: "failure",
            event:
              "invalid_failure",
            route: "/api/test",
            method: "POST",
            code:
              " Invalid code! ",
            status: 200,
          });

        const body =
          (await response.json()) as {
            error: string;
            code: string;
          };

        expect(response.status)
          .toBe(500);
        expect(body.error)
          .toBe(
            INTERNAL_API_ERROR_MESSAGE
          );
        expect(body.code)
          .toBe("invalid_code");
      }
    );
  }
);
