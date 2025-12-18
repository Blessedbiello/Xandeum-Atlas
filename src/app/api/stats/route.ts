import { NextResponse } from "next/server";
import { collectNetworkSnapshot } from "@/lib/prpc";
import type { NetworkStats, CollectionResult, NodeWithStats } from "@/types";
import { getCache, setCache, CACHE_KEYS, CACHE_TTL } from "@/lib/cache/redis";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/stats
 *
 * Returns network-wide statistics for all pNodes.
 * Uses Redis caching for improved performance.
 */
export async function GET() {
  const startTime = Date.now();

  try {
    // Check stats cache first (fastest)
    const cachedStats = await getCache<NetworkStats>(CACHE_KEYS.NETWORK_STATS);
    if (cachedStats) {
      return NextResponse.json(cachedStats, {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          "X-Response-Time": `${Date.now() - startTime}ms`,
          "X-Cache": "HIT",
        },
      });
    }

    // Check if we have a primary snapshot (shared across all endpoints)
    let snapshot = await getCache<CollectionResult>(CACHE_KEYS.NETWORK_SNAPSHOT_PRIMARY);
    let fromPrimary = true;

    if (!snapshot) {
      // Only collect if primary snapshot is also missing
      fromPrimary = false;
      snapshot = await collectNetworkSnapshot({
        timeout: 10000,
        concurrency: 15,
        fetchStats: true,
      });

      // Cache in primary location for other endpoints to use
      await setCache(CACHE_KEYS.NETWORK_SNAPSHOT_PRIMARY, snapshot, CACHE_TTL.SNAPSHOT_PRIMARY);
    }

    const nodes: NodeWithStats[] = snapshot.nodes;

    // Calculate status counts
    const online = nodes.filter((n) => n.status === "online").length;
    const degraded = nodes.filter((n) => n.status === "degraded").length;
    const offline = nodes.filter((n) => n.status === "offline").length;

    // Calculate averages from nodes with stats
    const nodesWithStats = nodes.filter((n) => n.stats);
    const avgCpu =
      nodesWithStats.length > 0
        ? nodesWithStats.reduce((sum, n) => sum + (n.stats?.cpu_percent || 0), 0) /
          nodesWithStats.length
        : 0;
    const avgRam =
      nodesWithStats.length > 0
        ? nodesWithStats.reduce((sum, n) => sum + (n.ram_percent || 0), 0) /
          nodesWithStats.length
        : 0;

    // Calculate total storage
    const totalStorage = nodesWithStats.reduce(
      (sum, n) => sum + (n.stats?.file_size || 0),
      0
    );

    // Calculate version distribution
    const versionDistribution: Record<string, number> = {};
    for (const node of nodes) {
      const version = node.version || "unknown";
      versionDistribution[version] = (versionDistribution[version] || 0) + 1;
    }

    const stats: NetworkStats = {
      total_nodes: nodes.length,
      online_nodes: online,
      degraded_nodes: degraded,
      offline_nodes: offline,
      health_percent:
        nodes.length > 0 ? Math.round((online / nodes.length) * 100) : 0,
      avg_cpu: Math.round(avgCpu * 10) / 10,
      avg_ram_percent: Math.round(avgRam * 10) / 10,
      total_storage_bytes: totalStorage,
      version_distribution: versionDistribution,
      fetched_at: snapshot.collected_at,
    };

    // Cache the stats for future requests
    await setCache(CACHE_KEYS.NETWORK_STATS, stats, CACHE_TTL.STATS);

    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        "X-Response-Time": `${Date.now() - startTime}ms`,
        "X-Collection-Duration": `${snapshot.duration_ms}ms`,
        "X-Cache": fromPrimary ? "PRIMARY" : "MISS",
      },
    });
  } catch (error) {
    console.error("[API /stats] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch network stats",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
