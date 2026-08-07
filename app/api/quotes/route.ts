import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import { calculateQuote } from "@/lib/quote-calculator";

type QuoteAction =
  | "send"
  | "accept"
  | "reject"
  | "cancel";

async function quoteById(
  quoteId: string
) {
  const { data, error } = await supabaseAdmin
    .from("service_quotes")
    .select(
      "id, client_profile_id, provider_profile_id, user_service_id, title, description, requested_date, requested_time, duration_hours, pricing_type, unit_price, quantity, estimated_total, provider_price, provider_message, status, expires_at, accepted_at, rejected_at, created_at, updated_at"
    )
    .eq("id", quoteId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data;
}

export async function GET(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    const isClient =
      profile.accountType === "client";
    const isProvider =
      profile.accountType === "provider";

    if (!isClient && !isProvider) {
      return NextResponse.json(
        { error: "Profil non autorisé." },
        { status: 403 }
      );
    }

    let query = supabaseAdmin
      .from("service_quotes")
      .select(
        "id, client_profile_id, provider_profile_id, user_service_id, title, description, requested_date, requested_time, duration_hours, pricing_type, unit_price, quantity, estimated_total, provider_price, provider_message, status, expires_at, accepted_at, rejected_at, created_at, updated_at"
      )
      .order("created_at", { ascending: false })
      .limit(50);

    query = isClient
      ? query.eq("client_profile_id", profile.id)
      : query.eq(
          "provider_profile_id",
          profile.id
        );

    const { data: quotes, error } = await query;

    if (error) throw new Error(error.message);

    const providerIds = [
      ...new Set(
        (quotes ?? []).map(
          (quote) => quote.provider_profile_id
        )
      ),
    ];
    const clientIds = [
      ...new Set(
        (quotes ?? []).map(
          (quote) => quote.client_profile_id
        )
      ),
    ];
    const profileIds = [
      ...new Set([
        ...providerIds,
        ...clientIds,
      ]),
    ];

    const { data: profiles, error: profileError } =
      profileIds.length > 0
        ? await supabaseAdmin
            .from("profiles")
            .select(
              "id, first_name, last_name, avatar_url"
            )
            .in("id", profileIds)
        : { data: [], error: null };

    if (profileError) {
      throw new Error(profileError.message);
    }

    const profileMap = new Map(
      (profiles ?? []).map((item) => [
        item.id,
        item,
      ])
    );

    const hydrated = (quotes ?? []).map(
      (quote) => ({
        ...quote,
        client: profileMap.get(
          quote.client_profile_id
        ) ?? null,
        provider: profileMap.get(
          quote.provider_profile_id
        ) ?? null,
      })
    );

    return NextResponse.json({
      quotes: hydrated,
      role: profile.accountType,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de charger les devis.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    requireAccountType(profile, "client");

    const body = (await request.json()) as {
      providerProfileId?: unknown;
      userServiceId?: unknown;
      title?: unknown;
      description?: unknown;
      requestedDate?: unknown;
      requestedTime?: unknown;
      durationHours?: unknown;
    };

    const providerProfileId =
      typeof body.providerProfileId === "string"
        ? body.providerProfileId.trim()
        : "";
    const userServiceId =
      typeof body.userServiceId === "string"
        ? body.userServiceId.trim()
        : "";
    const title =
      typeof body.title === "string"
        ? body.title.trim().slice(0, 160)
        : "";
    const description =
      typeof body.description === "string"
        ? body.description
            .trim()
            .slice(0, 2000)
        : "";
    const requestedDate =
      typeof body.requestedDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(
        body.requestedDate
      )
        ? body.requestedDate
        : null;
    const requestedTime =
      typeof body.requestedTime === "string" &&
      /^\d{2}:\d{2}$/.test(
        body.requestedTime
      )
        ? `${body.requestedTime}:00`
        : null;

    const durationRaw =
      body.durationHours == null ||
      body.durationHours === ""
        ? null
        : Number(body.durationHours);

    const durationHours =
      durationRaw !== null &&
      Number.isFinite(durationRaw) &&
      durationRaw > 0 &&
      durationRaw <= 48
        ? durationRaw
        : null;

    if (
      !providerProfileId ||
      !userServiceId ||
      title.length < 3 ||
      description.length < 10
    ) {
      return NextResponse.json(
        {
          error:
            "Prestataire, métier, titre et description sont requis.",
        },
        { status: 400 }
      );
    }

    if (providerProfileId === profile.id) {
      return NextResponse.json(
        {
          error:
            "Un client ne peut pas se demander un devis à lui-même.",
        },
        { status: 400 }
      );
    }

    const { data: userService, error } =
      await supabaseAdmin
        .from("user_services")
        .select(
          "id, user_id, provider_enabled, services(name, slug)"
        )
        .eq("id", userServiceId)
        .eq("user_id", providerProfileId)
        .eq("provider_enabled", true)
        .maybeSingle();

    if (error) throw new Error(error.message);

    if (!userService) {
      return NextResponse.json(
        {
          error:
            "Ce métier n’est pas actif pour ce prestataire.",
        },
        { status: 404 }
      );
    }

    const { data: serviceProfile, error: serviceError } =
      await supabaseAdmin
        .from("service_profiles")
        .select(
          "pricing_type, price, available"
        )
        .eq("user_service_id", userServiceId)
        .eq("available", true)
        .maybeSingle();

    if (serviceError) {
      throw new Error(serviceError.message);
    }

    if (!serviceProfile) {
      return NextResponse.json(
        {
          error:
            "Le prestataire n’a pas encore publié de tarif pour ce métier.",
        },
        { status: 409 }
      );
    }

    const pricingType =
      serviceProfile.pricing_type === "fixed"
        ? "fixed"
        : "hourly";

    const unitPrice =
      serviceProfile.price == null
        ? null
        : Number(serviceProfile.price);

    const calculation = calculateQuote({
      pricingType,
      unitPrice,
      durationHours,
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: quote, error: insertError } =
      await supabaseAdmin
        .from("service_quotes")
        .insert({
          client_profile_id: profile.id,
          provider_profile_id:
            providerProfileId,
          user_service_id: userServiceId,
          title,
          description,
          requested_date: requestedDate,
          requested_time: requestedTime,
          duration_hours: durationHours,
          pricing_type: pricingType,
          unit_price: unitPrice,
          quantity: calculation.quantity,
          estimated_total:
            calculation.estimatedTotal,
          status: "requested",
          expires_at: expiresAt.toISOString(),
        })
        .select(
          "id, title, status, pricing_type, unit_price, quantity, estimated_total, expires_at"
        )
        .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    return NextResponse.json({
      quote,
      calculation,
      message:
        "Demande de devis envoyée au prestataire.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de créer le devis.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { profile } =
      await getAuthenticatedProfile(request);

    const body = (await request.json()) as {
      quoteId?: unknown;
      action?: unknown;
      providerPrice?: unknown;
      providerMessage?: unknown;
    };

    const quoteId =
      typeof body.quoteId === "string"
        ? body.quoteId.trim()
        : "";
    const action =
      typeof body.action === "string"
        ? body.action.trim()
        : "";

    if (
      !quoteId ||
      ![
        "send",
        "accept",
        "reject",
        "cancel",
      ].includes(action)
    ) {
      return NextResponse.json(
        { error: "Action invalide." },
        { status: 400 }
      );
    }

    const quote = await quoteById(quoteId);

    if (!quote) {
      return NextResponse.json(
        { error: "Devis introuvable." },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    if (action === "send") {
      requireAccountType(profile, "provider");

      if (
        quote.provider_profile_id !== profile.id
      ) {
        return NextResponse.json(
          { error: "Accès refusé." },
          { status: 403 }
        );
      }

      if (quote.status !== "requested") {
        return NextResponse.json(
          {
            error:
              "Ce devis ne peut plus être envoyé.",
          },
          { status: 409 }
        );
      }

      const providerPrice =
        Number(body.providerPrice);

      if (
        !Number.isFinite(providerPrice) ||
        providerPrice < 0 ||
        providerPrice > 1000000
      ) {
        return NextResponse.json(
          {
            error:
              "Le montant du devis est invalide.",
          },
          { status: 400 }
        );
      }

      const providerMessage =
        typeof body.providerMessage === "string"
          ? body.providerMessage
              .trim()
              .slice(0, 1500)
          : "";

      const { error } = await supabaseAdmin
        .from("service_quotes")
        .update({
          provider_price: providerPrice,
          provider_message:
            providerMessage || null,
          status: "sent",
          updated_at: now,
        })
        .eq("id", quote.id)
        .eq(
          "provider_profile_id",
          profile.id
        );

      if (error) throw new Error(error.message);

      return NextResponse.json({
        message:
          "Devis envoyé au client.",
      });
    }

    requireAccountType(profile, "client");

    if (
      quote.client_profile_id !== profile.id
    ) {
      return NextResponse.json(
        { error: "Accès refusé." },
        { status: 403 }
      );
    }

    if (action === "accept") {
      if (quote.status !== "sent") {
        return NextResponse.json(
          {
            error:
              "Le prestataire doit d’abord envoyer le devis.",
          },
          { status: 409 }
        );
      }

      const { error } = await supabaseAdmin
        .from("service_quotes")
        .update({
          status: "accepted",
          accepted_at: now,
          updated_at: now,
        })
        .eq("id", quote.id)
        .eq("client_profile_id", profile.id);

      if (error) throw new Error(error.message);

      return NextResponse.json({
        message:
          "Devis accepté. Aucune réservation ni aucun paiement n’a été créé automatiquement.",
      });
    }

    if (action === "reject") {
      if (
        !["requested", "sent"].includes(
          quote.status
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Ce devis ne peut plus être refusé.",
          },
          { status: 409 }
        );
      }

      const { error } = await supabaseAdmin
        .from("service_quotes")
        .update({
          status: "rejected",
          rejected_at: now,
          updated_at: now,
        })
        .eq("id", quote.id)
        .eq("client_profile_id", profile.id);

      if (error) throw new Error(error.message);

      return NextResponse.json({
        message: "Devis refusé.",
      });
    }

    if (
      !["requested", "sent"].includes(
        quote.status
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Ce devis ne peut plus être annulé.",
        },
        { status: 409 }
      );
    }

    const { error } = await supabaseAdmin
      .from("service_quotes")
      .update({
        status: "cancelled",
        updated_at: now,
      })
      .eq("id", quote.id)
      .eq("client_profile_id", profile.id);

    if (error) throw new Error(error.message);

    return NextResponse.json({
      message: "Demande de devis annulée.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de modifier le devis.";

    return NextResponse.json(
      { error: message },
      { status: apiErrorStatus(message) }
    );
  }
}
