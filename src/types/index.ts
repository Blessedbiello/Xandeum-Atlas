// Core pNode types based on xandeum-prpc Rust crate

export interface Pod {
  pubkey: string;
  address: string;
  version?: string;
  last_seen_timestamp: number;
  // Extended fields (may be present in some responses)
  uptime?: number;
  storage_used?: number;
  credits?: number; // Pod credits allocation
}

export interface NodeStats {
  active_streams: number;
  cpu_percent: number;
  current_index: number;
  file_size: number;
  last_updated: number;
  packets_received: number;
  packets_sent: number;
  ram_total: number;
  ram_used: number;
  total_bytes: number;
  total_pages: number;
  uptime: number;
}

export interface PodsResponse {
  pods: Pod[];
  total_count: number;
}

// Extended node type with computed fields
export interface NodeWithStats extends Pod {
  stats: NodeStats | null;
  status: NodeStatus;
  ram_percent?: number;
  uptime_formatted?: string;
}

export type NodeStatus = 'online' | 'degraded' | 'offline' | 'unknown';

// Collection result from ingestion
export interface CollectionResult {
  nodes: NodeWithStats[];
  total_discovered: number;
  total_with_stats: number;
  errors: CollectionError[];
  duration_ms: number;
  collected_at: string;
}

export interface CollectionError {
  type: 'seed_unreachable' | 'stats_unreachable' | 'validation_error';
  target: string;
  error: string;
}

// Network statistics
export interface NetworkStats {
  total_nodes: number;
  online_nodes: number;
  degraded_nodes: number;
  offline_nodes: number;
  health_percent: number;
  avg_cpu: number;
  avg_ram_percent: number;
  total_storage_bytes: number;
  version_distribution: Record<string, number>;
  fetched_at: string;
}

// API Response types
export interface NodesApiResponse {
  nodes: NodeWithStats[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
  fetched_at: string;
}

export interface NodeDetailApiResponse {
  node: NodeWithStats;
  history?: NodeHistoryPoint[];
  fetched_at: string;
}

export interface NodeHistoryPoint {
  timestamp: string;
  cpu_percent: number;
  ram_percent: number;
  uptime: number;
  packets_sent: number;
  packets_received: number;
}

// Cache metadata
export interface CacheMetadata {
  cached_at: string;
  expires_at: string;
  is_stale: boolean;
}

export interface CachedResponse<T> {
  data: T;
  metadata: CacheMetadata;
}

// Pod Credits API types
export interface PodCredits {
  pod_id: string;  // Maps to Pod.pubkey
  credits: number;
}

export interface PodsCreditsResponse {
  pods_credits: PodCredits[];
  status: string;
}
