"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BadgeDisplay, ScoreBreakdown } from "./BadgeDisplay";
import type { NodeScore } from "@/lib/scoring/node-score";
import { cn } from "@/lib/utils";
import { Trophy, Medal, Award, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import Link from "next/link";

interface LeaderboardProps {
  scores: NodeScore[];
  loading?: boolean;
  showExpanded?: boolean;
}

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) {
    return <Trophy className="h-5 w-5 text-yellow-500" />;
  }
  if (rank === 2) {
    return <Medal className="h-5 w-5 text-gray-400" />;
  }
  if (rank === 3) {
    return <Award className="h-5 w-5 text-amber-600" />;
  }
  return (
    <span className="w-5 h-5 flex items-center justify-center text-sm text-muted-foreground">
      {rank}
    </span>
  );
}

function PubkeyCell({ pubkey }: { pubkey: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(pubkey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/nodes/${pubkey}`}
        className="font-mono text-sm hover:underline"
      >
        {pubkey.slice(0, 8)}...{pubkey.slice(-4)}
      </Link>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{copied ? "Copied!" : "Copy pubkey"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

function ExpandedRow({ score }: { score: NodeScore }) {
  return (
    <TableRow className="bg-muted/30">
      <TableCell colSpan={6} className="py-4">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <h4 className="text-sm font-medium mb-3">Score Breakdown</h4>
            <ScoreBreakdown nodeScore={score} />
          </div>
          <div>
            <h4 className="text-sm font-medium mb-3">Performance Metrics</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Uptime</span>
                <span>{score.breakdown.uptime_percent}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CPU Headroom</span>
                <span>{score.breakdown.cpu_headroom}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">RAM Headroom</span>
                <span>{score.breakdown.ram_headroom}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Days Online</span>
                <span>{score.breakdown.days_online} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Latest Version</span>
                <span>
                  {score.breakdown.is_latest_version ? (
                    <Badge variant="outline" className="text-green-500 border-green-500">
                      Yes
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-yellow-500 border-yellow-500">
                      No
                    </Badge>
                  )}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <Link href={`/nodes/${score.pubkey}`}>
              <Button variant="outline">View Node Details</Button>
            </Link>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function Leaderboard({ scores, loading = false, showExpanded = true }: LeaderboardProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (pubkey: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(pubkey)) {
      newExpanded.delete(pubkey);
    } else {
      newExpanded.add(pubkey);
    }
    setExpandedRows(newExpanded);
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Rank</TableHead>
            <TableHead>Node</TableHead>
            <TableHead className="text-center">Badge</TableHead>
            <TableHead className="text-right">Score</TableHead>
            <TableHead className="hidden md:table-cell text-right">Uptime</TableHead>
            {showExpanded && <TableHead className="w-12"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {scores.map((score, index) => {
            const rank = index + 1;
            const isExpanded = expandedRows.has(score.pubkey);

            return (
              <>
                <TableRow
                  key={score.pubkey}
                  className={cn(
                    rank <= 3 && "bg-gradient-to-r",
                    rank === 1 && "from-yellow-500/10 to-transparent",
                    rank === 2 && "from-gray-400/10 to-transparent",
                    rank === 3 && "from-amber-600/10 to-transparent"
                  )}
                >
                  <TableCell>
                    <RankIcon rank={rank} />
                  </TableCell>
                  <TableCell>
                    <PubkeyCell pubkey={score.pubkey} />
                  </TableCell>
                  <TableCell className="text-center">
                    <BadgeDisplay badge={score.badge} score={score.total} size="sm" />
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        "font-mono font-bold",
                        score.total >= 95 && "text-purple-400",
                        score.total >= 85 && score.total < 95 && "text-green-400",
                        score.total >= 70 && score.total < 85 && "text-blue-400",
                        score.total < 70 && "text-red-400"
                      )}
                    >
                      {score.total}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right text-muted-foreground">
                    {score.breakdown.uptime_percent}%
                  </TableCell>
                  {showExpanded && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleRow(score.pubkey)}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
                {showExpanded && isExpanded && (
                  <ExpandedRow key={`${score.pubkey}-expanded`} score={score} />
                )}
              </>
            );
          })}
          {scores.length === 0 && (
            <TableRow>
              <TableCell colSpan={showExpanded ? 6 : 5} className="text-center py-8">
                <p className="text-muted-foreground">No nodes found</p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Compact leaderboard for dashboard widget
 */
export function LeaderboardCompact({ scores }: { scores: NodeScore[] }) {
  return (
    <div className="space-y-2">
      {scores.slice(0, 5).map((score, index) => (
        <div
          key={score.pubkey}
          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <RankIcon rank={index + 1} />
            <Link
              href={`/nodes/${score.pubkey}`}
              className="font-mono text-sm hover:underline"
            >
              {score.pubkey.slice(0, 8)}...
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <BadgeDisplay badge={score.badge} showTooltip={false} size="sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default Leaderboard;
