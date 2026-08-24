import { describe, expect, it } from "vitest";
import {
  KLYX_BRAIN_ACTION_TRANSLATED_LOCALES,
  localizeKlyxBrainAction,
  resolveKlyxBrainActionLocale,
  type KlyxBrainActionLike,
} from "@/lib/klyx-brain-action-i18n";

function action(
  overrides: Partial<KlyxBrainActionLike> = {}
): KlyxBrainActionLike {
  return {
    id: "finalize-request",
    kind: "finalize_booking",
    priority: 100,
    title: "Finaliser la reservation",
    description:
      "Le prestataire et le prix sont choisis. Il reste a confirmer le creneau.",
    href: "/quotes/quote-1/book",
    label: "Choisir le creneau",
    ...overrides,
  };
}

describe("KLYX Brain action presentation i18n", () => {
  it("falls back explicitly to French outside the certified locales", () => {
    expect(resolveKlyxBrainActionLocale("es")).toBe("fr");

    const french = localizeKlyxBrainAction("fr", action());
    const fallback = localizeKlyxBrainAction("es", action());

    expect(fallback).toEqual(french);
  });

  it("preserves semantic action fields in every certified locale", () => {
    for (const locale of KLYX_BRAIN_ACTION_TRANSLATED_LOCALES) {
      const localized = localizeKlyxBrainAction(locale, action());

      expect(localized.id).toBe("finalize-request");
      expect(localized.kind).toBe("finalize_booking");
      expect(localized.priority).toBe(100);
      expect(localized.href).toBe("/quotes/quote-1/book");
      expect(localized.title.trim().length).toBeGreaterThan(0);
      expect(localized.description.trim().length).toBeGreaterThan(0);
      expect(localized.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps user-authored request titles verbatim while localizing compare-offer chrome", () => {
    const source = action({
      id: "compare-request-1",
      kind: "compare_offers",
      priority: 90,
      title: "2 offres a comparer",
      description: "Besoin de réparer mon évier demain",
      href: "/assistant/market/request-1",
      label: "Comparer avec KLYX",
    });

    for (const locale of KLYX_BRAIN_ACTION_TRANSLATED_LOCALES) {
      const localized = localizeKlyxBrainAction(locale, source);

      expect(localized.description).toBe(source.description);
      expect(localized.title).toContain("2");
      expect(localized.href).toBe(source.href);
    }
  });

  it("localizes every current base and group-cancellation action family", () => {
    const samples: KlyxBrainActionLike[] = [
      action(),
      action({
        id: "payment-booking-1",
        kind: "payment_pending",
        priority: 105,
        title: "Paiement a finaliser",
        description:
          "Le prestataire a accepte. Le paiement est la prochaine etape avant la mission.",
        href: "/bookings/booking-1",
        label: "Finaliser le paiement",
      }),
      action({
        id: "payment-group-group-1",
        kind: "payment_pending",
        priority: 110,
        title: "Paiement groupe a finaliser",
        description:
          "Tous les creneaux sont acceptes. Le groupe attend un paiement unique.",
        href: "/booking-groups/group-1",
        label: "Voir le groupe",
      }),
      action({
        id: "confirm-completion-booking-1",
        kind: "confirm_completion",
        priority: 120,
        title: "Confirme la fin de mission",
        description:
          "Le prestataire a declare son travail termine. Verifie la prestation puis confirme.",
        href: "/tracking/booking-1",
        label: "Verifier et confirmer",
      }),
      action({
        id: "track-booking-1",
        kind: "track_mission",
        priority: 108,
        title: "Le prestataire est arrive",
        description:
          "Le prestataire indique etre arrive. La prestation peut commencer.",
        href: "/tracking/booking-1",
        label: "Suivre la mission",
      }),
      action({
        id: "review-booking-1",
        kind: "review_completed",
        priority: 60,
        title: "Mission terminee",
        description:
          "La mission est terminee. Consulte le resultat et laisse un avis si necessaire.",
        href: "/bookings/booking-1",
        label: "Voir la mission",
      }),
      action({
        id: "review-group-group-1",
        kind: "review_completed",
        priority: 65,
        title: "Mission groupee terminee",
        description:
          "Tous les creneaux sont termines. Un seul avis KLYX evalue toute la mission.",
        href: "/reviews/group/group-1",
        label: "Donner mon avis",
      }),
      action({
        id: "provider-offer-offer-1",
        kind: "provider_offer_update",
        priority: 85,
        title: "Une offre a ete acceptee",
        description: "Montant accepte : 42.50 EUR.",
        href: "/bookings",
        label: "Voir mes reservations",
      }),
      action({
        id: "provider-booking-booking-1",
        kind: "provider_booking_request",
        priority: 120,
        title: "Nouvelle reservation a traiter",
        description:
          "Un client attend ta reponse. Accepte ou refuse la demande.",
        href: "/bookings/booking-1",
        label: "Repondre maintenant",
      }),
      action({
        id: "provider-group-group-1",
        kind: "provider_booking_request",
        priority: 125,
        title: "Reservation groupee a confirmer",
        description:
          "Le client t a selectionne pour plusieurs creneaux. Confirme le groupe complet.",
        href: "/booking-groups/group-1",
        label: "Traiter le groupe",
      }),
      action({
        id: "provider-finish-booking-1",
        kind: "provider_finish_mission",
        priority: 115,
        title: "Termine la mission dans KLYX",
        description:
          "La prestation est en cours. Quand le travail est fini, declare la mission terminee.",
        href: "/tracking/booking-1",
        label: "Declarer la fin",
      }),
      action({
        id: "provider-track-booking-1",
        kind: "provider_track_mission",
        priority: 109,
        title: "Continue ton trajet",
        description:
          "Indique ton arrivee au client depuis le suivi KLYX.",
        href: "/tracking/booking-1",
        label: "Ouvrir le suivi",
      }),
      action({
        id: "group-cancellation-waiting-group-1",
        kind: "group_cancellation_waiting",
        priority: 126,
        title: "Annulation en attente",
        description:
          "Ta demande concerne une mission groupee deja payee. L autre participant doit encore accepter ou refuser avant tout remboursement.",
        href: "/booking-groups/group-1",
        label: "Voir la demande",
      }),
      action({
        id: "group-cancellation-decision-group-1",
        kind: "group_cancellation_decision",
        priority: 145,
        title: "Decision d annulation requise",
        description:
          "L autre participant demande l annulation de toute la mission. Ton accord explicite peut declencher le remboursement Stripe du groupe.",
        href: "/booking-groups/group-1",
        label: "Examiner la demande",
      }),
      action({
        id: "group-refund-processing-group-1",
        kind: "group_refund_processing",
        priority: 130,
        title: "Remboursement groupe en cours",
        description:
          "Stripe traite le remboursement unique de cette mission groupee. Les creneaux restent synchronises par KLYX.",
        href: "/booking-groups/group-1",
        label: "Voir le remboursement",
      }),
      action({
        id: "group-refund-failed-group-1",
        kind: "group_refund_failed",
        priority: 160,
        title: "Remboursement groupe a verifier",
        description:
          "Stripe n a pas finalise le remboursement de la mission groupee. Le dossier doit etre verifie avant toute nouvelle action financiere.",
        href: "/booking-groups/group-1",
        label: "Verifier le dossier",
      }),
    ];

    for (const locale of KLYX_BRAIN_ACTION_TRANSLATED_LOCALES) {
      for (const source of samples) {
        const localized = localizeKlyxBrainAction(locale, source);

        expect(localized.id).toBe(source.id);
        expect(localized.kind).toBe(source.kind);
        expect(localized.priority).toBe(source.priority);
        expect(localized.href).toBe(source.href);
        expect(localized.title.trim().length).toBeGreaterThan(0);
        expect(localized.description.trim().length).toBeGreaterThan(0);
        expect(localized.label.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps unknown future action kinds untouched", () => {
    const source = action({
      id: "future-action",
      kind: "future_kind",
      title: "Future title",
      description: "Future description",
      label: "Future label",
    });

    expect(localizeKlyxBrainAction("de", source)).toEqual(source);
  });
});
