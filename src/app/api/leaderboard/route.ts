/**
 * Leaderboard API Route
 * Returns node scores and rankings
 */

import { NextRequest, NextResponse } from "next/server";
import { collectNetworkSnapshot } from "@/lib/prpc/collector";
import { calculateLeaderboard, type NodeScore } from "@/lib/scoring/node-score";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Cache for leaderboard data
let leaderboardCache: {
  scores: NodeScore[];
  fetched_at: string;
  badge_distribution: Record<string, number>;
} | null = null;
let lastFetched = 0;
const CACHE_DURATION = 60 * 1000; // 1 minute

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const badge = searchParams.get("badge"); // Filter by badge type

    const now = Date.now();

    // Refresh cache if needed
    if (!leaderboardCache || now - lastFetched > CACHE_DURATION) {
      const collectionResult = await collectNetworkSnapshot();
      const scores = calculateLeaderboard(collectionResult.nodes);

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
        fetched_at: new Date().toISOString(),
        badge_distribution,
      };
      lastFetched = now;
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
    return NextResponse.json(
      { error: "Failed to fetch leaderboard data" },
      { status: 500 }
    );
  }
}
