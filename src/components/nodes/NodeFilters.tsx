"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X } from "lucide-react";
import type { NodeStatus } from "@/types";

interface NodeFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string | null;
  onStatusFilterChange: (status: string | null) => void;
  totalNodes: number;
  filteredCount: number;
}

const STATUS_OPTIONS: Array<{ value: NodeStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "online", label: "Online" },
  { value: "degraded", label: "Degraded" },
  { value: "offline", label: "Offline" },
];

export function NodeFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  totalNodes,
  filteredCount,
}: NodeFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
      {/* Search */}
      <div className="relative w-full sm:w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by pubkey or IP..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 pr-9"
        />
        {search && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground mr-2">Status:</span>
        {STATUS_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={
              (option.value === "all" && !statusFilter) ||
              statusFilter === option.value
                ? "default"
                : "outline"
            }
            size="sm"
            onClick={() =>
              onStatusFilterChange(option.value === "all" ? null : option.value)
            }
            className="h-8"
          >
            {option.label}
          </Button>
        ))}
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing{" "}
        <span className="font-medium text-foreground">{filteredCount}</span> of{" "}
        <span className="font-medium text-foreground">{totalNodes}</span> nodes
      </div>
    </div>
  );
}
