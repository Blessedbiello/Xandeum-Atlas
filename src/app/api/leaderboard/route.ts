/**
 * Leaderboard API Route
 * Returns node scores and rankings
 * Rate limited to 100 requests per minute per IP.
 */

import { NextRequest, NextResponse } from "next/server";
import { collectNetworkSnapshot } from "@/lib/prpc/collector";
import { calculateLeaderboard, type NodeScore } from "@/lib/scoring/node-score";
import { getCache, setCache, CACHE_KEYS, CACHE_TTL } from "@/lib/cache/redis";
import type { CollectionResult } from "@/types";
import { withRateLimit } from "@/lib/ratelimit";
import { validateQuery, LeaderboardQuerySchema, ValidationError } from "@/lib/validation/api-schemas";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withRateLimit(request, async () => {
  try {
    const { searchParams } = new URL(request.url);

    // Validate and parse query parameters
    const { limit, badge } = validateQuery(LeaderboardQuerySchema, searchParams);

    // Check cache first
    const cacheKey = 'network:leaderboard';
    let leaderboardCache = await getCache<{
      scores: NodeScore[];
      fetched_at: string;
      badge_distribution: Record<string, number>;
    }>(cacheKey);

    if (!leaderboardCache) {
      // Try to get primary snapshot (shared across all endpoints)
      let snapshot = await getCache<CollectionResult>(CACHE_KEYS.NETWORK_SNAPSHOT_PRIMARY);

      if (!snapshot) {
        // Only collect if primary snapshot is also missing
        snapshot = await collectNetworkSnapshot();
        await setCache(CACHE_KEYS.NETWORK_SNAPSHOT_PRIMARY, snapshot, CACHE_TTL.SNAPSHOT_PRIMARY);
      }

      const scores = calculateLeaderboard(snapshot.nodes);

      // Calculate badge distribution
      const badge_distribution: Record<string, number> = {
        Elite: 0,
        Reliable: 0,
        Standard: 0,
        New: 0,
        "At Risk": 0,
      };

      for (const score of scores) {
        badge_distribution[score.badge]++;
      }

      leaderboardCache = {
        scores,
        fetched_at: snapshot.collected_at,
        badge_distribution,
      };

      // Cache the leaderboard
      await setCache(cacheKey, leaderboardCache, CACHE_TTL.STATS);
    }

    let filteredScores = leaderboardCache.scores;

    // Apply badge filter
    if (badge) {
      filteredScores = filteredScores.filter((s) => s.badge === badge);
    }

    // Apply limit
    const limitedScores = filteredScores.slice(0, limit);

    return NextResponse.json({
      scores: limitedScores,
      total: leaderboardCache.scores.length,
      filtered_total: filteredScores.length,
      badge_distribution: leaderboardCache.badge_distribution,
      fetched_at: leaderboardCache.fetched_at,
    });
  } catch (error) {
    console.error("Leaderboard API error:", error);

    // Handle validation errors
    if (error instanceof ValidationError) {
      return NextResponse.json(error.toJSON(), { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to fetch leaderboard data" },
      { status: 500 }
    );
  }
  });
}
