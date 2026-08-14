import {
  NextResponse,
} from "next/server";

import {
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

// KLYX_SPLIT_BOOKING_API_13_19

type JsonRecord =
  Record<string, unknown>;

type RouteContext = {
  params:
    Promise<{
      id:
        string;
    }>;
};

type ConfirmedSlot = {
  id:
    string;

  position:
    number;

  date:
    string;

  startTime:
    string;

  endTime:
    string;

  budgetMax:
    number | null;

  providerId:
    string;

  userServiceId:
    string;
};

type ConfirmedPlan = {
  requestId:
    string;

  slotCount:
    number;

  providerCount:
    number;

  providerIds:
    string[];

  slots:
    ConfirmedSlot[];
};

type ConfirmationRow = {
  id:
    string;

  market_request_id:
    string;

  client_profile_id:
    string;

  plan_hash:
    string;

  plan_snapshot:
    unknown;

  slot_count:
    number;

  provider_count:
    number;

  invalidated_at:
    string | null;
};

type ExistingBatch = {
  id:
    string;

  status:
    string;

  expected_booking_count:
    number;

  created_booking_count:
    number;

  failure_reason:
    string | null;
};

function asRecord(
  value:
    unknown
): JsonRecord | null {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    return null;
  }

  return value as JsonRecord;
}

