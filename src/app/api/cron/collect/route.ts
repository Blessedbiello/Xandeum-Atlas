/**
 * Background Data Collection Cron Job
 *
 * This endpoint is called by Vercel Cron every 2 minutes to:
 * 1. Collect fresh data from pNode network
 * 2. Update Redis cache proactively
 * 3. Persist snapshots to database for historical analytics
 * 4. Ensure users always get instant responses from cache
 *
 * Security: Protected by CRON_SECRET environment variable
 * Rate limited to 10 requests per hour per IP
 */

import { NextRequest, NextResponse } from "next/server";
import { collectNetworkSnapshot } from "@/lib/prpc/collector";
import { setCache, CACHE_KEYS, CACHE_TTL } from "@/lib/cache/redis";
import { withCronRateLimit } from "@/lib/ratelimit";
import { insertNodeSnapshotsBatch, isDatabaseAvailable } from "@/lib/db/client";
import { calculateNetworkStats, getHealthSummary } from "@/lib/stats/calculate-stats";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max execution time

/**
 * GET /api/cron/collect
 *
 * Protected endpoint for background data collection.
 * OPTIMIZED: Uses single-pass stats calculation and batch DB inserts.
 * Rate limited to 10 requests per hour.
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
        concurrency: 20, // Higher concurrency for background job
        fetchStats: true,
        fetchCredits: true,
      });

      const nodes = snapshot.nodes;

      // OPTIMIZED: Single-pass stats calculation
      const stats = calculateNetworkStats(nodes, snapshot.collected_at);

      // Cache snapshot and stats in parallel
      await Promise.all([
        setCache(CACHE_KEYS.NETWORK_SNAPSHOT_PRIMARY, snapshot, CACHE_TTL.SNAPSHOT_PRIMARY),
        setCache(CACHE_KEYS.NETWORK_STATS, stats, CACHE_TTL.STATS),
      ]);

      // OPTIMIZED: Batch database insert (non-blocking)
      let dbInserted = 0;
      if (isDatabaseAvailable()) {
        try {
          dbInserted = await insertNodeSnapshotsBatch(nodes);
          console.log(`[Cron] Persisted ${dbInserted} node snapshots to database`);
        } catch (dbError) {
          console.error('[Cron] Database insertion failed (non-fatal):', dbError);
          // Continue - database is optional, Redis cache is primary
        }
      }

      const duration = Date.now() - startTime;
      const nodesWithCredits = nodes.filter((n) => n.credits !== undefined).length;
      const nodesWithStats = nodes.filter((n) => n.stats).length;

      console.log(`[Cron] Collection completed in ${duration}ms`);
      console.log(`[Cron] ${getHealthSummary(stats)}`);
      console.log(`[Cron] Credits: ${nodesWithCredits}/${nodes.length} nodes have credits data`);

      return NextResponse.json({
        success: true,
        duration_ms: duration,
        nodes_collected: nodes.length,
        nodes_with_stats: nodesWithStats,
        health: {
          online: stats.online_nodes,
          degraded: stats.degraded_nodes,
          offline: stats.offline_nodes,
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
