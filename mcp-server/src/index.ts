import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import * as http from "node:http";
import * as https from "node:https";
import * as fs from "node:fs";
import { loadStore } from "./data-store.js";
import { catalogTools } from "./tools/catalog.js";
import { customerTools } from "./tools/customers.js";
import { campaignTools } from "./tools/campaigns.js";
import { channelTools } from "./tools/channels.js";
import { analyticsTools } from "./tools/analytics.js";
import { personalizationTools } from "./tools/personalization.js";
import { behavioralTools } from "./tools/behavioral.js";

function createMcpServer() {
  const server = new Server(
    { name: "wine-marketing-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  const allTools = [
    ...catalogTools,
    ...customerTools,
    ...campaignTools,
    ...channelTools,
    ...analyticsTools,
    ...personalizationTools,
    ...behavioralTools,
  ];

  const toolMap = new Map(allTools.map(t => [t.name, t]));

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const tool = toolMap.get(request.params.name);
    if (!tool) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `Unknown tool: ${request.params.name}` }) }],
        isError: true,
      };
    }
    try {
      const args = (request.params.arguments || {}) as Record<string, unknown>;
      return await tool.handler(args);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: JSON.stringify({ error: msg }) }],
        isError: true,
      };
    }
  });

  return { server, toolCount: allTools.length };
}

function makeRequestHandler() {
  return async (req: http.IncomingMessage, res: http.ServerResponse) => {
    if (req.url !== "/mcp" && req.url !== "/") {
      res.writeHead(404).end();
      return;
    }

    const { server } = createMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);

    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", async () => {
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
      await transport.handleRequest(req, res, body);
    });
  };
}

async function startHttps(port: number) {
  const { toolCount } = createMcpServer();

  const certPath = "localhost+1.pem";
  const keyPath = "localhost+1-key.pem";

  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    throw new Error(
      `TLS certificate not found. Run: mkcert localhost 127.0.0.1\n` +
      `in the mcp-server/ directory, then re-run this server.`
    );
  }

  const httpsServer = https.createServer(
    { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) },
    makeRequestHandler()
  );

  await new Promise<void>(resolve => httpsServer.listen(port, "0.0.0.0", resolve));
  console.error(`[wine-marketing-mcp] Registered ${toolCount} tools across 7 domains`);
  console.error(`[wine-marketing-mcp] Server ready — HTTPS on port ${port}`);
}

async function startHttp(port: number) {
  const { toolCount } = createMcpServer();
  const httpServer = http.createServer(makeRequestHandler());
  await new Promise<void>(resolve => httpServer.listen(port, "0.0.0.0", resolve));
  console.error(`[wine-marketing-mcp] Registered ${toolCount} tools across 7 domains`);
  console.error(`[wine-marketing-mcp] Server ready — HTTP on port ${port}`);
}

async function startStdio() {
  const { server, toolCount } = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[wine-marketing-mcp] Registered ${toolCount} tools across 7 domains`);
  console.error("[wine-marketing-mcp] Server ready — listening on stdio");
}

async function main() {
  loadStore();

  const httpsPort = process.env.MCP_HTTPS_PORT ? parseInt(process.env.MCP_HTTPS_PORT) : null;
  const httpPort = process.env.MCP_HTTP_PORT ? parseInt(process.env.MCP_HTTP_PORT) : null;

  if (httpsPort) {
    await startHttps(httpsPort);
  } else if (httpPort) {
    await startHttp(httpPort);
  } else if (process.stdin.isTTY) {
    // Interactive terminal — default to HTTPS on 3101
    await startHttps(3101);
  } else {
    // Piped stdin — stdio transport (for claude_desktop_config.json)
    await startStdio();
  }
}

main().catch(err => {
  console.error("[wine-marketing-mcp] Fatal error:", err);
  process.exit(1);
});
