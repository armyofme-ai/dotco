import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { toolDefinitions, dispatchTool, ToolError } from "./tools";

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

function authenticate(request: NextRequest): boolean {
  const apiKey = process.env.MCP_API_KEY;
  if (!apiKey) return false;

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return false;

  return token === apiKey;
}

// ─── Resolve org (single-tenant: use first org) ────────────────────

async function getOrgId(): Promise<string> {
  const org = await prisma.organization.findFirst({
    select: { id: true },
  });
  if (!org) throw new Error("No organization found");
  return org.id;
}

// ─── Handler ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Auth check
  if (!authenticate(request)) {
    return Response.json(
      jsonRpcError(null, -32000, "Unauthorized: invalid or missing API key"),
      { status: 401, headers: corsHeaders() }
    );
  }

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

        const orgId = await getOrgId();
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

// ─── OPTIONS for CORS preflight ─────────────────────────────────────

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
