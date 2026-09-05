import { after, NextResponse } from "next/server";
import Stripe from "stripe";

import { ACTIVE_PROFILE_COOKIE, getActiveProfile } from "@/lib/active-profile";
import { resolveKlyxAccountDeletePlan } from "@/lib/account-delete-scope";
import { secureApiErrorResponse } from "@/lib/api-error";
import { sendKlyxDeduplicatedEmail } from "@/lib/email/deduplicated-delivery";
import { profileDeletedEmail } from "@/lib/email/lifecycle-templates";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const AVATAR_BUCKET = "avatars";
const ACCOUNT_DELETION_PAGE = "/delete-account";

function setActiveProfileCookie(response: NextResponse, profileId: string) {
  response.cookies.set(ACTIVE_PROFILE_COOKIE, profileId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

async function removeProfileAvatars(profileId: string) {
  const { data: avatarObjects } = await supabaseAdmin.storage
    .from(AVATAR_BUCKET)
    .list(profileId, { limit: 100 });

  const storedAvatarObjects = (avatarObjects ?? []) as Array<{ name: string }>;

  if (storedAvatarObjects.length === 0) return;

  await supabaseAdmin.storage
    .from(AVATAR_BUCKET)
    .remove(storedAvatarObjects.map((object) => `${profileId}/${object.name}`));
}

export async function DELETE(request: Request) {
  const startedAt = Date.now();

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non connecté." }, { status: 401 });
    }

    const userEmail = user.email?.trim() || null;

    const body = (await request.json()) as {
      confirmation?: unknown;
      profileId?: unknown;
    };

    if (body.confirmation !== "SUPPRIMER") {
      return NextResponse.json(
        { error: "Écris exactement SUPPRIMER pour confirmer." },
        { status: 400 }
      );
    }

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, stripe_account_id")
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: true });

    if (profilesError) throw profilesError;

    const ownedProfiles = profiles ?? [];
    const activeProfile = await getActiveProfile();
    const requestedProfileId =
      typeof body.profileId === "string" && body.profileId.trim()
        ? body.profileId.trim()
        : activeProfile?.id ?? null;

    const deletePlan = resolveKlyxAccountDeletePlan(
      ownedProfiles,
      requestedProfileId
    );

    if (!deletePlan) {
      return NextResponse.json(
        { error: "Ce profil ne t’appartient pas." },
        { status: 403 }
      );
    }

    // KLY-11 / KLYX_PROFILE_DELETE_NEVER_DELETES_AUTH_IDENTITY
    // This endpoint is intentionally profile-only. Deleting auth.users would
    // cascade every profile owned by the same primary sign-in, including a
    // sibling profile created or preserved concurrently after this request's
    // initial profile snapshot. Full identity deletion stays behind the
    // dedicated /delete-account flow.
    if (deletePlan.scope === "account") {
      return NextResponse.json(
        {
          error:
            `Le dernier profil ne peut pas être supprimé ici. Utilise ${ACCOUNT_DELETION_PAGE} pour supprimer la connexion principale.`,
        },
        { status: 409 }
      );
    }

    const affectedProfileIds = deletePlan.targetProfileId
      ? [deletePlan.targetProfileId]
      : [];

    if (affectedProfileIds.length > 0) {
      const [
        { data: clientBookings, error: clientBookingsError },
        { data: providerBookings, error: providerBookingsError },
      ] = await Promise.all([
        supabaseAdmin
          .from("bookings")
          .select("id")
          .in("parent_id", affectedProfileIds)
          .in("status", ["pending", "accepted"]),
        supabaseAdmin
          .from("bookings")
          .select("id")
          .in("provider_id", affectedProfileIds)
          .in("status", ["pending", "accepted"]),
      ]);

      if (clientBookingsError) throw clientBookingsError;
      if (providerBookingsError) throw providerBookingsError;

      if (
        (clientBookings?.length ?? 0) > 0 ||
        (providerBookings?.length ?? 0) > 0
      ) {
        return NextResponse.json(
          {
            error:
              "Annule ou termine d’abord toutes les réservations actives.",
          },
          { status: 409 }
        );
      }

      const [
        { data: paidClient, error: paidClientError },
        { data: paidProvider, error: paidProviderError },
      ] = await Promise.all([
        supabaseAdmin
          .from("bookings")
          .select("id")
          .in("parent_id", affectedProfileIds)
          .eq("payment_status", "paid")
          .limit(1),
        supabaseAdmin
          .from("bookings")
          .select("id")
          .in("provider_id", affectedProfileIds)
          .eq("payment_status", "paid")
          .limit(1),
      ]);

      if (paidClientError) throw paidClientError;
      if (paidProviderError) throw paidProviderError;

      if (
        (paidClient?.length ?? 0) > 0 ||
        (paidProvider?.length ?? 0) > 0
      ) {
        return NextResponse.json(
          {
            error:
              "Ce compte contient des données de paiement qui nécessitent un traitement de suppression avec conservation limitée ou anonymisation. Utilise la page /delete-account pour initier la demande.",
          },
          { status: 409 }
        );
      }
    }

    const profilesToDisconnect = ownedProfiles.filter(
      (profile) => profile.id === deletePlan.targetProfileId
    );
    const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();

    if (stripeKey) {
      const stripe = new Stripe(stripeKey);

      for (const profile of profilesToDisconnect) {
        if (!profile.stripe_account_id) continue;

        try {
          await stripe.accounts.del(profile.stripe_account_id);
        } catch (stripeError) {
          return secureApiErrorResponse({
            error: stripeError,
            event: "account_delete_stripe_disconnect_failed",
            route: "/api/account/delete",
            method: "DELETE",
            status: 409,
            code: "KLYX_ACCOUNT_DELETE_STRIPE_BLOCKED",
            publicMessage:
              "Stripe empêche encore la suppression de ce compte prestataire.",
            startedAt,
          });
        }
      }
    }

    if (!deletePlan.targetProfileId) {
      return NextResponse.json(
        {
          error:
            `Aucun profil supprimable. Utilise ${ACCOUNT_DELETION_PAGE} pour supprimer la connexion principale.`,
        },
        { status: 409 }
      );
    }

    const { error: profileDeleteError } = await supabase.rpc(
      "klyx_delete_profile",
      {
        p_profile_id: deletePlan.targetProfileId,
      }
    );

    if (profileDeleteError) {
      return secureApiErrorResponse({
        error: profileDeleteError,
        event: "account_delete_profile_conflict",
        route: "/api/account/delete",
        method: "DELETE",
        status: 409,
        code: "KLYX_ACCOUNT_DELETE_PROFILE_BLOCKED",
        publicMessage:
          "Ce profil contient encore des données à conserver. Supprime d’abord son activité.",
        startedAt,
      });
    }

    await removeProfileAvatars(deletePlan.targetProfileId);

    if (userEmail) {
      after(async () => {
        await sendKlyxDeduplicatedEmail({
          deduplicationKey: `profile:${deletePlan.targetProfileId}:deleted:owner`,
          templateKey: "profile.deleted.owner",
          to: userEmail,
          ...profileDeletedEmail(),
        });
      });
    }

    const response = NextResponse.json({
      success: true,
      deletedScope: "profile" as const,
      remainingProfileId: deletePlan.replacementProfileId,
    });

    if (deletePlan.replacementProfileId) {
      setActiveProfileCookie(response, deletePlan.replacementProfileId);
    }

    return response;
  } catch (error) {
    return secureApiErrorResponse({
      error,
      event: "account_delete_failed",
      route: "/api/account/delete",
      method: "DELETE",
      status: 500,
      code: "KLYX_ACCOUNT_DELETE_FAILED",
      startedAt,
    });
  }
}
