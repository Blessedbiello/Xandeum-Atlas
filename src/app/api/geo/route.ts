/**
 * Geolocation API Route
 * Provides geolocation data for pNode IP addresses
 */

import { NextResponse } from "next/server";

// Force dynamic rendering - this route makes external API calls
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { collectNetworkSnapshot } from "@/lib/prpc/collector";
import {
  getGeoLocation,
  calculateDCConcentration,
  calculateCountryDistribution,
  type GeoLocation,
} from "@/lib/geo/geolocation";

// Cache for geo results
interface GeoApiResponse {
  nodes: Array<{
    pubkey: string;
    status: string;
    geo: GeoLocation;
  }>;
  total: number;
  geolocated: number;
  dcConcentration: ReturnType<typeof calculateDCConcentration>;
  countryDistribution: ReturnType<typeof calculateCountryDistribution>;
  fetched_at: string;
}

let geoCache: GeoApiResponse | null = null;
let lastFetched = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  try {
    const now = Date.now();

    // Return cached data if fresh
    if (geoCache && now - lastFetched < CACHE_DURATION) {
      return NextResponse.json(geoCache);
    }

    // Collect nodes from pRPC
    const collectionResult = await collectNetworkSnapshot();
    const nodes = collectionResult.nodes;

    // Extract unique IPs from node addresses
    const uniqueIps = new Set<string>();
    const nodeIpMap = new Map<string, string>(); // pubkey -> ip

    for (const node of nodes) {
      // Extract IP from address (format: "ip:port")
      const ip = node.address.split(":")[0];
      if (ip && !ip.startsWith("0.") && !ip.startsWith("127.")) {
        uniqueIps.add(ip);
        nodeIpMap.set(node.pubkey, ip);
      }
    }

    // Fetch geolocation for each unique IP (with rate limiting)
    const geoResults: GeoLocation[] = [];
    const ipArray = Array.from(uniqueIps);

    // Process in batches to respect rate limits (45 req/min for IP-API)
    const batchSize = 40;
    for (let i = 0; i < ipArray.length; i += batchSize) {
      const batch = ipArray.slice(i, i + batchSize);

      const batchPromises = batch.map(async (ip) => {
        const geo = await getGeoLocation(ip);
        return geo;
      });

      const batchResults = await Promise.all(batchPromises);
      geoResults.push(...batchResults.filter((g): g is GeoLocation => g !== null));

      // Wait 60 seconds between batches if more batches remain
      if (i + batchSize < ipArray.length) {
        await new Promise((r) => setTimeout(r, 60000));
      }
    }

    // Calculate concentration metrics
    const dcConcentration = calculateDCConcentration(geoResults);
    const countryDistribution = calculateCountryDistribution(geoResults);

    // Build response with node pubkeys attached to geo data
    const nodesWithGeo = nodes.map((node) => {
      const ip = nodeIpMap.get(node.pubkey);
      const geo = ip ? geoResults.find((g) => g.ip === ip) : null;
      return {
        pubkey: node.pubkey,
        status: node.status,
        geo: geo || {
          ip: ip || "unknown",
          country: "Unknown",
          countryCode: "XX",
          region: "Unknown",
          city: "Unknown",
          lat: 0,
          lon: 0,
          isp: "Unknown",
          asn: "Unknown",
          dataCenter: "Unknown",
        },
      };
    });

    // Cache the results
    const responseData: GeoApiResponse = {
      nodes: nodesWithGeo,
      total: nodesWithGeo.length,
      geolocated: geoResults.length,
      dcConcentration,
      countryDistribution,
      fetched_at: new Date().toISOString(),
    };

    geoCache = responseData;
    lastFetched = now;

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Geo API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch geolocation data" },
      { status: 500 }
    );
  }
}
