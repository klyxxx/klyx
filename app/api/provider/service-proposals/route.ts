import { NextResponse } from "next/server";
import { getActiveProfile } from "@/lib/active-profile";
import {
  createServiceSlug,
  moderateServiceProposal,
} from "@/lib/service-moderator";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase/server";

type ProposalBody = {
  proposedName?: unknown;
  category?: unknown;
  description?: unknown;
  experienceDetails?: unknown;
};

function cleanText(value: unknown, maximum: number): string {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

async function createUniqueService(name: string) {
  const baseSlug = createServiceSlug(name);

  if (!baseSlug) {
    throw new Error("Impossible de créer le lien de ce métier.");
  }

  const { data: existingByName, error: nameError } = await supabaseAdmin
    .from("services")
    .select("id, name, slug")
    .ilike("name", name)
    .maybeSingle();

  if (nameError) {
    throw new Error(nameError.message);
  }

  if (existingByName) {
    return existingByName;
  }

  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    const { data: existingSlug, error: slugError } = await supabaseAdmin
      .from("services")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (slugError) {
      throw new Error(slugError.message);
    }

    if (!existingSlug) break;

    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const { data, error } = await supabaseAdmin
    .from("services")
    .insert({ name, slug })
    .select("id, name, slug")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  const profile = await getActiveProfile();

  if (!profile || profile.accountType !== "provider") {
    return NextResponse.json(
      { error: "Un profil prestataire actif est obligatoire." },
      { status: 403 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("service_proposals")
    .select(
      "id, proposed_name, category, description, experience_details, status, admin_note, created_at, reviewed_at"
    )
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Impossible de charger les propositions de métiers." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    proposals: (data ?? []).map((proposal) => ({
      id: proposal.id,
      proposedName: proposal.proposed_name,
      category: proposal.category,
      description: proposal.description,
      experienceDetails: proposal.experience_details,
      status: proposal.status,
      adminNote: proposal.admin_note,
      createdAt: proposal.created_at,
      reviewedAt: proposal.reviewed_at,
    })),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  const profile = await getActiveProfile();

  if (!profile || profile.accountType !== "provider") {
    return NextResponse.json(
      { error: "Un profil prestataire actif est obligatoire." },
      { status: 403 }
    );
  }

  let body: ProposalBody;

  try {
    body = (await request.json()) as ProposalBody;
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const proposedName = cleanText(body.proposedName, 100);
  const category = cleanText(body.category, 80);
  const description = cleanText(body.description, 800);
  const experienceDetails = cleanText(body.experienceDetails, 500);

  if (proposedName.length < 3) {
    return NextResponse.json(
      { error: "Le nom du métier doit contenir au moins 3 caractères." },
      { status: 400 }
    );
  }

  if (category.length < 2) {
    return NextResponse.json(
      { error: "Choisis une catégorie." },
      { status: 400 }
    );
  }

  if (description.length < 30) {
    return NextResponse.json(
      { error: "Décris ce métier en au moins 30 caractères." },
      { status: 400 }
    );
  }

  const { data: duplicate, error: duplicateError } = await supabaseAdmin
    .from("service_proposals")
    .select("id")
    .eq("profile_id", profile.id)
    .eq("status", "pending")
    .ilike("proposed_name", proposedName)
    .maybeSingle();

  if (duplicateError) {
    return NextResponse.json(
      { error: "Impossible de vérifier les propositions existantes." },
      { status: 500 }
    );
  }

  if (duplicate) {
    return NextResponse.json(
      { error: "Ce métier est déjà en attente de validation." },
      { status: 409 }
    );
  }

  const moderation = moderateServiceProposal({
    proposedName,
    category,
    description,
    experienceDetails,
  });

  let service: { id: string; name: string; slug: string } | null = null;

  if (moderation.decision === "approved") {
    try {
      service = await createUniqueService(proposedName);
    } catch {
      return NextResponse.json(
        { error: "Le métier est valide, mais son ajout au catalogue a échoué." },
        { status: 500 }
      );
    }
  }

  const reviewedAt =
    moderation.decision === "pending" ? null : new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("service_proposals")
    .insert({
      profile_id: profile.id,
      proposed_name: proposedName,
      category,
      description,
      experience_details: experienceDetails || null,
      status: moderation.decision,
      admin_note: `Modérateur automatique KLYX : ${moderation.reason}`,
      reviewed_at: reviewedAt,
    })
    .select(
      "id, proposed_name, category, description, experience_details, status, admin_note, created_at, reviewed_at"
    )
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Impossible d’enregistrer cette proposition." },
      { status: 500 }
    );
  }

  const publicMessage =
    moderation.decision === "approved"
      ? "Métier approuvé automatiquement et ajouté au catalogue KLYX."
      : moderation.decision === "rejected"
        ? "Ce métier ne peut pas être proposé sur KLYX."
        : "Le métier reste masqué car le modérateur automatique n’est pas assez certain.";

  return NextResponse.json(
    {
      proposal: {
        id: data.id,
        proposedName: data.proposed_name,
        category: data.category,
        description: data.description,
        experienceDetails: data.experience_details,
        status: data.status,
        adminNote: data.admin_note,
        createdAt: data.created_at,
        reviewedAt: data.reviewed_at,
      },
      moderation: {
        decision: moderation.decision,
        confidence: moderation.confidence,
        message: publicMessage,
      },
      service,
    },
    { status: 201 }
  );
}
