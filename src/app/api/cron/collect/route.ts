/**
 * Background Data Collection Cron Job
 *
 * This endpoint is called by Vercel Cron every 2 minutes to:
 * 1. Collect fresh data from pNode network
 * 2. Update Redis cache proactively
 * 3. Ensure users always get instant responses from cache
 *
 * Security: Protected by CRON_SECRET environment variable
 * Rate limited to 10 requests per hour per IP
 */

import { NextRequest, NextResponse } from "next/server";
import { collectNetworkSnapshot } from "@/lib/prpc/collector";
import { setCache, CACHE_KEYS, CACHE_TTL } from "@/lib/cache/redis";
import type { NetworkStats } from "@/types";
import { withCronRateLimit } from "@/lib/ratelimit";
import { insertNodeSnapshots, isDatabaseAvailable } from "@/lib/db/client";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max execution time

/**
 * GET /api/cron/collect
 *
 * Protected endpoint for background data collection
 * Rate limited to 10 requests per hour
 */
export async function GET(request: NextRequest) {
  return withCronRateLimit(request, async () => {
  const startTime = Date.now();

  try {
    // Verify authorization
    const authHeader = request.headers.get("authorization");
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (authHeader !== expectedAuth) {
      console.error("[Cron] Unauthorized access attempt");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("[Cron] Starting background data collection...");

    // Collect fresh network snapshot with credits
    const snapshot = await collectNetworkSnapshot({
      timeout: 10000,
      concurrency: 20, // Slightly higher concurrency for background job
      fetchStats: true,
      fetchCredits: true, // Enable pod credits collection
    });

    const nodes = snapshot.nodes;

    // Calculate and cache network stats
    const online = nodes.filter((n) => n.status === "online").length;
    const degraded = nodes.filter((n) => n.status === "degraded").length;
    const offline = nodes.filter((n) => n.status === "offline").length;

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

    const totalStorage = nodesWithStats.reduce(
      (sum, n) => sum + (n.stats?.file_size || 0),
      0
    );

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

    // Cache in primary location (all endpoints will use this)
    await setCache(CACHE_KEYS.NETWORK_SNAPSHOT_PRIMARY, snapshot, CACHE_TTL.SNAPSHOT_PRIMARY);

    // Also cache the derived stats
    await setCache(CACHE_KEYS.NETWORK_STATS, stats, CACHE_TTL.STATS);

    // Persist to database for historical analytics (non-blocking)
    let dbInserted = 0;
    if (isDatabaseAvailable()) {
      try {
        dbInserted = await insertNodeSnapshots(nodes);
        console.log(`[Cron] Persisted ${dbInserted} node snapshots to database`);
      } catch (dbError) {
        console.error('[Cron] Database insertion failed (non-fatal):', dbError);
        // Continue - database is optional, Redis cache is primary
      }
    }

    const duration = Date.now() - startTime;
    const nodesWithCredits = nodes.filter((n) => n.credits !== undefined).length;

    console.log(`[Cron] Collection completed in ${duration}ms`);
    console.log(`[Cron] Cached stats for ${nodes.length} nodes`);
    console.log(`[Cron] Health: ${online} online, ${degraded} degraded, ${offline} offline`);
    console.log(`[Cron] Credits: ${nodesWithCredits}/${nodes.length} nodes have credits data`);

    return NextResponse.json({
      success: true,
      duration_ms: duration,
      nodes_collected: nodes.length,
      nodes_with_stats: nodesWithStats.length,
      health: {
        online,
        degraded,
        offline,
        health_percent: stats.health_percent,
      },
      cached: {
        stats: true,
        snapshot: true,
      },
      database: {
        inserted: dbInserted,
        available: isDatabaseAvailable(),
      },
      collected_at: snapshot.collected_at,
    });
  } catch (error) {
    console.error("[Cron] Collection failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Data collection failed",
        message: error instanceof Error ? error.message : "Unknown error",
        duration_ms: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
  });
}
