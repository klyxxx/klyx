import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("KLYX assistant-first real pilot intake", () => {
  it("connects a ready AssistantThread state to one central confirmation screen", () => {
    const ready = read("app/components/assistant/ReadyForSearchSummary.tsx");
    const confirm = read("app/assistant/confirm/page.tsx");

    expect(ready).toContain('/assistant/confirm?conversation=${encodeURIComponent(conversation)}');
    expect(ready).toContain("Vérifier et chercher");
    expect(confirm).toContain("<ClientRouteGuard>");
    expect(confirm).toContain("/api/brain/request-draft?conversationId=");
    expect(confirm).toContain('fetch("/api/brain/confirm-request"');
    expect(confirm).toContain('fetch("/api/brain/market-publish"');
    expect(confirm).not.toContain("/api/brain/respond");
    expect(confirm).not.toContain("klyx-card");
    expect(confirm).not.toContain("lg:grid-cols");
  });

  it("reloads the canonical ready snapshot from durable Brain messages instead of trusting URL facts", () => {
    const route = read("app/api/brain/request-draft/route.ts");

    expect(route).toContain('.eq("user_id", profile.id)');
    expect(route).toContain('.from("brain_messages")');
    expect(route).toContain('row.role === "assistant"');
    expect(route).toContain('assistant.payload.ready !== true');
    expect(route).toContain('source: "durable_brain_messages"');
    expect(route).toContain("compactDescription(rows)");
  });

  it("keeps publication explicit and lets eligible clients self-confirm pilot scope without forcing enrollment", () => {
    const confirm = read("app/assistant/confirm/page.tsx");

    expect(confirm).toContain("confirmed: true");
    expect(confirm).toContain("confirmationId: confirmationBody.confirmationId");
    expect(confirm).toContain("pilotCandidate && zoneConfirmed && serviceConfirmed");
    expect(confirm).toContain('fetch("/api/business-pilot/enroll-request"');
    expect(confirm).toContain("La mission se déroule bien à Anneessens.");
    expect(confirm).toContain("Le besoin concerne bien le montage de meubles.");
    expect(confirm).toContain("La demande peut être publiée sans les cocher.");
  });

  it("enrolls only the authenticated client's real request and preserves the 20-request hard cap", () => {
    const route = read("app/api/business-pilot/enroll-request/route.ts");

    expect(route).toContain("getAuthenticatedProfile(request)");
    expect(route).toContain('requireAccountType(profile, "client")');
    expect(route).toContain("!marketRequestId || !confirmedZone || !confirmedService");
    expect(route).toContain("marketRequest.client_profile_id !== profile.id");
    expect(route).toContain("marketRequest.service_id !== pilotService.id");
    expect(route).toContain("!isBrussels(marketRequest.city)");
    expect(route).toContain("KLYX_LOCAL_VALUE_PILOT.maxRealRequests");
    expect(route).toContain("zone_verified: true");
    expect(route).toContain("service_verified: true");
    expect(route).toContain("enrolled_by: user.id");
    expect(route).toContain('evidenceSource: "client_explicit_confirmation"');
    expect(route).toContain("preciseAddressStored: false");
    expect(route).toContain('insertError.code === "23514"');
    expect(route).not.toContain("street_address");
    expect(route).not.toContain("latitude");
    expect(route).not.toContain("longitude");
  });

  it("enforces the 20-request cap in PostgreSQL under concurrent intake", () => {
    const migration = read(
      "supabase/migrations/20260913165000_klyx_business_pilot_request_cap.sql"
    );

    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("hashtextextended(new.pilot_key, 0)");
    expect(migration).toContain("current_count >= 20");
    expect(migration).toContain("KLYX_BUSINESS_PILOT_REQUEST_CAP_REACHED");
    expect(migration).toContain("before insert on public.business_pilot_requests");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });
});
