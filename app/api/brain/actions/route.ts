import {
  NextResponse,
} from "next/server";

import {
  apiErrorStatus,
  getAuthenticatedProfile,
} from "@/lib/api-auth";

import {
  getBrainActions,
} from "@/lib/brain-actions";

import {
  getGroupCancellationBrainActions,
} from "@/lib/brain-group-cancellation-actions";

// KLYX_GROUP_ACTION_CENTER_12_91

type ActionItem = {
  id: string;
  kind: string;
  priority: number;
  title: string;
  description: string;
  href: string;
  label: string;
};

function normalizeActions(
  value: unknown
): ActionItem[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return value.filter(
    (
      item
    ): item is ActionItem => {
      if (
        !item ||
        typeof item !==
          "object"
      ) {
        return false;
      }

      const candidate =
        item as Partial<ActionItem>;

      return (
        typeof candidate.id ===
          "string" &&
        typeof candidate.kind ===
          "string" &&
        typeof candidate.priority ===
          "number" &&
        typeof candidate.title ===
          "string" &&
        typeof candidate.description ===
          "string" &&
        typeof candidate.href ===
          "string" &&
        typeof candidate.label ===
          "string"
      );
    }
  );
}

export async function GET(
  request: Request
) {
  try {
    const {
      profile,
    } =
      await getAuthenticatedProfile(
        request
      );

    const [
      baseResult,
      cancellationResult,
    ] = await Promise.all([
      getBrainActions(
        profile
      ),

      getGroupCancellationBrainActions(
        profile.id
      ),
    ]);

    const baseActions =
      normalizeActions(
        baseResult
      );

    const protectedHrefs =
      new Set(
        cancellationResult
          .protectedGroupHrefs
      );

    /*
      KLYX 12.91:
      Si une annulation ou un remboursement
      exige deja une action sur un groupe,
      on masque paiement / tracking / review
      concurrents pointant sur le meme groupe.
    */
    const filteredBase =
      baseActions.filter(
        (action) =>
          !protectedHrefs.has(
            action.href
          )
      );

    const actionMap =
      new Map<
        string,
        ActionItem
      >();

    for (
      const action
      of filteredBase
    ) {
      actionMap.set(
        action.id,
        action
      );
    }

    for (
      const action
      of cancellationResult.actions
    ) {
      actionMap.set(
        action.id,
        action
      );
    }

    const actions =
      Array.from(
        actionMap.values()
      )
        .sort(
          (
            first,
            second
          ) =>
            second.priority -
            first.priority
        )
        .slice(
          0,
          30
        );

    return NextResponse.json({
      profileId:
        profile.id,

      accountType:
        profile.accountType,

      actions,

      count:
        actions.length,

      automaticExecutionAllowed:
        false,

      groupCancellationAware:
        true,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de charger les actions KLYX.";

    return NextResponse.json(
      {
        error:
          message,

        automaticExecutionAllowed:
          false,
      },
      {
        status:
          apiErrorStatus(
            message
          ),
      }
    );
  }
}