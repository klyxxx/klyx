import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// KLYX_SPLIT_CHECKOUT_INTEGRATION_TESTS_13_30

const getAuthenticatedProfile =
  vi.fn();

const requireAccountType =
  vi.fn();

const assertStripeRuntimeReady =
  vi.fn();

const stripeAccountRetrieve =
  vi.fn();

const stripeCheckoutCreate =
  vi.fn();

const stripeCheckoutRetrieve =
  vi.fn();

const stripeCheckoutList =
  vi.fn();

const from =
  vi.fn();

const rpc =
  vi.fn();

vi.mock(
  "@/lib/api-auth",
  () => ({
    apiErrorStatus:
      () => 500,

    getAuthenticatedProfile,

    requireAccountType,
  })
);

vi.mock(
  "@/lib/stripe-runtime",
  () => ({
    assertStripeRuntimeReady,
  })
);

vi.mock(
  "@/lib/klyx-economics",
  () => ({
    calculateKlyxEconomics:
      (
        amount:
          number
      ) => ({
        grossAmountCents:
          amount,

        commissionPercent:
          15,

        platformFeeCents:
          Math.round(
            amount *
            0.15
          ),

        providerAmountCents:
          amount -
          Math.round(
            amount *
            0.15
          ),
      }),

    getKlyxCommissionPercent:
      () => 15,
  })
);

vi.mock(
  "@/lib/supabase-admin",
  () => ({
    supabaseAdmin: {
      from,
      rpc,
    },
  })
);

vi.mock(
  "stripe",
  () => ({
    default:
      class MockStripe {
        accounts = {
          retrieve:
            stripeAccountRetrieve,
        };

        checkout = {
          sessions: {
            create:
              stripeCheckoutCreate,

            retrieve:
              stripeCheckoutRetrieve,

            list:
              stripeCheckoutList,
          },
        };
      },
  })
);

async function routeModule() {
  return import(
    "@/app/api/bookings/split-missions/[id]/checkout/route"
  );
}

function context(
  id =
    "batch-test-1"
) {
  return {
    params:
      Promise.resolve({
        id,
      }),
  };
}

function request(
  body:
    unknown
) {
  return new Request(
    "http://localhost:3000/api/bookings/split-missions/batch-test-1/checkout",
    {
      method:
        "POST",

      headers: {
        "Content-Type":
          "application/json",

        Authorization:
          "Bearer test-token",
      },

      body:
        JSON.stringify(
          body
        ),
    }
  );
}

describe(
  "KLYX split Checkout security",
  () => {
    beforeEach(
      () => {
        vi.clearAllMocks();

        process.env.STRIPE_SECRET_KEY =
          "sk_test_klyx_13_30";

        getAuthenticatedProfile
          .mockResolvedValue({
            user: {
              id:
                "auth-client",

              email:
                "client@klyx.test",
            },

            profile: {
              id:
                "client-profile",

              account_type:
                "client",
            },
          });

        requireAccountType
          .mockImplementation(
            (
              profile:
                {
                  account_type?:
                    string;
                },

              expected:
                string
            ) => {
              if (
                profile.account_type !==
                expected
              ) {
                throw new Error(
                  "ACCOUNT_TYPE_FORBIDDEN"
                );
              }
            }
          );
      }
    );

    it(
      "refuses Checkout preparation without explicit confirmation",
      async () => {
        const {
          POST,
        } =
          await routeModule();

        const response =
          await POST(
            request({}),
            context()
          );

        const body =
          await response.json();

        expect(
          response.status
        ).toBe(
          400
        );

        expect(
          body.code
        ).toBe(
          "SPLIT_CHECKOUT_PREPARATION_CONFIRMATION_REQUIRED"
        );

        expect(
          body.automaticPayment
        ).toBe(
          false
        );
      }
    );

    it(
      "does not touch Supabase when explicit confirmation is missing",
      async () => {
        const {
          POST,
        } =
          await routeModule();

        await POST(
          request({}),
          context()
        );

        expect(
          from
        ).not.toHaveBeenCalled();

        expect(
          rpc
        ).not.toHaveBeenCalled();
      }
    );

    it(
      "does not create any Stripe Checkout when confirmation is missing",
      async () => {
        const {
          POST,
        } =
          await routeModule();

        await POST(
          request({}),
          context()
        );

        expect(
          stripeCheckoutCreate
        ).not.toHaveBeenCalled();

        expect(
          stripeAccountRetrieve
        ).not.toHaveBeenCalled();
      }
    );

    it(
      "requires the authenticated profile to be a client",
      async () => {
        getAuthenticatedProfile
          .mockResolvedValue({
            user: {
              id:
                "auth-provider",

              email:
                "provider@klyx.test",
            },

            profile: {
              id:
                "provider-profile",

              account_type:
                "provider",
            },
          });

        const {
          POST,
        } =
          await routeModule();

        const response =
          await POST(
            request({
              checkoutPreparationConfirmed:
                true,
            }),
            context()
          );

        expect(
          requireAccountType
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            account_type:
              "provider",
          }),
          "client"
        );

        expect(
          response.status
        ).not.toBe(
          200
        );

        expect(
          stripeCheckoutCreate
        ).not.toHaveBeenCalled();
      }
    );

    it(
      "runs Stripe runtime validation before attempting payment preparation",
      async () => {
        const {
          POST,
        } =
          await routeModule();

        await POST(
          request({}),
          context()
        );

        expect(
          assertStripeRuntimeReady
        ).toHaveBeenCalledTimes(
          1
        );
      }
    );
  }
);