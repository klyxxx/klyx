import { describe, expect, it } from "vitest";

import {
  createFinancialState,
  fullRefundCharge,
  outstandingSettlementMinor,
  refundCharge,
  reverseTransfer,
  settleProviderLiability,
} from "../../lib/pure-finance/engine";
import { projectFinancialStateToCanonicalLedger } from "../../lib/pure-finance/ledger-projection";
import {
  certifyPureFinanceRuntimeShadow,
  type PureFinanceRuntimeObservedMovement,
} from "../../lib/pure-finance/runtime-shadow";
import type { FinancialState } from "../../lib/pure-finance/types";
import { KlyxResilienceEngine } from "../../lib/resilience-engine";
import {
  InMemoryKlyxResilienceStore,
  ManualKlyxResilienceClock,
} from "../../lib/resilience-memory-adapter";

const SCENARIOS = [
  "success",
  "failed_payment",
  "failed_transfer",
  "timeout",
  "duplicate_webhook",
  "late_webhook",
  "missing_webhook",
  "retry",
  "double_click",
  "partial_refund",
  "full_refund",
  "reversal",
] as const;

const TOPOLOGIES = ["single", "group", "split", "multi_provider"] as const;

type Scenario = (typeof SCENARIOS)[number];
type Topology = (typeof TOPOLOGIES)[number];

type Leg = {
  bookingId: string;
  providerRef: string;
  grossMinor: number;
};

type RuntimeLeg = {
  leg: Leg;
  state: FinancialState | null;
  bookingState: "unpaid" | "paid" | "payment_failed" | "human_review";
};

type Truth = {
  charge: number;
  commission: number;
  providerLiability: number;
  transfer: number;
  reversal: number;
  refund: number;
};

type Reconciliation = {
  status: "coherent" | "human_review";
  blocked: boolean;
  reconciliationRequired: boolean;
  humanReview: boolean;
  ledger: Truth;
  settlement: Truth;
  stripe: Truth;
};

const ZERO_TRUTH: Truth = {
  charge: 0,
  commission: 0,
  providerLiability: 0,
  transfer: 0,
  reversal: 0,
  refund: 0,
};

function emptyTruth(): Truth {
  return { ...ZERO_TRUTH };
}

function addTruth(target: Truth, source: Truth): void {
  target.charge += source.charge;
  target.commission += source.commission;
  target.providerLiability += source.providerLiability;
  target.transfer += source.transfer;
  target.reversal += source.reversal;
  target.refund += source.refund;
}

function truthEqual(left: Truth, right: Truth): boolean {
  return (
    left.charge === right.charge &&
    left.commission === right.commission &&
    left.providerLiability === right.providerLiability &&
    left.transfer === right.transfer &&
    left.reversal === right.reversal &&
    left.refund === right.refund
  );
}

function fixture(topology: Topology): Leg[] {
  switch (topology) {
    case "single":
      return [{ bookingId: "single-1", providerRef: "provider-a", grossMinor: 10_000 }];
    case "group":
      return [
        { bookingId: "group-1", providerRef: "provider-a", grossMinor: 3_100 },
        { bookingId: "group-2", providerRef: "provider-a", grossMinor: 3_300 },
        { bookingId: "group-3", providerRef: "provider-a", grossMinor: 3_600 },
      ];
    case "split":
      return [
        { bookingId: "split-1", providerRef: "provider-a", grossMinor: 4_001 },
        { bookingId: "split-2", providerRef: "provider-a", grossMinor: 3_333 },
        { bookingId: "split-3", providerRef: "provider-b", grossMinor: 2_666 },
      ];
    case "multi_provider":
      return [
        { bookingId: "multi-1", providerRef: "provider-a", grossMinor: 5_500 },
        { bookingId: "multi-2", providerRef: "provider-b", grossMinor: 4_500 },
      ];
  }
}

function makeState(leg: Leg): FinancialState {
  return createFinancialState({
    transactionId: `tx:${leg.bookingId}`,
    currency: "EUR",
    grossMinor: leg.grossMinor,
    commission: { basisPoints: 1_000 },
  });
}

