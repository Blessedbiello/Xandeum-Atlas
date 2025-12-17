# Quick Start Implementation Guide

This guide gets you from zero to a working prototype in the fastest path possible.

## Prerequisites

```bash
# Required
node >= 18.17
pnpm >= 8.0 (or npm/yarn)

# Accounts needed
- Vercel account (free tier works)
- Supabase account (free tier works)
- Upstash account (free tier works)
```

## Step 1: Project Initialization

```bash
# Create Next.js 14 project
pnpm create next-app@latest xandeum-atlas --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

cd xandeum-atlas

# Install core dependencies
pnpm add @tanstack/react-query zod drizzle-orm @upstash/redis @upstash/ratelimit
pnpm add recharts lucide-react clsx tailwind-merge
pnpm add -D drizzle-kit @types/node

# Install shadcn/ui
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button card table badge input skeleton tabs
```

## Step 2: Environment Setup

Create `.env.local`:
```env
# Supabase
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"

# Upstash Redis
UPSTASH_REDIS_REST_URL="https://[ID].upstash.io"
UPSTASH_REDIS_REST_TOKEN="[TOKEN]"

# Cron secret (generate with: openssl rand -hex 32)
CRON_SECRET="your-secret-here"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Step 3: Create pRPC Client

Create `src/lib/prpc/client.ts`:
```typescript
import { z } from 'zod';

// Schemas
const PodSchema = z.object({
  pubkey: z.string(),
  address: z.string(),
  version: z.string().optional(),
  last_seen_timestamp: z.number(),
});

const NodeStatsSchema = z.object({
  active_streams: z.number(),
  cpu_percent: z.number(),
  current_index: z.number(),
  file_size: z.number(),
  last_updated: z.number(),
  packets_received: z.number(),
  packets_sent: z.number(),
  ram_total: z.number(),
  ram_used: z.number(),
  total_bytes: z.number(),
  total_pages: z.number(),
  uptime: z.number(),
});

const PodsResponseSchema = z.object({
  pods: z.array(PodSchema),
  total_count: z.number(),
});

export type Pod = z.infer<typeof PodSchema>;
export type NodeStats = z.infer<typeof NodeStatsSchema>;
export type PodsResponse = z.infer<typeof PodsResponseSchema>;

// Seed nodes
export const SEED_IPS = [
  "173.212.220.65",
  "161.97.97.41",
  "192.190.136.36",
  "192.190.136.38",
  "207.244.255.1",
  "192.190.136.28",
  "192.190.136.29",
  "173.212.203.145",
];

// Error types
export class PrpcError extends Error {
  constructor(message: string, public code?: number) {
    super(message);
    this.name = 'PrpcError';
  }
}

// Client - VERIFIED from xandeum-prpc Rust source
export class PrpcClient {
  private baseUrl: string;
  private timeout: number;

  constructor(ip: string, options?: { timeout?: number; port?: number }) {
    const port = options?.port || 6000; // Confirmed: pRPC uses port 6000
    this.baseUrl = `http://${ip}:${port}/rpc`; // Confirmed: endpoint is /rpc
    this.timeout = options?.timeout || 8000;
  }

  private async call<T>(method: string, params: unknown[] = []): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1, // Rust client uses id: 1
          method,
          params,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new PrpcError(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new PrpcError(data.error.message, data.error.code);
      }

      return data.result as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new PrpcError('Request timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Method names confirmed from Rust source (use hyphens, not underscores)
  async getPods(): Promise<PodsResponse> {
    const result = await this.call<unknown>('get-pods');
    return PodsResponseSchema.parse(result);
  }

  async getStats(): Promise<NodeStats> {
    const result = await this.call<unknown>('get-stats');
    return NodeStatsSchema.parse(result);
  }

  async getPodsWithStats(): Promise<PodsResponse> {
    const result = await this.call<unknown>('get-pods-with-stats');
    return PodsResponseSchema.parse(result);
  }
}

// Utility: Collect from all seeds
export async function collectFromAllSeeds(): Promise<{
  pods: Pod[];
  errors: { seed: string; error: string }[];
}> {
  const podMap = new Map<string, Pod>();
  const errors: { seed: string; error: string }[] = [];

  const results = await Promise.allSettled(
    SEED_IPS.map(async (ip) => {
      const client = new PrpcClient(ip);
      const response = await client.getPods();
      return { ip, pods: response.pods };
    })
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      for (const pod of result.value.pods) {
        const existing = podMap.get(pod.pubkey);
        if (!existing || pod.last_seen_timestamp > existing.last_seen_timestamp) {
          podMap.set(pod.pubkey, pod);
        }
      }
    } else {
      errors.push({ seed: SEED_IPS[i], error: result.reason.message });
    }
  }

