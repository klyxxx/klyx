import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const confirmSource = readFileSync(
  "app/api/brain/confirm-request/route.ts",
  "utf8"
);
const singleProofSource = readFileSync(
  "lib/brain-market-confirmation.ts",
  "utf8"
);
const multiProofSource = readFileSync(
  "lib/brain-multi-slot-proof.ts",
  "utf8"
);
const routeSource = readFileSync(
  "app/api/brain/market-publish-multi/route.ts",
  "utf8"
);
const notificationSource = readFileSync(
  "lib/market-multi-slot.ts",
  "utf8"
);
const atomicMigrationSource = readFileSync(
  "supabase/migrations/20260907232000_klyx_brain_multislot_atomic_publication.sql",
  "utf8"
);

describe(
  "KLYX multi-slot publication idempotency contract",
  () => {
    it(
      "persists an explicit confirmation mode for all new confirmations",
      () => {
        expect(confirmSource).toContain("requestMode:");
        expect(confirmSource).toContain('? "multi_slot"');
        expect(confirmSource).toContain(': "single"');
      }
    );

    it(
      "keeps legacy single confirmation fingerprints stable across the requestMode rollout",
      () => {
        expect(confirmSource).toContain(
          "pre-requestMode fingerprint for legacy single confirmations"
        );

        const fingerprintStart = confirmSource.indexOf(
          "const fingerprint ="
        );
        const fingerprintEnd = confirmSource.indexOf(
          "const {\n      data:\n        confirmationMessage",
          fingerprintStart
        );
        const fingerprintSection = confirmSource.slice(
          fingerprintStart,
          fingerprintEnd
        );

        expect(fingerprintSection).toContain("schedule");
        expect(fingerprintSection).toContain("? confirmedRequest");
        expect(fingerprintSection).toContain("serviceSlug");
        expect(fingerprintSection).toContain("requestBudget");
        expect(fingerprintSection).not.toContain(': "single"');
      }
    );

    it(
      "binds both proof paths through the compatibility-aware mode matcher",
      () => {
        expect(singleProofSource).toContain(
          "brainConfirmationModeMatches"
        );
        expect(singleProofSource).toContain('"single"');
        expect(multiProofSource).toContain(
          "brainConfirmationModeMatches"
        );
        expect(multiProofSource).toContain('"multi_slot"');
      }
    );

    it(
      "publishes a fresh parent and its frozen snapshot through one atomic RPC",
      () => {
        const helperStart = routeSource.indexOf(
          "async function createAtomicPublication"
        );
        const helperEnd = routeSource.indexOf(
          "export async function POST",
          helperStart
        );
        const helperSection = routeSource.slice(
          helperStart,
          helperEnd
        );

        expect(helperStart).toBeGreaterThan(-1);
        expect(helperSection).toContain("supabaseAdmin.rpc(");
        expect(helperSection).toContain(
          '"klyx_create_brain_multi_slot_market_request"'
        );
        expect(helperSection).not.toContain(".from(");
        expect(helperSection).not.toContain(".delete()");
      }
    );

    it(
      "commits parent candidates and slots together inside the database function",
      () => {
        const parentInsert = atomicMigrationSource.indexOf(
          "insert into public.market_service_requests"
        );
        const candidateInsert = atomicMigrationSource.indexOf(
          "insert into public.market_request_provider_candidates"
        );
        const slotInsert = atomicMigrationSource.indexOf(
          "insert into public.market_service_request_slots"
        );
        const successReturn = atomicMigrationSource.lastIndexOf(
          "select v_request_id, true;"
        );

        expect(parentInsert).toBeGreaterThan(-1);
        expect(candidateInsert).toBeGreaterThan(parentInsert);
        expect(slotInsert).toBeGreaterThan(candidateInsert);
        expect(successReturn).toBeGreaterThan(slotInsert);
        expect(atomicMigrationSource).toContain("language plpgsql");
        expect(atomicMigrationSource).toContain("security definer");
        expect(atomicMigrationSource).toContain("set search_path = ''");
      }
    );

    it(
      "turns a confirmation uniqueness race into a replay of the committed parent",
      () => {
        expect(atomicMigrationSource).toContain(
          "when unique_violation then"
        );
        expect(atomicMigrationSource).toContain(
          "request.brain_confirmation_message_id = p_confirmation_id"
        );
        expect(atomicMigrationSource).toContain(
          "select v_request_id, false;"
        );
        expect(routeSource).toContain(
          "replayed = !atomic.created"
        );
      }
    );

    it(
      "discards a concurrent caller's local ranking and reloads the winner snapshot",
      () => {
        const raceStart = routeSource.indexOf(
          "replayed = !atomic.created"
        );
        const raceEnd = routeSource.indexOf(
          "} else {\n        candidates = rankedCandidates;",
          raceStart
        );
        const raceSection = routeSource.slice(
          raceStart,
          raceEnd
        );

        expect(raceStart).toBeGreaterThan(-1);
        expect(raceSection).toContain("if (replayed)");
        expect(raceSection).toContain(
          "candidateSnapshotWasPersisted"
        );
        expect(raceSection).toContain("loadPersistedCandidates");
        expect(raceSection).not.toContain(
          "rankProvidersForMultiSlots"
        );
        expect(raceSection).not.toContain(".insert(");
        expect(raceSection).not.toContain(".upsert(");
      }
    );

    it(
      "keeps legacy incomplete parents fail-closed without mutating them",
      () => {
        expect(routeSource).toContain(
          "Legacy rows created before the atomic RPC can still be incomplete."
        );
        expect(routeSource).toContain(
          "publicationInProgressResponse"
        );
        expect(routeSource).toContain("inProgress: true");
        expect(routeSource).not.toContain("cleanupRequestId");
        expect(routeSource).not.toContain(
          "candidateSnapshotPersisted ="
        );
      }
    );

    it(
      "keeps the atomic RPC unavailable to browser roles",
      () => {
        expect(atomicMigrationSource).toContain("from public;");
        expect(atomicMigrationSource).toContain(
          "from anon, authenticated;"
        );
        expect(atomicMigrationSource).toContain("to service_role;");
        expect(atomicMigrationSource).toContain(
          "has_function_privilege("
        );
        expect(atomicMigrationSource).toContain(
          "KLYX_MULTI_SLOT_ATOMIC_EXECUTE_LEAK"
        );
      }
    );

    it(
      "does not redeliver provider notifications after the publication marker is committed",
      () => {
        const replayStart = routeSource.indexOf(
          "async function replayedResponse"
        );
        const replayEnd = routeSource.indexOf(
          "async function createAtomicPublication",
          replayStart
        );
        const replaySection = routeSource.slice(
          replayStart,
          replayEnd
        );

        expect(replayStart).toBeGreaterThan(-1);
        expect(replaySection).not.toContain(
          "notifyFullCoverageProviders"
        );
      }
    );

    it(
      "deduplicates provider notifications and commits only after delivery",
      () => {
        expect(notificationSource).toContain("idempotency_key:");
        expect(notificationSource).toContain(
          "market-provider:${params.marketRequestId}:${providerId}"
        );
        expect(notificationSource).toContain('.upsert(rows, {');
        expect(notificationSource).toContain('"idempotency_key"');
        expect(notificationSource).toContain(
          "KLYX_MULTI_SLOT_PROVIDER_NOTIFICATION_DELIVERY_FAILED"
        );

        const notify = routeSource.indexOf(
          "await notifyFullCoverageProviders",
          routeSource.indexOf("export async function POST")
        );
        const marker = routeSource.indexOf(
          "await ensurePublicationMarker",
          notify
        );

        expect(notify).toBeGreaterThan(-1);
        expect(marker).toBeGreaterThan(notify);
      }
    );

    it(
      "uses a deterministic Brain marker and accepts only its own 23505 collision",
      () => {
        expect(routeSource).toContain(
          "function publicationMessageId"
        );
        expect(routeSource).toContain('createHash("sha256")');
        expect(routeSource).toContain("id: messageId");
        expect(routeSource).toContain('error.code !== "23505"');
        expect(routeSource).toContain(
          "KLYX_MULTI_SLOT_PUBLICATION_MARKER_COLLISION"
        );
      }
    );
  }
);
