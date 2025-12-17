"use client";

import { useState } from "react";
import { Header } from "@/components/dashboard/Header";
import { NodeTable } from "@/components/nodes/NodeTable";
import { NodeFilters } from "@/components/nodes/NodeFilters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNodes } from "@/lib/hooks/use-nodes";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function NodesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, error } = useNodes({
    status: statusFilter || undefined,
    search: search || undefined,
    page,
    limit,
    sort: "last_seen",
    order: "desc",
  });

  const totalPages = data?.pagination.pages ?? 1;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6 space-y-6">
        {/* Page Title */}
        <div>
          <h2 className="text-3xl font-bold tracking-tight">pNodes</h2>
          <p className="text-muted-foreground">
            Browse and search all nodes in the Xandeum network
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <NodeFilters
              search={search}
              onSearchChange={(value) => {
                setSearch(value);
                setPage(1); // Reset to first page on search
              }}
              statusFilter={statusFilter}
              onStatusFilterChange={(status) => {
                setStatusFilter(status);
                setPage(1); // Reset to first page on filter change
              }}
              totalNodes={data?.pagination.total ?? 0}
              filteredCount={data?.nodes.length ?? 0}
            />
          </CardContent>
        </Card>

        {/* Error State */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">
                Failed to load nodes. Please try again later.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Node Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {data?.pagination.total ?? 0} Nodes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NodeTable nodes={data?.nodes ?? []} loading={isLoading} />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || isLoading}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || isLoading}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
