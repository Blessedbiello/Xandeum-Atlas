import { PrpcClient } from "./client";
import { SEED_IPS } from "./seeds";
import { isTimeoutError, isNetworkError } from "./errors";
import type {
  Pod,
  NodeStats,
  NodeWithStats,
  NodeStatus,
  CollectionResult,
  CollectionError,
  PodsCreditsResponse,
} from "@/types";

/**
 * Configuration for network snapshot collection
 */
export interface CollectorConfig {
  /** Timeout per request in ms (default: 8000) */
  timeout?: number;
  /** Max concurrent stats requests (default: 10) */
  concurrency?: number;
  /** Whether to fetch stats for each node (default: true) */
  fetchStats?: boolean;
  /** Whether to fetch pod credits (default: false) */
  fetchCredits?: boolean;
  /** Credits API URL (default: https://podcredits.xandeum.network/api/pods-credits) */
  creditsUrl?: string;
  /** Custom seed IPs to use */
  seeds?: string[];
  /** Enable debug logging */
  debug?: boolean;
}

const DEFAULT_CONFIG: Required<CollectorConfig> = {
  timeout: 8000,
  concurrency: 10,
  fetchStats: true,
  fetchCredits: false,
  creditsUrl: "https://podcredits.xandeum.network/api/pods-credits",
  seeds: [...SEED_IPS],
  debug: false,
};

/**
 * Fetch pod credits from the credits API
 */