function cleanText(
  value:
    unknown
): string {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function integer(
  value:
    unknown
): number {
  const parsed =
    Number(
      value
    );

  return Number.isFinite(
    parsed
  )
    ? Math.trunc(
        parsed
      )
    : 0;
}

function parsePlan(
  value:
    unknown
): ConfirmedPlan | null {
  const root =
    asRecord(
      value
    );

  if (!root) {
    return null;
  }

  const rawSlots =
    Array.isArray(
      root.slots
    )
      ? root.slots
      : [];

  if (
    rawSlots.length <
    2
  ) {
    return null;
  }

  const slots:
    ConfirmedSlot[] =
    [];

  for (
    const raw
    of rawSlots
  ) {
    const row =
      asRecord(
        raw
      );

    if (!row) {
      return null;
    }

    const id =
      cleanText(
        row.id
      );

    const date =
      cleanText(
        row.date
      );

    const startTime =
      cleanText(
        row.startTime
      );

    const endTime =
      cleanText(
        row.endTime
      );

    const providerId =
      cleanText(
        row.providerId
      );

    const userServiceId =
      cleanText(
        row.userServiceId
      );

    const position =
      integer(
        row.position
      );

    if (
      !id ||
      !date ||
      !startTime ||
      !endTime ||
      !providerId ||
      !userServiceId ||
      position <
        1
    ) {
      return null;
    }

    slots.push({
      id,

      position,

      date,

      startTime,

      endTime,

      budgetMax:
        row.budgetMax ===
          null ||
        row.budgetMax ===
          undefined
          ? null
          : Number(
              row.budgetMax
            ),

      providerId,

      userServiceId,
    });
  }

  slots.sort(
    (
      first,
      second
    ) =>
      first.position -
      second.position
  );

  const providerIds =
    Array.from(
      new Set(
        slots.map(
          (
            slot
          ) =>
            slot.providerId
        )
      )
    );

  if (
    providerIds.length <
    2
  ) {
    return null;
  }

  return {
    requestId:
      cleanText(
        root.requestId
      ),

    slotCount:
      slots.length,

    providerCount:
      providerIds.length,

    providerIds,

    slots,
  };
}

async function authHeaders(
  request:
    Request
): Promise<Headers> {
  const headers =
    new Headers();

  const authorization =
    request.headers.get(
      "authorization"
    );

  const cookie =
    request.headers.get(
      "cookie"
    );

  if (
    authorization
  ) {
    headers.set(
      "authorization",
      authorization
    );
  }

  if (
    cookie
  ) {
    headers.set(
      "cookie",
      cookie
    );
  }

  headers.set(
    "content-type",
    "application/json"
  );

  return headers;
}

async function verifyConfirmationLive(
  request:
    Request,

  requestId:
    string,

  confirmationId:
    string
): Promise<{
  ok:
    boolean;

  status:
    number;

  body:
    JsonRecord | null;
}> {
  const url =
    new URL(
      "/api/market/requests/" +
      encodeURIComponent(
        requestId
      ) +
      "/split-fallback/confirm",
      request.url
    );

  url.searchParams.set(
    "confirmationId",
    confirmationId
  );

  const response =
    await fetch(
      url,
      {
        method:
          "GET",

        cache:
          "no-store",

        headers:
          await authHeaders(
            request
          ),
      }
    );

  let body:
    JsonRecord | null =
    null;

  try {
    body =
      asRecord(
        await response.json()
      );
  }
  catch {
    body =
      null;
  }

  return {
    ok:
      response.ok &&
      body?.confirmed ===
        true &&
      body?.valid ===
        true,

    status:
      response.status,

    body,
  };
}

async function createSingleBooking(
  request:
    Request,

  input: {
    providerId:
      string;

    serviceSlug:
      string;

    bookingDate:
      string;

    startTime:
      string;

    endTime:
      string;

    message:
      string;
  }
): Promise<{
  ok:
    boolean;

  bookingId:
    string;

  error:
    string;
}> {
  const url =
    new URL(
      "/api/bookings/create",
      request.url
    );

  const response =
    await fetch(
      url,
      {
        method:
          "POST",

        cache:
          "no-store",

        headers:
          await authHeaders(
            request
          ),

        body:
          JSON.stringify(
            input
          ),
      }
    );

  let body:
    JsonRecord | null =
    null;

  try {
    body =
      asRecord(
        await response.json()
      );
  }
  catch {
    body =
      null;
  }

  const bookingId =
    cleanText(
      body?.bookingId
    );

  return {
    ok:
      response.ok &&
      Boolean(
        bookingId
      ),

    bookingId,

    error:
      cleanText(
        body?.error
      ) ||
      (
        "BOOKING_CREATE_FAILED_" +
        String(
          response.status
        )
      ),
  };
}

async function rollbackBookings(
  bookingIds:
    string[]
): Promise<void> {
  if (
    bookingIds.length ===
    0
  ) {
    return;
  }

  /*
    Compensation 13.19 :
    si une creation suivante echoue,
    les reservations creees durant CE batch
    sont supprimees.

    Aucun paiement n'a encore ete cree.
  */
  await supabaseAdmin
    .from(
      "bookings"
    )
    .delete()
    .in(
      "id",
      bookingIds
    );
}

export async function GET(
  request:
    Request,

  context:
    RouteContext
) {
  try {
    const {
      profile,
    } =
      await getAuthenticatedProfile(
        request
      );

    requireAccountType(
      profile,
      "client"
    );

    const {
      id:
        requestId,
    } =
      await context.params;

    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from(
          "split_booking_batches"
        )
        .select(
          "id, status, expected_booking_count, provider_count, created_booking_count, completed_at, failed_at, failure_reason, confirmation_id"
        )
        .eq(
          "market_request_id",
          requestId
        )
        .eq(
          "client_profile_id",
          profile.id
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        )
        .limit(
          1
        )
        .maybeSingle();

    if (
      error
    ) {
      throw new Error(
        error.message
      );
    }

    if (!data) {
      return NextResponse.json({
        exists:
          false,

        bookingCreated:
          false,

        paymentCreated:
          false,
      });
    }

    const {
      data:
        items,

      error:
        itemsError,
    } =
      await supabaseAdmin
        .from(
          "split_booking_batch_items"
        )
        .select(
          "booking_id, slot_id, slot_position, provider_profile_id"
        )
        .eq(
          "batch_id",
          data.id
        )
        .order(
          "slot_position",
          {
            ascending:
              true,
          }
        );

    if (
      itemsError
    ) {
      throw new Error(
        itemsError.message
      );
    }

    return NextResponse.json({
      exists:
        true,

      batch:
        data,

      bookings:
        items ??
        [],

      bookingCreated:
        data.status ===
        "created",

      paymentCreated:
        false,
    });
  }
  catch (
    error
  ) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de charger le batch multi-prestataires.",
      },
      {
        status:
          500,
      }
    );
  }
}

