import type { HyperspellMemory, PluginSettings } from "./types.js";

interface ListResponse {
  items: HyperspellMemory[];
  next_cursor: string | null;
}

interface QueryResponse {
  results?: HyperspellMemory[];
  items?: HyperspellMemory[];
}

export interface HyperspellSnapshot {
  memories: HyperspellMemory[];
  statusByProvider: Record<string, Record<string, number>>;
}

function buildHeaders(apiKey: string, senderId: string): Headers {
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${apiKey}`);
  headers.set("X-As-User", senderId);
  headers.set("Content-Type", "application/json");
  return headers;
}

async function getJson<T>(url: string, headers: Headers): Promise<T> {
  const res = await fetch(url, { method: "GET", headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hyperspell request failed (${res.status}): ${text.slice(0, 500)}`);
  }
  return (await res.json()) as T;
}

function toIsoCutoff(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function getDate(mem: HyperspellMemory): string | null {
  const metadata = (mem.metadata ?? {}) as Record<string, unknown>;
  const indexedAt = typeof metadata.indexed_at === "string" ? metadata.indexed_at : null;
  const createdAt = typeof metadata.created_at === "string" ? metadata.created_at : null;
  return indexedAt ?? createdAt;
}

export async function fetchHyperspellSnapshot(
  senderId: string,
  settings: PluginSettings,
): Promise<HyperspellSnapshot> {
  const apiKey = settings.apiKey || process.env.HYPERSPELL_API_KEY;
  if (!apiKey) {
    throw new Error("Missing HYPERSPELL_API_KEY in environment");
  }

  const base = settings.apiBase.replace(/\/$/, "");
  const headers = buildHeaders(apiKey, senderId);
  const statusRes = await getJson<{ providers?: Record<string, Record<string, number>> }>(
    `${base}/memories/status`,
    headers,
  );

  const pageSize = 100;
  let cursor: string | null = null;
  const all: HyperspellMemory[] = [];
  const cutoff = toIsoCutoff(settings.lookbackDays);

  for (;;) {
    const u = new URL(`${base}/memories/list`);
    u.searchParams.set("size", String(pageSize));
    if (cursor) {
      u.searchParams.set("cursor", cursor);
    }

    const page = await getJson<ListResponse>(u.toString(), headers);
    for (const item of page.items ?? []) {
      const dt = getDate(item);
      if (!dt || dt >= cutoff) {
        all.push(item);
      }
      if (all.length >= settings.maxDocs) {
        break;
      }
    }

    if (all.length >= settings.maxDocs) {
      break;
    }
    if (!page.next_cursor) {
      break;
    }
    cursor = page.next_cursor;
  }

  const enriched = [...all];
  const seen = new Set(all.map((m) => `${m.source}:${m.resource_id}`));
  const visualTerms = ["image", "photo", "screenshot", "diagram", "logo", "jpg", "png", "gif"];
  for (const q of visualTerms) {
    if (enriched.length >= settings.maxDocs) {
      break;
    }
    try {
      const queryUrl = new URL(`${base}/memories/query`);
      queryUrl.searchParams.set("q", q);
      queryUrl.searchParams.set("size", "20");
      const qr = await getJson<QueryResponse>(queryUrl.toString(), headers);
      const candidates = [...(qr.results ?? []), ...(qr.items ?? [])];
      for (const item of candidates) {
        const key = `${item.source}:${item.resource_id}`;
        if (!seen.has(key)) {
          seen.add(key);
          enriched.push(item);
          if (enriched.length >= settings.maxDocs) {
            break;
          }
        }
      }
    } catch {
      // Query endpoint may be unavailable for some tenants; keep list-only behavior.
    }
  }

  return {
    memories: enriched,
    statusByProvider: statusRes.providers ?? {},
  };
}