export async function fetchPodsCredits(
  url: string,
  timeout: number = 10000,
  debug: boolean = false
): Promise<Map<string, number>> {
  const creditsMap = new Map<string, number>();

  try {
    if (debug) {
      console.log(`[Collector] Fetching pod credits from ${url}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: PodsCreditsResponse = await response.json();

    if (data.pods_credits && Array.isArray(data.pods_credits)) {
      for (const { pod_id, credits } of data.pods_credits) {
        creditsMap.set(pod_id, credits);
      }

      if (debug) {
        console.log(`[Collector] Loaded ${creditsMap.size} pod credits`);
      }
    }
  } catch (error) {
    if (debug) {
      console.error(`[Collector] Failed to fetch pod credits:`, error);
    }
    // Return empty map on error - credits are optional
  }

  return creditsMap;
}

/**
 * Determine node status based on last seen timestamp
 */
export function determineNodeStatus(lastSeenTimestamp: number): NodeStatus {
  const now = Date.now() / 1000;
  const age = now - lastSeenTimestamp;

  if (age < 240) return "online"; // Seen in last 4 minutes (accounts for data collection latency)
  if (age < 600) return "degraded"; // Seen in last 10 minutes
  if (age < 3600) return "offline"; // Seen in last 1 hour
  return "unknown"; // Not seen for > 1 hour
}

/**
 * Format uptime seconds into human-readable string
 */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Process a batch of async operations with concurrency limit
 */
async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<Array<{ item: T; result: R | null; error: Error | null }>> {
  const results: Array<{ item: T; result: R | null; error: Error | null }> = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(processor));

    for (let j = 0; j < batch.length; j++) {
      const batchResult = batchResults[j];
      if (batchResult.status === "fulfilled") {
        results.push({ item: batch[j], result: batchResult.value, error: null });
      } else {
        results.push({
          item: batch[j],
          result: null,
          error: batchResult.reason,
        });
      }
    }
  }

  return results;
}

/**
 * Collect a complete network snapshot from all seed nodes
 *
 * 1. Queries all seed nodes for pod lists in parallel
 * 2. Deduplicates pods by pubkey (latest timestamp wins)
 * 3. Optionally fetches stats from each discovered pod
 * 4. Returns enriched node data with status information
 */
export async function collectNetworkSnapshot(
  config: CollectorConfig = {}
): Promise<CollectionResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  const errors: CollectionError[] = [];
  const podMap = new Map<string, Pod>();

  if (cfg.debug) {
    console.log(`[Collector] Starting collection from ${cfg.seeds.length} seeds`);
  }

  // Phase 1: Discover pods from all seed nodes
  const seedResults = await Promise.allSettled(
    cfg.seeds.map(async (ip) => {
      const client = new PrpcClient(ip, { timeout: cfg.timeout, debug: cfg.debug });
      const response = await client.getPods();
      return { ip, pods: response.pods, total: response.total_count };
    })
  );

  // Process seed results
  let successfulSeeds = 0;
  for (let i = 0; i < seedResults.length; i++) {
    const result = seedResults[i];
    const seedIp = cfg.seeds[i];

    if (result.status === "fulfilled") {
      successfulSeeds++;
      if (cfg.debug) {
        console.log(
          `[Collector] Seed ${seedIp}: ${result.value.pods.length} pods`
        );
      }

      // Merge pods, keeping the one with the latest timestamp
      for (const pod of result.value.pods) {
        const existing = podMap.get(pod.pubkey);
        if (
          !existing ||
          pod.last_seen_timestamp > existing.last_seen_timestamp
        ) {
          podMap.set(pod.pubkey, pod);
        }
      }
    } else {
      const errorMsg = result.reason?.message || "Unknown error";
      errors.push({
        type: "seed_unreachable",
        target: seedIp,
        error: errorMsg,
      });
      if (cfg.debug) {
        console.log(`[Collector] Seed ${seedIp} failed: ${errorMsg}`);
      }
    }
  }

  if (cfg.debug) {
    console.log(
      `[Collector] Discovered ${podMap.size} unique pods from ${successfulSeeds}/${cfg.seeds.length} seeds`
    );
  }

  // Phase 2: Fetch stats for each pod (if enabled)
  const pods = Array.from(podMap.values());
  const nodesWithStats: NodeWithStats[] = [];
  let statsSuccessCount = 0;

  if (cfg.fetchStats && pods.length > 0) {
    const statsResults = await processBatch(
      pods,
      async (pod) => {
        // Extract IP from address (format: "ip:port" or just "ip")
        const ip = pod.address.includes(":")
          ? pod.address.split(":")[0]
          : pod.address;
        const client = new PrpcClient(ip, { timeout: cfg.timeout, debug: cfg.debug });
        return client.getStats();
      },
      cfg.concurrency
    );

    for (const { item: pod, result: stats, error } of statsResults) {
      const status = determineNodeStatus(pod.last_seen_timestamp);

      if (stats) {
        statsSuccessCount++;
        nodesWithStats.push({
          ...pod,
          stats,
          status,
          ram_percent:
            stats.ram_total > 0
              ? (stats.ram_used / stats.ram_total) * 100
              : undefined,
          uptime_formatted: formatUptime(stats.uptime),
        });
      } else {
        // Node without stats
        if (error && !isTimeoutError(error) && !isNetworkError(error)) {
          errors.push({
            type: "stats_unreachable",
            target: pod.pubkey.slice(0, 8),
            error: error.message,
          });
        }
        nodesWithStats.push({
          ...pod,
          stats: null,
          status: status === "online" ? "degraded" : status,
        });
      }
    }
  } else {
    // No stats fetching, just add pods with status
    for (const pod of pods) {
      nodesWithStats.push({
        ...pod,
        stats: null,
        status: determineNodeStatus(pod.last_seen_timestamp),
      });
    }
  }

  // Phase 3: Fetch pod credits (if enabled)
  if (cfg.fetchCredits) {
    try {
      const creditsMap = await fetchPodsCredits(
        cfg.creditsUrl,
        cfg.timeout,
        cfg.debug
      );

      // Merge credits into nodes
      let creditsMatchedCount = 0;
      for (const node of nodesWithStats) {
        const credits = creditsMap.get(node.pubkey);
        if (credits !== undefined) {
          node.credits = credits;
          creditsMatchedCount++;
        }
      }

      if (cfg.debug) {
        console.log(
          `[Collector] Matched ${creditsMatchedCount}/${nodesWithStats.length} nodes with credits data`
        );
      }
    } catch (error) {
      if (cfg.debug) {
        console.error(`[Collector] Credits integration failed:`, error);
      }
      // Continue without credits - they're optional
    }
  }

  const duration = Date.now() - startTime;

  if (cfg.debug) {
    console.log(
      `[Collector] Completed in ${duration}ms. ${nodesWithStats.length} nodes, ${statsSuccessCount} with stats, ${errors.length} errors`
    );
  }

  return {
    nodes: nodesWithStats,
    total_discovered: podMap.size,
    total_with_stats: statsSuccessCount,
    errors,
    duration_ms: duration,
    collected_at: new Date().toISOString(),
  };
}

/**
 * Quick health check of seed nodes
 */
export async function checkSeedHealth(): Promise<
  Array<{ ip: string; healthy: boolean; latency_ms: number }>
> {
  const results = await Promise.all(
    SEED_IPS.map(async (ip) => {
      const client = new PrpcClient(ip, { timeout: 5000 });
      const health = await client.healthCheck();
      return { ip, ...health };
    })
  );
  return results;
}
