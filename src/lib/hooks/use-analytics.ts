"use client";

import { useQuery } from "@tanstack/react-query";

interface NodeHistoryPoint {
  timestamp: string;
  status: string;
  cpu_percent: number | null;
  ram_percent: number | null;
  uptime_seconds: number | null;
  packets_sent: number | null;
  packets_received: number | null;
}

interface NodeUptimeStats {
  pubkey: string;
  total_snapshots: number;
  online_snapshots: number;
  uptime_percent: number;
  last_seen: string;
  first_seen: string;
  avg_cpu: number | null;
  avg_ram: number | null;
  max_uptime_seconds: number | null;
}

interface NodeHistoryResponse {
  pubkey: string;
  history: NodeHistoryPoint[];
  uptime_stats: NodeUptimeStats | null;
  hours_requested: number;
  data_points: number;
  fetched_at: string;
}

interface NetworkHistoryPoint {
  timestamp: string;
  total_nodes: number;
  online_nodes: number;
  degraded_nodes: number;
  offline_nodes: number;
  health_percent: number;
  avg_cpu: number | null;
  avg_ram: number | null;
}

interface NetworkAnalyticsResponse {
  history: NetworkHistoryPoint[];
  summary: {
    total_data_points: number;
    avg_health_percent: number;
    min_health_percent: number;
    max_health_percent: number;
    avg_total_nodes: number;
    time_range_hours: number;
    interval: 'hour' | 'day';
  };
  fetched_at: string;
}

/**
 * Fetch historical data for a specific node
 */
export function useNodeHistory(pubkey: string | null, hours: number = 24) {
  return useQuery<NodeHistoryResponse>({
    queryKey: ["node-history", pubkey, hours],
    queryFn: async () => {
      if (!pubkey) throw new Error("Pubkey is required");

      const response = await fetch(
        `/api/nodes/${pubkey}/history?hours=${hours}`
      );

      if (!response.ok) {
        // Handle 503 (database not available) gracefully
        if (response.status === 503) {
          return null;
        }
        throw new Error(`Failed to fetch node history: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!pubkey,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry if database is unavailable
  });
}

/**
 * Fetch network-wide analytics over time
 */
export function useNetworkAnalytics(
  hours: number = 24,
  interval: 'hour' | 'day' = 'hour'
) {
  return useQuery<NetworkAnalyticsResponse>({
    queryKey: ["network-analytics", hours, interval],
    queryFn: async () => {
      const response = await fetch(
        `/api/analytics/network?hours=${hours}&interval=${interval}`
      );

      if (!response.ok) {
        // Handle 503 (database not available) gracefully
        if (response.status === 503) {
          return null;
        }
        throw new Error(
          `Failed to fetch network analytics: ${response.statusText}`
        );
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry if database is unavailable
  });
}
