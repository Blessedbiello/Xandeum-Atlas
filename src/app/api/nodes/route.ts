import { NextRequest, NextResponse } from "next/server";
import { collectNetworkSnapshot } from "@/lib/prpc";
import type { NodesApiResponse, NodeWithStats, CollectionResult } from "@/types";
import { getCache, setCache, CACHE_KEYS, CACHE_TTL } from "@/lib/cache/redis";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/nodes
 *
 * Fetches all pNodes from the gossip network with their stats.
 * Uses Redis caching for improved performance.
 *
 * Query Parameters:
 * - status: Filter by status (online, degraded, offline)
 * - sort: Sort field (uptime, cpu, ram, last_seen)
 * - order: Sort order (asc, desc)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50, max: 100)
 * - search: Search by pubkey or IP
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const status = searchParams.get("status");
    const sort = searchParams.get("sort") || "last_seen";
    const order = searchParams.get("order") || "desc";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const search = searchParams.get("search")?.toLowerCase();

    // Try to get primary snapshot first (shared across all endpoints)
    let snapshot = await getCache<CollectionResult>(CACHE_KEYS.NETWORK_SNAPSHOT_PRIMARY);
    let cacheHit = true;

    if (!snapshot) {
      // Cache miss - collect fresh data
      cacheHit = false;
      snapshot = await collectNetworkSnapshot({
        timeout: 10000,
        concurrency: 15,
        fetchStats: true,
      });

      // Cache in primary location for other endpoints to use
      await setCache(CACHE_KEYS.NETWORK_SNAPSHOT_PRIMARY, snapshot, CACHE_TTL.SNAPSHOT_PRIMARY);
    }

    let nodes: NodeWithStats[] = snapshot.nodes;

    // Filter by status
    if (status && ["online", "degraded", "offline", "unknown"].includes(status)) {
      nodes = nodes.filter((n) => n.status === status);
    }

    // Filter by search term
    if (search) {
      nodes = nodes.filter(
        (n) =>
          n.pubkey.toLowerCase().includes(search) ||
          n.address.toLowerCase().includes(search)
      );
    }

    // Sort nodes
    nodes = sortNodes(nodes, sort, order);

    // Paginate
    const total = nodes.length;
    const pages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedNodes = nodes.slice(offset, offset + limit);

    const response: NodesApiResponse = {
      nodes: paginatedNodes,
      pagination: {
        total,
        page,
        limit,
        pages,
      },
      fetched_at: snapshot.collected_at,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        "X-Response-Time": `${Date.now() - startTime}ms`,
        "X-Total-Nodes": String(snapshot.total_discovered),
        "X-Collection-Errors": String(snapshot.errors.length),
        "X-Cache": cacheHit ? "HIT" : "MISS",
      },
    });
  } catch (error) {
    console.error("[API /nodes] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch nodes",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

function sortNodes(
  nodes: NodeWithStats[],
  sort: string,
  order: string
): NodeWithStats[] {
  const multiplier = order === "asc" ? 1 : -1;

  return [...nodes].sort((a, b) => {
    switch (sort) {
      case "uptime":
        return (
          multiplier *
          ((a.stats?.uptime || 0) - (b.stats?.uptime || 0))
        );
      case "cpu":
        return (
          multiplier *
          ((a.stats?.cpu_percent || 0) - (b.stats?.cpu_percent || 0))
        );
      case "ram":
        return (
          multiplier *
          ((a.ram_percent || 0) - (b.ram_percent || 0))
        );
      case "last_seen":
      default:
        return (
          multiplier *
          (a.last_seen_timestamp - b.last_seen_timestamp)
        );
    }
  });
}
