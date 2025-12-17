"use client";

import { useQuery } from "@tanstack/react-query";
import type { GeoLocation, DCConcentration, CountryDistribution } from "@/lib/geo/geolocation";

interface NodeGeoData {
  pubkey: string;
  status: "online" | "degraded" | "offline" | "unknown";
  geo: GeoLocation;
}

interface GeoApiResponse {
  nodes: NodeGeoData[];
  total: number;
  geolocated: number;
  dcConcentration: DCConcentration[];
  countryDistribution: CountryDistribution[];
  fetched_at: string;
}

/**
 * Fetch geolocation data for all nodes
 */
export function useGeoData() {
  return useQuery<GeoApiResponse>({
    queryKey: ["geoData"],
    queryFn: async () => {
      const response = await fetch("/api/geo");
      if (!response.ok) {
        throw new Error(`Failed to fetch geo data: ${response.statusText}`);
      }
      return response.json();
    },
    // Geo data doesn't change often, cache for 5 minutes
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
