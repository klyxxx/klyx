import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { GET, OPTIONS, POST } from "../../app/mcp/route";
import { KLYX_MCP_PROTOCOL_VERSION } from "../../lib/chatgpt/klyx-mcp";

function readRepoFile(file: string) {
  return fs
    .readFileSync(path.join(process.cwd(), file), "utf8")
    .replace(/\r\n/g, "\n");
}

function modernRequest(
  method: string,
  params: Record<string, unknown> = {},
  name?: string
) {
  const headers = new Headers({
    "content-type": "application/json",
    "mcp-protocol-version": KLYX_MCP_PROTOCOL_VERSION,
    "mcp-method": method,
  });

  if (name) {
    headers.set("mcp-name", name);
  }

  return new Request("https://klyx.test/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params: {
        ...params,
        _meta: {
          "io.modelcontextprotocol/protocolVersion":
            KLYX_MCP_PROTOCOL_VERSION,
          "io.modelcontextprotocol/clientInfo": {
            name: "klyx-contract-test",
            version: "1.0.0",
          },
        },
      },
    }),
  });
}

describe("KLYX ChatGPT MCP connector foundation", () => {
  it("discovers the stateless 2026 MCP server and advertises only tools", async () => {
    const response = await POST(modernRequest("server/discover"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");

    const payload = await response.json();
    expect(payload.jsonrpc).toBe("2.0");
    expect(payload.result.resultType).toBe("complete");
    expect(payload.result.supportedVersions).toEqual([
      KLYX_MCP_PROTOCOL_VERSION,
    ]);
    expect(payload.result.capabilities).toEqual({
      tools: { listChanged: false },
    });
    expect(payload.result.cacheScope).toBe("public");
    expect(payload.result.ttlMs).toBe(300_000);
    expect(payload.result._meta["io.modelcontextprotocol/serverInfo"]).toMatchObject(
      {
        name: "klyx",
        title: "KLYX",
      }
    );
  });

  it("lists one explicitly read-only, non-destructive KLYX tool", async () => {
    const response = await POST(modernRequest("tools/list"));
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.result.resultType).toBe("complete");
    expect(payload.result.tools).toHaveLength(1);
    expect(payload.result.tools[0]).toMatchObject({
      name: "klyx_health",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    });
    expect(payload.result.tools[0].inputSchema).toEqual({
      type: "object",
      properties: {},
      additionalProperties: false,
    });
  });

  it("calls klyx_health without touching private or financial state", async () => {
    const response = await POST(
      modernRequest(
        "tools/call",
        {
          name: "klyx_health",
          arguments: {},
        },
        "klyx_health"
      )
    );
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.result.resultType).toBe("complete");
    expect(payload.result.structuredContent).toEqual({
      status: "ok",
      service: "klyx",
      connector: "chatgpt",
      mode: "read_only_foundation",
    });
    expect(payload.result.content[0].text).toContain("read-only foundation");
  });

  it("fails closed for unknown tools and routing-header mismatches", async () => {
    const unknown = await POST(
      modernRequest(
        "tools/call",
        {
          name: "stripe_transfer",
          arguments: {},
        },
        "stripe_transfer"
      )
    );
    expect(unknown.status).toBe(400);
    await expect(unknown.json()).resolves.toMatchObject({
      error: { code: -32602 },
    });

    const badHeader = modernRequest("tools/list");
    const mismatched = new Request(badHeader, {
      headers: {
        ...Object.fromEntries(badHeader.headers.entries()),
        "mcp-method": "tools/call",
      },
    });
    const mismatchResponse = await POST(mismatched);
    expect(mismatchResponse.status).toBe(400);
    await expect(mismatchResponse.json()).resolves.toMatchObject({
      error: { code: -32020 },
    });
  });

  it("keeps a compatibility initialize path for older MCP clients", async () => {
    const response = await POST(
      new Request("https://klyx.test/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 7,
          method: "initialize",
          params: {
            protocolVersion: "2025-11-25",
            capabilities: {},
            clientInfo: { name: "legacy-test", version: "1.0.0" },
          },
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 7,
      result: {
        protocolVersion: "2025-11-25",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "klyx" },
      },
    });
  });

  it("exposes only POST transport and bypasses Supabase session middleware", async () => {
    const getResponse = GET();
    expect(getResponse.status).toBe(405);
    expect(getResponse.headers.get("allow")).toBe("POST, OPTIONS");

    const optionsResponse = OPTIONS();
    expect(optionsResponse.status).toBe(204);
    expect(optionsResponse.headers.get("access-control-allow-methods")).toBe(
      "POST, OPTIONS"
    );

    const proxy = readRepoFile("proxy.ts");
    const mcpIndex = proxy.indexOf('request.nextUrl.pathname === "/mcp"');
    const sessionIndex = proxy.indexOf("return updateSession(request);");
    expect(mcpIndex).toBeGreaterThanOrEqual(0);
    expect(sessionIndex).toBeGreaterThan(mcpIndex);
  });

  it("contains no private provider or financial dependency in the public foundation", () => {
    const source = readRepoFile("lib/chatgpt/klyx-mcp.ts");
    expect(source).not.toMatch(
      /stripe|supabase|service[_-]?role|private[_-]?key|secret|transfer\.create/i
    );
  });
});
