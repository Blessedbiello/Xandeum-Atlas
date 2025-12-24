/**
 * Network Stats Calculator
 *
 * Optimized single-pass calculation of network statistics.
 * Used by both API endpoints and cron jobs for consistency.
 */

import type { NodeWithStats, NetworkStats } from "@/types";

/**
 * Calculate network statistics from nodes in a single pass (O(n))
 *
 * This is significantly more efficient than multiple filter/reduce operations:
 * - Old approach: 6+ array iterations
 * - New approach: 1 array iteration
 *
 * @param nodes - Array of nodes with stats
 * @param collectedAt - ISO timestamp of when data was collected
 * @returns NetworkStats object
 */
export function calculateNetworkStats(
  nodes: NodeWithStats[],
  collectedAt: string
): NetworkStats {
  // Single-pass aggregation
  let online = 0;
  let degraded = 0;
  let offline = 0;
  let cpuSum = 0;
  let ramSum = 0;
  let statsCount = 0;
  let totalStorage = 0;
  const versionDistribution: Record<string, number> = {};

  for (const node of nodes) {
    // Count by status
    switch (node.status) {
      case "online":
        online++;
        break;
      case "degraded":
        degraded++;
        break;
      case "offline":
      case "unknown":
        offline++;
        break;
    }

    // Aggregate stats if available
    if (node.stats) {
      cpuSum += node.stats.cpu_percent || 0;
      ramSum += node.ram_percent || 0;
      totalStorage += node.stats.file_size || 0;
      statsCount++;
    }

    // Version distribution
    const version = node.version || "unknown";
    versionDistribution[version] = (versionDistribution[version] || 0) + 1;
  }

  const totalNodes = nodes.length;

  return {
    total_nodes: totalNodes,
    online_nodes: online,
    degraded_nodes: degraded,
    offline_nodes: offline,
    health_percent: totalNodes > 0
      ? Math.round((online / totalNodes) * 100)
      : 0,
    avg_cpu: statsCount > 0
      ? Math.round((cpuSum / statsCount) * 10) / 10
      : 0,
    avg_ram_percent: statsCount > 0
      ? Math.round((ramSum / statsCount) * 10) / 10
      : 0,
    total_storage_bytes: totalStorage,
    version_distribution: versionDistribution,
    fetched_at: collectedAt,
  };
}

/**
 * Quick health summary for logging/monitoring
 */
export function getHealthSummary(stats: NetworkStats): string {
  return `Health: ${stats.health_percent}% | ` +
    `Online: ${stats.online_nodes} | ` +
    `Degraded: ${stats.degraded_nodes} | ` +
    `Offline: ${stats.offline_nodes} | ` +
    `Total: ${stats.total_nodes}`;
}
