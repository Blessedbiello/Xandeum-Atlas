/**
 * Node History API Route
 * Returns historical metrics for a specific node
 * OPTIMIZED: Redis caching to reduce database load
 * Rate limited to 100 requests per minute per IP
 */

import { NextRequest, NextResponse } from "next/server";
import { withRateLimit } from "@/lib/ratelimit";
import { getNodeHistory, getNodeUptimeStats, isDatabaseAvailable, NodeHistoryPoint, NodeUptimeStats } from "@/lib/db/client";
import { getCache, setCache } from "@/lib/cache/redis";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Cache TTL based on time range requested
// Shorter ranges = shorter cache (more recent data expected)
// Longer ranges = longer cache (historical data doesn't change)
const HISTORY_CACHE_TTL = {
  short: 120,    // 2 minutes for 24h data
  medium: 300,   // 5 minutes for 7d data
  long: 600,     // 10 minutes for 30d data
};

// Query parameter validation
const HistoryQuerySchema = z.object({
  hours: z.coerce.number().int().positive().max(720).default(24), // Max 30 days
});

// Cache key generator
function getHistoryCacheKey(pubkey: string, hours: number): string {
  // Normalize hours to cache buckets (24, 168, 720) to maximize cache hits
  const bucket = hours <= 24 ? 24 : hours <= 168 ? 168 : 720;
  return `node:history:${pubkey}:${bucket}h`;
}

function getCacheTTL(hours: number): number {
  if (hours <= 24) return HISTORY_CACHE_TTL.short;
  if (hours <= 168) return HISTORY_CACHE_TTL.medium;
  return HISTORY_CACHE_TTL.long;
}

interface CachedHistoryData {
  history: NodeHistoryPoint[];
  uptime_stats: NodeUptimeStats | null;
  cached_at: string;
}

/**
 * GET /api/nodes/[pubkey]/history
 *
 * OPTIMIZED: Redis caching with intelligent TTL based on time range
 * Query Parameters:
 * - hours: Number of hours to fetch (default: 24, max: 720)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { pubkey: string } }
) {
  return withRateLimit(request, async () => {
    const startTime = Date.now();
    const { pubkey } = params;

    if (!pubkey || pubkey.length < 32) {
      return NextResponse.json(
        { error: "Invalid pubkey" },
        { status: 400 }
      );
    }

    if (!isDatabaseAvailable()) {
      return NextResponse.json(
        {
          error: "Historical data not available",
          message: "Database not configured",
        },
        { status: 503 }
      );
    }

    try {
      const { searchParams } = new URL(request.url);
      const { hours } = HistoryQuerySchema.parse({
        hours: searchParams.get("hours"),
      });

      const cacheKey = getHistoryCacheKey(pubkey, hours);
      let cacheStatus = "MISS";

      // Check Redis cache first
      const cached = await getCache<CachedHistoryData>(cacheKey);
      if (cached) {
        cacheStatus = "HIT";
        return NextResponse.json(
          {
            pubkey,
            history: cached.history,
            uptime_stats: cached.uptime_stats,
            hours_requested: hours,
            data_points: cached.history.length,
            fetched_at: cached.cached_at,
          },
          {
            headers: {
              "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
              "X-Response-Time": `${Date.now() - startTime}ms`,
              "X-Cache": cacheStatus,
            },
          }
        );
      }

      // Cache miss - fetch from database
      const [history, uptimeStats] = await Promise.all([
        getNodeHistory(pubkey, hours),
        getNodeUptimeStats(pubkey, Math.ceil(hours / 24)),
      ]);

      if (history.length === 0 && !uptimeStats) {
        return NextResponse.json(
          {
            error: "No historical data found",
            message: `No data found for node ${pubkey}`,
          },
          { status: 404 }
        );
      }

      // Cache the results
      const cacheData: CachedHistoryData = {
        history,
        uptime_stats: uptimeStats,
        cached_at: new Date().toISOString(),
      };
      await setCache(cacheKey, cacheData, getCacheTTL(hours));

      return NextResponse.json(
        {
          pubkey,
          history,
          uptime_stats: uptimeStats,
          hours_requested: hours,
          data_points: history.length,
          fetched_at: cacheData.cached_at,
        },
        {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
            "X-Response-Time": `${Date.now() - startTime}ms`,
            "X-Cache": cacheStatus,
          },
        }
      );
    } catch (error) {
      console.error(`[API /nodes/${pubkey}/history] Error:`, error);

      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: "Invalid parameters",
            issues: error.issues,
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error: "Failed to fetch node history",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  });
}
