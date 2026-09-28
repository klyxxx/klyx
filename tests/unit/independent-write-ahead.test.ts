import { describe, expect, it } from "vitest";

import {
  openIndependentWalDurableJob,
  sealIndependentWalDurableJob,
  signIndependentWalRequest,
  verifyIndependentWalRequest,
} from "@/lib/independent-write-ahead";

const key = Buffer.alloc(32, 7).toString("base64");
const secret = "klyx-wal-test-secret-abcdefghijklmnopqrstuvwxyz-0123456789";

describe("independent WAL envelope", () => {
  it("encrypts, authenticates and restores a durable job deterministically by identity", () => {
    const envelope = sealIndependentWalDurableJob({
      job: {
        jobType: "financial_reconciliation",
        idempotencyKey: "booking:123",
        payload: { bookingId: "123", privateEvidence: "secret" },
      },
      encryptionKeyBase64: key,
      keyId: "test-v1",
      now: 1_790_000_000_000,
      iv: Buffer.alloc(12, 3),
    });

    const serialized = JSON.stringify(envelope);
    expect(serialized).not.toContain("privateEvidence");
    expect(serialized).not.toContain("booking:123");

    expect(
      openIndependentWalDurableJob({ envelope, encryptionKeyBase64: key })
    ).toMatchObject({
      jobType: "financial_reconciliation",
      idempotencyKey: "booking:123",
      payload: { bookingId: "123", privateEvidence: "secret" },
    });
  });

  it("rejects tampered ciphertext and authenticates signed requests", () => {
    const envelope = sealIndependentWalDurableJob({
      job: { jobType: "critical_alert_delivery", idempotencyKey: "alert:1" },
      encryptionKeyBase64: key,
      keyId: "test-v1",
      now: 1_790_000_000_000,
      iv: Buffer.alloc(12, 4),
    });
    const tampered = { ...envelope, ciphertext: `${envelope.ciphertext.slice(0, -2)}AA` };
    expect(() => openIndependentWalDurableJob({ envelope: tampered, encryptionKeyBase64: key })).toThrow();

    const body = JSON.stringify(envelope);
    const timestamp = "1790000000000";
    const nonce = "abcdefghijklmnop";
    const signed = signIndependentWalRequest({
      method: "PUT",
      path: `/v1/entries/${envelope.operationId}`,
      timestamp,
      nonce,
      body,
      secret,
    });
    expect(
      verifyIndependentWalRequest({
        method: "PUT",
        path: `/v1/entries/${envelope.operationId}`,
        timestamp,
        nonce,
        body,
        signature: signed.signature,
        secret,
        now: 1_790_000_000_000,
      })
    ).toBe(true);
  });
});
