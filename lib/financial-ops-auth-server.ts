import "server-only";

import { timingSafeEqual } from "node:crypto";

const SECRET_ENV = "KLYX_FINANCIAL_RECONCILIATION_SECRET";

export function isKlyxFinancialOpsConfigured(): boolean {
  return Boolean(process.env[SECRET_ENV]?.trim());
}

export function isKlyxFinancialOpsAuthorized(request: Request): boolean {
  const secret = process.env[SECRET_ENV]?.trim() ?? "";

  if (!secret) {
    return false;
  }

  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);

  return (
    provided.length === expected.length &&
    timingSafeEqual(provided, expected)
  );
}
