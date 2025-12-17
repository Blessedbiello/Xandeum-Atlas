import { NextResponse } from "next/server";
import { checkSeedHealth, SEED_IPS } from "@/lib/prpc";

export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * Health check endpoint for the API and seed node connectivity.
 */
export async function GET() {
  const startTime = Date.now();

  try {
    const seedHealth = await checkSeedHealth();

    const healthySeeds = seedHealth.filter((s) => s.healthy).length;
    const avgLatency =
      seedHealth
        .filter((s) => s.healthy)
        .reduce((sum, s) => sum + s.latency_ms, 0) / (healthySeeds || 1);

    const status =
      healthySeeds === 0
        ? "critical"
        : healthySeeds < SEED_IPS.length / 2
        ? "degraded"
        : "healthy";

    return NextResponse.json(
      {
        status,
        timestamp: new Date().toISOString(),
        seeds: {
          total: SEED_IPS.length,
          healthy: healthySeeds,
          avg_latency_ms: Math.round(avgLatency),
          details: seedHealth,
        },
        api: {
          response_time_ms: Date.now() - startTime,
        },
      },
      {
        status: status === "critical" ? 503 : 200,
        headers: {
          "Cache-Control": "no-cache",
        },
      }
    );
  } catch (error) {
    console.error("[API /health] Error:", error);
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
