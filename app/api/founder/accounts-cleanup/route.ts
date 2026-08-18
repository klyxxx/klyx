import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import {
  founderErrorPublicMessage,
  founderErrorStatus,
  requireKlyxFounder,
} from "@/lib/founder-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

type DeleteBody = {
  userId?: unknown;
  confirmation?: unknown;
};

function splitIds(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function protectedConfiguredIds(): Set<string> {
  return new Set([
    ...splitIds(process.env.KLYX_FOUNDER_USER_IDS),
    ...splitIds(process.env.KLYX_ADMIN_USER_IDS),
  ]);
}

async function protectionReasons(
  userId: string,
  currentFounderId: string
): Promise<string[]> {
  const reasons: string[] = [];

  if (userId === currentFounderId) {
    reasons.push("Compte Founder actuellement connecté");
  }

  if (protectedConfiguredIds().has(userId)) {
    reasons.push("UID déclaré Founder ou Admin");
  }

  const { data: idProfiles, error: idError } =
    await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .limit(1);

  if (idError) {
    throw new Error(idError.message);
  }

  if ((idProfiles ?? []).length > 0) {
    reasons.push("Cet UID est encore utilisé comme profiles.id");
  }

  const { data: ownedProfiles, error: ownerError } =
    await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("owner_user_id", userId)
      .limit(1);

  if (ownerError) {
    throw new Error(ownerError.message);
  }

  if ((ownedProfiles ?? []).length > 0) {
    reasons.push("Cet UID possède encore un profil KLYX");
  }

  return reasons;
}

export async function DELETE(request: Request) {
  const startedAt = Date.now();

  try {
    const founder = await requireKlyxFounder();

    let body: DeleteBody;

    try {
      body = (await request.json()) as DeleteBody;
    } catch {
      return NextResponse.json(
        { error: "Requête invalide." },
        { status: 400 }
      );
    }

    const userId =
      typeof body.userId === "string"
        ? body.userId.trim()
        : "";

    const confirmation =
      typeof body.confirmation === "string"
        ? body.confirmation.trim()
        : "";

    if (!userId) {
      return NextResponse.json(
        { error: "Utilisateur invalide." },
        { status: 400 }
      );
    }

    if (confirmation !== `SUPPRIMER ${userId}`) {
      return NextResponse.json(
        {
          error:
            "Confirmation invalide. La suppression n’a pas été exécutée.",
        },
        { status: 400 }
      );
    }

    const reasons = await protectionReasons(
      userId,
      founder.id
    );

    if (reasons.length > 0) {
      return NextResponse.json(
        {
          error:
            "Ce compte est protégé et ne peut pas être supprimé.",
          protectionReasons: reasons,
        },
        { status: 409 }
      );
    }

    const {
      data: { users },
      error: listError,
    } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) {
      throw new Error(listError.message);
    }

    const target = users.find(
      (user) => user.id === userId
    );

    if (!target) {
      return NextResponse.json(
        { error: "Compte Auth introuvable." },
        { status: 404 }
      );
    }

    const { error: deleteError } =
      await supabaseAdmin.auth.admin.deleteUser(
        userId,
        false
      );

    if (deleteError) {
      return secureApiErrorResponse({
        error: deleteError,
        event: "founder_account_cleanup_delete_failed",
        route: "/api/founder/accounts-cleanup",
        method: "DELETE",
        status: 409,
        code: "KLYX_FOUNDER_ACCOUNT_CLEANUP_DELETE_FAILED",
        publicMessage:
          "Supabase a refusé la suppression de ce compte.",
        startedAt,
      });
    }

    return NextResponse.json({
      success: true,
      deletedUserId: userId,
      deletedEmail: target.email ?? null,
    });
  } catch (error) {
    const status = founderErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "founder_account_cleanup_failed",
      route: "/api/founder/accounts-cleanup",
      method: "DELETE",
      status,
      code: "KLYX_FOUNDER_ACCOUNT_CLEANUP_FAILED",
      publicMessage: founderErrorPublicMessage(status),
      startedAt,
    });
  }
}
