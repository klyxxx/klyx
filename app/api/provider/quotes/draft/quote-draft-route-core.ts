import { NextResponse } from "next/server";
import {
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";
import {
  API_RATE_LIMIT_POLICIES,
  apiRateLimitExceededResponse,
  consumeApiRateLimit,
  rateLimitResponseHeaders,
} from "@/lib/api-rate-limit";
import { buildProviderQuoteDraft } from "@/lib/provider-quote-draft";
import { supabaseAdmin } from "@/lib/supabase-admin";

type QuoteRow = {
  id: string;
  provider_profile_id: string;
  title: string;
  description: string;
  requested_date: string | null;
  requested_time: string | null;
  duration_hours: number | null;
  pricing_type: string;
  unit_price: number | null;
  estimated_total: number | null;
  currency: string;
  status: string;
  expires_at: string | null;
};

export async function POST(request: Request) {
  const { profile } = await getAuthenticatedProfile(request);
  requireAccountType(profile, "provider");

  const policy = API_RATE_LIMIT_POLICIES.quoteDraft;
  const rateLimit = await consumeApiRateLimit(
    profile.id,
    policy
  );

  if (!rateLimit.allowed) {
    return apiRateLimitExceededResponse(policy, rateLimit);
  }

  const headers = rateLimitResponseHeaders(policy, rateLimit);
  const body = (await request.json()) as {
    quoteId?: unknown;
  };
  const quoteId =
    typeof body.quoteId === "string"
      ? body.quoteId.trim()
      : "";

  if (!quoteId) {
    return NextResponse.json(
      { error: "Demande de devis invalide." },
      { status: 400, headers }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("service_quotes")
    .select(
      "id, provider_profile_id, title, description, requested_date, requested_time, duration_hours, pricing_type, unit_price, estimated_total, currency, status, expires_at"
    )
    .eq("id", quoteId)
    .eq("provider_profile_id", profile.id)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const quote = data as QuoteRow | null;

  if (!quote) {
    return NextResponse.json(
      { error: "Demande de devis introuvable." },
      { status: 404, headers }
    );
  }

  if (quote.status !== "requested") {
    return NextResponse.json(
      {
        error:
          "Un brouillon KLYX ne peut être préparé que pour une demande encore en attente.",
      },
      { status: 409, headers }
    );
  }

  if (
    quote.expires_at &&
    Date.parse(quote.expires_at) <= Date.now()
  ) {
    return NextResponse.json(
      { error: "Cette demande de devis a expiré." },
      { status: 409, headers }
    );
  }

  const draft = buildProviderQuoteDraft({
    title: quote.title,
    description: quote.description,
    requestedDate: quote.requested_date,
    requestedTime: quote.requested_time,
    durationHours:
      quote.duration_hours == null
        ? null
        : Number(quote.duration_hours),
    pricingType:
      quote.pricing_type === "fixed" ? "fixed" : "hourly",
    unitPrice:
      quote.unit_price == null
        ? null
        : Number(quote.unit_price),
    estimatedTotal:
      quote.estimated_total == null
        ? null
        : Number(quote.estimated_total),
    currency: quote.currency || "EUR",
  });

  const generatedAt = new Date().toISOString();
  const payload = {
    quoteId: quote.id,
    ...draft,
    generatedAt,
  };
  const { data: existingDraft, error: existingError } =
    await supabaseAdmin
      .from("provider_assistant_drafts")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("draft_type", "quote")
      .eq("status", "draft")
      .contains("payload", { quoteId: quote.id })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  let draftId: string;
  let reused = false;

  if (existingDraft?.id) {
    const { error: updateError } = await supabaseAdmin
      .from("provider_assistant_drafts")
      .update({
        title: `Brouillon de devis — ${quote.title.slice(0, 120)}`,
        payload,
        updated_at: generatedAt,
      })
      .eq("id", existingDraft.id)
      .eq("profile_id", profile.id)
      .eq("status", "draft");

    if (updateError) throw new Error(updateError.message);

    draftId = existingDraft.id;
    reused = true;
  } else {
    const { data: insertedDraft, error: insertError } =
      await supabaseAdmin
        .from("provider_assistant_drafts")
        .insert({
          profile_id: profile.id,
          draft_type: "quote",
          title: `Brouillon de devis — ${quote.title.slice(0, 120)}`,
          payload,
          status: "draft",
        })
        .select("id")
        .single();

    if (insertError) throw new Error(insertError.message);
    draftId = insertedDraft.id;
  }

  return NextResponse.json(
    {
      draftId,
      draft,
      reused,
      message:
        "Brouillon KLYX préparé. Vérifie et modifie le prix et le message avant tout envoi.",
    },
    { headers }
  );
}
