"use client";

import { memo, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import type { NetworkStats } from "@/types";

const COLORS = {
  online: "#10B981",
  degraded: "#F59E0B",
  offline: "#EF4444",
};

interface StatusDistributionProps {
  stats?: NetworkStats | null;
  isLoading?: boolean;
}

/**
 * StatusDistribution - Displays pie chart of node statuses
 * OPTIMIZED: Accepts stats as props, memoized for performance
 */
export const StatusDistribution = memo(function StatusDistribution({
  stats,
  isLoading = false,
}: StatusDistributionProps) {
  // Memoize chart data to prevent recalculation
  const data = useMemo(() => {
    if (!stats) return [];
    return [
      { name: "Online", value: stats.online_nodes, color: COLORS.online },
      { name: "Degraded", value: stats.degraded_nodes, color: COLORS.degraded },
      { name: "Offline", value: stats.offline_nodes, color: COLORS.offline },
    ].filter((d) => d.value > 0);
  }, [stats]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Status Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value: number, name: string) => [
                  `${value} nodes (${((value / stats.total_nodes) * 100).toFixed(
                    1
                  )}%)`,
                  name,
                ]}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => (
                  <span className="text-sm text-muted-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Stats breakdown */}
        <div className="grid grid-cols-3 gap-2 mt-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-500">
              {stats.online_nodes}
            </div>
            <div className="text-xs text-muted-foreground">Online</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-500">
              {stats.degraded_nodes}
            </div>
            <div className="text-xs text-muted-foreground">Degraded</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-500">
              {stats.offline_nodes}
            </div>
            <div className="text-xs text-muted-foreground">Offline</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
