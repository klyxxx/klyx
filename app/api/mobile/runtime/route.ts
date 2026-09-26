import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const stripePublishableKey =
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";

  return NextResponse.json(
    {
      apiVersion: 1,
      stripePublishableKey:
        stripePublishableKey.startsWith("pk_") ? stripePublishableKey : null,
      integrations: {
        supabase: true,
        stripe: true,
        sumsub: true,
        twilio: true,
        resend: true,
        tolgee: true,
      },
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
