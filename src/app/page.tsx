"use client";

import { Header } from "@/components/dashboard/Header";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { StatusDistribution } from "@/components/dashboard/StatusDistribution";
import { VersionDistribution } from "@/components/dashboard/VersionDistribution";
import { NodeTable } from "@/components/nodes/NodeTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNodes } from "@/lib/hooks/use-nodes";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function DashboardPage() {
  const { data: nodesData, isLoading } = useNodes({ limit: 10 });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6 space-y-6">
        {/* Page Title */}
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Overview of the Xandeum pNode network
          </p>
        </div>

        {/* Stats Cards */}
        <StatsCards />

        {/* Charts Row */}
        <div className="grid gap-6 md:grid-cols-2">
          <StatusDistribution />
          <VersionDistribution />
        </div>

        {/* Recent Nodes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Nodes</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/nodes" className="gap-2">
                View all
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <NodeTable
              nodes={nodesData?.nodes ?? []}
              loading={isLoading}
            />
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Xandeum Atlas - pNode Analytics Platform
          </p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <a
              href="https://xandeum.network"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Xandeum Network
            </a>
            <a
              href="https://docs.xandeum.network"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Documentation
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
