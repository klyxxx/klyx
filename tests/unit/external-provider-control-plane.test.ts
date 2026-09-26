import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  KLYX_EXTERNAL_PROVIDER_NAMES,
} from "@/lib/providers/contracts";
import {
  KLYX_PROVIDER_CATALOG,
} from "@/lib/providers/catalog";

const SERVER_ONLY_SECRET_MARKERS = [
  "OPENAI_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SUMSUB_APP_TOKEN",
  "SUMSUB_SECRET_KEY",
  "SUMSUB_WEBHOOK_SECRET",
  "TWILIO_API_KEY_SECRET",
  "TWILIO_AUTH_TOKEN",
  "RESEND_API_KEY",
  "TOLGEE_API_KEY",
  "TURNSTILE_SECRET_KEY",
  "ELMAH_IO_API_KEY",
  "VERCEL_TOKEN",
  "GITHUB_TOKEN",
] as const;

const SERVER_PROVIDER_API_ORIGINS = [
  "api.openai.com",
  "api.stripe.com",
  "api.sumsub.com",
  "verify.twilio.com",
  "api.resend.com",
  "api.elmah.io",
  "api.vercel.com",
  "api.github.com",
] as const;

function sourceFiles(root: string): string[] {
  if (!fs.existsSync(root)) {
    return [];
  }

  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(root, entry.name);

    if (entry.isDirectory()) {
      return sourceFiles(full);
    }

    return /\.(?:ts|tsx|js|jsx)$/.test(entry.name)
      ? [full]
      : [];
  });
}

function clientSources(): Array<{ file: string; source: string }> {
  const roots = ["app", "components", "lib"].map((name) =>
    path.join(process.cwd(), name)
  );

  return roots
    .flatMap(sourceFiles)
    .map((file) => ({
      file,
      source: fs.readFileSync(file, "utf8"),
    }))
    .filter(({ source }) =>
      /^\s*["']use client["'];?/m.test(source)
    );
}

describe("external provider control plane", () => {
  it("governs exactly the eleven declared external providers", () => {
    expect(Object.keys(KLYX_PROVIDER_CATALOG).sort()).toEqual(
      [...KLYX_EXTERNAL_PROVIDER_NAMES].sort()
    );
  });

  it("never classifies a secret environment variable as public", () => {
    for (const provider of Object.values(KLYX_PROVIDER_CATALOG)) {
      for (const secret of provider.secretEnv) {
        expect(secret.startsWith("NEXT_PUBLIC_")).toBe(false);
        expect(provider.publicEnv).not.toContain(secret);
      }
    }
  });

  it("keeps financial and identity authority fail-closed", () => {
    expect(KLYX_PROVIDER_CATALOG.stripe.failurePolicy).toBe(
      "fail_closed"
    );
    expect(KLYX_PROVIDER_CATALOG.sumsub.failurePolicy).toBe(
      "fail_closed"
    );
    expect(KLYX_PROVIDER_CATALOG.supabase.failurePolicy).toBe(
      "fail_closed"
    );
    expect(
      KLYX_PROVIDER_CATALOG.cloudflare_turnstile.failurePolicy
    ).toBe("fail_closed");
  });

  it("keeps observability non-authoritative", () => {
    expect(KLYX_PROVIDER_CATALOG.elmah_io.failurePolicy).toBe(
      "fail_open"
    );
  });

  it("keeps translation runtime independent from Tolgee availability", () => {
    expect(KLYX_PROVIDER_CATALOG.tolgee.clientPolicy).toBe(
      "static_snapshot_only"
    );
    expect(KLYX_PROVIDER_CATALOG.tolgee.abstractionState).toBe(
      "static_snapshot"
    );
  });

  it("does not expose provider secrets or server provider APIs from client modules", () => {
    const violations: string[] = [];

    for (const { file, source } of clientSources()) {
      for (const marker of SERVER_ONLY_SECRET_MARKERS) {
        if (source.includes(marker)) {
          violations.push(`${file}: secret marker ${marker}`);
        }
      }

      for (const origin of SERVER_PROVIDER_API_ORIGINS) {
        if (source.includes(origin)) {
          violations.push(`${file}: server provider origin ${origin}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("documents the only browser-facing provider modes explicitly", () => {
    expect(KLYX_PROVIDER_CATALOG.supabase.clientPolicy).toBe(
      "public_token_only"
    );
    expect(KLYX_PROVIDER_CATALOG.stripe.clientPolicy).toBe(
      "public_token_only"
    );
    expect(KLYX_PROVIDER_CATALOG.sumsub.clientPolicy).toBe(
      "public_session_only"
    );
    expect(
      KLYX_PROVIDER_CATALOG.cloudflare_turnstile.clientPolicy
    ).toBe("public_token_only");
  });
});
