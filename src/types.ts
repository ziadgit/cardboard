export type MemoryStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "pending_review"
  | "skipped"
  | "unknown";

export interface HyperspellMemory {
  source: string;
  resource_id: string;
  title?: string | null;
  score?: number | null;
  metadata?: Record<string, unknown> | null;
  type?: string | null;
  data?: unknown;
}

export interface GraphNode {
  id: string;
  source: string;
  resourceId: string;
  label: string;
  title: string;
  status: MemoryStatus;
  score: number;
  createdAt: string | null;
  indexedAt: string | null;
  url: string | null;
  isImage: boolean;
  imageConfidence: "high" | "medium" | "low" | "none";
  keywords: string[];
  x: number;
  y: number;
  z: number;
  size: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  strength: number;
  reason: string;
}

export interface KnowledgeGraph {
  generatedAt: string;
  senderId: string;
  metrics: {
    totalMemories: number;
    imageMemories: number;
    failed: number;
    processing: number;
    freshnessHours: number | null;
  };
  sourceCounts: Record<string, number>;
  statusCounts: Record<string, Record<string, number>>;
  timeline: Array<{ day: string; memories: number; images: number }>;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface PluginSettings {
  apiKey?: string;
  defaultUserId?: string;
  apiBase: string;
  lookbackDays: number;
  maxDocs: number;
  imageKeywordBoost: number;
}
