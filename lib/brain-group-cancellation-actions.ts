import "server-only";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

// KLYX_GROUP_CANCELLATION_ACTIONS_12_91

export type GroupCancellationBrainAction = {
  id: string;
  kind: string;
  priority: number;
  title: string;
  description: string;
  href: string;
  label: string;
};

type GroupRow = {
  id: string;

  client_profile_id:
    string;

  provider_profile_id:
    string;

  status:
    string;

  payment_status:
    string;

  cancellation_request_status:
    string;

  cancellation_requested_by:
    | string
    | null;

  cancellation_requested_role:
    | string
    | null;

  cancellation_reason:
    | string
    | null;

  cancellation_resolution:
    string;

  refund_status:
    string;

  refunded_amount_cents:
    | number
    | null;

  updated_at:
    | string
    | null;
};

export type GroupCancellationActionResult = {
  actions:
    GroupCancellationBrainAction[];

  protectedGroupHrefs:
    string[];
};

function groupHref(
  groupId: string
) {
  return (
    "/booking-groups/" +
    groupId
  );
}

export async function getGroupCancellationBrainActions(
  profileId: string
): Promise<GroupCancellationActionResult> {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "booking_groups"
    )
    .select(
      "id, client_profile_id, provider_profile_id, status, payment_status, cancellation_request_status, cancellation_requested_by, cancellation_requested_role, cancellation_reason, cancellation_resolution, refund_status, refunded_amount_cents, updated_at"
    )
    .or(
      "client_profile_id.eq." +
      profileId +
      ",provider_profile_id.eq." +
      profileId
    )
    .order(
      "updated_at",
      {
        ascending: false,
      }
    )
    .limit(40);

  if (error) {
    throw new Error(
      error.message
    );
  }

  const groups =
    (
      data ??
      []
    ) as unknown as
      GroupRow[];

  const actions:
    GroupCancellationBrainAction[] =
    [];

  const protectedGroupHrefs =
    new Set<string>();

  for (
    const group
    of groups
  ) {
    const href =
      groupHref(
        group.id
      );

    const isClient =
      group.client_profile_id ===
      profileId;

    const isProvider =
      group.provider_profile_id ===
      profileId;

    if (
      !isClient &&
      !isProvider
    ) {
      continue;
    }

    const pendingCancellation =
      group.cancellation_request_status ===
      "requested";

    if (
      pendingCancellation
    ) {
      protectedGroupHrefs.add(
        href
      );

      const requester =
        group.cancellation_requested_by ===
        profileId;

      if (requester) {
        actions.push({
          id:
            "group-cancellation-waiting-" +
            group.id,

          kind:
            "group_cancellation_waiting",

          priority:
            group.payment_status ===
            "paid"
              ? 126
              : 116,

          title:
            "Annulation en attente",

          description:
            group.payment_status ===
            "paid"
              ? "Ta demande concerne une mission groupee deja payee. L autre participant doit encore accepter ou refuser avant tout remboursement."
              : "Ta demande d annulation groupee attend la decision de l autre participant.",

          href,

          label:
            "Voir la demande",
        });

        continue;
      }

      actions.push({
        id:
          "group-cancellation-decision-" +
          group.id,

        kind:
          "group_cancellation_decision",

        priority: 145,

        title:
          "Decision d annulation requise",

        description:
          group.payment_status ===
          "paid"
            ? "L autre participant demande l annulation de toute la mission. Ton accord explicite peut declencher le remboursement Stripe du groupe."
            : "L autre participant demande l annulation de toute la mission groupee. Accepte ou refuse la demande.",

        href,

        label:
          "Examiner la demande",
      });

      continue;
    }

    if (
      group.refund_status ===
      "processing"
    ) {
      protectedGroupHrefs.add(
        href
      );

      actions.push({
        id:
          "group-refund-processing-" +
          group.id,

        kind:
          "group_refund_processing",

        priority: 130,

        title:
          "Remboursement groupe en cours",

        description:
          "Stripe traite le remboursement unique de cette mission groupee. Les creneaux restent synchronises par KLYX.",

        href,

        label:
          "Voir le remboursement",
      });

      continue;
    }

    if (
      group.refund_status ===
      "failed"
    ) {
      protectedGroupHrefs.add(
        href
      );

      actions.push({
        id:
          "group-refund-failed-" +
          group.id,

        kind:
          "group_refund_failed",

        priority: 160,

        title:
          "Remboursement groupe a verifier",

        description:
          "Stripe n a pas finalise le remboursement de la mission groupee. Le dossier doit etre verifie avant toute nouvelle action financiere.",

        href,

        label:
          "Verifier le dossier",
      });

      continue;
    }

    if (
      group.cancellation_resolution ===
        "approved" &&
      group.status ===
        "cancelled" &&
      group.refund_status ===
        "refunded"
    ) {
      /*
        Etat final.
        Aucun CTA n est necessaire.
        Le Centre KLYX ne doit pas conserver
        une fausse action apres remboursement.
      */
      continue;
    }

    if (
      group.cancellation_resolution ===
        "rejected"
    ) {
      /*
        La mission reprend son cycle normal.
        Les actions existantes de brain-actions.ts
        peuvent de nouveau etre affichees.
      */
      continue;
    }
  }

  actions.sort(
    (
      first,
      second
    ) =>
      second.priority -
      first.priority
  );

  return {
    actions,

    protectedGroupHrefs:
      Array.from(
        protectedGroupHrefs
      ),
  };
}