"use client";

import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes, formatPercent } from "@/lib/utils";
import {
  Server,
  Activity,
  Cpu,
  HardDrive,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import type { NetworkStats } from "@/types";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  loading?: boolean;
}

const StatCard = memo(function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  loading,
}: StatCardProps) {
  if (loading) {
    return (
      <Card className="stat-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16 mb-1" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="stat-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center gap-2 mt-1">
          {trend && trendValue && (
            <span
              className={`flex items-center text-xs ${
                trend === "up"
                  ? "text-green-500"
                  : trend === "down"
                  ? "text-red-500"
                  : "text-muted-foreground"
              }`}
            >
              {trend === "up" ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : trend === "down" ? (
                <TrendingDown className="h-3 w-3 mr-1" />
              ) : null}
              {trendValue}
            </span>
          )}
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

interface StatsCardsProps {
  stats?: NetworkStats | null;
  isLoading?: boolean;
  error?: Error | null;
}

/**
 * StatsCards - Displays network statistics cards
 * OPTIMIZED: Accepts stats as props to avoid duplicate API calls
 */
export const StatsCards = memo(function StatsCards({
  stats,
  isLoading = false,
  error = null,
}: StatsCardsProps) {
  if (error) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="col-span-full border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              Failed to load network statistics. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Nodes"
        value={stats?.total_nodes ?? "-"}
        subtitle={`${stats?.online_nodes ?? 0} online`}
        icon={<Server className="h-4 w-4" />}
        loading={isLoading}
      />
      <StatCard
        title="Network Health"
        value={stats ? `${stats.health_percent}%` : "-"}
        subtitle={
          stats
            ? `${stats.degraded_nodes} degraded, ${stats.offline_nodes} offline`
            : undefined
        }
        icon={<Activity className="h-4 w-4" />}
        trend={
          stats
            ? stats.health_percent >= 90
              ? "up"
              : stats.health_percent >= 70
              ? "neutral"
              : "down"
            : undefined
        }
        loading={isLoading}
      />
      <StatCard
        title="Avg CPU Usage"
        value={stats ? formatPercent(stats.avg_cpu) : "-"}
        subtitle="Across all nodes"
        icon={<Cpu className="h-4 w-4" />}
        trend={
          stats
            ? stats.avg_cpu < 50
              ? "up"
              : stats.avg_cpu < 80
              ? "neutral"
              : "down"
            : undefined
        }
        loading={isLoading}
      />
      <StatCard
        title="Total Storage"
        value={stats ? formatBytes(stats.total_storage_bytes) : "-"}
        subtitle="Network capacity"
        icon={<HardDrive className="h-4 w-4" />}
        loading={isLoading}
      />
    </div>
  );
});
