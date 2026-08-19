import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260819204000_klyx_service_quote_table_privileges.sql";
const quoteCorePath =
  "app/api/quotes/quote-route-core.ts";
const quoteDetailPath =
  "app/api/quotes/[id]/route.ts";
const bookingCreatePath =
  "app/api/bookings/create/route.ts";
const clientQuotesPagePath =
  "app/quotes/page.tsx";
const providerQuotesPagePath =
  "app/provider/quotes/page.tsx";
const quoteBookingPagePath =
  "app/quotes/[id]/book/page.tsx";

describe("service quote table privilege hardening contract", () => {
  it("keeps private quote records service-role only", () => {
    const source = readFileSync(
      join(process.cwd(), migrationPath),
      "utf8"
    );

    expect(source).toContain(
      "KLYX_SERVICE_QUOTE_TABLE_PRIVILEGES_12B_12R"
    );
    expect(source).toContain(
      "revoke all privileges on table public.service_quotes\n  from public, anon, authenticated;"
    );
    expect(source).toContain(
      "grant all privileges on table public.service_quotes\n  to service_role;"
    );
  });

  it("keeps quote reads and mutations behind authenticated server APIs", () => {
    const quoteCore = readFileSync(
      join(process.cwd(), quoteCorePath),
      "utf8"
    );
    const quoteDetail = readFileSync(
      join(process.cwd(), quoteDetailPath),
      "utf8"
    );
    const bookingCreate = readFileSync(
      join(process.cwd(), bookingCreatePath),
      "utf8"
    );

    for (const source of [
      quoteCore,
      quoteDetail,
      bookingCreate,
    ]) {
      expect(source).toContain(
        'import { supabaseAdmin } from "@/lib/supabase-admin";'
      );
      expect(source).toContain(
        '.from("service_quotes")'
      );
    }
  });

  it("keeps quote UI pages off the raw service_quotes table", () => {
    const clientPage = readFileSync(
      join(process.cwd(), clientQuotesPagePath),
      "utf8"
    );
    const providerPage = readFileSync(
      join(process.cwd(), providerQuotesPagePath),
      "utf8"
    );
    const bookingPage = readFileSync(
      join(process.cwd(), quoteBookingPagePath),
      "utf8"
    );

    expect(clientPage).toContain("/api/quotes");
    expect(providerPage).toContain("/api/quotes");
    expect(bookingPage).toContain("/api/quotes/");

    for (const source of [
      clientPage,
      providerPage,
      bookingPage,
    ]) {
      expect(source).not.toContain(
        '.from("service_quotes")'
      );
    }
  });
});
