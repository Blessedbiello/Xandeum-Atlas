"use client";

import { useQuery } from "@tanstack/react-query";
import type { NodesApiResponse, NetworkStats, NodeDetailApiResponse } from "@/types";

const REFRESH_INTERVAL = 60 * 1000; // 60 seconds

/**
 * Fetch all nodes with optional filtering
 */
export function useNodes(params?: {
  status?: string;
  sort?: string;
  order?: string;
  page?: number;
  limit?: number;
  search?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.sort) searchParams.set("sort", params.sort);
  if (params?.order) searchParams.set("order", params.order);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.search) searchParams.set("search", params.search);

  const queryString = searchParams.toString();
  const url = queryString ? `/api/nodes?${queryString}` : "/api/nodes";

  return useQuery<NodesApiResponse>({
    queryKey: ["nodes", params],
    queryFn: async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch nodes: ${response.statusText}`);
      }
      return response.json();
    },
    refetchInterval: REFRESH_INTERVAL,
  });
}

/**
 * Fetch a single node by pubkey
 */
export function useNode(pubkey: string | null) {
  return useQuery<NodeDetailApiResponse>({
    queryKey: ["node", pubkey],
    queryFn: async () => {
      if (!pubkey) throw new Error("Pubkey is required");
      const response = await fetch(`/api/nodes/${pubkey}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Node not found");
        }
        throw new Error(`Failed to fetch node: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!pubkey,
    refetchInterval: REFRESH_INTERVAL,
  });
}

/**
 * Fetch network-wide statistics
 */
export function useNetworkStats() {
  return useQuery<NetworkStats>({
    queryKey: ["networkStats"],
    queryFn: async () => {
      const response = await fetch("/api/stats");
      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.statusText}`);
      }
      return response.json();
    },
    refetchInterval: 30 * 1000, // 30 seconds
  });
}

/**
 * Fetch API health status
 */
export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const response = await fetch("/api/health");
      return response.json();
    },
    refetchInterval: 60 * 1000,
  });
}
