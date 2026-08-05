import { NextResponse } from "next/server";
import { getActiveProfile } from "@/lib/active-profile";
import {
  generateKlyxAiReply,
  isKlyxAiEnabled,
} from "@/lib/klyx-ai";
import { createClient } from "@/lib/supabase/server";

type RequestBody = {
  message?: unknown;
};

export async function GET() {
  return NextResponse.json({
    enabled: isKlyxAiEnabled(),
    mode: isKlyxAiEnabled() ? "openai" : "fallback",
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Non connecté." },
      { status: 401 }
    );
  }

  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      { error: "Requête invalide." },
      { status: 400 }
    );
  }

  const message =
    typeof body.message === "string" ? body.message.trim() : "";

  if (!message) {
    return NextResponse.json(
      { error: "Écris un message." },
      { status: 400 }
    );
  }

  if (message.length > 4000) {
    return NextResponse.json(
      { error: "Le message est trop long." },
      { status: 400 }
    );
  }

  const profile = await getActiveProfile();

  const reply = await generateKlyxAiReply({
    message,
    firstName: profile?.firstName,
    city: profile?.city,
    accountType: profile?.accountType,
  });

  return NextResponse.json({
    reply: reply.text,
    mode: reply.mode,
  });
}