  return { pods: Array.from(podMap.values()), errors };
}
```

## Step 4: Create API Routes

Create `src/app/api/nodes/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { collectFromAllSeeds, PrpcClient } from '@/lib/prpc/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const { pods, errors } = await collectFromAllSeeds();

    // Optionally fetch stats for each pod (can be slow)
    const nodesWithStats = await Promise.all(
      pods.slice(0, 20).map(async (pod) => { // Limit to first 20 for speed
        try {
          const [ip] = pod.address.split(':');
          const client = new PrpcClient(ip);
          const stats = await client.getStats();
          return { ...pod, stats };
        } catch {
          return { ...pod, stats: null };
        }
      })
    );

    return NextResponse.json({
      nodes: nodesWithStats,
      total_count: pods.length,
      errors: errors.length > 0 ? errors : undefined,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to fetch nodes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch nodes' },
      { status: 500 }
    );
  }
}
```

Create `src/app/api/stats/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { collectFromAllSeeds } from '@/lib/prpc/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { pods, errors } = await collectFromAllSeeds();

    const online = pods.filter(p => {
      const age = Date.now() / 1000 - p.last_seen_timestamp;
      return age < 300; // Seen in last 5 minutes
    });

    return NextResponse.json({
      total_nodes: pods.length,
      online_nodes: online.length,
      offline_nodes: pods.length - online.length,
      health_percent: pods.length > 0
        ? Math.round((online.length / pods.length) * 100)
        : 0,
      seed_errors: errors.length,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
```

## Step 5: Create Dashboard Page

Create `src/app/page.tsx`:
```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface NodeData {
  pubkey: string;
  address: string;
  version?: string;
  last_seen_timestamp: number;
  stats?: {
    cpu_percent: number;
    ram_used: number;
    ram_total: number;
    uptime: number;
  };
}

interface NodesResponse {
  nodes: NodeData[];
  total_count: number;
  fetched_at: string;
}

interface StatsResponse {
  total_nodes: number;
  online_nodes: number;
  health_percent: number;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

function truncatePubkey(pubkey: string): string {
  return `${pubkey.slice(0, 4)}...${pubkey.slice(-4)}`;
}

function getStatusBadge(lastSeen: number) {
  const age = Date.now() / 1000 - lastSeen;
  if (age < 120) return <Badge className="bg-green-500">Online</Badge>;
  if (age < 300) return <Badge className="bg-yellow-500">Degraded</Badge>;
  return <Badge className="bg-red-500">Offline</Badge>;
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<StatsResponse>({
    queryKey: ['stats'],
    queryFn: () => fetch('/api/stats').then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: nodes, isLoading: nodesLoading } = useQuery<NodesResponse>({
    queryKey: ['nodes'],
    queryFn: () => fetch('/api/nodes').then(r => r.json()),
    refetchInterval: 60000,
  });

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Xandeum pNode Network</h1>
            <p className="text-gray-400 mt-1">Real-time analytics dashboard</p>
          </div>
          {nodes?.fetched_at && (
            <p className="text-sm text-gray-500">
              Updated: {new Date(nodes.fetched_at).toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-400">Total Nodes</CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-3xl font-bold">{stats?.total_nodes || 0}</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-400">Online Nodes</CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-3xl font-bold text-green-500">
                  {stats?.online_nodes || 0}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-400">Network Health</CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-3xl font-bold">
                  {stats?.health_percent || 0}%
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Node Table */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle>pNode List</CardTitle>
          </CardHeader>
          <CardContent>
            {nodesLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800">
                    <TableHead>Status</TableHead>
                    <TableHead>Pubkey</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>CPU</TableHead>
                    <TableHead>RAM</TableHead>
                    <TableHead>Uptime</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nodes?.nodes.map((node) => (
                    <TableRow key={node.pubkey} className="border-gray-800">
                      <TableCell>{getStatusBadge(node.last_seen_timestamp)}</TableCell>
                      <TableCell className="font-mono">
                        {truncatePubkey(node.pubkey)}
                      </TableCell>
                      <TableCell>{node.address}</TableCell>
                      <TableCell>
                        {node.stats ? `${node.stats.cpu_percent.toFixed(1)}%` : '-'}
                      </TableCell>
                      <TableCell>
                        {node.stats
                          ? `${Math.round((node.stats.ram_used / node.stats.ram_total) * 100)}%`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {node.stats ? formatUptime(node.stats.uptime) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
```

## Step 6: Add Query Provider

Create `src/app/providers.tsx`:
```typescript
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

Update `src/app/layout.tsx`:
```typescript
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Xandeum pNode Analytics',
  description: 'Real-time analytics for Xandeum pNode network',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

## Step 7: Run Development Server

```bash
pnpm dev
```

Visit `http://localhost:3000` - you should see the dashboard fetching live pNode data.

## Next Steps

1. **Add Caching** - Implement Upstash Redis caching (see blueprint section 3.4)
2. **Add Database** - Set up Supabase and persist historical data
3. **Add Cron Job** - Configure Vercel cron for automated ingestion
4. **Enhance UI** - Add charts, node detail pages, search
5. **Deploy** - Push to Vercel

## Troubleshooting

**pRPC calls timing out?**
- Verified port is `6000` with endpoint `/rpc`
- Some nodes may be behind firewalls or temporarily offline
- Try increasing timeout to 15000ms

**No nodes appearing?**
- Check that seed IPs are still valid
- Try fetching from a single seed first to isolate issues
- Test with curl: `curl -X POST http://173.212.220.65:6000/rpc -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"get-pods","params":[]}'`

**CORS errors?**
- API routes run server-side, so CORS shouldn't apply
- If calling from client, route through your API

**Method not found errors?**
- Use hyphens in method names: `get-pods`, `get-stats`, `get-pods-with-stats`
- NOT underscores: ~~`get_pods`~~

---

For the complete implementation, refer to `ENGINEERING_BLUEPRINT.md` and execute the prompts in Section 6.
