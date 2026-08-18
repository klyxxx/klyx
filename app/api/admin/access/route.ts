import { NextResponse } from "next/server";
import {
  adminErrorPublicMessage,
  adminErrorStatus,
  requireKlyxAdmin,
} from "@/lib/admin-auth";
import { secureApiErrorResponse } from "@/lib/api-error";

export async function GET() {
  const startedAt = Date.now();

  try {
    const admin = await requireKlyxAdmin();

    return NextResponse.json({
      isAdmin: true,
      userId: admin.id,
      mode: "observer",
      decisionAuthority: "external_verifier",
    });
  } catch (error) {
    const status = adminErrorStatus(error);

    return secureApiErrorResponse({
      error,
      event: "admin_access_failed",
      route: "/api/admin/access",
      method: "GET",
      status,
      code: "KLYX_ADMIN_ACCESS_FAILED",
      publicMessage: adminErrorPublicMessage(status),
      startedAt,
      details: {
        isAdmin: false,
      },
    });
  }
}
