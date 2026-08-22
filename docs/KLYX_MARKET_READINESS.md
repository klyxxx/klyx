# KLYX market readiness

## Purpose

KLYX must never treat technical currency support as proof that a country or territory is commercially, legally, or operationally open.

The historical `KLYX_SUPPORTED_MARKETS` catalogue in `lib/klyx-supported-markets.ts` is a **monetary capability catalogue**: it maps locations to currencies so KLYX can format amounts and preserve transaction currency correctly. Its historical name does not mean that every listed location is open for KLYX provider onboarding, Stripe Connect, KYC, taxation, regulated services, or production launch.

Commercial readiness is modeled separately in `lib/klyx-market-readiness.ts`.

## Required dimensions

A location can be considered commercially ready only when all of these dimensions have been reviewed:

1. **Stripe Connect** — provider onboarding, charges/payout capabilities and the intended KLYX funds flow are supported for the target market.
2. **KYC / identity verification** — the selected identity-verification path is supported for the target provider population and required documents.
3. **Tax / invoicing** — KLYX has reviewed the applicable tax, invoicing, platform-reporting and merchant/platform obligations for the intended operating model.
4. **Regulated categories** — local licensing, qualification, age, safety or other category-specific constraints have been mapped for the services KLYX plans to expose.
5. **Launch decision** — an explicit KLYX decision marks the market `open` after the above dimensions are proven.

A dimension marked `verified` or `not_applicable` still requires a dated `verifiedAt` value and a `sourceRef`. `not_applicable` is not a shortcut around evidence.

## Fail-closed rules

- Every monetary market starts `unverified` and `closed`.
- An unknown market is also commercially closed.
- Currency support alone never produces `ready=true`.
- A market is not ready when any required dimension is `unverified` or `blocked`.
- A market is not ready when a supposedly verified dimension has no dated evidence reference.
- A market is not ready without a separate explicit `open` launch decision and its evidence reference.
- The readiness helper performs no Stripe, KYC, tax or other network action. It only evaluates reviewed evidence recorded in code.

## Evidence standard

Before adding a readiness override, record evidence that is:

- current enough for the launch decision;
- attributable to an authoritative source where possible (provider documentation, regulator/government guidance, signed internal legal/compliance review, or a retained network certification);
- specific to the intended KLYX business model, not merely to the existence of a currency or payment method;
- dated and referenced in the readiness entry;
- reviewed again when the provider, regulation, tax treatment, payout model, or service catalogue materially changes.

Do not paste secrets, API keys, identity documents, database passwords or sensitive provider data into readiness evidence references.

## Opening a market

A future market-opening PR should:

1. add only the country/territory evidence actually reviewed;
2. keep unrelated locations closed;
3. include tests demonstrating that every required dimension has dated evidence;
4. include the explicit launch decision reference;
5. run the normal KLYX test, TypeScript, build and protected browser verification;
6. run Stripe/KYC/network proofs separately where the claim depends on an external provider;
7. update launch-readiness tracking with the exact evidence and date.

This framework is operational governance for KLYX. It does not replace jurisdiction-specific legal, tax or regulatory advice.
