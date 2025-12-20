/**
 * Network Analytics API Route
 * Returns historical network-wide metrics and trends
 * Rate limited to 100 requests per minute per IP
 */

import { NextRequest, NextResponse } from "next/server";
import { withRateLimit } from "@/lib/ratelimit";
import { getNetworkHistory, isDatabaseAvailable } from "@/lib/db/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Query parameter validation
const NetworkAnalyticsQuerySchema = z.object({
  hours: z.coerce.number().int().positive().max(720).default(24), // Max 30 days
  interval: z.enum(['hour', 'day']).default('hour'),
});

/**
 * GET /api/analytics/network
 *
 * Returns network-wide metrics over time
 *
 * Query Parameters:
 * - hours: Number of hours to fetch (default: 24, max: 720)
 * - interval: Aggregation interval - 'hour' or 'day' (default: 'hour')
 */
export async function GET(request: NextRequest) {
  return withRateLimit(request, async () => {
    const startTime = Date.now();

    if (!isDatabaseAvailable()) {
      return NextResponse.json(
        {
          error: "Historical data not available",
          message: "Database not configured",
        },
        { status: 503 }
      );
    }

    try {
      const { searchParams } = new URL(request.url);
      const { hours, interval } = NetworkAnalyticsQuerySchema.parse({
        hours: searchParams.get("hours"),
        interval: searchParams.get("interval"),
      });

      const history = await getNetworkHistory(hours, interval);

      if (history.length === 0) {
        return NextResponse.json(
          {
            error: "No historical data found",
            message: `No network data found for the requested time range`,
          },
          { status: 404 }
        );
      }

      // Calculate summary statistics
      const totalPoints = history.length;
      const avgHealth = history.reduce((sum, h) => sum + h.health_percent, 0) / totalPoints;
      const minHealth = Math.min(...history.map(h => h.health_percent));
      const maxHealth = Math.max(...history.map(h => h.health_percent));
      const avgNodes = history.reduce((sum, h) => sum + h.total_nodes, 0) / totalPoints;

      return NextResponse.json(
        {
          history,
          summary: {
            total_data_points: totalPoints,
            avg_health_percent: Math.round(avgHealth * 10) / 10,
            min_health_percent: Math.round(minHealth * 10) / 10,
            max_health_percent: Math.round(maxHealth * 10) / 10,
            avg_total_nodes: Math.round(avgNodes),
            time_range_hours: hours,
            interval,
          },
          fetched_at: new Date().toISOString(),
        },
        {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
            "X-Response-Time": `${Date.now() - startTime}ms`,
          },
        }
      );
    } catch (error) {
      console.error("[API /analytics/network] Error:", error);

      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: "Invalid parameters",
            issues: error.issues,
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error: "Failed to fetch network analytics",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  });
}
