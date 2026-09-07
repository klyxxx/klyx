import type { NextRequest } from "next/server";

import {
  isKlyxElmahHeartbeatConfigured,
  sendKlyxElmahHeartbeat,
} from "@/lib/elmah-io";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  if (!isKlyxElmahHeartbeatConfigured()) {
    return new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }

  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }

  if (
    request.headers.get("authorization") !==
    `Bearer ${cronSecret}`
  ) {
    return Response.json(
      { ok: false },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const delivered = await sendKlyxElmahHeartbeat();

  return Response.json(
    { ok: delivered },
    {
      status: delivered ? 200 : 502,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
