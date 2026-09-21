import { getKlyxBuildReleaseSha } from "@/lib/klyx-build-release";

export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export function GET(): Response {
  return Response.json(
    {
      status: "ok",
      service: "klyx",
      check: "liveness",
      releaseSha: getKlyxBuildReleaseSha(),
    },
    {
      status: 200,
      headers: responseHeaders,
    }
  );
}

export function HEAD(): Response {
  return new Response(null, {
    status: 204,
    headers: responseHeaders,
  });
}
