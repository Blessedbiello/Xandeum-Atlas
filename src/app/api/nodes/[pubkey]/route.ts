import { NextRequest, NextResponse } from "next/server";
import { collectNetworkSnapshot, PrpcClient } from "@/lib/prpc";
import type { NodeDetailApiResponse, CollectionResult } from "@/types";
import { withRateLimit } from "@/lib/ratelimit";
import { getCache, setCache, CACHE_KEYS, CACHE_TTL } from "@/lib/cache/redis";

export const dynamic = "force-dynamic";

/**
 * GET /api/nodes/[pubkey]
 *
 * Fetches detailed information about a specific pNode.
 * OPTIMIZED: Uses cached snapshot first, avoiding full network collection.
 * Rate limited to 100 requests per minute per IP.
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

    try {
      let cacheStatus = "MISS";

      // OPTIMIZATION: Try cached snapshot first (instant response)
      let snapshot = await getCache<CollectionResult>(CACHE_KEYS.NETWORK_SNAPSHOT_PRIMARY);

      if (snapshot) {
        cacheStatus = "HIT";
      } else {
        // Cache miss - collect fresh data (rare, only if cron hasn't run)
        snapshot = await collectNetworkSnapshot({
          timeout: 10000,
          concurrency: 15,
          fetchStats: true,
        });
        // Cache for future requests
        await setCache(CACHE_KEYS.NETWORK_SNAPSHOT_PRIMARY, snapshot, CACHE_TTL.SNAPSHOT_PRIMARY);
      }

      // Find the specific node (supports exact match or prefix match)
      const node = snapshot.nodes.find(
        (n) => n.pubkey === pubkey || n.pubkey.startsWith(pubkey)
      );

      if (!node) {
        return NextResponse.json(
          { error: "Node not found", pubkey },
          { status: 404 }
        );
      }

      // If we didn't get stats from the snapshot, try direct fetch
      // This is a fallback for nodes that were offline during collection
      if (!node.stats && node.address) {
        try {
          const ip = node.address.split(":")[0];
          const client = new PrpcClient(ip, { timeout: 5000 }); // Reduced timeout for single node
          const stats = await client.getStats();
          node.stats = stats;
          node.ram_percent = stats.ram_total > 0
            ? (stats.ram_used / stats.ram_total) * 100
            : undefined;
        } catch {
          // Stats unavailable, continue without them
        }
      }

      const response: NodeDetailApiResponse = {
        node,
        fetched_at: new Date().toISOString(),
      };

      return NextResponse.json(response, {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
          "X-Response-Time": `${Date.now() - startTime}ms`,
          "X-Cache": cacheStatus,
        },
      });
    } catch (error) {
      console.error(`[API /nodes/${pubkey}] Error:`, error);
      return NextResponse.json(
        {
          error: "Failed to fetch node",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  });
}
