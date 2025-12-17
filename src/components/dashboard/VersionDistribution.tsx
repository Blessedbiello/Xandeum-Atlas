"use client";

import { useNetworkStats } from "@/lib/hooks/use-nodes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

export function VersionDistribution() {
  const { data: stats, isLoading } = useNetworkStats();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Version Distribution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!stats || !stats.version_distribution) return null;

  // Sort versions by count (descending)
  const versions = Object.entries(stats.version_distribution)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5); // Top 5 versions

  const maxCount = Math.max(...versions.map(([, count]) => count));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Version Distribution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No version data available</p>
        ) : (
          versions.map(([version, count]) => {
            const percentage = (count / stats.total_nodes) * 100;
            return (
              <div key={version} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-mono">
                    {version === "unknown" ? "Unknown" : version}
                  </span>
                  <span className="text-muted-foreground">
                    {count} ({percentage.toFixed(1)}%)
                  </span>
                </div>
                <Progress
                  value={(count / maxCount) * 100}
                  className="h-2"
                  indicatorClassName={
                    version === "unknown"
                      ? "bg-gray-500"
                      : "bg-primary"
                  }
                />
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
