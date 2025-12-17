import { NextResponse } from "next/server";
import { collectNetworkSnapshot } from "@/lib/prpc";
import type { NetworkStats } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/stats
 *
 * Returns network-wide statistics for all pNodes.
 */
export async function GET() {
  const startTime = Date.now();

  try {
    const snapshot = await collectNetworkSnapshot({
      timeout: 10000,
      concurrency: 15,
      fetchStats: true,
    });

    const nodes = snapshot.nodes;

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

    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        "X-Response-Time": `${Date.now() - startTime}ms`,
        "X-Collection-Duration": `${snapshot.duration_ms}ms`,
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
