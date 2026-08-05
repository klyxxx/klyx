import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  apiErrorStatus,
  getAuthenticatedProfile,
  requireAccountType,
} from "@/lib/api-auth";

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

const rules = [
  { slug: "babysitting", words: ["baby-sitter", "babysitter", "garde d'enfant", "garder mon enfant", "garder mes enfants"] },
  { slug: "cleaning", words: ["ménage", "nettoyage", "nettoyer"] },
  { slug: "moving", words: ["déménagement", "déménager", "déménageur"] },
  { slug: "handyman", words: ["bricolage", "bricoleur", "réparation", "réparer"] },
];

const cities = [
  "Bruxelles", "Anderlecht", "Schaerbeek", "Ixelles", "Uccle",
  "Etterbeek", "Forest", "Saint-Gilles", "Jette", "Evere",
  "Louvain", "Anvers", "Gand", "Liège", "Namur", "Charleroi", "Mons",
];

function detectService(text: string): string | null {
  const normalized = normalize(text);
  return rules.find((rule) =>
    rule.words.some((word) => normalized.includes(normalize(word)))
  )?.slug ?? null;
}

function detectCity(text: string): string | null {
  const normalized = normalize(text);
  return cities.find((city) => normalized.includes(normalize(city))) ?? null;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function detectDay(text: string): string | null {
  const normalized = normalize(text);
  const now = new Date();

  if (normalized.includes("aujourd'hui")) return isoDate(now);

  if (normalized.includes("demain")) {
    const date = new Date(now);
    date.setDate(date.getDate() + 1);
    return isoDate(date);
  }

  const match = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (!match) return null;

  let year = match[3] ? Number(match[3]) : now.getFullYear();
  if (year < 100) year += 2000;

  const date = new Date(year, Number(match[2]) - 1, Number(match[1]));
  return Number.isNaN(date.getTime()) ? null : isoDate(date);
}

function detectTime(text: string): string | null {
  const match = text.match(/\b(?:vers\s*)?(\d{1,2})(?:[:h](\d{2}))?\s*(?:heures?|h)?\b/i);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");

  if (hours > 23 || minutes > 59) return null;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
}

function detectBudget(text: string): number | null {
  const match = text.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?)/i);
  if (!match) return null;

  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function detectChildren(text: string): number | null {
  const match = text.match(/\b(\d+)\s*enfants?\b/i);
  if (match) return Number(match[1]);

  const words: Record<string, number> = {
    un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5,
  };

  const normalized = normalize(text);

  for (const [word, value] of Object.entries(words)) {
    if (normalized.includes(`${word} enfant`)) return value;
  }

  return null;
}

function wantsMemory(text: string): boolean {
  const normalized = normalize(text);
  return [
    "comme d'habitude",
    "comme dhabitude",
    "pareil que la derniere fois",
    "la meme chose",
  ].some((phrase) => normalized.includes(normalize(phrase)));
}

export async function POST(request: Request) {
  try {
    const { profile } = await getAuthenticatedProfile(request);
    requireAccountType(profile, "client");

    const body = (await request.json()) as { text?: string };
    const text = body.text?.trim();

    if (!text) {
      return NextResponse.json(
        { error: "Décris le service dont tu as besoin." },
        { status: 400 }
      );
    }

    const { data: preferences } = await supabaseAdmin
      .from("user_preferences")
      .select(
        "default_city, default_budget, preferred_service_slugs, household_notes, scheduling_notes, ai_memory_enabled"
      )
      .eq("user_id", profile.id)
      .maybeSingle();

    let serviceSlug = detectService(text);
    let city = detectCity(text);
    let requestedDay = detectDay(text);
    let requestedTime = detectTime(text);
    let budgetMax = detectBudget(text);
    let peopleCount =
      serviceSlug === "babysitting" ? detectChildren(text) : null;
    let memoryUsed = false;

    if (wantsMemory(text) && preferences?.ai_memory_enabled) {
      memoryUsed = true;
      serviceSlug =
        serviceSlug ?? preferences.preferred_service_slugs?.[0] ?? null;
      city = city ?? preferences.default_city ?? null;
      budgetMax =
        budgetMax ??
        (preferences.default_budget != null
          ? Number(preferences.default_budget)
          : null);
      requestedTime =
        requestedTime ?? detectTime(preferences.scheduling_notes ?? "");
      peopleCount =
        peopleCount ?? detectChildren(preferences.household_notes ?? "");
    }

    const parsed = {
      serviceSlug,
      city,
      requestedDay,
      requestedTime,
      budgetMax,
      peopleCount,
      urgency: normalize(text).includes("urgent")
        ? "urgent"
        : normalize(text).includes("aujourd'hui") ||
            normalize(text).includes("ce soir")
          ? "today"
          : "normal",
      memoryUsed,
      memoryMessage: memoryUsed
        ? "KLYX a utilisé tes préférences enregistrées."
        : null,
    };

    const { data, error } = await supabaseAdmin
      .from("service_requests")
      .insert({
        user_id: profile.id,
        raw_text: text,
        detected_service_slug: parsed.serviceSlug,
        city: parsed.city,
        requested_day: parsed.requestedDay,
        requested_time: parsed.requestedTime,
        budget_max: parsed.budgetMax,
        people_count: parsed.peopleCount,
        urgency: parsed.urgency,
        parsed_payload: parsed,
        status: "analyzed",
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    if (memoryUsed) {
      await supabaseAdmin.from("user_memory_events").insert({
        user_id: profile.id,
        event_type: "memory_used",
        event_key: "assistant_request",
        event_value: { request_id: data.id, text, parsed },
        confidence: 1,
        source: "system",
      });
    }

    return NextResponse.json({ parsed, understood: Boolean(serviceSlug) });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Analyse impossible.",
      },
      {
        status: apiErrorStatus(
          error instanceof Error ? error.message : "Erreur inconnue."
        ),
      }
    );
  }
}
