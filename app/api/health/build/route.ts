import "server-only";

export const dynamic = "force-dynamic";

function normalizedSha(): string | null {
  const value = process.env.VERCEL_GIT_COMMIT_SHA?.trim().toLowerCase() ?? "";
  return /^[0-9a-f]{40}$/.test(value) ? value : null;
}

export async function GET(): Promise<Response> {
  const commitSha = normalizedSha();

  return Response.json(
    {
      ok: Boolean(commitSha),
      commitSha,
      environment: process.env.VERCEL_ENV?.trim() || null,
    },
    {
      status: commitSha ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
