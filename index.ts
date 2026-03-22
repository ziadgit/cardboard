import { Type } from "@sinclair/typebox";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
const DISK_CACHE_DIR = join(tmpdir(), "openclaw-hyperspell-viz3d");

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

function tokenFilePath(token: string): string {
  return join(DISK_CACHE_DIR, `${token}.json`);
}

async function writeDiskCache(token: string, graph: KnowledgeGraph, createdAtMs: number): Promise<void> {
  await mkdir(DISK_CACHE_DIR, { recursive: true });
  const payload = { graph, createdAtMs };
  await writeFile(tokenFilePath(token), JSON.stringify(payload), "utf8");
}

async function readDiskCache(token: string): Promise<CacheRecord | null> {
  try {
    const raw = await readFile(tokenFilePath(token), "utf8");
    const parsed = JSON.parse(raw) as { graph?: KnowledgeGraph; createdAtMs?: number };
    if (!parsed || !parsed.graph || typeof parsed.createdAtMs !== "number") {
      return null;
    }
    if (Date.now() - parsed.createdAtMs > CACHE_TTL_MS) {
      await rm(tokenFilePath(token), { force: true });
      return null;
    }
    return { graph: parsed.graph, createdAtMs: parsed.createdAtMs };
  } catch {
    return null;
  }
}

async function cleanupDiskCache(): Promise<void> {
  try {
    const entries = await readdir(DISK_CACHE_DIR);
    const now = Date.now();
    for (const name of entries) {
      if (!name.endsWith(".json")) {
        continue;
      }
      const file = join(DISK_CACHE_DIR, name);
      try {
        const st = await stat(file);
        if (now - st.mtimeMs > CACHE_TTL_MS) {
          await rm(file, { force: true });
        }
      } catch {
        // ignore cache cleanup errors
      }
    }
  } catch {
    // ignore cache cleanup errors
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
    apiBase:
      typeof pluginCfg.apiBase === "string" && pluginCfg.apiBase.trim() ? pluginCfg.apiBase.trim() : "https://api.hyperspell.com",
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

async function buildAndCacheGraph(
  api: any,
  senderId: string,
  overrides?: { lookbackDays?: number; maxDocs?: number },
): Promise<{ graph: KnowledgeGraph; token: string; url: string }> {
  cleanupCache();
  await cleanupDiskCache();
  const base = getPluginSettings(api);
  const settings: PluginSettings = {
    ...base,
    lookbackDays:
      typeof overrides?.lookbackDays === "number" && Number.isFinite(overrides.lookbackDays)
        ? Math.max(1, Math.min(3650, Math.round(overrides.lookbackDays)))
        : base.lookbackDays,
    maxDocs:
      typeof overrides?.maxDocs === "number" && Number.isFinite(overrides.maxDocs)
        ? Math.max(50, Math.min(5000, Math.round(overrides.maxDocs)))
        : base.maxDocs,
  };

  const snapshot = await fetchHyperspellSnapshot(senderId, settings);
  const graph = buildKnowledgeGraph(senderId, snapshot.memories, snapshot.statusByProvider, settings);
  const token = randomToken();
  const createdAtMs = Date.now();
  graphCache.set(token, { graph, createdAtMs });
  await writeDiskCache(token, graph, createdAtMs);
  const url = `/plugins/hyperspell-knowledge-3d?token=${encodeURIComponent(token)}`;
  return { graph, token, url };
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
      const base = getPluginSettings(api);
      const senderId = resolveSenderId(params, callId, context, base.defaultUserId);
      const out = await buildAndCacheGraph(api, senderId, {
        lookbackDays: typeof params.lookbackDays === "number" ? params.lookbackDays : undefined,
        maxDocs: typeof params.maxDocs === "number" ? params.maxDocs : undefined,
      });

      return {
        content: [
          {
            type: "text",
            text: [
              `Knowledge galaxy ready for sender: ${senderId}`,
              `Memories: ${out.graph.metrics.totalMemories}, image memories: ${out.graph.metrics.imageMemories}`,
              `Open dashboard: ${out.url}`,
            ].join("\n"),
          },
        ],
      };
    },
  });

  api.registerCommand({
    name: "hyperspell_viz3d",
    description: "Generate Hyperspell 3D knowledge visualization URL",
    acceptsArgs: false,
    handler: async (ctx: any) => {
      const base = getPluginSettings(api);
      const senderId = (ctx?.senderId || ctx?.from || ctx?.to || base.defaultUserId || "unknown-user").trim();
      const out = await buildAndCacheGraph(api, senderId);
      return {
        text: [
          `Knowledge galaxy ready for sender: ${senderId}`,
          `Memories: ${out.graph.metrics.totalMemories}, image memories: ${out.graph.metrics.imageMemories}`,
          `Open dashboard: ${out.url}`,
        ].join("\n"),
      };
    },
  });

  api.registerCli(
    ({ program }) => {
      const cmd = program
        .command("hyperspell-viz3d")
        .description("Generate Hyperspell 3D knowledge visualization URL")
        .option("--sender <id>", "Hyperspell user id / X-As-User")
        .option("--lookback-days <n>", "Lookback window in days")
        .option("--max-docs <n>", "Maximum memories to scan")
        .action(async (opts: Record<string, string>) => {
          const base = getPluginSettings(api);
          const senderId = (opts.sender || base.defaultUserId || "unknown-user").trim();
          const out = await buildAndCacheGraph(api, senderId, {
            lookbackDays: opts.lookbackDays ? Number(opts.lookbackDays) : undefined,
            maxDocs: opts.maxDocs ? Number(opts.maxDocs) : undefined,
          });
          const port = api.config?.gateway?.port ?? 18789;
          process.stdout.write(`http://127.0.0.1:${port}${out.url}\n`);
        });

      cmd.showHelpAfterError();
    },
    { commands: ["hyperspell-viz3d"] },
  );

  api.registerHttpRoute({
    path: "/plugins/hyperspell-knowledge-3d",
    auth: "plugin",
    match: "exact",
    handler: async (req: any, res: any) => {
      const reqUrl = new URL(req.url, "http://localhost");
      const token = reqUrl.searchParams.get("token") ?? "";
      let rec = graphCache.get(token);
      if (!rec && token) {
        rec = await readDiskCache(token);
        if (rec) {
          graphCache.set(token, rec);
        }
      }
      if (!token || !rec) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end("<h1>Visualization not found</h1><p>Run /hyperspell_viz3d first.</p>");
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
    auth: "plugin",
    match: "exact",
    handler: async (req: any, res: any) => {
      const reqUrl = new URL(req.url, "http://localhost");
      const token = reqUrl.searchParams.get("token") ?? "";
      let rec = graphCache.get(token);
      if (!rec && token) {
        rec = await readDiskCache(token);
        if (rec) {
          graphCache.set(token, rec);
        }
      }
      if (!token || !rec) {
        sendJson(res, 404, { error: "not_found", message: "No graph data for token" });
        return true;
      }
      sendJson(res, 200, rec.graph);
      return true;
    },
  });
}
