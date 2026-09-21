// Mission 19 local-only settlement eligibility chaos proof.
// Runs only against ephemeral local Supabase. It creates no Stripe object and
// performs no external money movement.

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  assertGoldenPathIsolation,
  requiredGoldenPathEnv,
} from "./golden-path-runtime.mjs";

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function rpcRow(data, label) {
  const rows = Array.isArray(data) ? data : [];
  if (rows.length !== 1) {
    throw new Error(`${label} returned ${rows.length} rows instead of 1.`);
  }
  return rows[0];
}
