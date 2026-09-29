import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("KLYX mobile API boundary", () => {
  it("keeps mobile bootstrap behind canonical bearer account auth", () => {
    const route = read("app/api/mobile/bootstrap/route.ts");
    const auth = read("lib/api-auth.ts");

    expect(route).toContain("getAuthenticatedAccount(request)");
    expect(route).not.toContain("supabaseAdmin");
    expect(route).toContain('"Cache-Control": "no-store, max-age=0"');

    expect(auth).toContain('request.headers\n    .get("authorization")');
    expect(auth).toContain('Authorization: `Bearer ${token}`');
    expect(auth).toContain('request.headers.get(PROFILE_SELECTION_HEADER)');
    expect(auth).toContain('throw new Error("KLYX_PROFILE_SELECTION_FORBIDDEN")');
  });

  it("keeps privileged provider secrets out of the mobile source", () => {
    const api = read("mobile/src/lib/klyx-api.ts");
    const supabase = read("mobile/src/lib/supabase.ts");
    const envExample = read("mobile/.env.example");
    const combined = `${api}\n${supabase}\n${envExample}`;

    for (const forbidden of [
      "SUPABASE_SERVICE_ROLE_KEY",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "SUMSUB_SECRET_KEY",
      "TWILIO_AUTH_TOKEN",
      "RESEND_API_KEY",
      "OPENAI_API_KEY",
    ]) {
      expect(combined).not.toContain(forbidden);
    }

    expect(combined).toContain("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  });
});
