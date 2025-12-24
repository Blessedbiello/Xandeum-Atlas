import { NextRequest, NextResponse } from "next/server";
import { collectNetworkSnapshot } from "@/lib/prpc";
import type { NetworkStats, CollectionResult } from "@/types";
import { getCache, setCache, CACHE_KEYS, CACHE_TTL } from "@/lib/cache/redis";
import { withRateLimit } from "@/lib/ratelimit";
import { calculateNetworkStats } from "@/lib/stats/calculate-stats";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/stats
 *
 * Returns network-wide statistics for all pNodes.
 * OPTIMIZED: Uses single-pass calculation and multi-layer caching.
 * Rate limited to 100 requests per minute per IP.
 */
export async function GET(request: NextRequest) {
  return withRateLimit(request, async () => {
    const startTime = Date.now();

    try {
      // Layer 1: Check stats cache first (fastest - pre-computed)
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

      // Layer 2: Check primary snapshot (shared across all endpoints)
      let snapshot = await getCache<CollectionResult>(CACHE_KEYS.NETWORK_SNAPSHOT_PRIMARY);
      let cacheSource = "PRIMARY";

      if (!snapshot) {
        // Layer 3: Collect fresh data (rare - only if cron hasn't run)
        cacheSource = "FRESH";
        snapshot = await collectNetworkSnapshot({
          timeout: 10000,
          concurrency: 15,
          fetchStats: true,
        });

        // Cache in primary location for other endpoints
        await setCache(CACHE_KEYS.NETWORK_SNAPSHOT_PRIMARY, snapshot, CACHE_TTL.SNAPSHOT_PRIMARY);
      }

      // OPTIMIZED: Single-pass stats calculation
      const stats = calculateNetworkStats(snapshot.nodes, snapshot.collected_at);

      // Cache the computed stats
      await setCache(CACHE_KEYS.NETWORK_STATS, stats, CACHE_TTL.STATS);

      return NextResponse.json(stats, {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          "X-Response-Time": `${Date.now() - startTime}ms`,
          "X-Collection-Duration": `${snapshot.duration_ms}ms`,
          "X-Cache": cacheSource,
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
  });
}
