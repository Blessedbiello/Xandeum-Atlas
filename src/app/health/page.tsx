"use client";

import { Header } from "@/components/dashboard/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useHealth } from "@/lib/hooks/use-nodes";
import { CheckCircle, XCircle, AlertCircle, Clock, Server } from "lucide-react";
import { cn } from "@/lib/utils";

function SeedStatus({
  ip,
  healthy,
  latency,
}: {
  ip: string;
  healthy: boolean;
  latency: number;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-lg border",
        healthy ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"
      )}
    >
      <div className="flex items-center gap-3">
        {healthy ? (
          <CheckCircle className="h-5 w-5 text-green-500" />
        ) : (
          <XCircle className="h-5 w-5 text-red-500" />
        )}
        <code className="text-sm font-mono">{ip}</code>
      </div>
      <div className="flex items-center gap-2">
        {healthy && (
          <span className="text-sm text-muted-foreground">
            {latency}ms
          </span>
        )}
        <Badge variant={healthy ? "online" : "offline"}>
          {healthy ? "Healthy" : "Unreachable"}
        </Badge>
      </div>
    </div>
  );
}

export default function HealthPage() {
  const { data, isLoading, error } = useHealth();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6 space-y-6">
        {/* Page Title */}
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Network Health</h2>
          <p className="text-muted-foreground">
            Monitor the health of seed nodes and API connectivity
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : error ? (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">
                Failed to check network health. Please try again later.
              </p>
            </CardContent>
          </Card>
        ) : data ? (
          <>
            {/* Overall Status */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {data.status === "healthy" ? (
                      <CheckCircle className="h-12 w-12 text-green-500" />
                    ) : data.status === "degraded" ? (
                      <AlertCircle className="h-12 w-12 text-yellow-500" />
                    ) : (
                      <XCircle className="h-12 w-12 text-red-500" />
                    )}
                    <div>
                      <h3 className="text-2xl font-bold">
                        {data.status === "healthy"
                          ? "All Systems Operational"
                          : data.status === "degraded"
                          ? "Partial Outage"
                          : "Major Outage"}
                      </h3>
                      <p className="text-muted-foreground">
                        {data.seeds.healthy} of {data.seeds.total} seed nodes
                        responding
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      data.status === "healthy"
                        ? "online"
                        : data.status === "degraded"
                        ? "degraded"
                        : "offline"
                    }
                    className="text-sm px-4 py-2"
                  >
                    {data.status.toUpperCase()}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Server className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Healthy Seeds
                      </p>
                      <p className="text-2xl font-bold">
                        {data.seeds.healthy}/{data.seeds.total}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Clock className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Avg Latency
                      </p>
                      <p className="text-2xl font-bold">
                        {data.seeds.avg_latency_ms}ms
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Clock className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        API Response
                      </p>
                      <p className="text-2xl font-bold">
                        {data.api.response_time_ms}ms
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Seed Node Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Seed Node Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.seeds.details.map(
                  (seed: { ip: string; healthy: boolean; latency_ms: number }) => (
                    <SeedStatus
                      key={seed.ip}
                      ip={seed.ip}
                      healthy={seed.healthy}
                      latency={seed.latency_ms}
                    />
                  )
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </main>
    </div>
  );
}
