"use client";

import { useState } from "react";
import { Header } from "@/components/dashboard/Header";
import { Leaderboard } from "@/components/leaderboard/Leaderboard";
import { BadgeDisplay } from "@/components/leaderboard/BadgeDisplay";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeaderboard } from "@/lib/hooks/use-leaderboard";
import type { BadgeType } from "@/lib/scoring/node-score";
import { Trophy, Medal, Award, Star, AlertTriangle, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const BADGE_FILTERS: { badge: BadgeType | "all"; label: string; icon: React.ReactNode }[] = [
  { badge: "all", label: "All Nodes", icon: <Users className="h-4 w-4" /> },
  { badge: "Elite", label: "Elite", icon: <Trophy className="h-4 w-4" /> },
  { badge: "Reliable", label: "Reliable", icon: <Medal className="h-4 w-4" /> },
  { badge: "Standard", label: "Standard", icon: <Award className="h-4 w-4" /> },
  { badge: "New", label: "New", icon: <Star className="h-4 w-4" /> },
  { badge: "At Risk", label: "At Risk", icon: <AlertTriangle className="h-4 w-4" /> },
];

export default function LeaderboardPage() {
  const [selectedBadge, setSelectedBadge] = useState<BadgeType | "all">("all");
  const { data, isLoading, error } = useLeaderboard({
    limit: 100,
    badge: selectedBadge === "all" ? undefined : selectedBadge,
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6 space-y-6">
        {/* Page Title */}
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="h-8 w-8 text-yellow-500" />
            Node Leaderboard
          </h2>
          <p className="text-muted-foreground">
            Top performing pNodes ranked by reputation score
          </p>
        </div>

        {/* Badge Distribution Stats */}
        {!isLoading && data && (
          <div className="grid gap-4 md:grid-cols-5">
            <BadgeStatCard
              badge="Elite"
              count={data.badge_distribution.Elite || 0}
              total={data.total}
              icon={<Trophy className="h-5 w-5 text-purple-400" />}
              color="purple"
            />
            <BadgeStatCard
              badge="Reliable"
              count={data.badge_distribution.Reliable || 0}
              total={data.total}
              icon={<Medal className="h-5 w-5 text-green-400" />}
              color="green"
            />
            <BadgeStatCard
              badge="Standard"
              count={data.badge_distribution.Standard || 0}
              total={data.total}
              icon={<Award className="h-5 w-5 text-blue-400" />}
              color="blue"
            />
            <BadgeStatCard
              badge="New"
              count={data.badge_distribution.New || 0}
              total={data.total}
              icon={<Star className="h-5 w-5 text-cyan-400" />}
              color="cyan"
            />
            <BadgeStatCard
              badge="At Risk"
              count={data.badge_distribution["At Risk"] || 0}
              total={data.total}
              icon={<AlertTriangle className="h-5 w-5 text-red-400" />}
              color="red"
            />
          </div>
        )}

        {/* Badge Filter */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filter by Badge</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {BADGE_FILTERS.map((filter) => (
                <Button
                  key={filter.badge}
                  variant={selectedBadge === filter.badge ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedBadge(filter.badge)}
                  className="gap-2"
                >
                  {filter.icon}
                  {filter.label}
                  {data && (
                    <Badge variant="secondary" className="ml-1">
                      {filter.badge === "all"
                        ? data.total
                        : data.badge_distribution[filter.badge] || 0}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Leaderboard */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Rankings</CardTitle>
            {data && (
              <Badge variant="secondary">
                Showing {data.filtered_total} of {data.total} nodes
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-2" />
                <p className="text-destructive">Failed to load leaderboard</p>
                <p className="text-sm text-muted-foreground">
                  {error instanceof Error ? error.message : "Unknown error"}
                </p>
              </div>
            ) : data ? (
              <Leaderboard scores={data.scores} />
            ) : null}
          </CardContent>
        </Card>

        {/* Scoring Methodology */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scoring Methodology</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none">
            <p className="text-muted-foreground">
              Node reputation scores are calculated based on five key metrics:
            </p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mt-4">
              <MetricCard
                name="Uptime"
                points="0-40"
                description="Based on uptime percentage"
              />
              <MetricCard
                name="Stability"
                points="0-20"
                description="Consistency of availability"
              />
              <MetricCard
                name="Performance"
                points="0-20"
                description="CPU and RAM headroom"
              />
              <MetricCard
                name="Longevity"
                points="0-10"
                description="Days online (max at 30 days)"
              />
              <MetricCard
                name="Version"
                points="0-10"
                description="Running latest software"
              />
            </div>
            <div className="mt-6 flex flex-wrap gap-4">
              <BadgeDisplay badge="Elite" />
              <span className="text-muted-foreground self-center">Score &ge; 95, 7+ days</span>
              <BadgeDisplay badge="Reliable" />
              <span className="text-muted-foreground self-center">Score &ge; 85</span>
              <BadgeDisplay badge="Standard" />
              <span className="text-muted-foreground self-center">Score &ge; 70</span>
              <BadgeDisplay badge="New" />
              <span className="text-muted-foreground self-center">&lt; 7 days online</span>
              <BadgeDisplay badge="At Risk" />
              <span className="text-muted-foreground self-center">Score &lt; 70</span>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Xandeum Atlas - pNode Analytics Platform
          </p>
          <p className="text-sm text-muted-foreground">
            Scores updated every minute
          </p>
        </div>
      </footer>
    </div>
  );
}

function BadgeStatCard({
  badge,
  count,
  total,
  icon,
  color,
}: {
  badge: string;
  count: number;
  total: number;
  icon: React.ReactNode;
  color: "purple" | "green" | "blue" | "cyan" | "red";
}) {
  const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : "0";

  const colorClasses = {
    purple: "bg-purple-500/10",
    green: "bg-green-500/10",
    blue: "bg-blue-500/10",
    cyan: "bg-cyan-500/10",
    red: "bg-red-500/10",
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className={cn("p-2 rounded-lg", colorClasses[color])}>{icon}</div>
          <div>
            <p className="text-2xl font-bold">{count}</p>
            <p className="text-xs text-muted-foreground">
              {badge} ({percentage}%)
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard({
  name,
  points,
  description,
}: {
  name: string;
  points: string;
  description: string;
}) {
  return (
    <div className="p-4 rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium">{name}</span>
        <Badge variant="secondary">{points}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
