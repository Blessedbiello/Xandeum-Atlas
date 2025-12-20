/**
 * Node History API Route
 * Returns historical metrics for a specific node
 * Rate limited to 100 requests per minute per IP
 */

import { NextRequest, NextResponse } from "next/server";
import { withRateLimit } from "@/lib/ratelimit";
import { getNodeHistory, getNodeUptimeStats, isDatabaseAvailable } from "@/lib/db/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Query parameter validation
const HistoryQuerySchema = z.object({
  hours: z.coerce.number().int().positive().max(720).default(24), // Max 30 days
});

/**
 * GET /api/nodes/[pubkey]/history
 *
 * Query Parameters:
 * - hours: Number of hours to fetch (default: 24, max: 720)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { pubkey: string } }
) {
  return withRateLimit(request, async () => {
    const startTime = Date.now();
    const { pubkey } = params;

    if (!pubkey || pubkey.length < 32) {
      return NextResponse.json(
        { error: "Invalid pubkey" },
        { status: 400 }
      );
    }

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
      const { hours } = HistoryQuerySchema.parse({
        hours: searchParams.get("hours"),
      });

      // Fetch both history and uptime stats in parallel
      const [history, uptimeStats] = await Promise.all([
        getNodeHistory(pubkey, hours),
        getNodeUptimeStats(pubkey, Math.ceil(hours / 24)),
      ]);

      if (history.length === 0 && !uptimeStats) {
        return NextResponse.json(
          {
            error: "No historical data found",
            message: `No data found for node ${pubkey}`,
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          pubkey,
          history,
          uptime_stats: uptimeStats,
          hours_requested: hours,
          data_points: history.length,
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
      console.error(`[API /nodes/${pubkey}/history] Error:`, error);

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
          error: "Failed to fetch node history",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  });
}
