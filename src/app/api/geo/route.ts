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
import { getCache, setCache, getIpGeo, setIpGeo, CACHE_KEYS, CACHE_TTL } from "@/lib/cache/redis";

// Interface for API response
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

export async function GET() {
  const startTime = Date.now();

  try {
    // Check Redis cache first
    const cachedGeoData = await getCache<GeoApiResponse>(CACHE_KEYS.GEO_DATA);
    if (cachedGeoData) {
      return NextResponse.json(cachedGeoData, {
        headers: {
          "X-Response-Time": `${Date.now() - startTime}ms`,
          "X-Cache": "HIT",
        },
      });
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

    // Fetch geolocation for each unique IP (with per-IP caching)
    const geoResults: GeoLocation[] = [];
    const ipArray = Array.from(uniqueIps);
    const uncachedIps: string[] = [];

    // Check cache for each IP first
    for (const ip of ipArray) {
      const cachedGeo = await getIpGeo(ip);
      if (cachedGeo) {
        geoResults.push(cachedGeo);
      } else {
        uncachedIps.push(ip);
      }
    }

    // Only fetch geolocation for uncached IPs (with rate limiting)
    if (uncachedIps.length > 0) {
      const batchSize = 45; // IP-API allows 45 req/min on free tier
      for (let i = 0; i < uncachedIps.length; i += batchSize) {
        const batch = uncachedIps.slice(i, i + batchSize);

        const batchPromises = batch.map(async (ip) => {
          const geo = await getGeoLocation(ip);
          if (geo) {
            // Cache this IP's geolocation for 30 days (fire and forget)
            setIpGeo(ip, geo).catch(() => {}); // Don't await to avoid blocking
          }
          return geo;
        });

        const batchResults = await Promise.all(batchPromises);
        geoResults.push(...batchResults.filter((g): g is GeoLocation => g !== null));

        // Wait 1.5 seconds between batches (45 req in 60s = ~1.3s per batch safe)
        if (i + batchSize < uncachedIps.length) {
          await new Promise((r) => setTimeout(r, 1500));
        }
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

    // Build and cache the response
    const responseData: GeoApiResponse = {
      nodes: nodesWithGeo,
      total: nodesWithGeo.length,
      geolocated: geoResults.length,
      dcConcentration,
      countryDistribution,
      fetched_at: new Date().toISOString(),
    };

    // Cache the full geo data response
    await setCache(CACHE_KEYS.GEO_DATA, responseData, CACHE_TTL.GEO_DATA);

    return NextResponse.json(responseData, {
      headers: {
        "X-Response-Time": `${Date.now() - startTime}ms`,
        "X-Cache": "MISS",
        "X-Cached-IPs": String(ipArray.length - uncachedIps.length),
        "X-New-IPs": String(uncachedIps.length),
      },
    });
  } catch (error) {
    console.error("Geo API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch geolocation data" },
      { status: 500 }
    );
  }
}
