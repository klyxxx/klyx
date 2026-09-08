import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const SERVER_ONLY_RLS_TABLES = [
  "api_rate_limits",
  "booking_financial_ledger",
  "booking_group_cancellation_events",
  "booking_groups",
  "client_agent_plan_events",
  "market_request_provider_candidates",
  "market_service_offers",
  "market_service_request_slots",
  "market_service_requests",
  "market_split_plan_confirmations",
  "phone_contact_access_logs",
  "phone_verification_limits",
  "photo_service_requests",
  "product_analytics_daily",
  "project_services",
  "projects",
  "provider_skill_documents",
  "provider_skill_verifications",
  "service_proposals",
  "service_requests",
  "skill_qualification_rules",
  "split_booking_batch_items",
  "split_booking_batches",
  "split_booking_payment_confirmations",
  "split_booking_payment_refunds",
  "split_booking_payment_runs",
  "split_booking_payment_units",
  "split_booking_price_confirmations",
  "split_booking_proof_consumptions",
  "stores",
  "stripe_webhook_events",
  "sumsub_webhook_events",
  "transactional_email_deliveries",
  "user_preferences",
] as const;

const SOURCE_ROOTS = ["app", "components", "lib"];
const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);

function collectSourceFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];

  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(absolute));
      continue;
    }
    if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(absolute);
    }
  }
  return files;
}

function isClientModule(source: string): boolean {
  return /^\uFEFF?\s*["']use client["']\s*;?/.test(source);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function directTablePattern(table: string): RegExp {
  return new RegExp(
    "\\.from\\(\\s*[\"'`]" + escapeRegExp(table) + "[\"'`]\\s*\\)",
    "g"
  );
}

describe("KLY-18 server-only RLS boundary", () => {
  it("keeps the certified registry sorted and unique", () => {
    expect(SERVER_ONLY_RLS_TABLES).toHaveLength(34);
    expect([...SERVER_ONLY_RLS_TABLES].sort()).toEqual([...SERVER_ONLY_RLS_TABLES]);
    expect(new Set(SERVER_ONLY_RLS_TABLES).size).toBe(SERVER_ONLY_RLS_TABLES.length);
  });

  it("documents every certified server-only table", () => {
    const documentation = fs.readFileSync(
      path.join(process.cwd(), "docs/KLYX_RLS_SERVER_ONLY_BOUNDARY.md"),
      "utf8"
    );

    for (const table of SERVER_ONLY_RLS_TABLES) {
      expect(documentation).toContain(`- \`${table}\``);
    }
  });

  it("rejects direct Supabase access to certified tables from client modules", () => {
    const violations: string[] = [];
    const sourceFiles = SOURCE_ROOTS.flatMap((root) =>
      collectSourceFiles(path.join(process.cwd(), root))
    );

    for (const file of sourceFiles) {
      const source = fs.readFileSync(file, "utf8");
      if (!isClientModule(source)) continue;

      for (const table of SERVER_ONLY_RLS_TABLES) {
        if (directTablePattern(table).test(source)) {
          violations.push(`${path.relative(process.cwd(), file)} -> ${table}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
