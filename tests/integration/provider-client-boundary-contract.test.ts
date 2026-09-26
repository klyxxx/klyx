import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOTS = ["app", "lib"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

const FORBIDDEN_CLIENT_PATTERNS = [
  { label: "Stripe SDK", pattern: /from\s+["']stripe["']/ },
  { label: "Supabase privileged client", pattern: /@\/lib\/supabase-admin/ },
  { label: "Sumsub server transport", pattern: /@\/lib\/sumsub(?:["'])/ },
  { label: "Twilio server transport", pattern: /@\/lib\/twilio-verify/ },
  { label: "Resend server transport", pattern: /@\/lib\/email\/resend(?:["'])/ },
  { label: "elmah.io server transport", pattern: /@\/lib\/elmah-io/ },
  { label: "OpenAI provider transport", pattern: /@\/lib\/brain\/llm\/openai-/ },
  { label: "provider registry server authority", pattern: /@\/lib\/providers\/registry\.server/ },
] as const;

const FORBIDDEN_CLIENT_SECRET_NAMES = [
  "OPENAI_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUMSUB_APP_TOKEN",
  "SUMSUB_SECRET_KEY",
  "SUMSUB_WEBHOOK_SECRET",
  "TWILIO_API_KEY_SECRET",
  "TWILIO_AUTH_TOKEN",
  "RESEND_API_KEY",
  "ELMAH_IO_API_KEY",
  "GITHUB_TOKEN",
] as const;

function sourceFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return sourceFiles(fullPath);
    }

    return SOURCE_EXTENSIONS.has(path.extname(entry.name)) ? [fullPath] : [];
  });
}

function isClientModule(source: string): boolean {
  return /^[\s\uFEFF]*["']use client["'];?/m.test(source);
}

describe("KLYX provider client/server boundary", () => {
  it("forbids privileged provider transports and secret names in client modules", () => {
    const violations: string[] = [];

    for (const root of ROOTS) {
      for (const file of sourceFiles(path.join(process.cwd(), root))) {
        const source = fs.readFileSync(file, "utf8");
        if (!isClientModule(source)) continue;

        for (const forbidden of FORBIDDEN_CLIENT_PATTERNS) {
          if (forbidden.pattern.test(source)) {
            violations.push(`${path.relative(process.cwd(), file)}: ${forbidden.label}`);
          }
        }

        for (const secretName of FORBIDDEN_CLIENT_SECRET_NAMES) {
          if (source.includes(secretName)) {
            violations.push(`${path.relative(process.cwd(), file)}: secret ${secretName}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("allows only bounded client-assisted provider surfaces", () => {
    const sumsubPage = fs.readFileSync(
      path.join(process.cwd(), "app/provider/verification/sumsub/page.tsx"),
      "utf8"
    );
    const supabaseClient = fs.readFileSync(
      path.join(process.cwd(), "lib/supabase/client.ts"),
      "utf8"
    );
    const turnstile = fs.readFileSync(
      path.join(process.cwd(), "app/components/AuthTurnstile.tsx"),
      "utf8"
    );

    expect(sumsubPage).toContain("@sumsub/websdk-react");
    expect(sumsubPage).not.toContain("SUMSUB_SECRET_KEY");
    expect(supabaseClient).toContain("NEXT_PUBLIC_SUPABASE_");
    expect(supabaseClient).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(turnstile).toContain("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
  });
});
