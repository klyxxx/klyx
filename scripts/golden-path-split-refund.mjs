import {
  createHmac,
  randomUUID,
} from "node:crypto";

import {
  createClient,
} from "@supabase/supabase-js";

import {
  assertGoldenPathIsolation,
  findGoldenPathUserByEmail,
  requiredGoldenPathEnv,
} from "./golden-path-runtime.mjs";

const APP_ORIGIN =
  "http://127.0.0.1:3100";

const CLEANING_SERVICE_SLUGS = [
  "menage-a-domicile",
  "cleaning",
  "menage",
  "ménage",
];

function expect(
  condition,
  message
) {
  if (!condition) {
    throw new Error(message);
  }
}

function cleaningService(
  services
) {
  for (
    const slug
    of CLEANING_SERVICE_SLUGS
  ) {
    const service =
      services.find(
        (candidate) =>
          candidate.slug ===
          slug
      );

    if (service) {
      return service;
    }
  }

  return undefined;
}

function stripeSignature(
  payload,
  webhookSecret,
  timestamp
) {
  const digest =
    createHmac(
      "sha256",
      webhookSecret
    )
      .update(
        `${timestamp}.${payload}`,
        "utf8"
      )
      .digest("hex");

  return `t=${timestamp},v1=${digest}`;
}

function stripeEvent(
  id,
  type,
  object
) {
  return {
    id,
    object: "event",
    api_version: null,
    created:
      Math.floor(
        Date.now() /
          1000
      ),
    data: {
      object,
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null,
    },
    type,
  };
}

async function postStripeEvent(
  event,
  webhookSecret
) {
  const payload =
    JSON.stringify(event);
  const timestamp =
    Math.floor(
      Date.now() /
        1000
    );

  const response =
    await fetch(
      `${APP_ORIGIN}/api/stripe/webhook`,
      {
        method: "POST",
        headers: {
          "content-type":
            "application/json",
          "stripe-signature":
            stripeSignature(
              payload,
              webhookSecret,
              timestamp
            ),
        },
        body: payload,
      }
    );

  let body = null;

  try {
    body =
      await response.json();
  }
  catch {
    body = null;
  }

  if (!response.ok) {
    throw new Error(
      `Stripe webhook ${event.type} failed (${response.status}): ${JSON.stringify(body)}`
    );
  }

  return body;
}

async function insertOne(
  admin,
  table,
  payload,
  columns = "*"
) {
  const {
    data,
    error,
  } =
    await admin
      .from(table)
      .insert(payload)
      .select(columns)
      .single();

  if (error) {
    throw new Error(
      `Unable to insert ${table}: ${error.message}`
    );
  }

  return data;
}

async function loadOne(
  admin,
  table,
  id,
  columns = "*"
) {
  const {
    data,
    error,
  } =
    await admin
      .from(table)
      .select(columns)
      .eq("id", id)
      .single();

  if (error) {
    throw new Error(
      `Unable to load ${table}: ${error.message}`
    );
  }

  return data;
}

async function loadBookings(
  admin,
  bookingIds
) {
  const {
    data,
    error,
  } =
    await admin
      .from("bookings")
      .select(
        "id, payment_status, payment_mode, amount_total, estimated_amount_cents, currency, stripe_checkout_session_id, refund_status, stripe_refund_id, refunded_amount_cents, platform_fee_amount, provider_amount"
      )
      .in("id", bookingIds);

  if (error) {
    throw new Error(
      `Unable to load split child bookings: ${error.message}`
    );
  }

  expect(
    (data ?? []).length ===
      bookingIds.length,
    "Split child booking fixture is incomplete."
  );

  return new Map(
    (data ?? []).map(
      (booking) => [
        booking.id,
        booking,
      ]
    )
  );
}

async function loadLedger(
  admin,
  bookingIds,
  entryType
) {
  const {
    data,
    error,
  } =
    await admin
      .from(
        "booking_financial_ledger"
      )
      .select(
        "booking_id, entry_key, entry_type, status, gross_amount_cents, platform_fee_cents, provider_amount_cents, refund_amount_cents, payment_mode, stripe_checkout_session_id, stripe_payment_intent_id, stripe_refund_id"
      )
      .in(
        "booking_id",
        bookingIds
      )
      .eq(
        "entry_type",
        entryType
      );

  if (error) {
    throw new Error(
      `Unable to load financial ledger: ${error.message}`
    );
  }

  return data ?? [];
}

