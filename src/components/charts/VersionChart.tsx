"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle, Clock } from "lucide-react";

interface VersionData {
  version: string;
  count: number;
  percentage: number;
  isLatest: boolean;
  isOutdated: boolean;
}

interface VersionChartProps {
  versionDistribution: Record<string, number>;
  totalNodes: number;
  latestVersion?: string;
  loading?: boolean;
}

// Default latest version - should match node-score.ts
const DEFAULT_LATEST_VERSION = "0.8.0";

export function VersionChart({
  versionDistribution,
  totalNodes,
  latestVersion = DEFAULT_LATEST_VERSION,
  loading = false,
}: VersionChartProps) {
  const versionData = useMemo(() => {
    if (!versionDistribution) return [];

    const data: VersionData[] = Object.entries(versionDistribution)
      .map(([version, count]) => ({
        version,
        count,
        percentage: (count / totalNodes) * 100,
        isLatest: version === latestVersion,
        isOutdated: isVersionOutdated(version, latestVersion),
      }))
      .sort((a, b) => b.count - a.count);

    return data;
  }, [versionDistribution, totalNodes, latestVersion]);

  const stats = useMemo(() => {
    const latest = versionData.find((v) => v.isLatest);
    const outdated = versionData.filter((v) => v.isOutdated);
    const unknown = versionData.find((v) => v.version === "unknown");

    return {
      latestCount: latest?.count || 0,
      latestPercent: latest?.percentage || 0,
      outdatedCount: outdated.reduce((sum, v) => sum + v.count, 0),
      outdatedPercent: outdated.reduce((sum, v) => sum + v.percentage, 0),
      unknownCount: unknown?.count || 0,
      uniqueVersions: versionData.length,
    };
  }, [versionData]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Version Tracking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          Version Tracking
          <Badge variant="outline" className="font-mono">
            Latest: {latestVersion}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-green-500/10">
            <CheckCircle className="h-5 w-5 text-green-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-green-500">{stats.latestPercent.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">On Latest</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-yellow-500/10">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-yellow-500">{stats.outdatedPercent.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Outdated</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted">
            <Clock className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-lg font-bold">{stats.uniqueVersions}</p>
            <p className="text-xs text-muted-foreground">Versions</p>
          </div>
        </div>

        {/* Version Bars */}
        <div className="space-y-3">
          {versionData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No version data available
            </p>
          ) : (
            versionData.map((v) => (
              <VersionBar
                key={v.version}
                version={v.version}
                count={v.count}
                percentage={v.percentage}
                isLatest={v.isLatest}
                isOutdated={v.isOutdated}
              />
            ))
          )}
        </div>

        {/* Upgrade Notice */}
        {stats.outdatedPercent > 20 && (
          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-500">
                  {stats.outdatedPercent.toFixed(0)}% of nodes are running outdated versions
                </p>
                <p className="text-muted-foreground">
                  Operators should upgrade to version {latestVersion} for optimal performance and security.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VersionBar({
  version,
  count,
  percentage,
  isLatest,
  isOutdated,
}: {
  version: string;
  count: number;
  percentage: number;
  isLatest: boolean;
  isOutdated: boolean;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="space-y-1 cursor-default">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="font-mono">
                  {version === "unknown" ? "Unknown" : `v${version}`}
                </span>
                {isLatest && (
                  <Badge className="bg-green-500/20 text-green-500 border-green-500/50 text-xs">
                    Latest
                  </Badge>
                )}
                {isOutdated && !isLatest && (
                  <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50 text-xs">
                    Outdated
                  </Badge>
                )}
              </div>
              <span className="text-muted-foreground">
                {count} ({percentage.toFixed(1)}%)
              </span>
            </div>
            <Progress
              value={percentage}
              className="h-2"
              indicatorClassName={cn(
                isLatest && "bg-green-500",
                isOutdated && !isLatest && "bg-yellow-500",
                version === "unknown" && "bg-gray-500",
                !isLatest && !isOutdated && version !== "unknown" && "bg-blue-500"
              )}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{version === "unknown" ? "Unknown version" : `Version ${version}`}</p>
          <p className="text-xs text-muted-foreground">{count} nodes ({percentage.toFixed(1)}%)</p>
          {isLatest && <p className="text-xs text-green-500">Running latest version</p>}
          {isOutdated && <p className="text-xs text-yellow-500">Upgrade recommended</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Check if a version is outdated compared to latest
 */
function isVersionOutdated(version: string, latestVersion: string): boolean {
  if (version === "unknown" || version === latestVersion) return false;

  const parseVersion = (v: string) => {
    const parts = v.split(".").map((p) => parseInt(p, 10) || 0);
    return parts[0] * 10000 + (parts[1] || 0) * 100 + (parts[2] || 0);
  };

  return parseVersion(version) < parseVersion(latestVersion);
}

/**
 * Compact version indicator for table cells
 */
export function VersionIndicator({
  version,
  latestVersion = DEFAULT_LATEST_VERSION,
}: {
  version?: string;
  latestVersion?: string;
}) {
  if (!version) {
    return <span className="text-muted-foreground">-</span>;
  }

  const isLatest = version === latestVersion;
  const outdated = isVersionOutdated(version, latestVersion);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "font-mono text-sm",
              isLatest && "text-green-500",
              outdated && "text-yellow-500",
              !isLatest && !outdated && "text-muted-foreground"
            )}
          >
            {version}
            {isLatest && <CheckCircle className="inline h-3 w-3 ml-1" />}
            {outdated && <AlertTriangle className="inline h-3 w-3 ml-1" />}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {isLatest ? "Running latest version" : outdated ? "Upgrade recommended" : "Version"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default VersionChart;
