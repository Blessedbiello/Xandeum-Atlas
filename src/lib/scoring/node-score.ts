/**
 * Node Scoring and Badge System
 *
 * Calculates a reputation score for pNodes based on:
 * - Uptime (0-40 points)
 * - Stability (0-20 points)
 * - Performance (0-20 points)
 * - Longevity (0-10 points)
 * - Version (0-10 points)
 */

import type { NodeWithStats } from "@/types";

export type BadgeType = "Elite" | "Reliable" | "Standard" | "New" | "At Risk";

export interface NodeScore {
  pubkey: string;
  uptime_score: number;      // 0-40
  stability_score: number;   // 0-20
  performance_score: number; // 0-20
  longevity_score: number;   // 0-10
  version_score: number;     // 0-10
  total: number;             // 0-100
  badge: BadgeType;
  breakdown: {
    uptime_percent: number;
    cpu_headroom: number;
    ram_headroom: number;
    days_online: number;
    is_latest_version: boolean;
  };
}

// Latest known version (update as new versions are released)
const LATEST_VERSION = "0.8.0";

/**
 * Calculate node score based on available metrics
 */
export function calculateNodeScore(node: NodeWithStats): NodeScore {
  const stats = node.stats;

  // Default breakdown
  const breakdown = {
    uptime_percent: 0,
    cpu_headroom: 100,
    ram_headroom: 100,
    days_online: 0,
    is_latest_version: false,
  };

  // Calculate uptime score (0-40 points)
  let uptime_score = 0;
  if (stats?.uptime) {
    const uptimeHours = stats.uptime / 3600;
    const uptimeDays = uptimeHours / 24;
    breakdown.days_online = Math.floor(uptimeDays);

    // Assume 99.9% uptime if online for > 7 days
    // This is a simplified calculation without historical data
    if (node.status === "online") {
      breakdown.uptime_percent = uptimeDays > 7 ? 99.9 : 95 + (uptimeDays / 7) * 4.9;
    } else if (node.status === "degraded") {
      breakdown.uptime_percent = 90;
    } else {
      breakdown.uptime_percent = 50;
    }

    uptime_score = Math.min(40, (breakdown.uptime_percent / 100) * 40);
  }

  // Calculate stability score (0-20 points)
  let stability_score = 0;
  if (node.status === "online") {
    stability_score = 20;
  } else if (node.status === "degraded") {
    stability_score = 10;
  } else if (node.status === "offline") {
    stability_score = 0;
  } else {
    stability_score = 5;
  }

  // Calculate performance score (0-20 points)
  let performance_score = 0;
  if (stats) {
    // CPU headroom: lower usage = better
    breakdown.cpu_headroom = 100 - stats.cpu_percent;
    const cpuScore = Math.min(10, (breakdown.cpu_headroom / 100) * 10);

    // RAM headroom: lower usage = better
    if (node.ram_percent !== undefined) {
      breakdown.ram_headroom = 100 - node.ram_percent;
    } else if (stats.ram_total > 0) {
      breakdown.ram_headroom = 100 - (stats.ram_used / stats.ram_total) * 100;
    }
    const ramScore = Math.min(10, (breakdown.ram_headroom / 100) * 10);

    performance_score = cpuScore + ramScore;
  }

  // Calculate longevity score (0-10 points)
  let longevity_score = 0;
  if (stats?.uptime) {
    const uptimeDays = stats.uptime / 86400;
    // 10 points for 30+ days, linear scale below
    longevity_score = Math.min(10, (uptimeDays / 30) * 10);
  }

  // Calculate version score (0-10 points)
  let version_score = 0;
  if (node.version) {
    breakdown.is_latest_version = node.version === LATEST_VERSION;
    if (breakdown.is_latest_version) {
      version_score = 10;
    } else {
      // Partial credit for close versions
      const versionNum = parseVersionNumber(node.version);
      const latestNum = parseVersionNumber(LATEST_VERSION);
      const versionDiff = latestNum - versionNum;
      version_score = Math.max(0, 10 - versionDiff * 2);
    }
  }

  // Calculate total score
  const total = Math.round(
    uptime_score + stability_score + performance_score + longevity_score + version_score
  );

  // Determine badge
  const badge = determineBadge(total, breakdown.days_online);

  return {
    pubkey: node.pubkey,
    uptime_score: Math.round(uptime_score * 10) / 10,
    stability_score: Math.round(stability_score * 10) / 10,
    performance_score: Math.round(performance_score * 10) / 10,
    longevity_score: Math.round(longevity_score * 10) / 10,
    version_score: Math.round(version_score * 10) / 10,
    total,
    badge,
    breakdown: {
      uptime_percent: Math.round(breakdown.uptime_percent * 10) / 10,
      cpu_headroom: Math.round(breakdown.cpu_headroom * 10) / 10,
      ram_headroom: Math.round(breakdown.ram_headroom * 10) / 10,
      days_online: breakdown.days_online,
      is_latest_version: breakdown.is_latest_version,
    },
  };
}

/**
 * Determine badge based on score and days online
 */
function determineBadge(total: number, daysOnline: number): BadgeType {
  if (daysOnline < 7) {
    return "New";
  }
  if (total >= 95) {
    return "Elite";
  }
  if (total >= 85) {
    return "Reliable";
  }
  if (total >= 70) {
    return "Standard";
  }
  return "At Risk";
}

/**
 * Parse version string to numeric value for comparison
 * e.g., "0.8.0" -> 8, "0.7.3" -> 7.3
 */
function parseVersionNumber(version: string): number {
  const parts = version.split(".");
  if (parts.length >= 2) {
    const major = parseInt(parts[0], 10) || 0;
    const minor = parseInt(parts[1], 10) || 0;
    const patch = parseInt(parts[2], 10) || 0;
    return major * 100 + minor + patch * 0.01;
  }
  return 0;
}

/**
 * Get badge color classes
 */
export function getBadgeColor(badge: BadgeType): {
  bg: string;
  text: string;
  border: string;
} {
  switch (badge) {
    case "Elite":
      return {
        bg: "bg-purple-500/20",
        text: "text-purple-400",
        border: "border-purple-500/50",
      };
    case "Reliable":
      return {
        bg: "bg-green-500/20",
        text: "text-green-400",
        border: "border-green-500/50",
      };
    case "Standard":
      return {
        bg: "bg-blue-500/20",
        text: "text-blue-400",
        border: "border-blue-500/50",
      };
    case "New":
      return {
        bg: "bg-cyan-500/20",
        text: "text-cyan-400",
        border: "border-cyan-500/50",
      };
    case "At Risk":
      return {
        bg: "bg-red-500/20",
        text: "text-red-400",
        border: "border-red-500/50",
      };
  }
}

/**
 * Get badge icon
 */
export function getBadgeIcon(badge: BadgeType): string {
  switch (badge) {
    case "Elite":
      return "🏆";
    case "Reliable":
      return "✓";
    case "Standard":
      return "●";
    case "New":
      return "★";
    case "At Risk":
      return "⚠";
  }
}

/**
 * Calculate scores for multiple nodes and return sorted by score
 */
export function calculateLeaderboard(
  nodes: NodeWithStats[],
  limit?: number
): NodeScore[] {
  const scores = nodes.map(calculateNodeScore);
  scores.sort((a, b) => b.total - a.total);
  return limit ? scores.slice(0, limit) : scores;
}
