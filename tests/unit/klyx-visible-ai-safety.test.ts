import {
  describe,
  expect,
  it,
} from "vitest";

import {
  assessKlyxVisibleAiCandidate,
} from "../../lib/klyx-visible-ai-safety";

const LOCKED_FACTS = {
  serviceSlug: "menage",
  city: "Bruxelles",
  date: "2026-09-10",
  time: "14:30",
  budget: 50,
  missing: [],
  ready: true,
};

const DETERMINISTIC_REPLY =
  "Ménage à Bruxelles le 2026-09-10 à 14:30, budget maximum 50 EUR. Vérifiez le résumé avant de confirmer.";

describe("KLYX visible AI deterministic safety", () => {
  it("accepts a natural reformulation that preserves locked facts", () => {
    const result = assessKlyxVisibleAiCandidate({
      candidate:
        "Je peux organiser ce ménage à Bruxelles le 10 septembre 2026 à 14h30, avec un budget de 50 €.",
      deterministicReply: DETERMINISTIC_REPLY,
      lockedFacts: LOCKED_FACTS,
    });

    expect(result).toEqual({ safe: true, reason: null });
  });

  it("accepts equivalent English date and 12-hour time formatting", () => {
    const result = assessKlyxVisibleAiCandidate({
      candidate:
        "Ménage à Bruxelles on September 10, 2026 at 2:30 PM, budget 50 EUR.",
      deterministicReply: DETERMINISTIC_REPLY,
      lockedFacts: LOCKED_FACTS,
    });

    expect(result).toEqual({ safe: true, reason: null });
  });

  it("accepts an equivalent partial date when the locked day and month match", () => {
    const result = assessKlyxVisibleAiCandidate({
      candidate:
        "Le ménage à Bruxelles est prévu le 10 septembre à 14h30 avec un budget de 50 EUR.",
      deterministicReply: DETERMINISTIC_REPLY,
      lockedFacts: LOCKED_FACTS,
    });

    expect(result.safe).toBe(true);
  });

  it("rejects a changed budget with a currency", () => {
    const result = assessKlyxVisibleAiCandidate({
      candidate:
        "Ménage à Bruxelles le 10 septembre 2026 à 14h30, budget 60 €.",
      deterministicReply: DETERMINISTIC_REPLY,
      lockedFacts: LOCKED_FACTS,
    });

    expect(result).toEqual({ safe: false, reason: "money" });
  });

  it("rejects a changed budget even when the candidate omits the currency", () => {
    const result = assessKlyxVisibleAiCandidate({
      candidate:
        "Ménage à Bruxelles le 10 septembre 2026 à 14h30, budget 60.",
      deterministicReply: DETERMINISTIC_REPLY,
      lockedFacts: LOCKED_FACTS,
    });

    expect(result).toEqual({ safe: false, reason: "number" });
  });

  it("rejects switching the locked currency", () => {
    const result = assessKlyxVisibleAiCandidate({
      candidate:
        "Ménage à Bruxelles le 10 septembre 2026 à 14h30, budget 50 USD.",
      deterministicReply: DETERMINISTIC_REPLY,
      lockedFacts: LOCKED_FACTS,
    });

    expect(result).toEqual({ safe: false, reason: "money" });
  });

  it("rejects an invented monetary amount when no budget is locked", () => {
    const result = assessKlyxVisibleAiCandidate({
      candidate: "Je peux organiser cela à Bruxelles pour 35 €.",
      deterministicReply:
        "Je peux organiser votre demande à Bruxelles dès que les informations manquantes sont complétées.",
      lockedFacts: {
        city: "Bruxelles",
        budget: null,
        missing: ["budget"],
        ready: false,
      },
    });

    expect(result).toEqual({ safe: false, reason: "money" });
  });

  it("rejects a changed date", () => {
    const result = assessKlyxVisibleAiCandidate({
      candidate:
        "Ménage à Bruxelles le 11/09/2026 à 14h30, budget 50 EUR.",
      deterministicReply: DETERMINISTIC_REPLY,
      lockedFacts: LOCKED_FACTS,
    });

    expect(result).toEqual({ safe: false, reason: "date" });
  });

  it("rejects a changed time", () => {
    const result = assessKlyxVisibleAiCandidate({
      candidate:
        "Ménage à Bruxelles le 10 septembre 2026 à 15h00, budget 50 EUR.",
      deterministicReply: DETERMINISTIC_REPLY,
      lockedFacts: LOCKED_FACTS,
    });

    expect(result).toEqual({ safe: false, reason: "time" });
  });

  it("rejects a different known KLYX locality", () => {
    const result = assessKlyxVisibleAiCandidate({
      candidate:
        "Ménage à Liège le 10 septembre 2026 à 14h30, budget 50 EUR.",
      deterministicReply: DETERMINISTIC_REPLY,
      lockedFacts: LOCKED_FACTS,
    });

    expect(result).toEqual({ safe: false, reason: "location" });
  });

  it("rejects an invented named location outside the Belgian locality list", () => {
    const result = assessKlyxVisibleAiCandidate({
      candidate:
        "Ménage à Paris le 10 septembre 2026 à 14h30, budget 50 EUR.",
      deterministicReply: DETERMINISTIC_REPLY,
      lockedFacts: LOCKED_FACTS,
    });

    expect(result).toEqual({ safe: false, reason: "location" });
  });

  it("rejects dropping a sensitive locked fact that deterministic KLYX stated", () => {
    const result = assessKlyxVisibleAiCandidate({
      candidate:
        "Le 10 septembre 2026 à 14h30 convient, avec un budget de 50 EUR.",
      deterministicReply: DETERMINISTIC_REPLY,
      lockedFacts: LOCKED_FACTS,
    });

    expect(result).toEqual({ safe: false, reason: "locked-fact" });
  });

  it("rejects a newly invented completed transaction state", () => {
    const result = assessKlyxVisibleAiCandidate({
      candidate: "Votre réservation est confirmée.",
      deterministicReply:
        "Tout est prêt. Vérifiez le résumé avant de confirmer.",
      lockedFacts: {
        missing: [],
        ready: true,
      },
    });

    expect(result).toEqual({ safe: false, reason: "transaction-state" });
  });

  it("rejects an invented completed transaction state in English", () => {
    const result = assessKlyxVisibleAiCandidate({
      candidate: "Your booking is confirmed.",
      deterministicReply:
        "Everything is ready. Review the summary before confirming.",
      lockedFacts: {
        missing: [],
        ready: true,
      },
    });

    expect(result).toEqual({ safe: false, reason: "transaction-state" });
  });

  it("allows a transaction state already asserted by deterministic KLYX", () => {
    const result = assessKlyxVisibleAiCandidate({
      candidate: "Bonne nouvelle : votre réservation est confirmée à Bruxelles.",
      deterministicReply: "Votre réservation est confirmée à Bruxelles.",
      lockedFacts: {
        city: "Bruxelles",
      },
    });

    expect(result).toEqual({ safe: true, reason: null });
  });

  it("rejects changing transaction-state polarity", () => {
    const result = assessKlyxVisibleAiCandidate({
      candidate: "Votre réservation est confirmée à Bruxelles.",
      deterministicReply:
        "Votre réservation n'est pas confirmée à Bruxelles.",
      lockedFacts: {
        city: "Bruxelles",
        status: "pending",
      },
    });

    expect(result).toEqual({ safe: false, reason: "transaction-state" });
  });

  it("rejects changing a failed payment into a successful one", () => {
    const result = assessKlyxVisibleAiCandidate({
      candidate: "The payment succeeded.",
      deterministicReply: "Le paiement a échoué.",
      lockedFacts: {
        status: "failed",
      },
    });

    expect(result).toEqual({ safe: false, reason: "transaction-state" });
  });

  it("does not treat unrelated negation as a transaction polarity change", () => {
    const result = assessKlyxVisibleAiCandidate({
      candidate:
        "Je ne change pas le lieu. Votre réservation est confirmée à Bruxelles.",
      deterministicReply: "Votre réservation est confirmée à Bruxelles.",
      lockedFacts: {
        city: "Bruxelles",
      },
    });

    expect(result).toEqual({ safe: true, reason: null });
  });

  it("rejects a ready claim while deterministic KLYX still has missing fields", () => {
    const result = assessKlyxVisibleAiCandidate({
      candidate: "Tout est prêt, je peux continuer.",
      deterministicReply: "Il reste la date à préciser.",
      lockedFacts: {
        missing: ["date"],
        ready: false,
      },
    });

    expect(result).toEqual({ safe: false, reason: "readiness" });
  });

  it("rejects a missing-information claim after deterministic KLYX is ready", () => {
    const result = assessKlyxVisibleAiCandidate({
      candidate: "There is still missing information.",
      deterministicReply: "Everything is ready for confirmation.",
      lockedFacts: {
        missing: [],
        ready: true,
      },
    });

    expect(result).toEqual({ safe: false, reason: "readiness" });
  });
});
