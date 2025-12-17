"use client";

import { useNetworkStats } from "@/lib/hooks/use-nodes";
import { formatRelativeTime } from "@/lib/utils";
import { RefreshCw, Activity, Github, Globe2, Trophy, Download, FileJson, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";

export function Header() {
  const { data: stats, isLoading, refetch, isFetching } = useNetworkStats();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo and Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Activity className="h-8 w-8 text-primary" />
              <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Xandeum Atlas
              </h1>
              <p className="text-xs text-muted-foreground">
                pNode Analytics Platform
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/nodes"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Nodes
          </Link>
          <Link
            href="/map"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Globe2 className="h-4 w-4" />
            Map
          </Link>
          <Link
            href="/leaderboard"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Trophy className="h-4 w-4" />
            Leaderboard
          </Link>
          <Link
            href="/health"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Health
          </Link>
        </nav>

        {/* Status and Actions */}
        <div className="flex items-center gap-4">
          {/* Last Updated */}
          {stats?.fetched_at && (
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              <div
                className={`h-2 w-2 rounded-full ${
                  isFetching ? "bg-yellow-500 animate-pulse" : "bg-green-500"
                }`}
              />
              <span>
                {isFetching
                  ? "Updating..."
                  : `Updated ${formatRelativeTime(stats.fetched_at)}`}
              </span>
            </div>
          )}

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <a href="/api/export?format=json&scores=true" download>
                  <FileJson className="h-4 w-4 mr-2" />
                  Export as JSON
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/api/export?format=csv&scores=true" download>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export as CSV
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href="/api/export?format=json&scores=true&stats=true" download>
                  <FileJson className="h-4 w-4 mr-2" />
                  Full Export (JSON)
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9 w-9"
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
            <span className="sr-only">Refresh data</span>
          </Button>

          {/* GitHub Link */}
          <Button variant="ghost" size="icon" asChild className="h-9 w-9">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="h-4 w-4" />
              <span className="sr-only">GitHub</span>
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}
