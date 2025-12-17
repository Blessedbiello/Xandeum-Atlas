/**
 * Export API Route
 * Provides node data export in CSV and JSON formats
 */

import { NextRequest, NextResponse } from "next/server";
import { collectNetworkSnapshot } from "@/lib/prpc/collector";
import { calculateLeaderboard } from "@/lib/scoring/node-score";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json";
    const includeScores = searchParams.get("scores") === "true";
    const includeStats = searchParams.get("stats") !== "false"; // Default true

    // Collect node data
    const collectionResult = await collectNetworkSnapshot();
    const nodes = collectionResult.nodes;

    // Calculate scores if requested
    const scores = includeScores ? calculateLeaderboard(nodes) : null;
    const scoreMap = scores
      ? new Map(scores.map((s) => [s.pubkey, s]))
      : null;

    // Build export data
    const exportData = nodes.map((node) => {
      const score = scoreMap?.get(node.pubkey);

      const baseData = {
        pubkey: node.pubkey,
        address: node.address,
        version: node.version || "unknown",
        status: node.status,
        last_seen: new Date(node.last_seen_timestamp * 1000).toISOString(),
      };

      const statsData = includeStats && node.stats
        ? {
            cpu_percent: node.stats.cpu_percent,
            ram_used: node.stats.ram_used,
            ram_total: node.stats.ram_total,
            ram_percent: node.ram_percent,
            uptime_seconds: node.stats.uptime,
            uptime_formatted: node.uptime_formatted,
            packets_sent: node.stats.packets_sent,
            packets_received: node.stats.packets_received,
            total_bytes: node.stats.total_bytes,
            active_streams: node.stats.active_streams,
          }
        : {};

      const scoreData = score
        ? {
            score_total: score.total,
            score_badge: score.badge,
            score_uptime: score.uptime_score,
            score_stability: score.stability_score,
            score_performance: score.performance_score,
            score_longevity: score.longevity_score,
            score_version: score.version_score,
          }
        : {};

      return {
        ...baseData,
        ...statsData,
        ...scoreData,
      };
    });

    // Generate response based on format
    if (format === "csv") {
      const csv = convertToCSV(exportData);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="xandeum-nodes-${Date.now()}.csv"`,
        },
      });
    }

    // Default JSON response
    return NextResponse.json({
      nodes: exportData,
      meta: {
        total: exportData.length,
        exported_at: new Date().toISOString(),
        includes_scores: includeScores,
        includes_stats: includeStats,
      },
    });
  } catch (error) {
    console.error("Export API error:", error);
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    );
  }
}

/**
 * Convert array of objects to CSV string
 */
function convertToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";

  // Get headers from first object
  const headers = Object.keys(data[0]);

  // Build CSV rows
  const rows = data.map((item) =>
    headers
      .map((header) => {
        const value = item[header];
        if (value === null || value === undefined) return "";
        if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      })
      .join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}
