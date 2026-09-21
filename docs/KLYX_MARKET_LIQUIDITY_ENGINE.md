# KLYX Market & Liquidity Engine — Mission 19

Mission 19 answers a different question from technical platform readiness:

> Can KLYX actually satisfy demand in this market, for this service, at this time and price?

## Core separation

KLYX must keep these states independent:

```text
service technically supported
!=
service actually liquid in this market
```

Technical support is configuration.

Liquidity is observed market performance.

A technically supported service may be illiquid. A market with historical demand may also have unknown liquidity if the sample or policy is insufficient.

## Canonical sources

Mission 19 does not create a second marketplace truth.

It derives from existing canonical facts:

- demand: `market_service_requests`;
- supply discovery / live matching cache: `market_request_provider_candidates`;
- provider proposals: `market_service_offers`;
- quotes: `service_quotes`;
- bookings / mission outcome: `bookings`;
- replacement attempts and outcomes: `booking_incidents` + `booking_incident_events`.

The engine may read these sources. It does not mutate their lifecycle state.

## Data-driven market dimensions

Requests may now carry optional structured keys:

- `market_id`;
- `region_id`.

They are free structured text keys, not enums and not foreign keys to a permanent country/category catalogue.

Country, service and currency remain canonical existing dimensions.

Price bands are versioned data in:

`klyx_market_liquidity_price_bands`

They use canonical accounting minor units, so zero-decimal currencies are not treated as 2-decimal currencies.

## Technical capability

`klyx_market_service_capabilities` declares whether a service is:

- `unsupported`;
- `pilot`;
- `supported`.

Rules may be global or scoped by market, country, region and service.

No matching, quote, booking or payment count can silently turn a technically unsupported market into supported.

## Liquidity policy

`klyx_market_liquidity_policies` contains versioned thresholds.

No threshold is embedded in TypeScript.

Supported threshold dimensions include:

- minimum sample size;
- p90 time to first match;
- p90 time to quote;
- quote acceptance;
- booking conversion;
- fill rate;
- completion rate;
- cancellation rate;
- replacement success;
- repeat usage;
- provider utilization;
- availability;
- matching quality.

If no policy exists, liquidity is `unknown`.

If the sample is smaller than `min_sample_size`, liquidity is `unknown`.

Only a cohort that satisfies every configured threshold is `liquid`.

Anything that fails a configured threshold is `illiquid`.

## Metrics

For a selected segment and arbitrary time window:

```text
time_to_first_match
= first candidate/offer timestamp - demand timestamp

time_to_quote
= first quote timestamp - demand timestamp

quote_probability
= quoted demands / matched demands

quote_acceptance
= accepted quote demands / quoted demands

booking_conversion
= booked demands / accepted quote demands

fill_rate
= booked demands / total demands

completion_rate
= completed demands / booked demands

cancellation_rate
= cancelled booked demands / booked demands

replacement_success
= incidents with replacement_selected / incidents entering replacement flow

repeat_usage
= clients with >= 2 completed demands / clients with >= 1 completed demand

provider_utilization
= discovered providers that receive a booking / discovered providers

availability
= demands with a full-coverage candidate or live offer / total demands

matching_quality
= mean best coverage ratio among matched demands

fulfillment_probability
= completed demands / total demands
```

These are empirical cohort measurements, not promises.

## Segmentation

`getKlyxMarketLiquidityMetrics` accepts arbitrary combinations of:

- market;
- country;
- region;
- service;
- time window;
- price band;
- currency.

No permanent list of markets, countries or service categories exists in Mission 19.

## Price bands

Price bands are data-driven and currency-specific.

They are never implemented as:

```text
cheap / medium / expensive
```

hardcoded in application logic.

Each price band stores lower/upper canonical minor-unit bounds and version validity.

## Matching limitations

Historical `market_request_provider_candidates` is strongest for flows where KLYX persisted discovery candidates.

For legacy requests where discovery was not persisted, an actual provider offer is accepted as the first observable match signal.

This is deliberately explicit: the engine does not fabricate an earlier discovery timestamp.

## Authority boundary

Mission 19 is analytical.

It must not:

- choose a provider;
- create a quote;
- create a booking;
- mutate pricing;
- authorize payment;
- change Economic Eligibility;
- release Settlement;
- activate Stripe LIVE;
- mutate Vercel;
- apply production migrations.

The Orchestrator may consume liquidity results to explain market conditions or choose a workflow strategy, but domain mutations remain deterministic server authorities.
