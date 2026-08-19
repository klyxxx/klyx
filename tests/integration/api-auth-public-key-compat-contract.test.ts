import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const apiAuthPath = path.join(
  process.cwd(),
  "lib/api-auth.ts"
);

const serverClientPath = path.join(
  process.cwd(),
  "lib/supabase/server.ts"
);

describe("KLYX Supabase public key compatibility contract", () => {
  it("prefers the modern publishable key with anon-key fallback in API auth", () => {
    const source = fs.readFileSync(apiAuthPath, "utf8");

    expect(source).toContain(
      "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()"
    );
    expect(source).toContain(
      "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()"
    );
    expect(source).toMatch(
      /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY[\s\S]*\?\?[\s\S]*NEXT_PUBLIC_SUPABASE_ANON_KEY/
    );
    expect(source).toContain("supabasePublicKey()");
  });

  it("keeps API auth aligned with the SSR Supabase client", () => {
    const apiAuth = fs.readFileSync(apiAuthPath, "utf8");
    const serverClient = fs.readFileSync(serverClientPath, "utf8");

    for (const variable of [
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ]) {
      expect(apiAuth).toContain(variable);
      expect(serverClient).toContain(variable);
    }
  });
});
