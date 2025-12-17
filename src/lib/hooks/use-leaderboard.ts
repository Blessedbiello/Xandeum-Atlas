"use client";

import { useQuery } from "@tanstack/react-query";
import type { NodeScore, BadgeType } from "@/lib/scoring/node-score";

interface LeaderboardApiResponse {
  scores: NodeScore[];
  total: number;
  filtered_total: number;
  badge_distribution: Record<string, number>;
  fetched_at: string;
}

/**
 * Fetch leaderboard data
 */
export function useLeaderboard(params?: { limit?: number; badge?: BadgeType }) {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.badge) searchParams.set("badge", params.badge);

  const queryString = searchParams.toString();
  const url = queryString ? `/api/leaderboard?${queryString}` : "/api/leaderboard";

  return useQuery<LeaderboardApiResponse>({
    queryKey: ["leaderboard", params],
    queryFn: async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
      }
      return response.json();
    },
    refetchInterval: 60 * 1000, // 1 minute
  });
}