function economicsTruth(state: FinancialState): Truth {
  return {
    charge: state.breakdown.grossMinor,
    commission: state.breakdown.commissionMinor,
    providerLiability: state.breakdown.providerLiabilityMinor,
    transfer: state.transferredMinor,
    reversal: state.reversedMinor,
    refund: state.refundedMinor,
  };
}

class FakeStripeTruth {
  private readonly charges = new Map<string, Truth>();
  private readonly transfers = new Map<string, number>();
  private readonly reversals = new Map<string, number>();
  private readonly refunds = new Map<string, number>();
  private readonly failedPayments = new Set<string>();
  private readonly failedTransfers = new Set<string>();

  recordSucceededCharge(leg: Leg, state: FinancialState): void {
    const key = `charge:${leg.bookingId}`;
    const next = economicsTruth(state);
    next.transfer = 0;
    next.reversal = 0;
    next.refund = 0;
    const existing = this.charges.get(key);
    if (existing && !truthEqual(existing, next)) {
      throw new Error("KLYX_CERT_TEST_STRIPE_CHARGE_IDEMPOTENCY_CONFLICT");
    }
    if (!existing) this.charges.set(key, next);
  }

  recordFailedPayment(leg: Leg): void {
    this.failedPayments.add(`payment:${leg.bookingId}`);
  }

  recordTransfer(leg: Leg, amountMinor: number): void {
    const key = `transfer:${leg.bookingId}`;
    const existing = this.transfers.get(key);
    if (existing !== undefined && existing !== amountMinor) {
      throw new Error("KLYX_CERT_TEST_STRIPE_TRANSFER_IDEMPOTENCY_CONFLICT");
    }
    if (existing === undefined) this.transfers.set(key, amountMinor);
  }

  recordFailedTransfer(leg: Leg): void {
    this.failedTransfers.add(`transfer:${leg.bookingId}`);
  }

  recordReversal(leg: Leg, amountMinor: number): void {
    const key = `reversal:${leg.bookingId}`;
    this.reversals.set(key, (this.reversals.get(key) ?? 0) + amountMinor);
  }

  recordRefund(leg: Leg, amountMinor: number): void {
    const key = `refund:${leg.bookingId}`;
    this.refunds.set(key, (this.refunds.get(key) ?? 0) + amountMinor);
  }

  transferFor(leg: Leg): number {
    return this.transfers.get(`transfer:${leg.bookingId}`) ?? 0;
  }

  objectCounts(): {
    charges: number;
    transfers: number;
    reversals: number;
    refunds: number;
    failedPayments: number;
    failedTransfers: number;
  } {
    return {
      charges: this.charges.size,
      transfers: this.transfers.size,
      reversals: this.reversals.size,
      refunds: this.refunds.size,
      failedPayments: this.failedPayments.size,
      failedTransfers: this.failedTransfers.size,
    };
  }

  injectTransferDivergence(leg: Leg, amountMinor: number): void {
    this.transfers.set(`transfer:${leg.bookingId}`, amountMinor);
  }

  snapshot(): Truth {
    const total = emptyTruth();
    for (const charge of this.charges.values()) addTruth(total, charge);
    for (const amount of this.transfers.values()) total.transfer += amount;
    for (const amount of this.reversals.values()) total.reversal += amount;
    for (const amount of this.refunds.values()) total.refund += amount;
    return total;
  }
}

class FakeSettlementTruth {
  private readonly rows = new Map<string, Truth>();
  blocked = false;
  reconciliation = false;
  humanReview = false;

  recognizePayment(leg: Leg, state: FinancialState): void {
    const existing = this.rows.get(leg.bookingId);
    const next = economicsTruth(state);
    next.transfer = 0;
    next.reversal = 0;
    next.refund = 0;
    if (existing && !truthEqual(existing, next)) {
      throw new Error("KLYX_CERT_TEST_SETTLEMENT_RECOGNITION_CONFLICT");
    }
    if (!existing) this.rows.set(leg.bookingId, next);
  }

  recordTransfer(leg: Leg, amountMinor: number): void {
    const row = this.requireRow(leg);
    row.transfer = amountMinor;
  }

