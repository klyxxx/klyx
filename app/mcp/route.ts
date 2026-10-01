import { handleKlyxMcpRequest } from "@/lib/chatgpt/klyx-mcp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const baseHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function POST(request: Request) {
  return handleKlyxMcpRequest(request);
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...baseHeaders,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, MCP-Protocol-Version, Mcp-Method, Mcp-Name, Traceparent, Tracestate, Baggage",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export function GET() {
  return Response.json(
    {
      error: "method_not_allowed",
      endpoint: "/mcp",
      transport: "streamable-http",
    },
    {
      status: 405,
      headers: {
        ...baseHeaders,
        Allow: "POST, OPTIONS",
      },
    }
  );
}
