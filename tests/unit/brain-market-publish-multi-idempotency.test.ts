import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const confirmSource =
  readFileSync(
    "app/api/brain/confirm-request/route.ts",
    "utf8"
  );

const singleProofSource =
  readFileSync(
    "lib/brain-market-confirmation.ts",
    "utf8"
  );

const multiProofSource =
  readFileSync(
    "lib/brain-multi-slot-proof.ts",
    "utf8"
  );

const routeSource =
  readFileSync(
    "app/api/brain/market-publish-multi/route.ts",
    "utf8"
  );

const notificationSource =
  readFileSync(
    "lib/market-multi-slot.ts",
    "utf8"
  );

describe(
  "KLYX multi-slot publication idempotency contract",
  () => {
    it(
      "persists an explicit confirmation mode for all new confirmations",
      () => {
        expect(confirmSource).toContain(
          "requestMode:"
        );
        expect(confirmSource).toContain(
          '? "multi_slot"'
        );
        expect(confirmSource).toContain(
          ': "single"'
        );
      }
    );

    it(
      "keeps legacy single confirmation fingerprints stable across the requestMode rollout",
      () => {
        expect(confirmSource).toContain(
          "pre-requestMode fingerprint for legacy single confirmations"
        );

        const fingerprintSection =
          confirmSource.slice(
            confirmSource.indexOf(
              "const fingerprint ="
            ),
            confirmSource.indexOf(
              "const {\n      data:\n        confirmationMessage",
              confirmSource.indexOf(
                "const fingerprint ="
              )
            )
          );

        expect(fingerprintSection).toContain(
          "schedule"
        );
        expect(fingerprintSection).toContain(
          "? confirmedRequest"
        );
        expect(fingerprintSection).toContain(
          "serviceSlug"
        );
        expect(fingerprintSection).toContain(
          "requestBudget"
        );
        expect(fingerprintSection).not.toContain(
          ': "single"'
        );
      }
    );

    it(
      "binds both proof paths through the compatibility-aware mode matcher",
      () => {
        expect(singleProofSource).toContain(
          "brainConfirmationModeMatches"
        );
        expect(singleProofSource).toContain(
          '"single"'
        );
        expect(multiProofSource).toContain(
          "brainConfirmationModeMatches"
        );
        expect(multiProofSource).toContain(
          '"multi_slot"'
        );
      }
    );

    it(
      "uses one parent per confirmation and recovers 23505 races",
      () => {
        expect(routeSource).toContain(
          "brain_confirmation_message_id:"
        );
        expect(routeSource).toContain(
          "proof.confirmationId"
        );
        expect(routeSource).toContain(
          "createError.code !=="
        );
        expect(routeSource).toContain(
          '"23505"'
        );
        expect(routeSource).toContain(
          "marketRequestId ="
        );
        expect(routeSource).toContain(
          "raced.id"
        );
      }
    );

    it(
      "never reranks a concurrent publication before the candidate snapshot is complete",
      () => {
        expect(routeSource).toContain(
          "candidateSnapshotWasPersisted"
        );
        expect(routeSource).toContain(
          "publicationInProgressResponse"
        );
        expect(routeSource).toContain(
          "inProgress: true"
        );
        expect(routeSource).toContain(
          "replayed &&"
        );
        expect(routeSource).toContain(
          "await publicationWasCommitted"
        );

        const replayBranch =
          routeSource.slice(
            routeSource.indexOf(
              "if (replayed)"
            ),
            routeSource.indexOf(
              "} else {",
              routeSource.indexOf(
                "if (replayed)"
              )
            )
          );

        expect(replayBranch).toContain(
          "loadPersistedCandidates"
        );
        expect(replayBranch).not.toContain(
          "rankProvidersForMultiSlots"
        );
        expect(replayBranch).not.toContain(
          ".insert("
        );
        expect(replayBranch).not.toContain(
          ".upsert("
        );
      }
    );

    it(
      "writes one insert-only candidate ranking on the creator's fresh parent",
      () => {
        const writerStart =
          routeSource.indexOf(
            "await rankProvidersForMultiSlots"
          );
        const writerEnd =
          routeSource.indexOf(
            "candidateSnapshotPersisted =",
            writerStart
          );
        const writerSection =
          routeSource.slice(
            writerStart,
            writerEnd
          );

        expect(writerStart).toBeGreaterThan(-1);
        expect(writerSection).toContain(
          '"market_request_provider_candidates"'
        );
        expect(writerSection).toContain(
          ".insert("
        );
        expect(writerSection).not.toContain(
          ".upsert("
        );
        expect(writerSection).not.toContain(
          '"market_request_id,provider_profile_id"'
        );
      }
    );

    it(
      "replaces a failed pre-snapshot ranking by deleting its fresh parent instead of unioning rows",
      () => {
        const catchStart =
          routeSource.indexOf(
            "} catch (error)"
          );
        const catchSection =
          routeSource.slice(
            catchStart
          );

        expect(catchSection).toContain(
          "cleanupRequestId"
        );
        expect(catchSection).toContain(
          "!candidateSnapshotPersisted"
        );
        expect(catchSection).toContain(
          '"market_service_requests"'
        );
        expect(catchSection).toContain(
          ".delete()"
        );
      }
    );

    it(
      "freezes the candidate snapshot before slots expose it to retries",
      () => {
        const rank =
          routeSource.indexOf(
            "await rankProvidersForMultiSlots"
          );
        const candidateWrite =
          routeSource.indexOf(
            '"market_request_id,provider_profile_id"',
            rank
          );
        const slotMarker =
          routeSource.indexOf(
            '"market_request_id,position"',
            candidateWrite
          );

        expect(rank).toBeGreaterThan(-1);
        expect(candidateWrite).toBeGreaterThan(rank);
        expect(slotMarker).toBeGreaterThan(candidateWrite);
        expect(routeSource).toContain(
          "candidateSnapshotPersisted ="
        );
        expect(routeSource).toContain(
          ".insert(slotRows);"
        );
      }
    );

    it(
      "cleans only a newly-created parent when failure happens before the snapshot marker",
      () => {
        expect(routeSource).toContain(
          "cleanupRequestId"
        );
        expect(routeSource).toContain(
          "!candidateSnapshotPersisted"
        );
        expect(routeSource).toContain(
          '.delete()'
        );
      }
    );

    it(
      "does not redeliver provider notifications after the publication marker is committed",
      () => {
        const replayStart =
          routeSource.indexOf(
            "async function replayedResponse"
          );
        const replayEnd =
          routeSource.indexOf(
            "export async function POST",
            replayStart
          );
        const replaySection =
          routeSource.slice(
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
        expect(notificationSource).toContain(
          "idempotency_key:"
        );
        expect(notificationSource).toContain(
          "market-provider:${params.marketRequestId}:${providerId}"
        );
        expect(notificationSource).toContain(
          '.upsert(rows, {'
        );
        expect(notificationSource).toContain(
          '"idempotency_key"'
        );
        expect(notificationSource).toContain(
          "KLYX_MULTI_SLOT_PROVIDER_NOTIFICATION_DELIVERY_FAILED"
        );

        const notify = routeSource.indexOf(
          "await notifyFullCoverageProviders",
          routeSource.indexOf(
            "export async function POST"
          )
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
        expect(routeSource).toContain(
          'createHash("sha256")'
        );
        expect(routeSource).toContain(
          "id: messageId"
        );
        expect(routeSource).toContain(
          'error.code !== "23505"'
        );
        expect(routeSource).toContain(
          "KLYX_MULTI_SLOT_PUBLICATION_MARKER_COLLISION"
        );
      }
    );
  }
);