  recordReversal(leg: Leg, amountMinor: number): void {
    const row = this.requireRow(leg);
    row.reversal += amountMinor;
  }

  recordRefund(leg: Leg, amountMinor: number): void {
    const row = this.requireRow(leg);
    row.refund += amountMinor;
  }

  failClosed(): void {
    this.blocked = true;
    this.reconciliation = true;
    this.humanReview = true;
  }

  markReconciled(): void {
    this.reconciliation = true;
    this.blocked = false;
    this.humanReview = false;
  }

  snapshot(): Truth {
    const total = emptyTruth();
    for (const row of this.rows.values()) addTruth(total, row);
    return total;
  }

  private requireRow(leg: Leg): Truth {
    const row = this.rows.get(leg.bookingId);
    if (!row) throw new Error("KLYX_CERT_TEST_SETTLEMENT_ROW_MISSING");
    return row;
  }
}

function projectObserved(state: FinancialState, leg: Leg): PureFinanceRuntimeObservedMovement[] {
  return projectFinancialStateToCanonicalLedger(state, {
    bookingId: leg.bookingId,
    platformBeneficiaryRef: "klyx",
    clientBeneficiaryRef: "client-certification",
    providerBeneficiaryRef: leg.providerRef,
  }).map((event) => ({
    movementKey: event.movementKey,
    movementType: event.movementType,
    amountMinor: event.amountMinor,
    currency: event.currency,
    beneficiaryKind: event.beneficiaryKind,
    beneficiaryRef: event.beneficiaryRef,
    cause: event.cause,
    source: event.source,
    newState: event.newState,
    occurredAt: new Date(1_800_000_000_000 + event.sequence * 1_000).toISOString(),
  }));
}

function ledgerTruth(runtime: RuntimeLeg[]): Truth {
  const total = emptyTruth();
  for (const item of runtime) {
    if (!item.state) continue;
    const events = projectFinancialStateToCanonicalLedger(item.state, {
      bookingId: item.leg.bookingId,
      platformBeneficiaryRef: "klyx",
      clientBeneficiaryRef: "client-certification",
      providerBeneficiaryRef: item.leg.providerRef,
    });
    for (const event of events) {
      switch (event.movementType) {
        case "charge":
          total.charge += event.amountMinor;
          break;
        case "commission":
          total.commission += event.amountMinor;
          break;
        case "provider_liability":
          total.providerLiability += event.amountMinor;
          break;
        case "transfer":
          total.transfer += event.amountMinor;
          break;
        case "reversal":
          total.reversal += event.amountMinor;
          break;
        case "refund":
          total.refund += event.amountMinor;
          break;
        case "payout":
          break;
      }
    }
  }
  return total;
}

function assertRuntimeParity(runtime: RuntimeLeg[]): void {
  for (const item of runtime) {
    if (!item.state) continue;
    const observed = projectObserved(item.state, item.leg);
    const certification = certifyPureFinanceRuntimeShadow({
      transactionId: item.state.transactionId,
      bookingId: item.leg.bookingId,
      currency: item.state.currency,
      grossMinor: item.state.breakdown.grossMinor,
      commissionMinor: item.state.breakdown.commissionMinor,
      providerLiabilityMinor: item.state.breakdown.providerLiabilityMinor,
      expectedBeneficiaries: {
        platform: "klyx",
        client: "client-certification",
        provider: item.leg.providerRef,
      },
      observed,
    });
    expect(certification.status).toBe("coherent");
    expect(certification.runtimeParity).toBe(true);
    expect(certification.divergences).toEqual([]);
  }
}

function reconcile(runtime: RuntimeLeg[], settlement: FakeSettlementTruth, stripe: FakeStripeTruth): Reconciliation {
  const ledger = ledgerTruth(runtime);
  const settlementTruth = settlement.snapshot();
  const stripeTruth = stripe.snapshot();
  const coherent = truthEqual(ledger, settlementTruth) && truthEqual(ledger, stripeTruth);
  return {
    status: coherent ? "coherent" : "human_review",
    blocked: !coherent,
    reconciliationRequired: !coherent,
    humanReview: !coherent,
    ledger,
    settlement: settlementTruth,
    stripe: stripeTruth,
  };
}

