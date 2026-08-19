import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX profile management API error sanitization contract", () => {
  it("secures active profile load and switch failures", () => {
    const source = read("app/api/profiles/active/route.ts");

    expect(source).toContain('from "@/lib/api-error"');
    expect(source).toContain('event: "profiles_active_load_failed"');
    expect(source).toContain('event: "profiles_active_switch_failed"');
    expect(source).toContain("secureApiErrorResponse({");
    expect(source).not.toMatch(
      /error:\s*error\s+instanceof\s+Error/
    );
  });

  it("allows only explicit safe profile errors to remain public", () => {
    const source = read("app/api/profiles/manage/route.ts");

    expect(source).toContain("SAFE_PROFILE_INPUT_MESSAGES");
    expect(source).toContain("safeProfileError(");
    expect(source).toContain("secureProfileManageError(");
    expect(source).toContain("status: safe?.status ?? 500");
    expect(source).toContain("publicMessage: safe?.publicMessage");
    expect(source).not.toContain("return raw ||");
    expect(source).not.toContain("marketWriteError.message");
  });

  it("logs profile delete conflicts without exposing provider details", () => {
    const source = read("app/api/profiles/manage/route.ts");

    expect(source).toContain(
      'event: "profiles_manage_delete_conflict"'
    );
    expect(source).toContain(
      'code: "KLYX_PROFILES_MANAGE_DELETE_CONFLICT"'
    );
    expect(source).toContain(
      "Ce profil contient encore des réservations ou des données à conserver. Supprime d’abord son activité."
    );
  });

  it("keeps public validation and ownership responses intact", () => {
    const active = read("app/api/profiles/active/route.ts");
    const manage = read("app/api/profiles/manage/route.ts");

    expect(active).toContain('"Ce profil ne t’appartient pas."');
    expect(manage).toContain('"Choisis Client ou Prestataire."');
    expect(manage).toContain('"Le dernier profil KLYX ne peut pas être supprimé."');
    expect(manage).toContain('"Adresse de photo invalide."');
  });
});
