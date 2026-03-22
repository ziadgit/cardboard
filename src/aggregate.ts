import type { GraphEdge, GraphNode, HyperspellMemory, KnowledgeGraph, PluginSettings } from "./types.js";

const IMAGE_EXT = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".heic", ".svg", ".bmp", ".tiff"];
const IMAGE_WORDS = [
  "image",
  "photo",
  "screenshot",
  "diagram",
  "picture",
  "render",
  "illustration",
  "logo",
  "icon",
  "frame",
  "camera",
  "visual",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "heic",
  "svg",
  "screenshot",
];

function asObj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object") {
    return {};
  }
  return v as Record<string, unknown>;
}

function toTime(v: string | null): number | null {
  if (!v) {
    return null;
  }
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

function dateParts(mem: HyperspellMemory): { createdAt: string | null; indexedAt: string | null; status: string; url: string | null } {
  const md = asObj(mem.metadata);
  const createdAt = typeof md.created_at === "string" ? md.created_at : null;
  const indexedAt = typeof md.indexed_at === "string" ? md.indexed_at : null;
  const status = typeof md.status === "string" ? md.status : "unknown";
  const url = typeof md.url === "string" ? md.url : null;
  return { createdAt, indexedAt, status, url };
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4)
    .slice(0, 10);
}

function imageConfidence(mem: HyperspellMemory, boost: number): "high" | "medium" | "low" | "none" {
  const { url } = dateParts(mem);
  const title = (mem.title ?? "").toLowerCase();
  const type = (mem.type ?? "").toLowerCase();
  const md = asObj(mem.metadata);
  const blob = JSON.stringify(md).toLowerCase();
  const source = (mem.source ?? "").toLowerCase();

  let score = 0;
  if (url && IMAGE_EXT.some((ext) => url.toLowerCase().includes(ext))) {
    score += 3;
  }
  if (IMAGE_EXT.some((ext) => title.includes(ext))) {
    score += 3;
  }
  if (type.includes("image") || type.includes("photo") || type.includes("screenshot")) {
    score += 2;
  }
  if (source === "vault" || source === "google_drive" || source === "dropbox" || source === "box") {
    score += 0.4;
  }

  const mdType = typeof md.mime_type === "string" ? md.mime_type.toLowerCase() : "";
  if (mdType.startsWith("image/")) {
    score += 3;
  }
  const mdFile = typeof md.file_name === "string" ? md.file_name.toLowerCase() : "";
  if (IMAGE_EXT.some((ext) => mdFile.includes(ext))) {
    score += 3;
  }

  const keywordHits = IMAGE_WORDS.filter((w) => title.includes(w) || blob.includes(w)).length;
  score += keywordHits * boost * 0.5;

  if (score >= 4) {
    return "high";
  }
  if (score >= 2.5) {
    return "medium";
  }
  if (score >= 1.25) {
    return "low";
  }
  return "none";
}

function sourceHash(source: string): number {
  let h = 0;
  for (let i = 0; i < source.length; i += 1) {
    h = ((h << 5) - h + source.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function positionFor(idx: number, source: string, isImage: boolean): { x: number; y: number; z: number } {
  const ring = 26 + (sourceHash(source) % 30);
  const a = idx * 0.6180339887 + (sourceHash(source) % 360) * (Math.PI / 180);
  const drift = Math.sin(idx * 0.23 + sourceHash(source)) * 14;
  const imageLift = isImage ? 14 : 0;
  return {
    x: Math.cos(a) * (ring + (idx % 11)) + drift,
    y: Math.sin(idx * 0.17) * 20 + imageLift,
    z: Math.sin(a) * (ring + (idx % 7)) - drift,
  };
}

function dayKey(iso: string | null): string | null {
  if (!iso) {
    return null;
  }
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) {
    return null;
  }
  return t.toISOString().slice(0, 10);
}

export function buildKnowledgeGraph(
  senderId: string,
  memories: HyperspellMemory[],
  statusByProvider: Record<string, Record<string, number>>,
  settings: PluginSettings,
): KnowledgeGraph {
  const nodes: GraphNode[] = [];
  const sourceCounts: Record<string, number> = {};
  const timelineMap: Record<string, { memories: number; images: number }> = {};
  let failed = 0;
  let processing = 0;
  let imageMemories = 0;
  let latestTs: number | null = null;

  for (let i = 0; i < memories.length; i += 1) {
    const mem = memories[i];
    const source = mem.source || "unknown";
    const title = mem.title || `${source}/${mem.resource_id.slice(0, 8)}`;
    const textBlob = `${title} ${source}`;
    const keywords = tokenize(textBlob);
    const conf = imageConfidence(mem, settings.imageKeywordBoost);
    const isImage = conf !== "none";
    const { createdAt, indexedAt, status, url } = dateParts(mem);
    const stamp = indexedAt ?? createdAt;
    const t = toTime(stamp);
    if (t !== null && (latestTs === null || t > latestTs)) {
      latestTs = t;
    }

    if (status === "failed") {
      failed += 1;
    }
    if (status === "processing" || status === "pending") {
      processing += 1;
    }
    if (isImage) {
      imageMemories += 1;
    }

    sourceCounts[source] = (sourceCounts[source] ?? 0) + 1;
    const dKey = dayKey(stamp);
    if (dKey) {
      timelineMap[dKey] = timelineMap[dKey] ?? { memories: 0, images: 0 };
      timelineMap[dKey].memories += 1;
      if (isImage) {
        timelineMap[dKey].images += 1;
      }
    }

    const pos = positionFor(i, source, isImage);
    nodes.push({
      id: `${source}:${mem.resource_id}`,
      source,
      resourceId: mem.resource_id,
      label: title.slice(0, 40),
      title,
      status: status as GraphNode["status"],
      score: typeof mem.score === "number" ? mem.score : 0,
      createdAt,
      indexedAt,
      url,
      isImage,
      imageConfidence: conf,
      keywords,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      size: isImage ? 1.8 : 1.1,
    });
  }

  const edges: GraphEdge[] = [];
  const bySource: Record<string, GraphNode[]> = {};
  for (const node of nodes) {
    bySource[node.source] = bySource[node.source] ?? [];
    bySource[node.source].push(node);
  }

  for (const list of Object.values(bySource)) {
    const cap = Math.min(list.length, 120);
    for (let i = 1; i < cap; i += 1) {
      edges.push({
        source: list[i - 1].id,
        target: list[i].id,
        strength: 0.55,
        reason: "same_source",
      });
    }
  }

  const imageNodes = nodes.filter((n) => n.isImage).slice(0, 160);
  for (let i = 1; i < imageNodes.length; i += 1) {
    edges.push({
      source: imageNodes[i - 1].id,
      target: imageNodes[i].id,
      strength: 0.85,
      reason: "image_band",
    });
  }

  const timeline = Object.keys(timelineMap)
    .sort()
    .map((day) => ({ day, memories: timelineMap[day].memories, images: timelineMap[day].images }));

  const freshnessHours = latestTs === null ? null : Math.max(0, Math.round((Date.now() - latestTs) / 36e5));

  return {
    generatedAt: new Date().toISOString(),
    senderId,
    metrics: {
      totalMemories: nodes.length,
      imageMemories,
      failed,
      processing,
      freshnessHours,
    },
    sourceCounts,
    statusCounts: statusByProvider,
    timeline,
    nodes,
    edges,
  };
}
