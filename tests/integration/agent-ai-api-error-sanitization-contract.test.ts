import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("KLYX agent and AI API error sanitization contract", () => {
  it("secures all agent plan operation failures", () => {
    const source = read("app/api/agent/plans/route.ts");

    expect(source).toContain('from "@/lib/api-error"');
    expect(source).toContain("secureApiErrorResponse({");
    expect(source).toContain('event: "agent_plans_load_failed"');
    expect(source).toContain('event: "agent_plan_create_failed"');
    expect(source).toContain('event: "agent_plan_update_failed"');
    expect(source).not.toContain("preferencesResult.error.message");
    expect(source).not.toContain("profileResult.error.message");
    expect(source).not.toContain("cancelError.message");
    expect(source).not.toContain("updateError.message");
  });

  it("keeps agent business validation public", () => {
    const source = read("app/api/agent/plans/route.ts");

    expect(source).toContain('"Décris ce que KLYX doit organiser."');
    expect(source).toContain('{ error: "Action invalide." }');
    expect(source).toContain('{ error: "Plan introuvable." }');
    expect(source).toContain('{ error: "Étape invalide." }');
  });

  it("secures unexpected AI response failures", () => {
    const source = read("app/api/ai/respond/route.ts");

    expect(source).toContain('from "@/lib/api-error"');
    expect(source).toContain("secureApiErrorResponse({");
    expect(source).toContain('event: "ai_respond_failed"');
    expect(source).toContain('code: "KLYX_AI_RESPOND_FAILED"');
    expect(source).toContain('{ error: "Non connecté." }');
    expect(source).toContain('{ error: "Requête invalide." }');
    expect(source).toContain('{ error: "Écris un message." }');
    expect(source).toContain('{ error: "Le message est trop long." }');
  });
});