function recognizeLocalPayment(runtime: RuntimeLeg[], settlement: FakeSettlementTruth): void {
  for (const item of runtime) {
    if (item.state) throw new Error("KLYX_CERT_TEST_PAYMENT_RECOGNIZED_TWICE");
    item.state = makeState(item.leg);
    item.bookingState = "paid";
    settlement.recognizePayment(item.leg, item.state);
  }
}

function recordExternalPayment(runtime: RuntimeLeg[], stripe: FakeStripeTruth): void {
  for (const item of runtime) {
    stripe.recordSucceededCharge(item.leg, makeState(item.leg));
  }
}

function settleAll(runtime: RuntimeLeg[], settlement: FakeSettlementTruth, stripe: FakeStripeTruth): void {
  for (const item of runtime) {
    if (!item.state) throw new Error("KLYX_CERT_TEST_SETTLEMENT_WITHOUT_PAYMENT");
    const amount = outstandingSettlementMinor(item.state);
    stripe.recordTransfer(item.leg, amount);
    item.state = settleProviderLiability(item.state, {
      operationId: `settlement:${item.leg.bookingId}`,
      amountMinor: amount,
      cause: "provider_settlement",
    });
    settlement.recordTransfer(item.leg, amount);
  }
}

function runtimeFixture(topology: Topology): RuntimeLeg[] {
  return fixture(topology).map((leg) => ({
    leg,
    state: null,
    bookingState: "unpaid" as const,
  }));
}