async function assertWebhookHandled(
  event,
  webhookSecret
) {
  const body =
    await postStripeEvent(
      event,
      webhookSecret
    );

  expect(
    body?.received === true,
    `Webhook ${event.type} was not acknowledged.`
  );
  expect(
    body?.duplicate === false,
    `Webhook ${event.type} was unexpectedly marked duplicate.`
  );
  expect(
    body?.splitPayment === true,
    `Webhook ${event.type} did not use the split payment handler.`
  );
  expect(
    body?.eventId === event.id,
    `Webhook ${event.type} returned the wrong event id.`
  );

  return body;
}

function tomorrowDate() {
  const date =
    new Date();
  date.setUTCDate(
    date.getUTCDate() +
      1
  );

  return date
    .toISOString()
    .slice(0, 10);
}

async function main() {
  const {
    e2eOrigin,
    localSupabase,
  } =
    assertGoldenPathIsolation();

  expect(
    localSupabase,
    "Split refund golden path is allowed only on ephemeral local Supabase."
  );
  expect(
    process.env.NEXT_PUBLIC_APP_URL ===
      APP_ORIGIN,
    "Split refund golden path requires the isolated local production server."
  );

  const serviceRole =
    requiredGoldenPathEnv(
      "SUPABASE_SERVICE_ROLE_KEY"
    );
  const email =
    requiredGoldenPathEnv(
      "KLYX_E2E_EMAIL"
    );
  const webhookSecret =
    requiredGoldenPathEnv(
      "STRIPE_WEBHOOK_SECRET"
    );

  const admin =
    createClient(
      e2eOrigin,
      serviceRole,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

  const user =
    await findGoldenPathUserByEmail(
      admin,
      email
    );

  expect(
    Boolean(user),
    "Golden-path auth user must exist before split refund proof."
  );

  const {
    data: profiles,
    error: profilesError,
  } =
    await admin
      .from("profiles")
      .select(
        "id, owner_user_id, account_type, country_code, currency_code"
      )
      .eq(
        "owner_user_id",
        user.id
      );

  if (profilesError) {
    throw new Error(
      `Unable to load golden profiles: ${profilesError.message}`
    );
  }

  const client =
    (profiles ?? []).find(
      (profile) =>
        profile.account_type ===
        "client"
    );
  const providerOne =
    (profiles ?? []).find(
      (profile) =>
        profile.account_type ===
        "provider"
    );

  expect(
    Boolean(client) &&
      Boolean(providerOne),
    "Golden-path client/provider fixture is missing."
  );
  expect(
    client.country_code === "BE" &&
      client.currency_code === "EUR" &&
      providerOne.country_code === "BE" &&
      providerOne.currency_code === "EUR",
    "Split refund proof requires BE/EUR golden profiles."
  );

  const {
    data: services,
    error: servicesError,
  } =
    await admin
      .from("services")
      .select("id, slug")
      .order("slug")
      .limit(500);

  if (servicesError) {
    throw new Error(
      `Unable to load KLYX services: ${servicesError.message}`
    );
  }

  const service =
    cleaningService(
      services ?? []
    );

  expect(
    Boolean(service),
    "Canonical cleaning service is missing from split refund proof."
  );

  const {
    data: providerOneService,
    error: providerOneServiceError,
  } =
    await admin
      .from("user_services")
      .select("id")
      .eq(
        "user_id",
        providerOne.id
      )
      .eq(
        "service_id",
        service.id
      )
      .eq("active", true)
      .eq(
        "provider_enabled",
        true
      )
      .maybeSingle();

  if (providerOneServiceError) {
    throw new Error(
      `Unable to load first split provider service: ${providerOneServiceError.message}`
    );
  }

  expect(
    Boolean(providerOneService),
    "First split provider does not have an active cleaning service."
  );

  const nonce =
    randomUUID()
      .replaceAll("-", "")
      .slice(0, 16);
  const providerTwoId =
    randomUUID();

  await insertOne(
    admin,
    "profiles",
    {
      id: providerTwoId,
      owner_user_id: user.id,
      full_name:
        "KLYX Golden Split Provider",
      first_name: "Golden",
      last_name: "Split",
      role: "provider",
      current_mode: "provider",
      account_type: "provider",
      city: "Bruxelles",
      country_code: "BE",
      currency_code: "EUR",
      stripe_account_id:
        `acct_test_split_${nonce}`,
      stripe_onboarding_complete: true,
      stripe_charges_enabled: true,
      stripe_payouts_enabled: true,
    },
    "id"
  );

  const providerTwoService =
    await insertOne(
      admin,
      "user_services",
      {
        user_id: providerTwoId,
        service_id: service.id,
        active: true,
        provider_enabled: true,
      },
      "id"
    );

  const now =
    new Date()
      .toISOString();

  const {
    error: providerTwoAvailabilityError,
  } =
    await admin
      .from("availability_slots")
      .insert(
        Array.from(
          {
            length: 7,
          },
          (_, dayOfWeek) => ({
            user_service_id:
              providerTwoService.id,
            day_of_week:
              dayOfWeek,
            start_time: "08:00",
            end_time: "20:00",
            is_active: true,
            updated_at: now,
          })
        )
      );

  if (providerTwoAvailabilityError) {
    throw new Error(
      `Unable to create second split provider availability: ${providerTwoAvailabilityError.message}`
    );
  }

  const marketRequest =
    await insertOne(
      admin,
      "market_service_requests",
      {
        client_profile_id:
          client.id,
        service_id: service.id,
        title:
          "Golden split refund reconciliation",
        description:
          "Ephemeral KLYX split payment and refund reconciliation proof.",
        city: "Bruxelles",
        requested_date:
          tomorrowDate(),
        requested_time:
          "09:00",
        budget_max: 150,
        budget_total: 150,
        status: "open",
        request_mode:
          "multi_slot",
        slot_count: 3,
        prefer_single_provider:
          false,
        country_code: "BE",
        currency: "EUR",
      },
      "id"
    );

  const planHash =
    "a".repeat(64);
  const priceHash =
    "b".repeat(64);
  const paymentPlanHash =
    "c".repeat(64);

  const planConfirmation =
    await insertOne(
      admin,
      "market_split_plan_confirmations",
      {
        market_request_id:
          marketRequest.id,
        client_profile_id:
          client.id,
        plan_hash: planHash,
        plan_snapshot: {
          golden: true,
          slots: 3,
          providers: 2,
        },
        slot_count: 3,
        provider_count: 2,
      },
      "id"
    );

  const batch =
    await insertOne(
      admin,
      "split_booking_batches",
      {
        market_request_id:
          marketRequest.id,
        client_profile_id:
          client.id,
        confirmation_id:
          planConfirmation.id,
        plan_hash: planHash,
        status: "creating",
        expected_booking_count:
          3,
        provider_count: 2,
      },
      "id"
    );

  const bookingDate =
    tomorrowDate();

  const bookingSpecs = [
    {
      providerId:
        providerOne.id,
      userServiceId:
        providerOneService.id,
      amount: 4000,
      start: "09:00",
      end: "10:00",
      position: 1,
      slotId:
        `golden-split-${nonce}-1`,
    },
    {
      providerId:
        providerOne.id,
      userServiceId:
        providerOneService.id,
      amount: 6000,
      start: "11:00",
      end: "12:00",
      position: 2,
      slotId:
        `golden-split-${nonce}-2`,
    },
    {
      providerId:
        providerTwoId,
      userServiceId:
        providerTwoService.id,
      amount: 5000,
      start: "13:00",
      end: "14:00",
      position: 3,
      slotId:
        `golden-split-${nonce}-3`,
    },
  ];

  const bookings = [];

  for (
    const spec
    of bookingSpecs
  ) {
    const booking =
      await insertOne(
        admin,
        "bookings",
        {
          babysitter_id:
            spec.providerId,
          provider_id:
            spec.providerId,
          parent_id:
            client.id,
          booking_date:
            bookingDate,
          start_time:
            spec.start,
          end_time:
            spec.end,
          status: "accepted",
          message:
            "Golden split refund proof",
          payment_status:
            "unpaid",
          amount_total:
            spec.amount,
          estimated_amount_cents:
            spec.amount,
          currency: "EUR",
          service_id:
            service.id,
          user_service_id:
            spec.userServiceId,
          service_status:
            "scheduled",
          pricing_type_snapshot:
            "fixed",
          unit_price_cents:
            spec.amount,
          country_code: "BE",
          accepted_at: now,
        },
        "id"
      );

    bookings.push({
      ...booking,
      ...spec,
    });
  }

  const {
    error: batchItemsError,
  } =
    await admin
      .from(
        "split_booking_batch_items"
      )
      .insert(
        bookings.map(
          (booking) => ({
            batch_id: batch.id,
            booking_id:
              booking.id,
            slot_id:
              booking.slotId,
            slot_position:
              booking.position,
            provider_profile_id:
              booking.providerId,
            user_service_id:
              booking.userServiceId,
          })
        )
      );

  if (batchItemsError) {
    throw new Error(
      `Unable to create split batch items: ${batchItemsError.message}`
    );
  }

  const {
    error: batchReadyError,
  } =
    await admin
      .from(
        "split_booking_batches"
      )
      .update({
        status: "created",
        completed_at: now,
        updated_at: now,
      })
      .eq("id", batch.id);

  if (batchReadyError) {
    throw new Error(
      `Unable to finalize split batch: ${batchReadyError.message}`
    );
  }

  const priceConfirmation =
    await insertOne(
      admin,
      "split_booking_price_confirmations",
      {
        batch_id: batch.id,
        client_profile_id:
          client.id,
        price_hash: priceHash,
        price_snapshot: {
          golden: true,
          total_amount_cents:
            15000,
        },
        item_count: 3,
        total_amount_cents:
          15000,
        currency: "EUR",
      },
      "id"
    );

  const paymentConfirmation =
    await insertOne(
      admin,
      "split_booking_payment_confirmations",
      {
        batch_id: batch.id,
        client_profile_id:
          client.id,
        price_confirmation_id:
          priceConfirmation.id,
        payment_plan_hash:
          paymentPlanHash,
        payment_plan_snapshot: {
          golden: true,
          units: 2,
          total_amount_cents:
            15000,
        },
        provider_count: 2,
        payment_unit_count: 2,
        total_amount_cents:
          15000,
        currency: "EUR",
      },
      "id"
    );

  const run =
    await insertOne(
      admin,
      "split_booking_payment_runs",
      {
        batch_id: batch.id,
        client_profile_id:
          client.id,
        payment_confirmation_id:
          paymentConfirmation.id,
        payment_plan_hash:
          paymentPlanHash,
        total_amount_cents:
          15000,
        currency: "EUR",
        provider_count: 2,
        payment_unit_count: 2,
        status: "ready",
        ready_at: now,
      },
      "id"
    );

  const unitOne =
    await insertOne(
      admin,
      "split_booking_payment_units",
      {
        run_id: run.id,
        batch_id: batch.id,
        payment_confirmation_id:
          paymentConfirmation.id,
        client_profile_id:
          client.id,
        provider_profile_id:
          providerOne.id,
        stripe_account_id:
          `acct_test_split_one_${nonce}`,
        amount_cents: 10000,
        currency: "EUR",
        booking_ids: [
          bookings[0].id,
          bookings[1].id,
        ],
        slot_ids: [
          bookings[0].slotId,
          bookings[1].slotId,
        ],
        application_fee_amount:
          1500,
        provider_amount_cents:
          8500,
        status: "pending",
      },
      "id"
    );

  const unitTwo =
    await insertOne(
      admin,
      "split_booking_payment_units",
      {
        run_id: run.id,
        batch_id: batch.id,
        payment_confirmation_id:
          paymentConfirmation.id,
        client_profile_id:
          client.id,
        provider_profile_id:
          providerTwoId,
        stripe_account_id:
          `acct_test_split_two_${nonce}`,
        amount_cents: 5000,
        currency: "EUR",
        booking_ids: [
          bookings[2].id,
        ],
        slot_ids: [
          bookings[2].slotId,
        ],
        application_fee_amount:
          750,
        provider_amount_cents:
          4250,
        status: "pending",
      },
      "id"
    );

  const sessionOneId =
    `cs_test_split_one_${nonce}`;
  const sessionTwoId =
    `cs_test_split_two_${nonce}`;
  const intentOneId =
    `pi_test_split_one_${nonce}`;
  const intentTwoId =
    `pi_test_split_two_${nonce}`;

  await assertWebhookHandled(
    stripeEvent(
      `evt_test_split_pay_one_${nonce}`,
      "checkout.session.completed",
      {
        id: sessionOneId,
        object:
          "checkout.session",
        amount_total: 10000,
        currency: "eur",
        payment_status: "paid",
        payment_intent:
          intentOneId,
        metadata: {
          klyx_flow:
            "split_payment_13_27",
          split_payment_unit_id:
            unitOne.id,
        },
      }
    ),
    webhookSecret
  );

  let storedRun =
    await loadOne(
      admin,
      "split_booking_payment_runs",
      run.id,
      "id, status"
    );
  expect(
    storedRun.status ===
      "partially_paid",
    `Split run should be partially_paid after first unit, got ${storedRun.status}.`
  );

  await assertWebhookHandled(
    stripeEvent(
      `evt_test_split_pay_two_${nonce}`,
      "checkout.session.completed",
      {
        id: sessionTwoId,
        object:
          "checkout.session",
        amount_total: 5000,
        currency: "eur",
        payment_status: "paid",
        payment_intent:
          intentTwoId,
        metadata: {
          klyx_flow:
            "split_payment_13_27",
          split_payment_unit_id:
            unitTwo.id,
        },
      }
    ),
    webhookSecret
  );

  storedRun =
    await loadOne(
      admin,
      "split_booking_payment_runs",
      run.id,
      "id, status"
    );
  expect(
    storedRun.status === "paid",
    `Split run should be paid after both units, got ${storedRun.status}.`
  );

  const bookingIds =
    bookings.map(
      (booking) =>
        booking.id
    );
  let bookingMap =
    await loadBookings(
      admin,
      bookingIds
    );

  for (
    const booking
    of bookings
  ) {
    const stored =
      bookingMap.get(
        booking.id
      );

    expect(
      stored?.payment_status ===
        "paid",
      `Split child ${booking.id} should be paid.`
    );
    expect(
      stored?.payment_mode ===
        "connect_destination_split",
      `Split child ${booking.id} should preserve split payment mode.`
    );
  }

  expect(
    bookingMap.get(
      bookings[0].id
    )?.stripe_checkout_session_id ===
      sessionOneId &&
      bookingMap.get(
        bookings[1].id
      )?.stripe_checkout_session_id ===
        sessionOneId,
    "Two child bookings must be allowed to share the unit-level Stripe Checkout Session."
  );

  const paymentLedger =
    await loadLedger(
      admin,
      bookingIds,
      "payment_succeeded"
    );

  expect(
    paymentLedger.length === 3,
    `Expected 3 split payment ledger rows, got ${paymentLedger.length}.`
  );
  expect(
    paymentLedger.every(
      (entry) =>
        entry.payment_mode ===
          "connect_destination_split" &&
        entry.status ===
          "succeeded"
    ),
    "Split payment ledger rows must be succeeded and tagged with split payment mode."
  );
  expect(
    paymentLedger.reduce(
      (
        total,
        entry
      ) =>
        total +
        Number(
          entry.platform_fee_cents ??
            0
        ),
      0
    ) === 2250,
    "Split payment ledger platform fee total must equal 2250 cents."
  );

  const partialRefundId =
    `re_test_split_partial_${nonce}`;
  const partialRefundEvent =
    stripeEvent(
      `evt_test_split_refund_partial_${nonce}`,
      "refund.created",
      {
        id: partialRefundId,
        object: "refund",
        amount: 2500,
        currency: "eur",
        payment_intent:
          intentOneId,
        status: "succeeded",
        failure_reason: null,
        metadata: {
          split_payment_unit_id:
            unitOne.id,
        },
      }
    );

  await assertWebhookHandled(
    partialRefundEvent,
    webhookSecret
  );

  let storedUnitOne =
    await loadOne(
      admin,
      "split_booking_payment_units",
      unitOne.id,
      "id, refund_status, refunded_amount_cents, stripe_refund_id"
    );

  expect(
    storedUnitOne.refund_status ===
      "partially_refunded" &&
      Number(
        storedUnitOne.refunded_amount_cents
      ) === 2500,
    "First split unit must record the 2500-cent partial refund."
  );

  storedRun =
    await loadOne(
      admin,
      "split_booking_payment_runs",
      run.id,
      "id, status"
    );
  expect(
    storedRun.status ===
      "partially_refunded",
    "Split run must become partially_refunded after the first partial refund."
  );

  bookingMap =
    await loadBookings(
      admin,
      bookingIds
    );

  expect(
    Number(
      bookingMap.get(
        bookings[0].id
      )?.refunded_amount_cents
    ) === 1000 &&
      Number(
        bookingMap.get(
          bookings[1].id
        )?.refunded_amount_cents
      ) === 1500,
    "Partial split refund must allocate 1000/1500 cents across 40/60 child bookings."
  );
  expect(
    bookingMap.get(
      bookings[0].id
    )?.payment_status ===
      "paid" &&
      bookingMap.get(
        bookings[1].id
      )?.payment_status ===
        "paid",
    "Partially refunded child bookings must remain payment_status=paid."
  );
  expect(
    bookingMap.get(
      bookings[0].id
    )?.stripe_refund_id ===
      partialRefundId &&
      bookingMap.get(
        bookings[1].id
      )?.stripe_refund_id ===
        partialRefundId,
    "Split children must be allowed to share the unit-level Stripe refund id."
  );

  const refundLedgerBeforeReplay =
    await loadLedger(
      admin,
      bookingIds,
      "refund_succeeded"
    );

  expect(
    refundLedgerBeforeReplay.length ===
      2,
    `Expected 2 partial refund ledger rows before replay, got ${refundLedgerBeforeReplay.length}.`
  );

  const duplicateBody =
    await postStripeEvent(
      partialRefundEvent,
      webhookSecret
    );

  expect(
    duplicateBody?.received === true &&
      duplicateBody?.duplicate === true &&
      duplicateBody?.reason ===
        "already_processed" &&
      duplicateBody?.eventId ===
        partialRefundEvent.id,
    "Exact split refund webhook replay must be rejected as an already_processed duplicate."
  );

  const refundLedgerAfterReplay =
    await loadLedger(
      admin,
      bookingIds,
      "refund_succeeded"
    );
  expect(
    refundLedgerAfterReplay.length ===
      refundLedgerBeforeReplay.length,
    "Duplicate split refund webhook must not create extra ledger rows."
  );

  const {
    count: partialRefundCount,
    error: partialRefundCountError,
  } =
    await admin
      .from(
        "split_booking_payment_refunds"
      )
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "stripe_refund_id",
        partialRefundId
      );

  if (partialRefundCountError) {
    throw new Error(
      `Unable to count split refunds after replay: ${partialRefundCountError.message}`
    );
  }
  expect(
    partialRefundCount === 1,
    "Duplicate webhook must keep exactly one split refund record."
  );

  const finalUnitOneRefundId =
    `re_test_split_final_one_${nonce}`;

  await assertWebhookHandled(
    stripeEvent(
      `evt_test_split_refund_final_one_${nonce}`,
      "refund.created",
      {
        id: finalUnitOneRefundId,
        object: "refund",
        amount: 7500,
        currency: "eur",
        payment_intent:
          intentOneId,
        status: "succeeded",
        failure_reason: null,
        metadata: {
          split_payment_unit_id:
            unitOne.id,
        },
      }
    ),
    webhookSecret
  );

  storedUnitOne =
    await loadOne(
      admin,
      "split_booking_payment_units",
      unitOne.id,
      "id, refund_status, refunded_amount_cents"
    );
  expect(
    storedUnitOne.refund_status ===
      "refunded" &&
      Number(
        storedUnitOne.refunded_amount_cents
      ) === 10000,
    "First split unit must become fully refunded at 10000 cents."
  );

  bookingMap =
    await loadBookings(
      admin,
      bookingIds
    );
  expect(
    Number(
      bookingMap.get(
        bookings[0].id
      )?.refunded_amount_cents
    ) === 4000 &&
      Number(
        bookingMap.get(
          bookings[1].id
        )?.refunded_amount_cents
      ) === 6000,
    "Cumulative split refund snapshots must reach the exact 4000/6000 child totals."
  );
  expect(
    bookingMap.get(
      bookings[0].id
    )?.payment_status ===
      "refunded" &&
      bookingMap.get(
        bookings[1].id
      )?.payment_status ===
        "refunded",
    "Fully refunded split children must reach terminal payment_status=refunded."
  );

  const unitTwoRefundId =
    `re_test_split_final_two_${nonce}`;

  await assertWebhookHandled(
    stripeEvent(
      `evt_test_split_refund_final_two_${nonce}`,
      "refund.created",
      {
        id: unitTwoRefundId,
        object: "refund",
        amount: 5000,
        currency: "eur",
        payment_intent:
          intentTwoId,
        status: "succeeded",
        failure_reason: null,
        metadata: {
          split_payment_unit_id:
            unitTwo.id,
        },
      }
    ),
    webhookSecret
  );

  const storedUnitTwo =
    await loadOne(
      admin,
      "split_booking_payment_units",
      unitTwo.id,
      "id, refund_status, refunded_amount_cents"
    );
  expect(
    storedUnitTwo.refund_status ===
      "refunded" &&
      Number(
        storedUnitTwo.refunded_amount_cents
      ) === 5000,
    "Second split unit must become fully refunded at 5000 cents."
  );

  storedRun =
    await loadOne(
      admin,
      "split_booking_payment_runs",
      run.id,
      "id, status"
    );
  expect(
    storedRun.status ===
      "refunded",
    `Split run must become refunded after all units, got ${storedRun.status}.`
  );

  bookingMap =
    await loadBookings(
      admin,
      bookingIds
    );
  expect(
    bookings.every(
      (booking) =>
        bookingMap.get(
          booking.id
        )?.payment_status ===
          "refunded"
    ),
    "Every split child booking must end in terminal payment_status=refunded."
  );
  expect(
    Number(
      bookingMap.get(
        bookings[2].id
      )?.refunded_amount_cents
    ) === 5000,
    "Second split unit child refund snapshot must equal 5000 cents."
  );

  const finalRefundLedger =
    await loadLedger(
      admin,
      bookingIds,
      "refund_succeeded"
    );
  expect(
    finalRefundLedger.length === 5,
    `Expected 5 split refund ledger rows, got ${finalRefundLedger.length}.`
  );

  const refundedByBooking =
    new Map(
      bookingIds.map(
        (id) => [id, 0]
      )
    );

  for (
    const entry
    of finalRefundLedger
  ) {
    expect(
      entry.payment_mode ===
        "connect_destination_split" &&
        entry.status ===
          "succeeded",
      "Split refund ledger rows must be succeeded and tagged with split payment mode."
    );

    refundedByBooking.set(
      entry.booking_id,
      (
        refundedByBooking.get(
          entry.booking_id
        ) ?? 0
      ) +
        Number(
          entry.refund_amount_cents ??
            0
        )
    );
  }

  expect(
    refundedByBooking.get(
      bookings[0].id
    ) === 4000 &&
      refundedByBooking.get(
        bookings[1].id
      ) === 6000 &&
      refundedByBooking.get(
        bookings[2].id
      ) === 5000,
    "Refund ledger totals must reconcile exactly to 4000/6000/5000 cents."
  );

  const {
    data: refundRows,
    error: refundRowsError,
  } =
    await admin
      .from(
        "split_booking_payment_refunds"
      )
      .select(
        "stripe_refund_id, amount_cents, status"
      )
      .eq("run_id", run.id);

  if (refundRowsError) {
    throw new Error(
      `Unable to load final split refund records: ${refundRowsError.message}`
    );
  }

  expect(
    (refundRows ?? []).length === 3 &&
      (refundRows ?? []).every(
        (refund) =>
          refund.status ===
          "succeeded"
      ) &&
      (refundRows ?? []).reduce(
        (
          total,
          refund
        ) =>
          total +
          Number(
            refund.amount_cents
          ),
        0
      ) === 15000,
    "Three succeeded split refund records must reconcile to the full 15000 cents."
  );

  process.stdout.write(
    `${JSON.stringify({
      verified: true,
      flow:
        "split_payment_13_27",
      runId: run.id,
      paymentUnitCount: 2,
      childBookingCount: 3,
      paymentLedgerRows:
        paymentLedger.length,
      refundRows:
        (refundRows ?? []).length,
      refundLedgerRows:
        finalRefundLedger.length,
      duplicateWebhookRejected:
        true,
      totalPaidCents: 15000,
      totalRefundedCents:
        15000,
      finalRunStatus:
        storedRun.status,
    })}\n`
  );
}

main().catch(
  (error) => {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      `KLYX golden-path split refund failed: ${message}`
    );
    process.exitCode = 1;
  }
);
