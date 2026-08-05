import { NextResponse } from "next/server";
import { getActiveProfile } from "@/lib/active-profile";
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

  const { data, error } = await supabase
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

  const { data: duplicate } = await supabase
    .from("service_proposals")
    .select("id")
    .eq("profile_id", profile.id)
    .eq("status", "pending")
    .ilike("proposed_name", proposedName)
    .maybeSingle();

  if (duplicate) {
    return NextResponse.json(
      { error: "Ce métier est déjà en attente de validation." },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("service_proposals")
    .insert({
      profile_id: profile.id,
      proposed_name: proposedName,
      category,
      description,
      experience_details: experienceDetails || null,
    })
    .select(
      "id, proposed_name, category, description, experience_details, status, admin_note, created_at, reviewed_at"
    )
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Impossible d’envoyer cette proposition." },
      { status: 500 }
    );
  }

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
    },
    { status: 201 }
  );
}