async function runScenario(topology: Topology, scenario: Scenario): Promise<{
  runtime: RuntimeLeg[];
  settlement: FakeSettlementTruth;
  stripe: FakeStripeTruth;
  evidence: Record<string, string | number | boolean>;
}> {
  const runtime = runtimeFixture(topology);
  const settlement = new FakeSettlementTruth();
  const stripe = new FakeStripeTruth();
  const evidence: Record<string, string | number | boolean> = {};

  if (scenario === "failed_payment") {
    for (const item of runtime) {
      stripe.recordFailedPayment(item.leg);
      item.bookingState = "payment_failed";
    }
    evidence.failedPaymentCount = stripe.objectCounts().failedPayments;
    return { runtime, settlement, stripe, evidence };
  }

  if (scenario === "duplicate_webhook" || scenario === "late_webhook") {
    recordExternalPayment(runtime, stripe);
    const clock = new ManualKlyxResilienceClock(1_800_000_000_000);
    const store = new InMemoryKlyxResilienceStore();
    let handlerCalls = 0;
    const engine = new KlyxResilienceEngine({
      store,
      clock,
      inboundEventHandlers: {
        "payment_intent.succeeded": async () => {
          handlerCalls += 1;
          recognizeLocalPayment(runtime, settlement);
          return {
            kind: "proved_succeeded",
            resultRef: `payment:${topology}`,
            reasonCode: "PAYMENT_WEBHOOK_PROVED",
          };
        },
      },
    });
    const queued = await engine.enqueue({
      jobType: "payment_webhook",
      idempotencyKey: `payment:${topology}:${scenario}`,
      payload: { topology, scenario },
    });
    const occurredAtMs =
      scenario === "late_webhook" ? clock.nowMs() - 3_600_000 : clock.nowMs();
    const first = await engine.ingestInboundEvent({
      source: "stripe",
      eventId: `evt:${topology}:${scenario}`,
      eventType: "payment_intent.succeeded",
      jobId: queued.job.id,
      occurredAtMs,
      payload: { payment_intent: `pi:${topology}:${scenario}` },
    });
    expect(first.disposition).toBe("applied");

    if (scenario === "duplicate_webhook") {
      const duplicate = await engine.ingestInboundEvent({
        source: "stripe",
        eventId: `evt:${topology}:${scenario}`,
        eventType: "payment_intent.succeeded",
        jobId: queued.job.id,
        occurredAtMs,
        payload: { payment_intent: `pi:${topology}:${scenario}` },
      });
      expect(duplicate.disposition).toBe("duplicate");
      expect(handlerCalls).toBe(1);
      evidence.webhookDisposition = "duplicate";
    } else {
      const audit = await store.listAudit(queued.job.id);
      const received = audit.find((event) => event.eventType === "event.received");
      expect(received?.details?.delayed).toBe(true);
      evidence.delayedWebhookObserved = true;
    }

    settleAll(runtime, settlement, stripe);
    return { runtime, settlement, stripe, evidence };
  }

  if (scenario === "missing_webhook") {
    recordExternalPayment(runtime, stripe);
    const beforeRecovery = reconcile(runtime, settlement, stripe);
    expect(beforeRecovery).toMatchObject({
      status: "human_review",
      blocked: true,
      reconciliationRequired: true,
      humanReview: true,
    });

    const clock = new ManualKlyxResilienceClock(1_800_000_000_000);
    const store = new InMemoryKlyxResilienceStore();
    const engine = new KlyxResilienceEngine({
      store,
      clock,
      recoveryHandlers: {
        payment_webhook: async () => {
          recognizeLocalPayment(runtime, settlement);
          return {
            kind: "proved_succeeded",
            resultRef: `recovered-payment:${topology}`,
            reasonCode: "MISSING_WEBHOOK_RECOVERED_FROM_STRIPE_TRUTH",
          };
        },
      },
    });
    const queued = await engine.enqueue({
      jobType: "payment_webhook",
      idempotencyKey: `missing-webhook:${topology}`,
      payload: { topology },
    });
    const recovered = await engine.recoverMissingWebhook({
      jobId: queued.job.id,
      expectedByMs: clock.nowMs(),
      reasonCode: "WEBHOOK_ABSENT",
    });
    expect(recovered.outcome).toBe("succeeded");
    settlement.markReconciled();
    settleAll(runtime, settlement, stripe);
    evidence.missingWebhookRecovered = true;
    return { runtime, settlement, stripe, evidence };
  }

  if (scenario === "retry" || scenario === "double_click") {
    const clock = new ManualKlyxResilienceClock(1_800_000_000_000);
    const store = new InMemoryKlyxResilienceStore();
    let executions = 0;
    let attempts = 0;
    const engine = new KlyxResilienceEngine({
      store,
      clock,
      defaultRetryPolicy: {
        maxAttempts: 3,
        backoffBaseMs: 1_000,
        backoffMaxMs: 1_000,
      },
      executors: {
        financial_chain: async () => {
          attempts += 1;
          if (scenario === "retry" && attempts === 1) {
            return { kind: "retryable_failure", errorCode: "SIMULATED_TRANSIENT_FAILURE" };
          }
          executions += 1;
          recordExternalPayment(runtime, stripe);
          recognizeLocalPayment(runtime, settlement);
          settleAll(runtime, settlement, stripe);
          return {
            kind: "success",
            resultRef: `financial-chain:${topology}:${scenario}`,
          };
        },
      },
    });

    const firstEnqueue = await engine.enqueue({
      jobType: "financial_chain",
      idempotencyKey: `financial-chain:${topology}:${scenario}`,
      payload: { topology, scenario },
    });

    if (scenario === "double_click") {
      const secondEnqueue = await engine.enqueue({
        jobType: "financial_chain",
        idempotencyKey: `financial-chain:${topology}:${scenario}`,
        payload: { topology, scenario },
      });
      expect(firstEnqueue.created).toBe(true);
      expect(secondEnqueue.duplicate).toBe(true);
    }

    const firstClaim = await engine.claim({ workerId: "worker-1", limit: 1 });
    expect(firstClaim).toHaveLength(1);
    expect(firstClaim[0].lease).not.toBeNull();
    const firstOutcome = await engine.executeClaim({
      job: firstClaim[0],
      workerId: "worker-1",
      leaseToken: firstClaim[0].lease!.token,
    });

    if (scenario === "retry") {
      expect(firstOutcome.outcome).toBe("retry_scheduled");
      expect(stripe.objectCounts().charges).toBe(0);
      expect(stripe.objectCounts().transfers).toBe(0);
      clock.advance(1_000);
      const retryClaim = await engine.claim({ workerId: "worker-2", limit: 1 });
      expect(retryClaim).toHaveLength(1);
      const retryOutcome = await engine.executeClaim({
        job: retryClaim[0],
        workerId: "worker-2",
        leaseToken: retryClaim[0].lease!.token,
      });
      expect(retryOutcome.outcome).toBe("succeeded");
      evidence.retryAttempts = attempts;
    } else {
      expect(firstOutcome.outcome).toBe("succeeded");
      evidence.doubleClickDeduplicated = true;
    }

    expect(executions).toBe(1);
    evidence.executions = executions;
    return { runtime, settlement, stripe, evidence };
  }

  recordExternalPayment(runtime, stripe);
  recognizeLocalPayment(runtime, settlement);

  if (scenario === "failed_transfer") {
    for (const item of runtime) {
      stripe.recordFailedTransfer(item.leg);
      item.bookingState = "human_review";
    }
    settlement.failClosed();
    evidence.failedTransferCount = stripe.objectCounts().failedTransfers;
    return { runtime, settlement, stripe, evidence };
  }

  if (scenario === "timeout") {
    for (const item of runtime) {
      if (!item.state) throw new Error("KLYX_CERT_TEST_TIMEOUT_PAYMENT_MISSING");
      const amount = outstandingSettlementMinor(item.state);
      stripe.recordTransfer(item.leg, amount);
    }
    const ambiguous = reconcile(runtime, settlement, stripe);
    expect(ambiguous).toMatchObject({
      status: "human_review",
      blocked: true,
      reconciliationRequired: true,
      humanReview: true,
    });
    settlement.failClosed();

    for (const item of runtime) {
      if (!item.state) throw new Error("KLYX_CERT_TEST_TIMEOUT_PAYMENT_MISSING");
      const remoteAmount = stripe.transferFor(item.leg);
      item.state = settleProviderLiability(item.state, {
        operationId: `recovered-transfer:${item.leg.bookingId}`,
        amountMinor: remoteAmount,
        cause: "timeout_reconciliation_existing_transfer",
      });
      settlement.recordTransfer(item.leg, remoteAmount);
    }
    settlement.markReconciled();
    evidence.timeoutRecoveredWithoutSecondTransfer = true;
    return { runtime, settlement, stripe, evidence };
  }

  settleAll(runtime, settlement, stripe);

  if (scenario === "partial_refund") {
    for (const item of runtime) {
      if (!item.state) throw new Error("KLYX_CERT_TEST_REFUND_PAYMENT_MISSING");
      const amount = Math.max(1, Math.floor(item.state.breakdown.grossMinor * 0.3));
      const beforeReversal = item.state.reversedMinor;
      item.state = refundCharge(item.state, {
        operationId: `partial-refund:${item.leg.bookingId}`,
        amountMinor: amount,
        cause: "partial_customer_refund",
      });
      const reversalDelta = item.state.reversedMinor - beforeReversal;
      if (reversalDelta > 0) {
        stripe.recordReversal(item.leg, reversalDelta);
        settlement.recordReversal(item.leg, reversalDelta);
      }
      stripe.recordRefund(item.leg, amount);
      settlement.recordRefund(item.leg, amount);
    }
    evidence.partialRefund = true;
  }

  if (scenario === "full_refund") {
    for (const item of runtime) {
      if (!item.state) throw new Error("KLYX_CERT_TEST_REFUND_PAYMENT_MISSING");
      const amount = item.state.breakdown.grossMinor - item.state.refundedMinor;
      const beforeReversal = item.state.reversedMinor;
      item.state = fullRefundCharge(item.state, {
        operationId: `full-refund:${item.leg.bookingId}`,
        cause: "full_customer_refund",
      });
      const reversalDelta = item.state.reversedMinor - beforeReversal;
      if (reversalDelta > 0) {
        stripe.recordReversal(item.leg, reversalDelta);
        settlement.recordReversal(item.leg, reversalDelta);
      }
      stripe.recordRefund(item.leg, amount);
      settlement.recordRefund(item.leg, amount);
    }
    evidence.fullRefund = true;
  }

  if (scenario === "reversal") {
    for (const item of runtime) {
      if (!item.state) throw new Error("KLYX_CERT_TEST_REVERSAL_PAYMENT_MISSING");
      const amount = Math.max(1, Math.floor(item.state.transferredMinor / 2));
      item.state = reverseTransfer(item.state, {
        operationId: `reversal:${item.leg.bookingId}`,
        amountMinor: amount,
        cause: "controlled_transfer_reversal",
      });
      stripe.recordReversal(item.leg, amount);
      settlement.recordReversal(item.leg, amount);
    }
    evidence.reversal = true;
  }

  return { runtime, settlement, stripe, evidence };
}

