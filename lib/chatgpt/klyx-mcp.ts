export const KLYX_MCP_PROTOCOL_VERSION = "2026-07-28";
export const KLYX_MCP_LEGACY_PROTOCOL_VERSION = "2025-11-25";

const KLYX_MCP_SERVER_INFO = {
  name: "klyx",
  title: "KLYX",
  version: "0.1.0",
  websiteUrl: "https://klyx-ten.vercel.app",
  description:
    "KLYX assistant connector for everyday-service orchestration.",
};

const KLYX_MCP_INSTRUCTIONS =
  "This KLYX connector foundation is read-only. Use klyx_health only to verify that the KLYX MCP endpoint is reachable. Do not claim access to private accounts, bookings, payments, provider data, or financial mutations.";

const KLYX_HEALTH_TOOL = {
  name: "klyx_health",
  title: "KLYX connection status",
  description:
    "Check whether the public KLYX MCP connector endpoint is reachable. This does not inspect private account data or financial systems.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["ok"] },
      service: { type: "string", enum: ["klyx"] },
      connector: { type: "string", enum: ["chatgpt"] },
      mode: { type: "string", enum: ["read_only_foundation"] },
    },
    required: ["status", "service", "connector", "mode"],
    additionalProperties: false,
  },
  annotations: {
    title: "KLYX connection status",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

type JsonRpcId = string | number | null;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function responseHeaders() {
  return {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  };
}

function jsonRpcResult(id: JsonRpcId, result: JsonRecord, status = 200) {
  return Response.json(
    {
      jsonrpc: "2.0",
      id,
      result,
    },
    {
      status,
      headers: responseHeaders(),
    }
  );
}

function jsonRpcError(
  id: JsonRpcId,
  code: number,
  message: string,
  status = 400,
  data?: JsonRecord
) {
  return Response.json(
    {
      jsonrpc: "2.0",
      id,
      error: {
        code,
        message,
        ...(data ? { data } : {}),
      },
    },
    {
      status,
      headers: responseHeaders(),
    }
  );
}

function getId(body: JsonRecord): JsonRpcId {
  const id = body.id;
  if (typeof id === "string" || typeof id === "number" || id === null) {
    return id;
  }
  return null;
}

function getMethod(body: JsonRecord) {
  return typeof body.method === "string" ? body.method : null;
}

function getParams(body: JsonRecord) {
  return isRecord(body.params) ? body.params : {};
}

function modernResult(result: JsonRecord) {
  return {
    ...result,
    resultType: "complete",
    _meta: {
      "io.modelcontextprotocol/serverInfo": KLYX_MCP_SERVER_INFO,
    },
  };
}

function isModernRequest(request: Request, method: string, params: JsonRecord) {
  if (method === "server/discover") {
    return true;
  }

  if (
    request.headers.get("mcp-protocol-version") === KLYX_MCP_PROTOCOL_VERSION
  ) {
    return true;
  }

  const meta = isRecord(params._meta) ? params._meta : null;
  return (
    meta?.["io.modelcontextprotocol/protocolVersion"] ===
    KLYX_MCP_PROTOCOL_VERSION
  );
}

function validateModernRoutingHeaders(
  request: Request,
  method: string,
  params: JsonRecord
): Response | null {
  const protocolHeader = request.headers.get("mcp-protocol-version");
  const methodHeader = request.headers.get("mcp-method");
  const nameHeader = request.headers.get("mcp-name");

  if (
    protocolHeader !== null &&
    protocolHeader !== KLYX_MCP_PROTOCOL_VERSION
  ) {
    return jsonRpcError(
      null,
      -32022,
      "Unsupported MCP protocol version.",
      400,
      { supportedVersions: [KLYX_MCP_PROTOCOL_VERSION] }
    );
  }

  if (methodHeader !== null && methodHeader !== method) {
    return jsonRpcError(null, -32020, "Mcp-Method header mismatch.");
  }

  if (method === "tools/call") {
    const requestedName =
      typeof params.name === "string" ? params.name : undefined;
    if (nameHeader !== null && nameHeader !== requestedName) {
      return jsonRpcError(null, -32020, "Mcp-Name header mismatch.");
    }
  }

  return null;
}

function healthToolResult(modern: boolean) {
  const structuredContent = {
    status: "ok",
    service: "klyx",
    connector: "chatgpt",
    mode: "read_only_foundation",
  } as const;

  const result = {
    content: [
      {
        type: "text",
        text: "KLYX MCP connector is reachable in read-only foundation mode.",
      },
    ],
    structuredContent,
  };

  return modern ? modernResult(result) : result;
}

export async function handleKlyxMcpRequest(request: Request): Promise<Response> {
  let parsed: unknown;

  try {
    parsed = await request.json();
  } catch {
    return jsonRpcError(null, -32700, "Invalid JSON payload.");
  }

  if (!isRecord(parsed) || parsed.jsonrpc !== "2.0") {
    return jsonRpcError(null, -32600, "Invalid JSON-RPC request.");
  }

  const method = getMethod(parsed);
  if (!method) {
    return jsonRpcError(getId(parsed), -32600, "Missing JSON-RPC method.");
  }

  const params = getParams(parsed);
  const id = getId(parsed);

  if (method === "notifications/initialized" || method === "notifications/cancelled") {
    return new Response(null, {
      status: 202,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const modern = isModernRequest(request, method, params);
  if (modern) {
    const routingError = validateModernRoutingHeaders(request, method, params);
    if (routingError) {
      return routingError;
    }
  }

  if (method === "server/discover") {
    return jsonRpcResult(
      id,
      modernResult({
        supportedVersions: [KLYX_MCP_PROTOCOL_VERSION],
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
        instructions: KLYX_MCP_INSTRUCTIONS,
        ttlMs: 300_000,
        cacheScope: "public",
      })
    );
  }

  if (method === "initialize") {
    const requestedProtocol =
      typeof params.protocolVersion === "string"
        ? params.protocolVersion
        : KLYX_MCP_LEGACY_PROTOCOL_VERSION;

    return jsonRpcResult(id, {
      protocolVersion: requestedProtocol,
      capabilities: {
        tools: {
          listChanged: false,
        },
      },
      serverInfo: KLYX_MCP_SERVER_INFO,
      instructions: KLYX_MCP_INSTRUCTIONS,
    });
  }

  if (method === "ping") {
    return jsonRpcResult(id, modern ? modernResult({}) : {});
  }

  if (method === "tools/list") {
    const result = {
      tools: [KLYX_HEALTH_TOOL],
      ...(modern
        ? {
            ttlMs: 300_000,
            cacheScope: "public",
          }
        : {}),
    };

    return jsonRpcResult(id, modern ? modernResult(result) : result);
  }

  if (method === "tools/call") {
    const name = typeof params.name === "string" ? params.name : null;

    if (name !== KLYX_HEALTH_TOOL.name) {
      return jsonRpcError(id, -32602, "Unknown KLYX MCP tool.", 400, {
        tool: name ?? "",
      });
    }

    const args = isRecord(params.arguments) ? params.arguments : {};
    if (Object.keys(args).length > 0) {
      return jsonRpcError(id, -32602, "klyx_health accepts no arguments.");
    }

    return jsonRpcResult(id, healthToolResult(modern));
  }

  return jsonRpcError(id, -32601, "Method not found.", 404);
}
