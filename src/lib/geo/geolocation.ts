/**
 * IP Geolocation Service using IP-API.com
 * Free tier: Unlimited requests for non-commercial use
 * Rate limit: 45 requests per minute
 */

import { z } from "zod";

const IP_API_URL = "http://ip-api.com/json";

// Response schema from IP-API
const GeoResponseSchema = z.object({
  status: z.enum(["success", "fail"]),
  country: z.string().optional(),
  countryCode: z.string().optional(),
  region: z.string().optional(),
  regionName: z.string().optional(),
  city: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  isp: z.string().optional(),
  as: z.string().optional(), // ASN
  message: z.string().optional(), // Error message
});

export interface GeoLocation {
  ip: string;
  country: string;
  countryCode: string;
  region: string;
  city: string;
  lat: number;
  lon: number;
  isp: string;
  asn: string;
  dataCenter?: string;
}

// Cache for geolocation results (IP rarely changes location)
const geoCache = new Map<string, GeoLocation>();

/**
 * Get geolocation data for an IP address
 */
export async function getGeoLocation(ip: string): Promise<GeoLocation | null> {
  // Check cache first
  if (geoCache.has(ip)) {
    return geoCache.get(ip)!;
  }

  try {
    const response = await fetch(
      `${IP_API_URL}/${ip}?fields=status,country,countryCode,region,regionName,city,lat,lon,isp,as,message`,
      { next: { revalidate: 86400 } } // Cache for 24 hours
    );

    const data = await response.json();
    const parsed = GeoResponseSchema.safeParse(data);

    if (!parsed.success || parsed.data.status === "fail") {
      console.error(`Geolocation failed for ${ip}:`, parsed.data?.message);
      return null;
    }

    const geo: GeoLocation = {
      ip,
      country: parsed.data.country || "Unknown",
      countryCode: parsed.data.countryCode || "XX",
      region: parsed.data.regionName || "Unknown",
      city: parsed.data.city || "Unknown",
      lat: parsed.data.lat || 0,
      lon: parsed.data.lon || 0,
      isp: parsed.data.isp || "Unknown",
      asn: parsed.data.as || "Unknown",
      dataCenter: inferDataCenter(parsed.data.isp || "", parsed.data.as || ""),
    };

    // Cache the result
    geoCache.set(ip, geo);

    return geo;
  } catch (error) {
    console.error(`Geolocation error for ${ip}:`, error);
    return null;
  }
}

/**
 * Batch geolocation with rate limiting
 * IP-API allows 45 requests per minute on free tier
 */
export async function batchGeoLocation(
  ips: string[],
  delayMs = 1400 // ~43 requests per minute to stay under limit
): Promise<Map<string, GeoLocation>> {
  const results = new Map<string, GeoLocation>();

  for (const ip of ips) {
    const geo = await getGeoLocation(ip);
    if (geo) {
      results.set(ip, geo);
    }
    // Rate limit delay
    await new Promise((r) => setTimeout(r, delayMs));
  }

  return results;
}

/**
 * Infer data center from ISP/ASN information
 */
function inferDataCenter(isp: string, asn: string): string {
  const ispLower = isp.toLowerCase();
  const asnLower = asn.toLowerCase();

  // Common hosting providers
  if (ispLower.includes("hetzner") || asnLower.includes("hetzner")) {
    return "Hetzner";
  }
  if (ispLower.includes("ovh") || asnLower.includes("ovh")) {
    return "OVH";
  }
  if (ispLower.includes("amazon") || ispLower.includes("aws")) {
    return "AWS";
  }
  if (ispLower.includes("google") || ispLower.includes("gcp")) {
    return "Google Cloud";
  }
  if (ispLower.includes("digitalocean")) {
    return "DigitalOcean";
  }
  if (ispLower.includes("linode") || ispLower.includes("akamai")) {
    return "Linode/Akamai";
  }
  if (ispLower.includes("vultr")) {
    return "Vultr";
  }
  if (ispLower.includes("contabo")) {
    return "Contabo";
  }
  if (ispLower.includes("scaleway")) {
    return "Scaleway";
  }
  if (ispLower.includes("azure") || ispLower.includes("microsoft")) {
    return "Azure";
  }

  return "Other";
}

/**
 * Calculate data center concentration scores
 */
export interface DCConcentration {
  dataCenter: string;
  count: number;
  percentage: number;
  score: number; // 0-2, higher is better (more decentralized)
  risk: "LOW" | "MEDIUM" | "HIGH";
}

export function calculateDCConcentration(
  geoData: GeoLocation[]
): DCConcentration[] {
  const dcCounts = new Map<string, number>();
  const total = geoData.length;

  // Count nodes per data center
  for (const geo of geoData) {
    const dc = geo.dataCenter || "Unknown";
    dcCounts.set(dc, (dcCounts.get(dc) || 0) + 1);
  }

  // Calculate concentration scores
  const results: DCConcentration[] = [];

  Array.from(dcCounts.entries()).forEach(([dc, count]) => {
    const percentage = (count / total) * 100;
    // Score: 2.0 = excellent (decentralized), 0.0 = poor (concentrated)
    const score = Math.max(0, 2.0 - (percentage / 50) * 2.0);
    const risk: "LOW" | "MEDIUM" | "HIGH" =
      percentage > 30 ? "HIGH" : percentage > 15 ? "MEDIUM" : "LOW";

    results.push({
      dataCenter: dc,
      count,
      percentage: Math.round(percentage * 10) / 10,
      score: Math.round(score * 100) / 100,
      risk,
    });
  });

  // Sort by count descending
  return results.sort((a, b) => b.count - a.count);
}

/**
 * Calculate country distribution
 */
export interface CountryDistribution {
  country: string;
  countryCode: string;
  count: number;
  percentage: number;
}

export function calculateCountryDistribution(
  geoData: GeoLocation[]
): CountryDistribution[] {
  const countryCounts = new Map<string, { code: string; count: number }>();
  const total = geoData.length;

  for (const geo of geoData) {
    const existing = countryCounts.get(geo.country);
    if (existing) {
      existing.count++;
    } else {
      countryCounts.set(geo.country, { code: geo.countryCode, count: 1 });
    }
  }

  const results: CountryDistribution[] = [];
  Array.from(countryCounts.entries()).forEach(([country, data]) => {
    results.push({
      country,
      countryCode: data.code,
      count: data.count,
      percentage: Math.round((data.count / total) * 1000) / 10,
    });
  });

  return results.sort((a, b) => b.count - a.count);
}

/**
 * Clear the geolocation cache
 */
export function clearGeoCache(): void {
  geoCache.clear();
}

/**
 * Get cache size
 */
export function getGeoCacheSize(): number {
  return geoCache.size;
}
