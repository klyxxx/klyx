import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripeKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

if (!stripeKey) throw new Error("STRIPE_SECRET_KEY missing.");
if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL missing.");
if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing.");

const stripe = new Stripe(stripeKey);
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const STRIPE_CHARGE_OVERRIDES = Object.freeze({
  ISK: { exponent: 2, increment: 100 },
  UGX: { exponent: 2, increment: 100 },
});

const STRIPE_PAYOUT_INCREMENT_OVERRIDES = Object.freeze({
  HUF: 100,
  TWD: 100,
});

function currencyExponent(currencyCode) {
  const options = new Intl.NumberFormat("en", {
    style: "currency",
    currency: currencyCode,
  }).resolvedOptions();

  return options.maximumFractionDigits ?? options.minimumFractionDigits ?? 2;
}

function currencyPolicy(currencyCode) {
  const accountingExponent = currencyExponent(currencyCode);
  const chargeOverride = STRIPE_CHARGE_OVERRIDES[currencyCode];

  return {
    accountingExponent,
    stripeChargeExponent: chargeOverride?.exponent ?? accountingExponent,
    stripeChargeIncrement: chargeOverride?.increment ?? 1,
    stripePayoutIncrement:
      STRIPE_PAYOUT_INCREMENT_OVERRIDES[currencyCode] ??
      chargeOverride?.increment ??
      1,
    zeroDecimal: accountingExponent === 0,
  };
}

const checkedAt = new Date().toISOString();
const rows = [];

for await (const spec of stripe.countrySpecs.list({ limit: 100 })) {
  const countryCode = String(spec.id ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) continue;

  const paymentCurrencies = new Set(
    (spec.supported_payment_currencies ?? [])
      .map((value) => String(value).trim().toUpperCase())
      .filter((value) => /^[A-Z]{3}$/.test(value))
  );

  const bankCurrencies = spec.supported_bank_account_currencies ?? {};
  const settlementCurrencies = new Set(
    Object.entries(bankCurrencies)
      .filter(([, countries]) =>
        Array.isArray(countries) &&
        countries.some(
          (value) => String(value).trim().toUpperCase() === countryCode
        )
      )
      .map(([currency]) => currency.trim().toUpperCase())
      .filter((value) => /^[A-Z]{3}$/.test(value))
  );

  const currencies = new Set([
    ...paymentCurrencies,
    ...settlementCurrencies,
  ]);

  for (const currencyCode of currencies) {
    const policy = currencyPolicy(currencyCode);
    const payoutEnabled = settlementCurrencies.has(currencyCode);

    rows.push({
      provider: "stripe",
      country_code: countryCode,
      currency_code: currencyCode,
      charge_enabled: paymentCurrencies.has(currencyCode),
      payout_enabled: payoutEnabled,
      settlement_enabled: payoutEnabled,
      accounting_exponent: policy.accountingExponent,
      stripe_charge_exponent: policy.stripeChargeExponent,
      stripe_charge_increment: policy.stripeChargeIncrement,
      stripe_payout_increment: policy.stripePayoutIncrement,
      minimum_charge_amount: null,
      maximum_charge_amount: null,
      zero_decimal: policy.zeroDecimal,
      source_ref: `stripe:country_spec:${countryCode}`,
      source_checked_at: checkedAt,
      metadata: {
        default_currency: spec.default_currency ?? null,
        supported_transfer_countries:
          spec.supported_transfer_countries ?? [],
        source: "stripe_country_specs_api",
      },
      updated_at: checkedAt,
    });
  }
}

if (rows.length === 0) {
  throw new Error("Stripe Country Specs returned no currency capability rows.");
}

const { error } = await admin
  .from("klyx_payment_currency_capabilities")
  .upsert(rows, {
    onConflict: "provider,country_code,currency_code",
  });

if (error) {
  throw new Error(error.message);
}

console.log(
  JSON.stringify(
    {
      synced: rows.length,
      countries: new Set(rows.map((row) => row.country_code)).size,
      checkedAt,
    },
    null,
    2
  )
);
