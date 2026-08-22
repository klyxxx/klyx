import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HEALTH_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
} as const;

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "klyx",
      check: "liveness",
    },
    {
      status: 200,
      headers: HEALTH_HEADERS,
    }
  );
}

export function HEAD() {
  return new Response(null, {
    status: 204,
    headers: HEALTH_HEADERS,
  });
}
