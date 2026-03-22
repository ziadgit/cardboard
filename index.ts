import { Type } from "@sinclair/typebox";
import { buildKnowledgeGraph } from "./src/aggregate.js";
import { fetchHyperspellSnapshot } from "./src/hyperspell-client.js";
import { renderGalaxyHtml } from "./src/html.js";
import type { KnowledgeGraph, PluginSettings } from "./src/types.js";

const PLUGIN_ID = "openclaw-hyperspell-knowledge-3d";

interface CacheRecord {
  graph: KnowledgeGraph;
  createdAtMs: number;
}

const graphCache = new Map<string, CacheRecord>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function randomToken(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function cleanupCache(): void {
  const now = Date.now();
  for (const [k, rec] of graphCache.entries()) {
    if (now - rec.createdAtMs > CACHE_TTL_MS) {
      graphCache.delete(k);
    }
  }
}

function getPluginSettings(api: any): PluginSettings {
  const pluginCfg = api?.config?.plugins?.entries?.[PLUGIN_ID]?.config ?? {};
  return {
    apiKey: typeof pluginCfg.apiKey === "string" && pluginCfg.apiKey.trim() ? pluginCfg.apiKey.trim() : undefined,
    defaultUserId:
      typeof pluginCfg.defaultUserId === "string" && pluginCfg.defaultUserId.trim()
        ? pluginCfg.defaultUserId.trim()
        : undefined,
    apiBase: typeof pluginCfg.apiBase === "string" && pluginCfg.apiBase.trim() ? pluginCfg.apiBase.trim() : "https://api.hyperspell.com",
    lookbackDays:
      typeof pluginCfg.lookbackDays === "number" && Number.isFinite(pluginCfg.lookbackDays)
        ? Math.max(1, Math.min(3650, Math.round(pluginCfg.lookbackDays)))
        : 180,
    maxDocs:
      typeof pluginCfg.maxDocs === "number" && Number.isFinite(pluginCfg.maxDocs)
        ? Math.max(50, Math.min(5000, Math.round(pluginCfg.maxDocs)))
        : 800,
    imageKeywordBoost:
      typeof pluginCfg.imageKeywordBoost === "number" && Number.isFinite(pluginCfg.imageKeywordBoost)
        ? Math.max(0, Math.min(10, pluginCfg.imageKeywordBoost))
        : 1.5,
  };
}

function resolveSenderId(params: any, callId: string, context: any, defaultUserId?: string): string {
  if (typeof params?.senderId === "string" && params.senderId.trim()) {
    return params.senderId.trim();
  }
  const candidates = [
    context?.senderId,
    context?.sender?.id,
    context?.requesterSenderId,
    context?.runtimeScope?.requesterSenderId,
    context?.chat?.senderId,
    context?.session?.senderId,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      return c;
    }
  }
  if (typeof defaultUserId === "string" && defaultUserId.trim()) {
    return defaultUserId.trim();
  }
  return callId;
}

function sendJson(res: any, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export default function register(api: any) {
  api.registerTool({
      name: "hyperspell_knowledge_viz",
      description: "Build and open 3D knowledge galaxy for Hyperspell memories and images",
      parameters: Type.Object({
        command: Type.Optional(Type.String()),
        commandName: Type.Optional(Type.String()),
        skillName: Type.Optional(Type.String()),
        senderId: Type.Optional(Type.String()),
        lookbackDays: Type.Optional(Type.Integer({ minimum: 1, maximum: 3650 })),
        maxDocs: Type.Optional(Type.Integer({ minimum: 50, maximum: 5000 })),
      }),
      async execute(callId: string, params: Record<string, unknown>, context: any) {
        cleanupCache();
        const base = getPluginSettings(api);
        const senderId = resolveSenderId(params, callId, context, base.defaultUserId);
        const settings: PluginSettings = {
          ...base,
          lookbackDays:
            typeof params.lookbackDays === "number" && Number.isFinite(params.lookbackDays)
              ? Math.max(1, Math.min(3650, Math.round(params.lookbackDays)))
              : base.lookbackDays,
          maxDocs:
            typeof params.maxDocs === "number" && Number.isFinite(params.maxDocs)
              ? Math.max(50, Math.min(5000, Math.round(params.maxDocs)))
              : base.maxDocs,
        };

        const snapshot = await fetchHyperspellSnapshot(senderId, settings);
        const graph = buildKnowledgeGraph(senderId, snapshot.memories, snapshot.statusByProvider, settings);
        const token = randomToken();
        graphCache.set(token, { graph, createdAtMs: Date.now() });

        const basePath = "/plugins/hyperspell-knowledge-3d";
        const url = `${basePath}?token=${encodeURIComponent(token)}`;
        const msg = [
          `Knowledge galaxy ready for sender: ${senderId}`,
          `Memories: ${graph.metrics.totalMemories}, image memories: ${graph.metrics.imageMemories}`,
          `Open dashboard: ${url}`,
        ].join("\n");

        return {
          content: [{ type: "text", text: msg }],
        };
      },
    }, { optional: false });

  api.registerHttpRoute({
      path: "/plugins/hyperspell-knowledge-3d",
      auth: "gateway",
      match: "exact",
      handler: async (req: any, res: any) => {
        const reqUrl = new URL(req.url, "http://localhost");
        const token = reqUrl.searchParams.get("token") ?? "";
        if (!token || !graphCache.has(token)) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end("<h1>Visualization not found</h1><p>Run hyperspell_knowledge_viz first.</p>");
          return true;
        }
        const html = renderGalaxyHtml(`/plugins/hyperspell-knowledge-3d/data?token=${encodeURIComponent(token)}`);
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(html);
        return true;
      },
    });

  api.registerHttpRoute({
      path: "/plugins/hyperspell-knowledge-3d/data",
      auth: "gateway",
      match: "exact",
      handler: async (req: any, res: any) => {
        const reqUrl = new URL(req.url, "http://localhost");
        const token = reqUrl.searchParams.get("token") ?? "";
        const rec = graphCache.get(token);
        if (!token || !rec) {
          sendJson(res, 404, { error: "not_found", message: "No graph data for token" });
          return true;
        }
        sendJson(res, 200, rec.graph);
        return true;
      },
  });
}
