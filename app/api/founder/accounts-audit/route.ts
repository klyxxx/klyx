import { NextResponse } from "next/server";

import { secureApiErrorResponse } from "@/lib/api-error";
import {
  founderErrorPublicMessage,
  founderErrorStatus,
  requireKlyxFounder,
} from "@/lib/founder-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

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

export async function GET() {
  const startedAt = Date.now();

  try {
    const founder = await requireKlyxFounder();

    const {
      data: usersData,
      error: usersError,
    } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (usersError) {
      throw new Error(usersError.message);
    }

    const { data: profiles, error: profilesError } =
      await supabaseAdmin
        .from("profiles")
        .select(
          "id, owner_user_id, account_type, first_name, last_name"
        );

    if (profilesError) {
      throw new Error(profilesError.message);
    }

    const protectedIds = protectedConfiguredIds();

    const users = usersData.users.map((user) => {
      const profileIdRefs = (profiles ?? []).filter(
        (profile) => profile.id === user.id
      );

      const ownerRefs = (profiles ?? []).filter(
        (profile) => profile.owner_user_id === user.id
      );

      const reasons: string[] = [];

      if (user.id === founder.id) {
        reasons.push("Session Founder actuellement connectée");
      }

      if (protectedIds.has(user.id)) {
        reasons.push("UID déclaré Founder ou Admin");
      }

      if (profileIdRefs.length > 0) {
        reasons.push(
          `${profileIdRefs.length} profil(s) utilise(nt) cet UID comme id`
        );
      }

      if (ownerRefs.length > 0) {
        reasons.push(
          `${ownerRefs.length} profil(s) appartient/appartiennent à cet UID`
        );
      }

      const protectedAccount = reasons.length > 0;

      return {
        id: user.id,
        email: user.email ?? null,
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
        protected: protectedAccount,
        protectionReasons: reasons,
        profileIdReferences: profileIdRefs.map((profile) => ({
          id: profile.id,
          accountType: profile.account_type,
          name: `${profile.first_name ?? ""} ${
            profile.last_name ?? ""
          }`.trim(),
        })),
        ownedProfiles: ownerRefs.map((profile) => ({
          id: profile.id,
          accountType: profile.account_type,
          name: `${profile.first_name ?? ""} ${
            profile.last_name ?? ""
          }`.trim(),
        })),
      };
    });

    return NextResponse.json({
      founderUserId: founder.id,
      totalUsers: users.length,
      protectedUsers: users.filter((user) => user.protected).length,
      unreferencedUsers: users.filter((user) => !user.protected).length,
      users,
      deletionEnabled: false,
      deletionMessage:
        "11.3 est un audit de sécurité. Aucun compte Auth n’est supprimé automatiquement.",
    });
  } catch (error) {
    const status = founderErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "founder_accounts_audit_failed",
      route: "/api/founder/accounts-audit",
      method: "GET",
      status,
      code: "KLYX_FOUNDER_ACCOUNTS_AUDIT_FAILED",
      publicMessage: founderErrorPublicMessage(status),
      startedAt,
    });
  }
}
