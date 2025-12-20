"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Header } from "@/components/dashboard/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useNode } from "@/lib/hooks/use-nodes";
import { useNodeHistory } from "@/lib/hooks/use-analytics";
import { NodeHistoryChart } from "@/components/charts/NodeHistoryChart";
import {
  formatBytes,
  formatUptime,
  formatPercent,
  formatNumber,
  formatRelativeTime,
  formatDateTime,
  cn,
} from "@/lib/utils";
import {
  ArrowLeft,
  Copy,
  Cpu,
  HardDrive,
  Clock,
  Activity,
  Server,
  Network,
  CheckCircle,
  XCircle,
  TrendingUp,
} from "lucide-react";

function StatCard({
  title,
  value,
  subtitle,
  icon,
  progress,
  progressColor,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  progress?: number;
  progressColor?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="text-muted-foreground">{icon}</div>
        </div>
        {progress !== undefined && (
          <Progress
            value={progress}
            className="mt-3 h-2"
            indicatorClassName={progressColor}
          />
        )}
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function NodeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pubkey = params.pubkey as string;
  const [historyHours, setHistoryHours] = useState(24);

  const { data, isLoading, error } = useNode(pubkey);
  const { data: historyData, isLoading: historyLoading } = useNodeHistory(pubkey, historyHours);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-6">
          <Card className="border-destructive">
            <CardContent className="pt-6 text-center">
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Node Not Found</h2>
              <p className="text-muted-foreground mb-4">
                The node with pubkey &quot;{pubkey.slice(0, 12)}...&quot; could
                not be found.
              </p>
              <Button onClick={() => router.push("/nodes")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Nodes
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const node = data?.node;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6 space-y-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/nodes")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Nodes
        </Button>

        {isLoading ? (
          <LoadingSkeleton />
        ) : node ? (
          <>
            {/* Node Header */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Server className="h-8 w-8 text-primary" />
                      <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                          pNode Details
                        </h1>
                        <p className="text-sm text-muted-foreground">
                          {node.address}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                        {node.pubkey}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleCopy(node.pubkey)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge
                      variant={
                        node.status === "online"
                          ? "online"
                          : node.status === "degraded"
                          ? "degraded"
                          : "offline"
                      }
                      className="text-sm px-3 py-1"
                    >
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full mr-2",
                          node.status === "online" && "bg-green-500",
                          node.status === "degraded" && "bg-yellow-500",
                          node.status === "offline" && "bg-red-500"
                        )}
                      />
                      {node.status.charAt(0).toUpperCase() + node.status.slice(1)}
                    </Badge>
                    <Badge variant="outline">
                      {node.version || "Unknown Version"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="CPU Usage"
                value={
                  node.stats
                    ? formatPercent(node.stats.cpu_percent)
                    : "N/A"
                }
                subtitle="Current utilization"
                icon={<Cpu className="h-5 w-5" />}
                progress={node.stats?.cpu_percent}
                progressColor={
                  node.stats
                    ? node.stats.cpu_percent < 50
                      ? "bg-green-500"
                      : node.stats.cpu_percent < 80
                      ? "bg-yellow-500"
                      : "bg-red-500"
                    : undefined
                }
              />
              <StatCard
                title="Memory Usage"
                value={
                  node.ram_percent
                    ? formatPercent(node.ram_percent)
                    : "N/A"
                }
                subtitle={
                  node.stats
                    ? `${formatBytes(node.stats.ram_used)} / ${formatBytes(
                        node.stats.ram_total
                      )}`
                    : undefined
                }
                icon={<HardDrive className="h-5 w-5" />}
                progress={node.ram_percent}
                progressColor={
                  node.ram_percent
                    ? node.ram_percent < 50
                      ? "bg-green-500"
                      : node.ram_percent < 80
                      ? "bg-yellow-500"
                      : "bg-red-500"
                    : undefined
                }
              />
              <StatCard
                title="Uptime"
                value={
                  node.stats ? formatUptime(node.stats.uptime) : "N/A"
                }
                subtitle={
                  node.stats
                    ? `${formatNumber(node.stats.uptime)} seconds`
                    : undefined
                }
                icon={<Clock className="h-5 w-5" />}
              />
              <StatCard
                title="Active Streams"
                value={node.stats?.active_streams ?? "N/A"}
                subtitle="Current connections"
                icon={<Activity className="h-5 w-5" />}
              />
              <StatCard
                title="Pod Credits"
                value={node.credits !== undefined ? node.credits.toLocaleString() : "N/A"}
                subtitle="Available credits allocation"
                icon={<Activity className="h-5 w-5" />}
              />
            </div>

            {/* Additional Info */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Network Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Network className="h-4 w-4" />
                    Network Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Packets Sent</span>
                    <span className="font-mono">
                      {node.stats
                        ? formatNumber(node.stats.packets_sent)
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Packets Received
                    </span>
                    <span className="font-mono">
                      {node.stats
                        ? formatNumber(node.stats.packets_received)
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Total Bytes Processed
                    </span>
                    <span className="font-mono">
                      {node.stats
                        ? formatBytes(node.stats.total_bytes)
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Pages</span>
                    <span className="font-mono">
                      {node.stats
                        ? formatNumber(node.stats.total_pages)
                        : "N/A"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Node Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Server className="h-4 w-4" />
                    Node Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IP Address</span>
                    <code className="font-mono text-sm">
                      {node.address.split(":")[0]}
                    </code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Port</span>
                    <code className="font-mono text-sm">
                      {node.address.split(":")[1] || "6000"}
                    </code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Seen</span>
                    <span>{formatRelativeTime(node.last_seen_timestamp)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">File Size</span>
                    <span className="font-mono">
                      {node.stats
                        ? formatBytes(node.stats.file_size)
                        : "N/A"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Historical Performance Trends */}
            {historyData && historyData.history && historyData.history.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Performance History
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button
                        variant={historyHours === 24 ? "default" : "outline"}
                        size="sm"
                        onClick={() => setHistoryHours(24)}
                      >
                        24h
                      </Button>
                      <Button
                        variant={historyHours === 168 ? "default" : "outline"}
                        size="sm"
                        onClick={() => setHistoryHours(168)}
                      >
                        7d
                      </Button>
                      <Button
                        variant={historyHours === 720 ? "default" : "outline"}
                        size="sm"
                        onClick={() => setHistoryHours(720)}
                      >
                        30d
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Uptime Stats Summary */}
                  {historyData.uptime_stats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg bg-muted/50">
                      <div>
                        <p className="text-xs text-muted-foreground">Uptime</p>
                        <p className="text-lg font-bold text-green-500">
                          {historyData.uptime_stats.uptime_percent.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Avg CPU</p>
                        <p className="text-lg font-bold">
                          {historyData.uptime_stats.avg_cpu
                            ? `${historyData.uptime_stats.avg_cpu.toFixed(1)}%`
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Avg RAM</p>
                        <p className="text-lg font-bold">
                          {historyData.uptime_stats.avg_ram
                            ? `${historyData.uptime_stats.avg_ram.toFixed(1)}%`
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Data Points</p>
                        <p className="text-lg font-bold">{historyData.data_points}</p>
                      </div>
                    </div>
                  )}

                  {/* Charts Grid */}
                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <h4 className="text-sm font-medium mb-3">CPU Usage</h4>
                      <NodeHistoryChart data={historyData.history} metric="cpu" height={250} />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-3">RAM Usage</h4>
                      <NodeHistoryChart data={historyData.history} metric="ram" height={250} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Show message if historical data is not available */}
            {!historyLoading && (!historyData || !historyData.history || historyData.history.length === 0) && (
              <Card className="border-dashed">
                <CardContent className="pt-6 text-center py-8">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">Historical Data Coming Soon</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Historical performance data will be available once the database collects enough snapshots.
                    Data collection happens automatically every hour.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
