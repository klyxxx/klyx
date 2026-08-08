import { NextResponse } from "next/server";
import {
  adminErrorStatus,
  requireKlyxAdmin,
} from "@/lib/admin-auth";

export async function GET() {
  try {
    const admin = await requireKlyxAdmin();

    return NextResponse.json({
      isAdmin: true,
      userId: admin.id,
      mode: "observer",
      decisionAuthority: "external_verifier",
    });
  } catch (error) {
    return NextResponse.json(
      {
        isAdmin: false,
        error:
          error instanceof Error
            ? error.message
            : "Accès administrateur refusé.",
      },
      { status: adminErrorStatus(error) }
    );
  }
}