export async function POST(
  request:
    Request,

  context:
    RouteContext
) {
  let batchId =
    "";

  const createdBookingIds:
    string[] =
    [];

  try {
    const {
      profile,
    } =
      await getAuthenticatedProfile(
        request
      );

    requireAccountType(
      profile,
      "client"
    );

    const {
      id:
        requestId,
    } =
      await context.params;

    const body =
      asRecord(
        await request.json()
      );

    const confirmationId =
      cleanText(
        body?.confirmationId
      );

    const bookingConfirmed =
      body?.bookingConfirmed ===
      true;

    /*
      13.18 confirme le plan.
      13.19 exige EN PLUS un clic explicitement
      dedie a la creation des reservations.
    */
    if (
      !confirmationId ||
      !bookingConfirmed
    ) {
      return NextResponse.json(
        {
          code:
            "SPLIT_BOOKING_EXPLICIT_CONFIRMATION_REQUIRED",

          error:
            "Confirme explicitement la creation des reservations.",

          bookingCreated:
            false,

          paymentCreated:
            false,
        },
        {
          status:
            400,
        }
      );
    }

    const {
      data:
        confirmationData,

      error:
        confirmationError,
    } =
      await supabaseAdmin
        .from(
          "market_split_plan_confirmations"
        )
        .select(
          "id, market_request_id, client_profile_id, plan_hash, plan_snapshot, slot_count, provider_count, invalidated_at"
        )
        .eq(
          "id",
          confirmationId
        )
        .eq(
          "market_request_id",
          requestId
        )
        .eq(
          "client_profile_id",
          profile.id
        )
        .maybeSingle();

    if (
      confirmationError
    ) {
      throw new Error(
        confirmationError.message
      );
    }

    const confirmation =
      confirmationData as unknown as
        ConfirmationRow |
        null;

    if (
      !confirmation ||
      confirmation.invalidated_at
    ) {
      return NextResponse.json(
        {
          code:
            "SPLIT_BOOKING_CONFIRMATION_INVALID",

          error:
            "La confirmation du plan n'est plus valide.",

          reconfirmationRequired:
            true,

          bookingCreated:
            false,

          paymentCreated:
            false,
        },
        {
          status:
            409,
        }
      );
    }

    /*
      Revalidation 13.18 juste avant la creation.
    */
    const proof =
      await verifyConfirmationLive(
        request,
        requestId,
        confirmationId
      );

    if (
      !proof.ok
    ) {
      return NextResponse.json(
        {
          code:
            "SPLIT_BOOKING_PLAN_CHANGED",

          error:
            "Le plan a change. Verifie puis confirme de nouveau avant de reserver.",

          reconfirmationRequired:
            true,

          bookingCreated:
            false,

          paymentCreated:
            false,
        },
        {
          status:
            409,
        }
      );
    }

    const plan =
      parsePlan(
        confirmation.plan_snapshot
      );

    if (
      !plan ||
      plan.requestId !==
        requestId ||
      plan.slotCount !==
        confirmation.slot_count ||
      plan.providerCount !==
        confirmation.provider_count
    ) {
      return NextResponse.json(
        {
          code:
            "SPLIT_BOOKING_SNAPSHOT_INVALID",

          error:
            "Le snapshot confirme ne peut pas etre utilise.",

          bookingCreated:
            false,

          paymentCreated:
            false,
        },
        {
          status:
            409,
        }
      );
    }

    /*
      Idempotence :
      une preuve 13.18 ne peut produire
      qu'un seul batch 13.19.
    */
    const {
      data:
        previousBatch,

      error:
        previousBatchError,
    } =
      await supabaseAdmin
        .from(
          "split_booking_batches"
        )
        .select(
          "id, status, expected_booking_count, created_booking_count, failure_reason"
        )
        .eq(
          "confirmation_id",
          confirmationId
        )
        .maybeSingle();

    if (
      previousBatchError
    ) {
      throw new Error(
        previousBatchError.message
      );
    }

    const previous =
      previousBatch as unknown as
        ExistingBatch |
        null;

    if (
      previous
    ) {
      const {
        data:
          existingItems,
      } =
        await supabaseAdmin
          .from(
            "split_booking_batch_items"
          )
          .select(
            "booking_id, slot_id, slot_position, provider_profile_id"
          )
          .eq(
            "batch_id",
            previous.id
          )
          .order(
            "slot_position",
            {
              ascending:
                true,
            }
          );

      if (
        previous.status ===
        "created"
      ) {
        return NextResponse.json({
          created:
            true,

          alreadyCreated:
            true,

          batchId:
            previous.id,

          bookings:
            existingItems ??
            [],

          bookingCount:
            previous.created_booking_count,

          paymentCreated:
            false,
        });
      }

      /*
        Ne jamais reexecuter silencieusement
        un batch interrompu.
      */
      return NextResponse.json(
        {
          code:
            "SPLIT_BOOKING_BATCH_RECOVERY_REQUIRED",

          error:
            "Une tentative precedente existe. KLYX bloque une seconde creation automatique pour eviter les doublons.",

          batchId:
            previous.id,

          status:
            previous.status,

          bookingCreated:
            false,

          paymentCreated:
            false,

          supportReviewRequired:
            true,
        },
        {
          status:
            409,
        }
      );
    }

    const {
      data:
        marketRequest,

      error:
        marketError,
    } =
      await supabaseAdmin
        .from(
          "market_service_requests"
        )
        .select(
          "id, client_profile_id, service_id, status"
        )
        .eq(
          "id",
          requestId
        )
        .eq(
          "client_profile_id",
          profile.id
        )
        .maybeSingle();

    if (
      marketError
    ) {
      throw new Error(
        marketError.message
      );
    }

    if (
      !marketRequest
    ) {
      return NextResponse.json(
        {
          error:
            "Demande KLYX introuvable.",
        },
        {
          status:
            404,
        }
      );
    }

    const {
      data:
        service,

      error:
        serviceError,
    } =
      await supabaseAdmin
        .from(
          "services"
        )
        .select(
          "id, slug, name"
        )
        .eq(
          "id",
          marketRequest.service_id
        )
        .maybeSingle();

    if (
      serviceError
    ) {
      throw new Error(
        serviceError.message
      );
    }

    if (
      !service?.slug
    ) {
      return NextResponse.json(
        {
          code:
            "SPLIT_BOOKING_SERVICE_REQUIRED",

          error:
            "Service KLYX introuvable.",

          bookingCreated:
            false,

          paymentCreated:
            false,
        },
        {
          status:
            409,
        }
      );
    }

    /*
      Verifie encore les liaisons
      provider -> user_service du snapshot.
    */
    for (
      const slot
      of plan.slots
    ) {
      const {
        data:
          userService,

        error:
          userServiceError,
      } =
        await supabaseAdmin
          .from(
            "user_services"
          )
          .select(
            "id, user_id, service_id, active, provider_enabled"
          )
          .eq(
            "id",
            slot.userServiceId
          )
          .eq(
            "user_id",
            slot.providerId
          )
          .eq(
            "service_id",
            marketRequest.service_id
          )
          .eq(
            "active",
            true
          )
          .eq(
            "provider_enabled",
            true
          )
          .maybeSingle();

      if (
        userServiceError
      ) {
        throw new Error(
          userServiceError.message
        );
      }

      if (
        !userService
      ) {
        return NextResponse.json(
          {
            code:
              "SPLIT_BOOKING_PROVIDER_SERVICE_CHANGED",

            error:
              "Un prestataire ne propose plus le service confirme.",

            reconfirmationRequired:
              true,

            bookingCreated:
              false,

            paymentCreated:
              false,
          },
          {
            status:
              409,
          }
        );
      }
    }

    const {
      data:
        batch,

      error:
        batchError,
    } =
      await supabaseAdmin
        .from(
          "split_booking_batches"
        )
        .insert({
          market_request_id:
            requestId,

          client_profile_id:
            profile.id,

          confirmation_id:
            confirmationId,

          plan_hash:
            confirmation.plan_hash,

          status:
            "creating",

          expected_booking_count:
            plan.slotCount,

          provider_count:
            plan.providerCount,

          created_booking_count:
            0,
        })
        .select(
          "id"
        )
        .single();

    if (
      batchError
    ) {
      /*
        Double clic concurrent :
        ne jamais lancer une seconde creation.
      */
      if (
        batchError.code ===
          "23505"
      ) {
        return NextResponse.json(
          {
            code:
              "SPLIT_BOOKING_ALREADY_STARTED",

            error:
              "La creation de ces reservations a deja commence.",

            bookingCreated:
              false,

            paymentCreated:
              false,
          },
          {
            status:
              409,
          }
        );
      }

      throw new Error(
        batchError.message
      );
    }

    batchId =
      batch.id;

    const bookingResults:
      Array<{
        bookingId:
          string;

        slotId:
          string;

        position:
          number;

        providerId:
          string;
      }> =
      [];

    /*
      Chaque slot confirme devient
      une vraie reservation KLYX.

      Ce flux reutilise /api/bookings/create
      afin de conserver les regles historiques
      de creation d'une reservation simple.
    */
    for (
      const slot
      of plan.slots
    ) {
      const created =
        await createSingleBooking(
          request,
          {
            providerId:
              slot.providerId,

            serviceSlug:
              service.slug,

            bookingDate:
              slot.date,

            startTime:
              slot.startTime,

            endTime:
              slot.endTime,

            message:
              "Reservation issue du plan multi-prestataires KLYX " +
              requestId +
              " - creneau " +
              String(
                slot.position
              ) +
              ".",
          }
        );

      if (
        !created.ok
      ) {
        throw new Error(
          "SPLIT_BOOKING_SLOT_FAILED:" +
          slot.id +
          ":" +
          created.error
        );
      }

      createdBookingIds.push(
        created.bookingId
      );

      const {
        error:
          itemError,
      } =
        await supabaseAdmin
          .from(
            "split_booking_batch_items"
          )
          .insert({
            batch_id:
              batchId,

            booking_id:
              created.bookingId,

            slot_id:
              slot.id,

            slot_position:
              slot.position,

            provider_profile_id:
              slot.providerId,

            user_service_id:
              slot.userServiceId,
          });

      if (
        itemError
      ) {
        throw new Error(
          "SPLIT_BOOKING_ITEM_FAILED:" +
          itemError.message
        );
      }

      bookingResults.push({
        bookingId:
          created.bookingId,

        slotId:
          slot.id,

        position:
          slot.position,

        providerId:
          slot.providerId,
      });

      const {
        error:
          countError,
      } =
        await supabaseAdmin
          .from(
            "split_booking_batches"
          )
          .update({
            created_booking_count:
              bookingResults.length,

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            batchId
          );

      if (
        countError
      ) {
        throw new Error(
          countError.message
        );
      }
    }

    const {
      error:
        completionError,
    } =
      await supabaseAdmin
        .from(
          "split_booking_batches"
        )
        .update({
          status:
            "created",

          created_booking_count:
            bookingResults.length,

          completed_at:
            new Date()
              .toISOString(),

          updated_at:
            new Date()
              .toISOString(),

          failure_reason:
            null,
        })
        .eq(
          "id",
          batchId
        );

    if (
      completionError
    ) {
      throw new Error(
        completionError.message
      );
    }

    return NextResponse.json(
      {
        created:
          true,

        alreadyCreated:
          false,

        batchId,

        confirmationId,

        bookingCount:
          bookingResults.length,

        providerCount:
          plan.providerCount,

        bookings:
          bookingResults,

        paymentCreated:
          false,

        paymentRequiredLater:
          true,

        message:
          "Reservations multi-prestataires creees. Aucun paiement n'a ete lance.",
      },
      {
        status:
          201,
      }
    );
  }
  catch (
    error
  ) {
    const message =
      error instanceof Error
        ? error.message
        : "SPLIT_BOOKING_FAILED";

    /*
      Compensation :
      si une partie du batch a deja cree
      des bookings, on les retire pour eviter
      une mission commerciale partielle.
    */
    if (
      createdBookingIds.length >
      0
    ) {
      try {
        await rollbackBookings(
          createdBookingIds
        );
      }
      catch {
        /*
          Le batch reste failed et visible.
          Aucun second essai automatique.
        */
      }
    }

    if (
      batchId
    ) {
      try {
        await supabaseAdmin
          .from(
            "split_booking_batches"
          )
          .update({
            status:
              "failed",

            created_booking_count:
              0,

            failed_at:
              new Date()
                .toISOString(),

            failure_reason:
              message.slice(
                0,
                1000
              ),

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            batchId
          );
      }
      catch {
        // Fail closed.
      }
    }

    return NextResponse.json(
      {
        code:
          "SPLIT_BOOKING_CREATION_FAILED",

        error:
          "KLYX n'a pas pu creer l'ensemble des reservations.",

        detail:
          message,

        batchId:
          batchId ||
          null,

        createdBookingCount:
          0,

        partialCommercialMission:
          false,

        paymentCreated:
          false,

        automaticRetry:
          false,

        supportReviewRequired:
          Boolean(
            batchId
          ),
      },
      {
        status:
          409,
      }
    );
  }
}