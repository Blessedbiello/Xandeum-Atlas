"use client";

import { memo, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  truncatePubkey,
  formatUptime,
  formatRelativeTime,
  formatPercent,
  cn,
} from "@/lib/utils";
import { Copy } from "lucide-react";
import type { NodeWithStats, NodeStatus } from "@/types";

interface NodeTableProps {
  nodes: NodeWithStats[];
  loading?: boolean;
}

/**
 * StatusBadge - Memoized status indicator
 */
const StatusBadge = memo(function StatusBadge({ status }: { status: NodeStatus }) {
  const variants: Record<NodeStatus, "online" | "degraded" | "offline" | "unknown"> = {
    online: "online",
    degraded: "degraded",
    offline: "offline",
    unknown: "unknown",
  };

  return (
    <Badge variant={variants[status]} className="gap-1">
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          status === "online" && "bg-green-500 status-online",
          status === "degraded" && "bg-yellow-500 status-degraded",
          status === "offline" && "bg-red-500 status-offline",
          status === "unknown" && "bg-gray-500"
        )}
      />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
});

/**
 * MetricProgress - Memoized progress bar for CPU/RAM
 */
const MetricProgress = memo(function MetricProgress({
  value,
  label,
}: {
  value: number;
  label?: string;
}) {
  const color = useMemo(() => {
    if (value < 50) return "bg-green-500";
    if (value < 80) return "bg-yellow-500";
    return "bg-red-500";
  }, [value]);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span>{formatPercent(value)}</span>
      </div>
      <Progress value={value} className="h-1.5" indicatorClassName={color} />
    </div>
  );
});

/**
 * CopyButton - Memoized copy to clipboard button
 */
const CopyButton = memo(function CopyButton({ text }: { text: string }) {
  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
  }, [text]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={handleCopy}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <Copy className="h-3 w-3 text-muted-foreground" />
        </button>
      </TooltipTrigger>
      <TooltipContent>Copy pubkey</TooltipContent>
    </Tooltip>
  );
});

/**
 * LoadingSkeleton - Memoized loading state
 */
const LoadingSkeleton = memo(function LoadingSkeleton() {
  return (
    <>
      {[...Array(10)].map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-6 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-28" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-16" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
});

/**
 * NodeTableRow - Memoized individual row component
 * Prevents re-render when other rows update
 */
const NodeTableRow = memo(function NodeTableRow({
  node,
  onRowClick,
}: {
  node: NodeWithStats;
  onRowClick: (pubkey: string) => void;
}) {
  const handleClick = useCallback(() => {
    onRowClick(node.pubkey);
  }, [node.pubkey, onRowClick]);

  return (
    <TableRow className="node-row" onClick={handleClick}>
      <TableCell>
        <StatusBadge status={node.status} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <code className="text-sm font-mono">
            {truncatePubkey(node.pubkey)}
          </code>
          <CopyButton text={node.pubkey} />
        </div>
      </TableCell>
      <TableCell>
        <code className="text-sm text-muted-foreground">
          {node.address}
        </code>
      </TableCell>
      <TableCell>
        <span className="text-sm">
          {node.version || "Unknown"}
        </span>
      </TableCell>
      <TableCell>
        <span className="text-sm font-mono">
          {node.credits !== undefined ? node.credits.toLocaleString() : "-"}
        </span>
      </TableCell>
      <TableCell>
        {node.stats ? (
          <MetricProgress value={node.stats.cpu_percent} />
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        {node.ram_percent !== undefined ? (
          <MetricProgress value={node.ram_percent} />
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        {node.stats ? (
          <span className="text-sm">
            {formatUptime(node.stats.uptime)}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {formatRelativeTime(node.last_seen_timestamp)}
        </span>
      </TableCell>
    </TableRow>
  );
});

/**
 * NodeTable - OPTIMIZED with React.memo and memoized sub-components
 * - All child components are memoized to prevent unnecessary re-renders
 * - Row components are extracted and memoized individually
 * - Callbacks are memoized with useCallback
 */
export const NodeTable = memo(function NodeTable({ nodes, loading }: NodeTableProps) {
  const router = useRouter();

  const handleRowClick = useCallback((pubkey: string) => {
    router.push(`/nodes/${pubkey}`);
  }, [router]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">Status</TableHead>
          <TableHead>Pubkey</TableHead>
          <TableHead>Address</TableHead>
          <TableHead>Version</TableHead>
          <TableHead className="w-[100px]">Credits</TableHead>
          <TableHead className="w-[140px]">CPU</TableHead>
          <TableHead className="w-[140px]">RAM</TableHead>
          <TableHead>Uptime</TableHead>
          <TableHead>Last Seen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <LoadingSkeleton />
        ) : nodes.length === 0 ? (
          <TableRow>
            <TableCell colSpan={9} className="text-center py-8">
              <p className="text-muted-foreground">No nodes found</p>
            </TableCell>
          </TableRow>
        ) : (
          nodes.map((node) => (
            <NodeTableRow
              key={node.pubkey}
              node={node}
              onRowClick={handleRowClick}
            />
          ))
        )}
      </TableBody>
    </Table>
  );
});