describe("KLYX Integrated Financial TEST 48", () => {
  it("defines exactly 12 scenarios x 4 topologies", () => {
    expect(SCENARIOS).toHaveLength(12);
    expect(TOPOLOGIES).toHaveLength(4);
    expect(SCENARIOS.length * TOPOLOGIES.length).toBe(48);
  });

  it("keeps topology fixtures structurally distinct", () => {
    expect(fixture("single")).toHaveLength(1);
    expect(fixture("group")).toHaveLength(3);
    expect(fixture("split")).toHaveLength(3);
    expect(new Set(fixture("multi_provider").map((leg) => leg.providerRef)).size).toBeGreaterThanOrEqual(2);
    expect(new Set(fixture("split").map((leg) => leg.providerRef)).size).toBeGreaterThanOrEqual(2);
  });

  describe.each(TOPOLOGIES)("topology=%s", (topology) => {
    it.each(SCENARIOS)("scenario=%s", async (scenario) => {
      const result = await runScenario(topology, scenario);
      assertRuntimeParity(result.runtime);

      const final = reconcile(result.runtime, result.settlement, result.stripe);
      expect(final.status).toBe("coherent");
      expect(final.blocked).toBe(false);
      expect(final.reconciliationRequired).toBe(false);
      expect(final.humanReview).toBe(false);
      expect(final.ledger).toEqual(final.settlement);
      expect(final.ledger).toEqual(final.stripe);

      if (scenario === "failed_payment") {
        expect(final.ledger).toEqual(ZERO_TRUTH);
        expect(result.stripe.objectCounts().failedPayments).toBe(fixture(topology).length);
      }
      if (scenario === "failed_transfer") {
        expect(final.ledger.transfer).toBe(0);
        expect(result.settlement.blocked).toBe(true);
        expect(result.settlement.reconciliation).toBe(true);
        expect(result.settlement.humanReview).toBe(true);
      }
      if (scenario === "duplicate_webhook") {
        expect(result.evidence.webhookDisposition).toBe("duplicate");
        expect(result.stripe.objectCounts().charges).toBe(fixture(topology).length);
      }
      if (scenario === "late_webhook") {
        expect(result.evidence.delayedWebhookObserved).toBe(true);
      }
      if (scenario === "missing_webhook") {
        expect(result.evidence.missingWebhookRecovered).toBe(true);
      }
      if (scenario === "retry") {
        expect(result.evidence.retryAttempts).toBe(2);
        expect(result.evidence.executions).toBe(1);
      }
      if (scenario === "double_click") {
        expect(result.evidence.doubleClickDeduplicated).toBe(true);
        expect(result.evidence.executions).toBe(1);
      }
      if (scenario === "timeout") {
        expect(result.evidence.timeoutRecoveredWithoutSecondTransfer).toBe(true);
        expect(result.stripe.objectCounts().transfers).toBe(fixture(topology).length);
      }
    });
  });

  it("fails closed on an injected Ledger/Settlement/Stripe divergence", async () => {
    const topology: Topology = "single";
    const result = await runScenario(topology, "success");
    const leg = fixture(topology)[0];
    result.stripe.injectTransferDivergence(leg, result.stripe.transferFor(leg) + 1);

    const divergent = reconcile(result.runtime, result.settlement, result.stripe);
    expect(divergent).toMatchObject({
      status: "human_review",
      blocked: true,
      reconciliationRequired: true,
      humanReview: true,
    });
  });
});
