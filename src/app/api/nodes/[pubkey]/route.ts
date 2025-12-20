import { NextRequest, NextResponse } from "next/server";
import { collectNetworkSnapshot, PrpcClient } from "@/lib/prpc";
import type { NodeDetailApiResponse } from "@/types";
import { withRateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * GET /api/nodes/[pubkey]
 *
 * Fetches detailed information about a specific pNode.
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
    // Collect network snapshot to find the node
    const snapshot = await collectNetworkSnapshot({
      timeout: 10000,
      concurrency: 10,
      fetchStats: true,
    });

    // Find the specific node
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
    if (!node.stats && node.address) {
      try {
        const ip = node.address.split(":")[0];
        const client = new PrpcClient(ip, { timeout: 8000 });
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
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        "X-Response-Time": `${Date.now() - startTime}ms`,
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
