import { after, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { sendKlyxDeduplicatedEmail } from "@/lib/email/deduplicated-delivery";
import { accountCreatedEmail, profileCreatedEmail } from "@/lib/email/lifecycle-templates";
import { normalizeKlyxCountryCode, normalizeKlyxCurrencyCode } from "@/lib/klyx-currency";
import { supabaseAdmin } from "@/lib/supabase-admin";

type AccountType = "client" | "provider";

type CreateBody = {
  firstName?: unknown;
  lastName?: unknown;
  city?: unknown;
  countryCode?: unknown;
  currencyCode?: unknown;
  accountType?: unknown;
  serviceId?: unknown;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variable manquante : ${name}`);
  return value;
}

function publicKey(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!value) throw new Error("Clé publique Supabase manquante.");
  return value;
}

async function authenticated(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Session manquante.");
  const client = createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), publicKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) throw new Error("Session invalide.");
  return { client, user };
}

function clean(value: unknown, max: number, code: string) {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result || result.length > max) throw new Error(code);
  return result;
}

export async function GET(request: Request) {
  try {
    const { user } = await authenticated(request);
    const [{ data: profiles, error: profileError }, { data: services, error: serviceError }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, first_name, last_name, account_type, country_code, currency_code").eq("owner_user_id", user.id).order("created_at", { ascending: true }),
      supabaseAdmin.from("services").select("id, name, slug").order("name", { ascending: true }),
    ]);
    if (profileError) throw profileError;
    if (serviceError) throw serviceError;
    return NextResponse.json({
      profiles: (profiles ?? []).map((row) => ({
        id: row.id,
        firstName: row.first_name ?? "",
        lastName: row.last_name ?? "",
        accountType: row.account_type === "provider" ? "provider" : "client",
        countryCode: row.country_code,
        currencyCode: row.currency_code,
      })),
      services: services ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "KLYX mobile indisponible.";
    const status = /Session/.test(message) ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? message : "KLYX mobile indisponible." }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const { client, user } = await authenticated(request);
    const body = (await request.json()) as CreateBody;
    const firstName = clean(body.firstName, 60, "KLYX_FIRST_NAME_INVALID");
    const lastName = clean(body.lastName, 60, "KLYX_LAST_NAME_INVALID");
    const city = clean(body.city, 100, "KLYX_CITY_INVALID");
    const countryCode = normalizeKlyxCountryCode(typeof body.countryCode === "string" ? body.countryCode : "");
    const currencyCode = normalizeKlyxCurrencyCode(typeof body.currencyCode === "string" ? body.currencyCode : "");
    const accountType: AccountType | null = body.accountType === "provider" || body.accountType === "client" ? body.accountType : null;
    if (!accountType) return NextResponse.json({ error: "Choisis Demander ou Gagner." }, { status: 400 });
    const serviceId = typeof body.serviceId === "string" && body.serviceId ? body.serviceId : null;
    if (accountType === "provider" && !serviceId) return NextResponse.json({ error: "Choisis un premier service." }, { status: 400 });

    const { count, error: countError } = await supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("owner_user_id", user.id);
    if (countError) throw countError;

    const { data: profileId, error: createError } = await client.rpc("klyx_create_profile", {
      p_first_name: firstName,
      p_last_name: lastName,
      p_city: city,
      p_account_type: accountType,
      p_service_id: accountType === "provider" ? serviceId : null,
    });
    if (createError) throw createError;
    if (typeof profileId !== "string") throw new Error("KLYX_INVALID_PROFILE_CREATION_RESULT");

    const { error: marketError } = await supabaseAdmin.from("profiles").update({ country_code: countryCode, currency_code: currencyCode, updated_at: new Date().toISOString() }).eq("id", profileId).eq("owner_user_id", user.id);
    if (marketError) throw marketError;

    const email = user.email?.trim();
    if (email) {
      const firstProfile = (count ?? 0) === 0;
      const content = firstProfile ? accountCreatedEmail({ firstName, accountType }) : profileCreatedEmail(accountType);
      after(async () => {
        await sendKlyxDeduplicatedEmail({
          deduplicationKey: firstProfile ? `account:${user.id}:created:owner` : `profile:${profileId}:created:owner`,
          templateKey: firstProfile ? "account.created.owner" : "profile.created.owner",
          to: email,
          ...content,
        });
      });
    }

    return NextResponse.json({ profileId }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Création impossible.";
    const status = /Session/.test(message) ? 401 : /INVALID|REQUIRED|LIMIT|COUNTRY|CURRENCY/.test(message) ? 400 : 500;
    return NextResponse.json({ error: status < 500 ? message : "Création du profil impossible." }, { status });
  }
}
