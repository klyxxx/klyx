import { NextResponse } from "next/server";
import { adminErrorStatus, requireKlyxAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

type ReviewBody = {
  proposalId?: unknown;
  action?: unknown;
  adminNote?: unknown;
};

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function GET() {
  try {
    await requireKlyxAdmin();

    const { data, error } = await supabaseAdmin
      .from("service_proposals")
      .select(
        "id, profile_id, proposed_name, category, description, experience_details, status, admin_note, created_at, reviewed_at, profiles(first_name, last_name, city)"
      )
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json({ proposals: data ?? [] });
  } catch (error) {
    const status = adminErrorStatus(error);

    return NextResponse.json(
      {
        error:
          status === 401
            ? "Non connecté."
            : status === 403
              ? "Accès administrateur refusé."
              : "Impossible de charger les propositions.",
      },
      { status }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    await requireKlyxAdmin();

    const body = (await request.json()) as ReviewBody;
    const proposalId =
      typeof body.proposalId === "string" ? body.proposalId.trim() : "";
    const action =
      body.action === "approve" || body.action === "reject"
        ? body.action
        : null;
    const adminNote =
      typeof body.adminNote === "string"
        ? body.adminNote.trim().slice(0, 500)
        : "";

    if (!proposalId || !action) {
      return NextResponse.json(
        { error: "Proposition ou action invalide." },
        { status: 400 }
      );
    }

    if (action === "reject" && adminNote.length < 5) {
      return NextResponse.json(
        { error: "Explique brièvement la raison du refus." },
        { status: 400 }
      );
    }

    const { data: proposal, error: proposalError } = await supabaseAdmin
      .from("service_proposals")
      .select("id, proposed_name, status")
      .eq("id", proposalId)
      .maybeSingle();

    if (proposalError) throw new Error(proposalError.message);

    if (!proposal) {
      return NextResponse.json(
        { error: "Proposition introuvable." },
        { status: 404 }
      );
    }

    if (proposal.status !== "pending") {
      return NextResponse.json(
        { error: "Cette proposition a déjà été examinée." },
        { status: 409 }
      );
    }

    let service: { id: string; name: string; slug: string } | null = null;

    if (action === "approve") {
      const baseSlug = slugify(proposal.proposed_name);
      let slug = baseSlug;
      let suffix = 2;

      while (true) {
        const { data: existing, error: existingError } = await supabaseAdmin
          .from("services")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();

        if (existingError) throw new Error(existingError.message);
        if (!existing) break;

        slug = `${baseSlug}-${suffix}`;
        suffix += 1;
      }

      const { data: createdService, error: serviceError } =
        await supabaseAdmin
          .from("services")
          .insert({ name: proposal.proposed_name, slug })
          .select("id, name, slug")
          .single();

      if (serviceError) throw new Error(serviceError.message);
      service = createdService;
    }

    const { data: reviewed, error: reviewError } = await supabaseAdmin
      .from("service_proposals")
      .update({
        status: action === "approve" ? "approved" : "rejected",
        admin_note: adminNote || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", proposalId)
      .eq("status", "pending")
      .select("id, status, admin_note, reviewed_at")
      .maybeSingle();

    if (reviewError) throw new Error(reviewError.message);

    return NextResponse.json({ success: true, review: reviewed, service });
  } catch (error) {
    const status = adminErrorStatus(error);

    return NextResponse.json(
      {
        error:
          status === 401
            ? "Non connecté."
            : status === 403
              ? "Accès administrateur refusé."
              : error instanceof Error
                ? error.message
                : "Impossible d’examiner cette proposition.",
      },
      { status }
    );
  }
}
