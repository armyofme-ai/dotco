import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { toolDefinitions, dispatchTool, ToolError } from "./tools";
import bcrypt from "bcryptjs";

// ─── Types ──────────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// ─── Helpers ────────────────────────────────────────────────────────

function jsonRpcSuccess(
  id: string | number | null,
  result: unknown
): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message, ...(data !== undefined ? { data } : {}) } };
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

// ─── Auth ───────────────────────────────────────────────────────────

interface AuthResult {
  authenticated: boolean;
  organizationId?: string;
}

async function authenticate(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return { authenticated: false };

  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return { authenticated: false };

  // Fetch all API keys (across all orgs, since we don't know which org yet)
  const apiKeys = await prisma.apiKey.findMany({
    select: {
      id: true,
      keyHash: true,
      organizationId: true,
    },
  });

  for (const apiKey of apiKeys) {
    const match = await bcrypt.compare(token, apiKey.keyHash);
    if (match) {
      // Update lastUsedAt (fire and forget)
      prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      }).catch(() => {});

      return {
        authenticated: true,
        organizationId: apiKey.organizationId,
      };
    }
  }

  return { authenticated: false };
}

// ─── Handler ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Auth check
  const authResult = await authenticate(request);
  if (!authResult.authenticated || !authResult.organizationId) {
    return Response.json(
      jsonRpcError(null, -32000, "Unauthorized: invalid or missing API key"),
      { status: 401, headers: corsHeaders() }
    );
  }

  const orgId = authResult.organizationId;

  let body: JsonRpcRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      jsonRpcError(null, -32700, "Parse error: invalid JSON"),
      { status: 400, headers: corsHeaders() }
    );
  }

  // Validate JSON-RPC structure
  if (body.jsonrpc !== "2.0" || !body.method) {
    return Response.json(
      jsonRpcError(body.id ?? null, -32600, "Invalid JSON-RPC request"),
      { status: 400, headers: corsHeaders() }
    );
  }

  const id = body.id ?? null;

  try {
    switch (body.method) {
      // ── initialize ──────────────────────────────────────────
      case "initialize": {
        return Response.json(
          jsonRpcSuccess(id, {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: {
              name: "dotco-mcp",
              version: "1.0.0",
            },
          }),
          { headers: corsHeaders() }
        );
      }

      // ── notifications/initialized (client notification, no response needed) ──
      case "notifications/initialized": {
        // Notifications have no id and expect no response, but we send
        // an empty 200 to keep the HTTP transport happy.
        return new Response(null, { status: 204, headers: corsHeaders() });
      }

      // ── tools/list ──────────────────────────────────────────
      case "tools/list": {
        return Response.json(
          jsonRpcSuccess(id, { tools: toolDefinitions }),
          { headers: corsHeaders() }
        );
      }

      // ── tools/call ──────────────────────────────────────────
      case "tools/call": {
        const params = body.params as
          | { name: string; arguments?: Record<string, unknown> }
          | undefined;

        if (!params?.name) {
          return Response.json(
            jsonRpcError(id, -32602, "Missing tool name in params"),
            { status: 400, headers: corsHeaders() }
          );
        }

        const toolArgs = params.arguments ?? {};

        try {
          const result = await dispatchTool(
            params.name,
            toolArgs,
            prisma,
            orgId
          );

          return Response.json(
            jsonRpcSuccess(id, {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2),
                },
              ],
            }),
            { headers: corsHeaders() }
          );
        } catch (err) {
          if (err instanceof ToolError) {
            return Response.json(
              jsonRpcSuccess(id, {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({ error: err.message }),
                  },
                ],
                isError: true,
              }),
              { headers: corsHeaders() }
            );
          }
          throw err;
        }
      }

      // ── Unknown method ──────────────────────────────────────
      default: {
        return Response.json(
          jsonRpcError(id, -32601, `Method not found: ${body.method}`),
          { status: 400, headers: corsHeaders() }
        );
      }
    }
  } catch (err) {
    console.error("MCP server error:", err);
    return Response.json(
      jsonRpcError(id, -32603, "Internal server error"),
      { status: 500, headers: corsHeaders() }
    );
  }
}

// ─── GET for transport discovery ────────────────────────────────────
// mcp-remote tries GET first to discover OAuth/SSE. Return a proper
// JSON response so it falls back to HTTP POST transport.

export async function GET() {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32600, message: "Use POST for JSON-RPC requests" } },
    { status: 405, headers: { ...corsHeaders(), Allow: "POST, OPTIONS" } }
  );
}

// ─── OPTIONS for CORS preflight ─────────────────────────────────────

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
