# Xandeum pNode Analytics Platform - Engineering Blueprint

**Version:** 1.0
**Target:** Competitive Bounty Submission
**Prepared:** December 2025

---

## Table of Contents

1. [System Understanding](#1-system-understanding)
2. [Production Architecture](#2-production-architecture)
3. [Data Pipeline Design](#3-data-pipeline-design)
4. [Feature Breakdown](#4-feature-breakdown)
5. [UX & Clarity Strategy](#5-ux--clarity-strategy)
6. [Prompt Pack for Execution](#6-prompt-pack-for-execution)
7. [Risk & Failure Analysis](#7-risk--failure-analysis)
8. [Delivery Plan](#8-delivery-plan)

---

## 1. System Understanding

### 1.1 Xandeum Network Architecture Overview

Xandeum provides a scalable storage layer for Solana, offloading data-intensive operations from validators to a dedicated network of **Provider Nodes (pNodes)**. This enables exabyte-scale capacity without overburdening Solana validators.

```
┌─────────────────────────────────────────────────────────────────┐
│                     SOLANA MAINNET                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   vNode 1   │  │   vNode 2   │  │   vNode N   │             │
│  │  (Modified  │  │  (Modified  │  │  (Modified  │             │
│  │  Validator) │  │  Validator) │  │  Validator) │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
└─────────┼────────────────┼────────────────┼────────────────────┘
          │                │                │
          │ Cryptographic  │                │
          │ Supervision    │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    XANDEUM STORAGE LAYER                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   pNode 1   │◄─┼─►│   pNode 2   │◄─┼─►│   pNode N   │             │
│  │  (Storage   │  │  │  (Storage   │  │  │  (Storage   │             │
│  │  Provider)  │  │  │  Provider)  │  │  │  Provider)  │             │
│  └─────────────┘  │  └─────────────┘  │  └─────────────┘             │
│                   │                   │                             │
│         ◄─────────┴───────────────────┴─────────►                  │
│                    GOSSIP NETWORK                                   │
│                 (Herrenberg Protocol)                               │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 How pNodes Work

**Core Function:** pNodes store data in a distributed manner using:
- **Erasure coding** for redundancy
- **Configurable replication** (typically 3 copies across different pNodes)
- **4MB page chunks** for data distribution
- **Merkle proofs** for data integrity verification

**Storage Primitives:**
- `peek` - Read data from Xandeum buckets
- `poke` - Write data to Xandeum buckets
- `prove` - Generate Merkle proofs for validation

**Lifecycle:**
1. Developer specifies destination bucket and offset
2. Xandeum divides data into 4MB pages
3. Pages are encrypted and distributed to pNodes based on redundancy level
4. vNodes cryptographically supervise pNodes for integrity

### 1.3 Gossip Discovery (Herrenberg Protocol)

The **Herrenberg release** introduced the gossip protocol enabling pNodes to:
- Communicate and share status updates
- Form a decentralized discovery network
- Broadcast node availability and health metrics

**Gossip Mechanism:**
```
┌──────────┐     heartbeat     ┌──────────┐
│  pNode A │◄─────────────────►│  pNode B │
└────┬─────┘                   └────┬─────┘
     │                              │
     │    peer list exchange        │
     ▼                              ▼
┌──────────┐     heartbeat     ┌──────────┐
│  pNode C │◄─────────────────►│  pNode D │
└──────────┘                   └──────────┘
```

Each pNode maintains:
- Local peer list from gossip
- `last_seen_timestamp` for peer liveness
- Node metadata (version, address, pubkey)

### 1.4 pRPC (pNode RPC) System

The pRPC interface provides programmatic access to pNode data via JSON-RPC 2.0.

**Dual RPC Architecture:**
1. **RPC to vNodes** - Storage primitives flow from sedApps to pNodes
2. **pRPC to pNodes** - Analytics and monitoring access (our target)

**Available pRPC Methods:**

| Method | Description | Returns |
|--------|-------------|---------|
| `get-pods` | List all pNodes in gossip | `PodsResponse` |
| `get-stats` | Node performance metrics | `NodeStats` |
| `get-pods-with-stats` | Combined pods + stats | `PodsResponse` with stats |

**Endpoint Details (Verified from Rust source):**
- **Port:** `6000`
- **Path:** `/rpc`
- **Full URL:** `http://{IP}:6000/rpc`
- **Protocol:** JSON-RPC 2.0 over HTTP POST

**Seed IPs (Bootstrap Nodes):**
```
173.212.220.65    161.97.97.41      192.190.136.36
192.190.136.38    207.244.255.1     192.190.136.28
192.190.136.29    173.212.203.145
```

### 1.5 Data Structures

**Pod (pNode Identity):**
```typescript
interface Pod {
  pubkey: string;           // Ed25519 public key
  address: string;          // IP:port
  version: string;          // Software version
  last_seen_timestamp: number; // Unix timestamp (seconds)
  // Optional fields in extended responses:
  uptime?: number;
  storage_used?: number;
}
```

**NodeStats (Performance Metrics):**
```typescript
interface NodeStats {
  active_streams: number;      // Current active connections
  cpu_percent: number;         // CPU utilization (0-100)
  current_index: number;       // Current processing index
  file_size: number;           // Total file storage (bytes)
  last_updated: number;        // Timestamp of last update
  packets_received: number;    // Network RX packets
  packets_sent: number;        // Network TX packets
  ram_total: number;           // Total RAM (bytes)
  ram_used: number;            // Used RAM (bytes)
  total_bytes: number;         // Total bytes processed
  total_pages: number;         // Total storage pages
  uptime: number;              // Node uptime (seconds)
}
```

**PodsResponse:**
```typescript
interface PodsResponse {
  total_count: number;
  pods: Pod[];
}
```

### 1.6 Assumptions, Constraints & Unknowns

**Confirmed Assumptions:**
- pRPC uses JSON-RPC 2.0 over HTTP (not WebSocket)
- Default timeout: 8 seconds
- Gossip propagation is eventually consistent
- `last_seen_timestamp` indicates gossip freshness

**Constraints:**
- No official rate limits documented (assume reasonable usage)
- pRPC endpoints may have variable availability
- No WebSocket/streaming API currently available
- Limited to 8 known seed nodes

**Unknowns (Mitigated by Design):**
- Exact gossip propagation delay (design for eventual consistency)
- Maximum network size (design for scalability)
- Historical data retention on pNodes (we'll maintain our own history)
- Authentication requirements (appears to be open access)

---

## 2. Production Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PRESENTATION LAYER                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     Next.js Frontend (Vercel)                         │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │  │
│  │  │ Dashboard│ │ Node List│ │  Detail  │ │  Health  │ │  Search  │  │  │
│  │  │   View   │ │   View   │ │   View   │ │   View   │ │   View   │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ REST/tRPC
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                API LAYER                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │              Next.js API Routes / Edge Functions                      │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │  │
│  │  │  /api/nodes │  │ /api/stats  │  │ /api/health │                   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
┌───────────────────────┐ ┌───────────────────┐ ┌───────────────────────────┐
│     CACHE LAYER       │ │   DATA LAYER      │ │    INGESTION SERVICE      │
│  ┌─────────────────┐  │ │ ┌─────────────┐   │ │  ┌─────────────────────┐  │
│  │   Upstash Redis │  │ │ │   Supabase  │   │ │  │  Background Worker  │  │
│  │   (KV Store)    │  │ │ │ (PostgreSQL)│   │ │  │  (Vercel Cron/QStash)│  │
│  │                 │  │ │ │             │   │ │  │                     │  │
│  │  • Node cache   │  │ │ │  • History  │   │ │  │  • Poll pRPC (1min) │  │
│  │  • Stats cache  │  │ │ │  • Metrics  │   │ │  │  • Update cache     │  │
│  │  • Rate limits  │  │ │ │  • Alerts   │   │ │  │  • Store history    │  │
│  └─────────────────┘  │ │ └─────────────┘   │ │  └─────────────────────┘  │
└───────────────────────┘ └───────────────────┘ └───────────────────────────┘
                                      │
                                      │ pRPC (JSON-RPC 2.0)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         XANDEUM pNODE NETWORK                                │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │ Seed 1  │  │ Seed 2  │  │ Seed 3  │  │ Seed N  │  │ Peers   │          │
│  │ pNode   │  │ pNode   │  │ pNode   │  │ pNode   │  │ via     │          │
│  │         │  │         │  │         │  │         │  │ gossip  │          │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Architectural Decisions

#### Decision 1: Polling vs Streaming

**Choice: Polling with Intelligent Caching**

| Approach | Pros | Cons |
|----------|------|------|
| Polling | Simple, reliable, works with current pRPC | Higher latency |
| Streaming | Real-time updates | No pRPC WebSocket support |

**Rationale:**
- pRPC only supports HTTP/JSON-RPC (no WebSocket)
- 60-second polling interval is sufficient for analytics
- Aggressive caching minimizes pRPC load
- Simulates real-time via client-side polling of cached data

#### Decision 2: Server vs Edge

**Choice: Hybrid (Edge API + Server Background Jobs)**

| Component | Deployment | Rationale |
|-----------|------------|-----------|
| API Routes | Vercel Edge | Low latency, global distribution |
| UI | Vercel (Static/ISR) | Fast initial load, SEO |
| Background Jobs | Vercel Cron + QStash | Reliable scheduled execution |
| Cache | Upstash Redis | Edge-compatible, global |
| Database | Supabase | Managed PostgreSQL, realtime |

**Rationale:**
- Edge functions for API reads (sub-50ms response)
- Server functions for background data ingestion
- Upstash Redis is edge-native (no cold starts)
- Zero infrastructure management

#### Decision 3: Indexing Strategy

**Choice: Time-Series Bucketing with Materialized Aggregates**

```sql
-- Raw snapshots (1-minute granularity)
node_snapshots(node_pubkey, timestamp, stats_json, ...)

-- Pre-computed aggregates (hourly/daily)
node_metrics_hourly(node_pubkey, hour, avg_cpu, avg_ram, uptime_pct, ...)
node_metrics_daily(node_pubkey, date, avg_cpu, avg_ram, uptime_pct, ...)

-- Indexes
CREATE INDEX idx_snapshots_node_time ON node_snapshots(node_pubkey, timestamp DESC);
CREATE INDEX idx_snapshots_time ON node_snapshots(timestamp DESC);
```

**Rationale:**
- Fast queries for recent data (latest snapshot)
- Efficient historical analysis (pre-aggregated)
- Automatic cleanup of old raw data (retain 7 days)
- Keep aggregates indefinitely

### 2.3 Technology Stack

| Layer | Technology | Justification |
|-------|------------|---------------|
| **Frontend** | Next.js 14 (App Router) | Server components, streaming, best DX |
| **Styling** | Tailwind CSS + shadcn/ui | Rapid development, consistent design |
| **Charts** | Recharts / Tremor | React-native, performant |
| **State** | TanStack Query | Caching, background refetch |
| **API** | Next.js Route Handlers | Unified codebase, type-safe |
| **Validation** | Zod | Runtime type safety |
| **pRPC Client** | Custom TypeScript | Port of xandeum-prpc patterns |
| **Cache** | Upstash Redis | Edge-native, serverless |
| **Database** | Supabase PostgreSQL | Managed, realtime subscriptions |
| **Background Jobs** | Vercel Cron + QStash | Reliable, managed |
| **Hosting** | Vercel | Zero-config, edge network |
| **Monitoring** | Vercel Analytics + Sentry | Error tracking, performance |

### 2.4 Detailed Component Architecture

```
src/
├── app/                          # Next.js App Router
│   ├── (dashboard)/
│   │   ├── page.tsx              # Main dashboard
│   │   ├── nodes/
│   │   │   ├── page.tsx          # Node list
│   │   │   └── [pubkey]/
│   │   │       └── page.tsx      # Node detail
│   │   ├── health/
│   │   │   └── page.tsx          # Network health
│   │   └── layout.tsx            # Dashboard layout
│   ├── api/
│   │   ├── nodes/
│   │   │   ├── route.ts          # GET all nodes
│   │   │   └── [pubkey]/
│   │   │       ├── route.ts      # GET node details
│   │   │       └── history/
│   │   │           └── route.ts  # GET node history
│   │   ├── stats/
│   │   │   └── route.ts          # GET network stats
│   │   ├── health/
│   │   │   └── route.ts          # GET health summary
│   │   └── cron/
│   │       └── ingest/
│   │           └── route.ts      # POST trigger ingestion
│   └── layout.tsx
├── lib/
│   ├── prpc/
│   │   ├── client.ts             # pRPC client implementation
│   │   ├── types.ts              # TypeScript types
│   │   └── seeds.ts              # Seed node configuration
│   ├── db/
│   │   ├── schema.ts             # Database schema (Drizzle)
│   │   ├── client.ts             # Supabase client
│   │   └── queries.ts            # Database queries
│   ├── cache/
│   │   ├── client.ts             # Upstash Redis client
│   │   └── keys.ts               # Cache key patterns
│   └── utils/
│       ├── formatting.ts         # Number/date formatting
│       └── calculations.ts       # Metric calculations
├── components/
│   ├── dashboard/
│   │   ├── NetworkOverview.tsx
│   │   ├── NodeGrid.tsx
│   │   └── StatsCards.tsx
│   ├── nodes/
│   │   ├── NodeTable.tsx
│   │   ├── NodeCard.tsx
│   │   ├── NodeDetail.tsx
│   │   └── NodeSearch.tsx
│   ├── charts/
│   │   ├── UptimeChart.tsx
│   │   ├── ResourceChart.tsx
│   │   └── NetworkChart.tsx
│   └── ui/                       # shadcn/ui components
└── services/
    ├── ingestion/
    │   ├── collector.ts          # pRPC data collection
    │   ├── processor.ts          # Data normalization
    │   └── storage.ts            # Persistence logic
    └── aggregation/
        └── metrics.ts            # Metric aggregation
```

---

## 3. Data Pipeline Design

### 3.1 Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA INGESTION PIPELINE                            │
└─────────────────────────────────────────────────────────────────────────────┘

  PHASE 1: Discovery          PHASE 2: Collection        PHASE 3: Processing
  ──────────────────          ────────────────────       ───────────────────

  ┌─────────────┐             ┌─────────────────┐        ┌─────────────────┐
  │ Cron Trigger│             │  For each seed  │        │   Deduplicate   │
  │  (1 min)    │────────────►│  call get_pods  │───────►│   by pubkey     │
  └─────────────┘             └─────────────────┘        └────────┬────────┘
                                                                  │
                                      ┌───────────────────────────┘
                                      ▼
                              ┌─────────────────┐        ┌─────────────────┐
                              │  For each node  │        │    Normalize    │
                              │  call get_stats │───────►│    & Validate   │
                              └─────────────────┘        └────────┬────────┘
                                                                  │
                                      ┌───────────────────────────┘
                                      ▼
  PHASE 4: Storage            PHASE 5: Caching           PHASE 6: Notification
  ────────────────            ─────────────────          ────────────────────

  ┌─────────────────┐         ┌─────────────────┐        ┌─────────────────┐
  │  Write to       │         │  Update Redis   │        │ Detect changes  │
  │  PostgreSQL     │────────►│  cache          │───────►│ & alert         │
  │  (snapshots)    │         │  (TTL: 90s)     │        │ (optional)      │
  └─────────────────┘         └─────────────────┘        └─────────────────┘
```

### 3.2 Ingestion Service Implementation

```typescript
// services/ingestion/collector.ts

import { PrpcClient } from '@/lib/prpc/client';
import { SEED_IPS } from '@/lib/prpc/seeds';
import { Pod, NodeStats, CollectedNode } from '@/lib/prpc/types';

interface CollectionResult {
  nodes: CollectedNode[];
  errors: CollectionError[];
  duration_ms: number;
}

export async function collectNetworkSnapshot(): Promise<CollectionResult> {
  const startTime = Date.now();
  const errors: CollectionError[] = [];
  const nodeMap = new Map<string, CollectedNode>();

  // Phase 1: Discover all pods from seed nodes (parallel)
  const seedResults = await Promise.allSettled(
    SEED_IPS.map(async (ip) => {
      const client = new PrpcClient(ip, { timeout: 8000 });
      return client.getPods();
    })
  );

  // Merge pod lists, dedupe by pubkey
  for (let i = 0; i < seedResults.length; i++) {
    const result = seedResults[i];
    if (result.status === 'fulfilled') {
      for (const pod of result.value.pods) {
        if (!nodeMap.has(pod.pubkey)) {
          nodeMap.set(pod.pubkey, {
            pod,
            stats: null,
            collected_at: Date.now(),
            source_seed: SEED_IPS[i],
          });
        }
      }
    } else {
      errors.push({
        type: 'seed_unreachable',
        seed: SEED_IPS[i],
        error: result.reason.message,
      });
    }
  }

  // Phase 2: Collect stats from each discovered node (batched parallel)
  const nodes = Array.from(nodeMap.values());
  const BATCH_SIZE = 10; // Limit concurrent requests

  for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
    const batch = nodes.slice(i, i + BATCH_SIZE);
    const statsResults = await Promise.allSettled(
      batch.map(async (node) => {
        const [ip, port] = node.pod.address.split(':');
        const client = new PrpcClient(ip, { timeout: 8000, port });
        const stats = await client.getStats();
        return { pubkey: node.pod.pubkey, stats };
      })
    );

    for (const result of statsResults) {
      if (result.status === 'fulfilled') {
        const node = nodeMap.get(result.value.pubkey);
        if (node) {
          node.stats = result.value.stats;
        }
      } else {
        errors.push({
          type: 'stats_unreachable',
          pubkey: batch[statsResults.indexOf(result)]?.pod.pubkey,
          error: result.reason.message,
        });
      }
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    errors,
    duration_ms: Date.now() - startTime,
  };
}
```

### 3.3 Error Handling & Retry Strategy

```typescript
// services/ingestion/retry.ts

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const { maxRetries, baseDelay, maxDelay, backoffMultiplier } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) break;

      // Don't retry on certain errors
      if (isNonRetryableError(error)) throw error;

      const delay = Math.min(
        baseDelay * Math.pow(backoffMultiplier, attempt),
        maxDelay
      );

      await sleep(delay + Math.random() * 1000); // Add jitter
    }
  }

  throw lastError!;
}

function isNonRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    // Don't retry on client errors (4xx)
    if (error.message.includes('400') ||
        error.message.includes('401') ||
        error.message.includes('403') ||
        error.message.includes('404')) {
      return true;
    }
  }
  return false;
}
```

### 3.4 Rate Limiting & Backpressure

```typescript
// lib/prpc/rate-limiter.ts

import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '@/lib/cache/client';

// Global rate limit: 100 requests per minute per seed
export const seedRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1m'),
  prefix: 'prpc:seed',
});

// Per-node rate limit: 10 requests per minute
export const nodeRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1m'),
  prefix: 'prpc:node',
});

export async function withRateLimit(
  identifier: string,
  limiter: Ratelimit,
  fn: () => Promise<unknown>
): Promise<unknown> {
  const { success, remaining, reset } = await limiter.limit(identifier);

  if (!success) {
    const waitTime = reset - Date.now();
    throw new RateLimitError(
      `Rate limited. Try again in ${Math.ceil(waitTime / 1000)}s`,
      { remaining, reset }
    );
  }

  return fn();
}
```

### 3.5 Node Churn Handling

```typescript
// services/ingestion/churn.ts

interface NodeStatus {
  pubkey: string;
  first_seen: number;
  last_seen: number;
  consecutive_failures: number;
  status: 'online' | 'degraded' | 'offline' | 'churned';
}

const CHURN_THRESHOLDS = {
  degraded_after_failures: 3,      // Mark degraded after 3 consecutive failures
  offline_after_failures: 5,       // Mark offline after 5 consecutive failures
  churn_after_minutes: 30,         // Mark churned if offline > 30 min
  recovery_required_successes: 2,  // Require 2 successes to recover
};

export function updateNodeStatus(
  current: NodeStatus,
  collectionSuccessful: boolean,
  timestamp: number
): NodeStatus {
  if (collectionSuccessful) {
    return {
      ...current,
      last_seen: timestamp,
      consecutive_failures: 0,
      status: current.consecutive_failures >= CHURN_THRESHOLDS.recovery_required_successes
        ? 'online'  // Full recovery
        : current.status === 'online' ? 'online' : 'degraded', // Partial recovery
    };
  }

  const newFailures = current.consecutive_failures + 1;
  const offlineMinutes = (timestamp - current.last_seen) / 60000;

  let newStatus: NodeStatus['status'] = current.status;

  if (offlineMinutes >= CHURN_THRESHOLDS.churn_after_minutes) {
    newStatus = 'churned';
  } else if (newFailures >= CHURN_THRESHOLDS.offline_after_failures) {
    newStatus = 'offline';
  } else if (newFailures >= CHURN_THRESHOLDS.degraded_after_failures) {
    newStatus = 'degraded';
  }

  return {
    ...current,
    consecutive_failures: newFailures,
    status: newStatus,
  };
}
```

### 3.6 Data Normalization

```typescript
// services/ingestion/processor.ts

import { z } from 'zod';

// Strict validation schema
const NodeSnapshotSchema = z.object({
  pubkey: z.string().min(32).max(64),
  address: z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{1,5}$/),
  version: z.string().optional(),
  last_seen_timestamp: z.number().int().positive(),
  stats: z.object({
    active_streams: z.number().int().min(0),
    cpu_percent: z.number().min(0).max(100),
    ram_used: z.number().int().min(0),
    ram_total: z.number().int().min(0),
    uptime: z.number().int().min(0),
    packets_sent: z.number().int().min(0),
    packets_received: z.number().int().min(0),
    total_bytes: z.number().int().min(0),
    total_pages: z.number().int().min(0),
    file_size: z.number().int().min(0),
  }).nullable(),
});

export function normalizeNode(raw: unknown): NormalizedNode | null {
  const result = NodeSnapshotSchema.safeParse(raw);

  if (!result.success) {
    console.error('Validation failed:', result.error.issues);
    return null;
  }

  const data = result.data;

  return {
    pubkey: data.pubkey,
    address: data.address,
    ip: data.address.split(':')[0],
    port: parseInt(data.address.split(':')[1], 10),
    version: data.version || 'unknown',
    last_seen: new Date(data.last_seen_timestamp * 1000),
    stats: data.stats ? {
      ...data.stats,
      ram_percent: (data.stats.ram_used / data.stats.ram_total) * 100,
      uptime_hours: data.stats.uptime / 3600,
    } : null,
    collected_at: new Date(),
  };
}
```

### 3.7 Database Schema

```sql
-- PostgreSQL Schema (Supabase)

-- Core node registry
CREATE TABLE nodes (
  pubkey TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  ip INET NOT NULL,
  port INTEGER NOT NULL,
  version TEXT,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'degraded', 'offline', 'churned')),
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Time-series snapshots (partitioned by time)
CREATE TABLE node_snapshots (
  id BIGSERIAL,
  node_pubkey TEXT NOT NULL REFERENCES nodes(pubkey),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cpu_percent REAL,
  ram_used BIGINT,
  ram_total BIGINT,
  ram_percent REAL,
  uptime BIGINT,
  active_streams INTEGER,
  packets_sent BIGINT,
  packets_received BIGINT,
  total_bytes BIGINT,
  total_pages INTEGER,
  file_size BIGINT,
  collection_duration_ms INTEGER,
  PRIMARY KEY (timestamp, id)
) PARTITION BY RANGE (timestamp);

-- Create partitions for efficient time-series queries
CREATE TABLE node_snapshots_current PARTITION OF node_snapshots
  FOR VALUES FROM (NOW() - INTERVAL '1 day') TO (NOW() + INTERVAL '1 day');

-- Hourly aggregates
CREATE TABLE node_metrics_hourly (
  node_pubkey TEXT NOT NULL REFERENCES nodes(pubkey),
  hour TIMESTAMPTZ NOT NULL,
  sample_count INTEGER NOT NULL,
  avg_cpu REAL,
  max_cpu REAL,
  avg_ram_percent REAL,
  max_ram_percent REAL,
  avg_uptime BIGINT,
  total_packets_sent BIGINT,
  total_packets_received BIGINT,
  uptime_percent REAL,  -- % of samples where node was reachable
  PRIMARY KEY (node_pubkey, hour)
);

-- Daily aggregates
CREATE TABLE node_metrics_daily (
  node_pubkey TEXT NOT NULL REFERENCES nodes(pubkey),
  date DATE NOT NULL,
  sample_count INTEGER NOT NULL,
  avg_cpu REAL,
  max_cpu REAL,
  avg_ram_percent REAL,
  max_ram_percent REAL,
  uptime_seconds BIGINT,
  uptime_percent REAL,
  total_packets BIGINT,
  total_bytes_processed BIGINT,
  PRIMARY KEY (node_pubkey, date)
);

-- Network-wide daily stats
CREATE TABLE network_stats_daily (
  date DATE PRIMARY KEY,
  total_nodes INTEGER NOT NULL,
  active_nodes INTEGER NOT NULL,
  new_nodes INTEGER NOT NULL DEFAULT 0,
  churned_nodes INTEGER NOT NULL DEFAULT 0,
  avg_cpu REAL,
  avg_ram_percent REAL,
  total_storage_bytes BIGINT,
  avg_uptime_percent REAL
);

-- Indexes for common queries
CREATE INDEX idx_nodes_status ON nodes(status);
CREATE INDEX idx_nodes_last_seen ON nodes(last_seen DESC);
CREATE INDEX idx_snapshots_node_time ON node_snapshots(node_pubkey, timestamp DESC);
CREATE INDEX idx_hourly_node_hour ON node_metrics_hourly(node_pubkey, hour DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER nodes_updated_at
  BEFORE UPDATE ON nodes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 4. Feature Breakdown

### 4.1 Minimum Viable Features (Bounty Requirements)

These features directly address the judging criteria: **Functionality**, **Clarity**, and **User Experience**.

| # | Feature | Judging Criteria | Priority |
|---|---------|------------------|----------|
| 1 | **Node Discovery & Display** | Functionality | P0 |
| 2 | **Real-time Node List** | Functionality + Clarity | P0 |
| 3 | **Node Detail View** | Clarity + UX | P0 |
| 4 | **Network Overview Dashboard** | Clarity | P0 |
| 5 | **Node Search & Filter** | UX | P1 |
| 6 | **Responsive Design** | UX | P1 |

#### Feature 1: Node Discovery & Display
```
┌─────────────────────────────────────────────────────────┐
│  Successfully retrieves pNode list via pRPC calls       │
│  ───────────────────────────────────────────────────    │
│  • Connects to seed nodes                               │
│  • Calls get_pods() on each                             │
│  • Deduplicates by pubkey                               │
│  • Handles offline seeds gracefully                     │
└─────────────────────────────────────────────────────────┘
```

#### Feature 2: Real-time Node List
```
┌────────────────────────────────────────────────────────────────────────┐
│  pNode Network                                   Last updated: 12s ago │
├────────────────────────────────────────────────────────────────────────┤
│  🟢 47 Online   🟡 3 Degraded   🔴 2 Offline        Total: 52 nodes    │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ Status │ Pubkey      │ IP Address       │ CPU  │ RAM  │ Uptime │   │
│  ├────────┼─────────────┼──────────────────┼──────┼──────┼────────┤   │
│  │   🟢   │ HjeR...nQnC │ 173.212.220.65   │ 23%  │ 45%  │ 14d 5h │   │
│  │   🟢   │ GCoC...6yBg │ 161.97.97.41     │ 18%  │ 32%  │ 7d 12h │   │
│  │   🟡   │ 9kWm...pL2x │ 192.190.136.36   │ 78%  │ 91%  │ 2d 3h  │   │
│  │   🔴   │ Bx4n...qR7t │ 207.244.255.1    │  -   │  -   │   -    │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│                        [1] [2] [3] ... [5]  Next →                     │
└────────────────────────────────────────────────────────────────────────┘
```

#### Feature 3: Node Detail View
```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back to Nodes                                                        │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  pNode: HjeRsvpPX4CnJAXW3ua2y1qrRA7t9nf8s4dYgJnavQnC           │   │
│  │  ────────────────────────────────────────────────────────────   │   │
│  │  Status: 🟢 Online    Version: v0.1.5    First Seen: Dec 1     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │   CPU        │  │   Memory     │  │   Uptime     │  │  Network  │  │
│  │   23.4%      │  │   45% used   │  │   14d 5h 23m │  │  2.3 TB   │  │
│  │   ▁▂▃▂▁▂▃   │  │   8GB / 16GB │  │   99.7%      │  │  ↑↓ 1.2k  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └───────────┘  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Resource Usage (24h)                                           │   │
│  │  100% ┤                                                         │   │
│  │   75% ┤      ╭─╮        ╭───╮                                   │   │
│  │   50% ┼─────╯   ╰──────╯     ╰────────                          │   │
│  │   25% ┤                                  ───────────────────    │   │
│  │    0% ┴──────────────────────────────────────────────────────   │   │
│  │       00:00   06:00   12:00   18:00   24:00                     │   │
│  │       ── CPU   ── RAM                                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Feature 4: Network Overview Dashboard
```
┌─────────────────────────────────────────────────────────────────────────┐
│  XANDEUM pNODE NETWORK                                                  │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                         │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐               │
│  │ Total Nodes   │  │ Network Health│  │ Avg Uptime    │               │
│  │     52        │  │    🟢 94.2%   │  │    98.7%      │               │
│  │   +3 today    │  │   47 healthy  │  │   ▲ 0.3%     │               │
│  └───────────────┘  └───────────────┘  └───────────────┘               │
│                                                                         │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────┐  │
│  │  Node Status Distribution       │  │  Version Distribution       │  │
│  │  ┌───────────────────────┐      │  │  v0.1.5  ████████████ 35   │  │
│  │  │ 🟢 Online    90.4%   │      │  │  v0.1.4  █████        12   │  │
│  │  │ 🟡 Degraded   5.8%   │      │  │  v0.1.3  ██            5   │  │
│  │  │ 🔴 Offline    3.8%   │      │  │                             │  │
│  │  └───────────────────────┘      │  └─────────────────────────────┘  │
│  └─────────────────────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 High-Leverage Enhancements (Innovation Bonus)

These features differentiate for the **Innovation** bonus.

| # | Feature | Impact | Complexity |
|---|---------|--------|------------|
| 7 | **Geographic Map Visualization** | High | Medium |
| 8 | **Historical Performance Charts** | High | Low |
| 9 | **Node Comparison Tool** | Medium | Low |
| 10 | **Performance Leaderboard** | High | Low |
| 11 | **Uptime Badges / Score** | High | Low |
| 12 | **Network Health Alerts** | Medium | Medium |
| 13 | **API Endpoint (Public)** | Medium | Low |
| 14 | **Export Data (CSV/JSON)** | Low | Low |

#### Feature 7: Geographic Map Visualization
```
┌─────────────────────────────────────────────────────────────────────────┐
│  Network Geography                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                            🟢                                   │   │
│  │        🟢 🟢                    🟢 🟢                           │   │
│  │    🟢       🟢              🟢          🟢                      │   │
│  │          🟢    🟡    🟢  🟢                                      │   │
│  │       🟢     🟢   🟢       🔴                                    │   │
│  │                  🟢  🟢                                          │   │
│  │              🟢                                                  │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  Legend: 🟢 Online  🟡 Degraded  🔴 Offline                            │
│  Data Center Concentration: Germany (23), USA (15), France (8)...     │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Feature 10: Performance Leaderboard
```
┌─────────────────────────────────────────────────────────────────────────┐
│  🏆 Top Performing pNodes (30-day)                                      │
├────┬──────────────┬────────────┬──────────┬──────────┬─────────────────┤
│ #  │ Node         │ Uptime     │ Avg CPU  │ Score    │ Badge           │
├────┼──────────────┼────────────┼──────────┼──────────┼─────────────────┤
│ 1  │ HjeR...nQnC  │ 99.98%     │ 12.3%    │ 98.5     │ 🥇 Elite        │
│ 2  │ GCoC...6yBg  │ 99.95%     │ 15.1%    │ 97.2     │ 🥇 Elite        │
│ 3  │ 9kWm...pL2x  │ 99.87%     │ 22.4%    │ 95.8     │ 🥈 Reliable     │
│ 4  │ Bx4n...qR7t  │ 99.82%     │ 18.7%    │ 94.1     │ 🥈 Reliable     │
│ 5  │ mN3k...wT9v  │ 99.71%     │ 25.2%    │ 92.3     │ 🥉 Standard     │
└────┴──────────────┴────────────┴──────────┴──────────┴─────────────────┘
```

#### Feature 11: Uptime Badge System
```typescript
// Scoring algorithm
interface NodeScore {
  uptime_score: number;        // 0-40 points (uptime %)
  stability_score: number;     // 0-20 points (variance in availability)
  performance_score: number;   // 0-20 points (CPU/RAM headroom)
  longevity_score: number;     // 0-10 points (time online)
  version_score: number;       // 0-10 points (running latest version)
  total: number;               // 0-100
  badge: 'Elite' | 'Reliable' | 'Standard' | 'New' | 'At Risk';
}

function calculateBadge(total: number, daysOnline: number): string {
  if (daysOnline < 7) return 'New';
  if (total >= 95) return 'Elite';
  if (total >= 85) return 'Reliable';
  if (total >= 70) return 'Standard';
  return 'At Risk';
}
```

---

## 5. UX & Clarity Strategy

### 5.1 Information Architecture

```
                           ┌─────────────────┐
                           │    Dashboard    │
                           │  (Entry Point)  │
                           └────────┬────────┘
                                    │
           ┌────────────────────────┼────────────────────────┐
           │                        │                        │
           ▼                        ▼                        ▼
   ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
   │   Node List   │       │ Network Health│       │  Leaderboard  │
   │   (Browse)    │       │  (Monitor)    │       │  (Compare)    │
   └───────┬───────┘       └───────────────┘       └───────────────┘
           │
           ▼
   ┌───────────────┐
   │  Node Detail  │
   │  (Deep Dive)  │
   └───────────────┘
```

### 5.2 User Personas & Information Needs

#### Persona 1: pNode Operator
**Goal:** Monitor my own node's health and performance
**Key Questions:**
- Is my node online and reachable?
- How does my node compare to others?
- Are there issues I should address?

**Information Priority:**
1. Node status (online/offline)
2. Uptime percentage
3. Resource utilization (CPU/RAM)
4. Comparative ranking

#### Persona 2: Network Observer / Staker
**Goal:** Understand network health before staking/delegating
**Key Questions:**
- How healthy is the overall network?
- Which nodes are most reliable?
- What's the decentralization status?

**Information Priority:**
1. Network-wide statistics
2. Performance leaderboard
3. Geographic distribution
4. Historical reliability

#### Persona 3: Developer / Builder
**Goal:** Understand network capacity for building sedApps
**Key Questions:**
- How much storage capacity is available?
- What's the network's throughput?
- Are nodes running compatible versions?

**Information Priority:**
1. Total network capacity
2. Version distribution
3. API access for integration

### 5.3 Visual Design Principles

#### Color System for Status
```css
:root {
  /* Status Colors */
  --status-online: #10B981;      /* Green - Healthy */
  --status-degraded: #F59E0B;    /* Amber - Warning */
  --status-offline: #EF4444;     /* Red - Critical */
  --status-unknown: #6B7280;     /* Gray - No data */

  /* Metric Colors */
  --metric-low: #10B981;         /* Green - Good (< 50%) */
  --metric-medium: #F59E0B;      /* Amber - Caution (50-80%) */
  --metric-high: #EF4444;        /* Red - Critical (> 80%) */
}
```

#### Data Density Guidelines
```
┌──────────────────────────────────────────────────────────┐
│  HIGH DENSITY (Expert Users)                             │
│  • Node list table with all columns                      │
│  • Detailed metrics in tooltips                          │
│  • Advanced filtering and sorting                        │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  MEDIUM DENSITY (Default)                                │
│  • Key metrics visible at glance                         │
│  • Progressive disclosure for details                    │
│  • Visual status indicators                              │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  LOW DENSITY (Quick Overview)                            │
│  • Dashboard summary cards                               │
│  • Big numbers, minimal text                             │
│  • Single-glance health status                           │
└──────────────────────────────────────────────────────────┘
```

### 5.4 Key Visualizations

#### Uptime Visualization
```
   Uptime: 99.73%
   ┌────────────────────────────────────────────────────────┐
   │████████████████████████████████████████████████████░░░│
   └────────────────────────────────────────────────────────┘
   30d avg: 99.5%  │  7d avg: 99.8%  │  24h avg: 100%
```

#### Resource Utilization Gauge
```
        CPU: 23%                    RAM: 67%
     ┌─────────────┐             ┌─────────────┐
     │   ╭───╮     │             │   ╭───╮     │
     │  ╱     ╲    │             │  ╱     ╲    │
     │ │   ●   │   │             │ │   ●   │   │
     │  ╲  │  ╱    │             │  ╲  │  ╱    │
     │   ╰─┼─╯     │             │   ╰─┼─╯     │
     │     ▼       │             │       ▼     │
     │ [===    ]   │             │ [======= ]  │
     └─────────────┘             └─────────────┘
       Healthy                     Moderate
```

### 5.5 Accessibility Considerations

- **Color Blindness:** Use icons + color for status (not color alone)
- **Screen Readers:** Semantic HTML, ARIA labels on all interactive elements
- **Keyboard Navigation:** Full tab navigation support
- **Text Scaling:** Responsive typography that scales
- **Contrast:** WCAG AA compliant contrast ratios

---

## 6. Prompt Pack for Execution

### 6.1 Backend Service Prompts

#### Prompt 1: pRPC Client Implementation
```
Create a TypeScript pRPC client for Xandeum pNodes with the following specifications:

REQUIREMENTS:
1. Implement PrpcClient class with methods:
   - constructor(ip: string, options?: { timeout?: number; port?: number })
   - getPods(): Promise<PodsResponse>
   - getStats(): Promise<NodeStats>
   - getPodWithStats(): Promise<PodsResponse>

2. Use JSON-RPC 2.0 protocol over HTTP POST
3. Implement proper error handling with typed errors:
   - NetworkError (connection failed)
   - TimeoutError (request exceeded timeout)
   - RpcError (server returned error)
   - ValidationError (response failed validation)

4. Include Zod schemas for runtime validation of responses
5. Support configurable timeout (default 8 seconds)
6. Include request/response logging in development mode

TYPES TO IMPLEMENT:
```typescript
interface Pod {
  pubkey: string;
  address: string;
  version?: string;
  last_seen_timestamp: number;
  uptime?: number;
  storage_used?: number;
}

interface NodeStats {
  active_streams: number;
  cpu_percent: number;
  current_index: number;
  file_size: number;
  last_updated: number;
  packets_received: number;
  packets_sent: number;
  ram_total: number;
  ram_used: number;
  total_bytes: number;
  total_pages: number;
  uptime: number;
}

interface PodsResponse {
  pods: Pod[];
  total_count: number;
}
```

SEED IPS: ["173.212.220.65", "161.97.97.41", "192.190.136.36", "192.190.136.38", "207.244.255.1", "192.190.136.28", "192.190.136.29", "173.212.203.145"]

Use async/await, modern TypeScript features, and include JSDoc comments.
```

#### Prompt 2: Data Ingestion Service
```
Create a data ingestion service that collects pNode network snapshots with the following specifications:

REQUIREMENTS:
1. Implement collectNetworkSnapshot() function that:
   - Queries all seed nodes for pod lists in parallel
   - Deduplicates pods by pubkey
   - Collects stats from each unique pod (batched, 10 concurrent max)
   - Returns CollectionResult with nodes, errors, and timing

2. Implement retry logic with exponential backoff:
   - Max 3 retries
   - Base delay 1000ms, max delay 10000ms
   - Add jitter to prevent thundering herd

3. Handle node churn:
   - Track consecutive failures per node
   - Mark nodes as degraded after 3 failures
   - Mark nodes as offline after 5 failures
   - Mark nodes as churned after 30 minutes offline

4. Normalize and validate all collected data using Zod schemas

5. Support rate limiting (100 req/min per seed, 10 req/min per node)

INTEGRATE WITH:
- PrpcClient from lib/prpc/client.ts
- Upstash Redis for rate limiting
- Supabase PostgreSQL for persistence

Return detailed timing metrics for monitoring ingestion performance.
```

#### Prompt 3: Database Queries Service
```
Create a database queries service for the pNode analytics platform using Drizzle ORM with Supabase PostgreSQL.

REQUIREMENTS:
1. Implement the following query functions:
   - getAllNodes(options: { status?: string; limit?: number; offset?: number })
   - getNodeByPubkey(pubkey: string)
   - getNodeHistory(pubkey: string, timeRange: '24h' | '7d' | '30d')
   - getNetworkStats()
   - getTopNodes(metric: 'uptime' | 'performance', limit: number)
   - searchNodes(query: string)

2. Implement write functions:
   - upsertNode(node: NodeData)
   - insertSnapshot(snapshot: SnapshotData)
   - updateNodeStatus(pubkey: string, status: NodeStatus)
   - aggregateHourlyMetrics(hour: Date)
   - aggregateDailyMetrics(date: Date)

3. Use prepared statements for performance
4. Include proper error handling and logging
5. Support pagination with cursor-based or offset pagination
6. Include TypeScript return types for all functions

DATABASE SCHEMA:
- nodes: pubkey (PK), address, ip, port, version, first_seen, last_seen, status, consecutive_failures
- node_snapshots: id, node_pubkey (FK), timestamp, cpu_percent, ram_used, ram_total, uptime, etc.
- node_metrics_hourly: node_pubkey (FK), hour (PK), aggregated metrics
- node_metrics_daily: node_pubkey (FK), date (PK), aggregated metrics
- network_stats_daily: date (PK), total_nodes, active_nodes, avg metrics
```

#### Prompt 4: Caching Layer
```
Create a Redis caching layer using Upstash for the pNode analytics platform.

REQUIREMENTS:
1. Implement cache client with these methods:
   - getCachedNodes(): Promise<CachedNodesResponse | null>
   - setCachedNodes(data: CachedNodesResponse, ttl?: number): Promise<void>
   - getCachedNodeStats(pubkey: string): Promise<NodeStats | null>
   - setCachedNodeStats(pubkey: string, stats: NodeStats, ttl?: number): Promise<void>
   - getNetworkOverview(): Promise<NetworkOverview | null>
   - setNetworkOverview(data: NetworkOverview, ttl?: number): Promise<void>
   - invalidateNode(pubkey: string): Promise<void>
   - invalidateAll(): Promise<void>

2. Cache key patterns:
   - nodes:list -> Full node list (TTL: 60s)
   - nodes:{pubkey}:stats -> Individual node stats (TTL: 60s)
   - network:overview -> Network-wide stats (TTL: 30s)
   - network:health -> Health summary (TTL: 30s)

3. Implement stale-while-revalidate pattern:
   - Return stale data while fetching fresh data in background
   - Include cache metadata (cached_at, expires_at, is_stale)

4. Support cache warming on service startup

Use @upstash/redis package with proper error handling for edge runtime compatibility.
```

### 6.2 API Implementation Prompts

#### Prompt 5: API Route Handlers
```
Create Next.js 14 API route handlers for the pNode analytics platform.

REQUIREMENTS:
1. GET /api/nodes
   - Returns list of all nodes with pagination
   - Query params: status, sort, order, page, limit, search
   - Response: { nodes: Node[], pagination: { total, page, limit, pages } }
   - Use caching with 60s TTL

2. GET /api/nodes/[pubkey]
   - Returns detailed node information
   - Response: { node: NodeDetail, stats: NodeStats }
   - Include recent history (last 24h of snapshots)

3. GET /api/nodes/[pubkey]/history
   - Returns historical data for a node
   - Query params: range (24h, 7d, 30d), interval (raw, hourly, daily)
   - Response: { history: HistoryPoint[] }

4. GET /api/stats/network
   - Returns network-wide statistics
   - Response: { total_nodes, active_nodes, avg_cpu, avg_ram, total_storage, health_score }

5. GET /api/health
   - Returns network health summary
   - Response: { status, online_count, degraded_count, offline_count, checks: Check[] }

6. POST /api/cron/ingest (protected)
   - Triggers data ingestion
   - Verify Vercel Cron authorization header
   - Returns ingestion results

IMPLEMENTATION:
- Use Next.js App Router route handlers
- Implement proper HTTP status codes
- Include request validation with Zod
- Add rate limiting for public endpoints
- Include proper CORS headers
- Return consistent error responses
```

#### Prompt 6: Cron Job Implementation
```
Create a Vercel Cron job for automated data ingestion.

REQUIREMENTS:
1. Configure vercel.json:
   {
     "crons": [{
       "path": "/api/cron/ingest",
       "schedule": "* * * * *"  // Every minute
     }]
   }

2. Implement /api/cron/ingest route:
   - Verify CRON_SECRET header for security
   - Call collectNetworkSnapshot()
   - Update cache with fresh data
   - Store snapshots to database
   - Update node statuses based on collection results
   - Return summary of ingestion

3. Implement aggregation job (hourly):
   {
     "path": "/api/cron/aggregate",
     "schedule": "0 * * * *"  // Every hour
   }
   - Aggregate raw snapshots into hourly metrics
   - Clean up old raw snapshots (>7 days)

4. Include error handling and alerting:
   - Log all errors to Vercel logs
   - Track ingestion success rate
   - Alert if >50% of seeds unreachable

5. Add idempotency protection (prevent duplicate runs)
```

### 6.3 Frontend Dashboard Prompts

#### Prompt 7: Dashboard Layout
```
Create the main dashboard layout for the pNode analytics platform using Next.js 14 App Router.

REQUIREMENTS:
1. Create app/(dashboard)/layout.tsx:
   - Responsive sidebar navigation (collapsible on mobile)
   - Header with Xandeum branding and refresh indicator
   - Main content area with proper spacing

2. Navigation items:
   - Dashboard (home icon)
   - Nodes (server icon)
   - Network Health (activity icon)
   - Leaderboard (trophy icon)

3. Header features:
   - Xandeum logo
   - Last updated timestamp
   - Manual refresh button
   - Dark/light mode toggle (optional)

4. Implement using:
   - shadcn/ui components (Sidebar, Button, etc.)
   - Tailwind CSS for styling
   - Lucide icons

5. Include loading states and error boundaries

Make the layout responsive:
- Desktop: Fixed sidebar (240px)
- Tablet: Collapsible sidebar
- Mobile: Bottom navigation or hamburger menu
```

#### Prompt 8: Network Overview Dashboard
```
Create the main dashboard page showing network overview.

REQUIREMENTS:
1. Create app/(dashboard)/page.tsx with these sections:

   a) Stats Cards Row:
      - Total Nodes (with trend indicator)
      - Network Health % (color-coded)
      - Average Uptime %
      - Total Storage Capacity

   b) Status Distribution Chart:
      - Donut/pie chart showing online/degraded/offline distribution
      - Legend with counts and percentages

   c) Version Distribution:
      - Horizontal bar chart showing version breakdown
      - Sorted by count descending

   d) Recent Activity (optional):
      - List of recent node status changes
      - "Node X came online", "Node Y went offline"

2. Use TanStack Query for data fetching:
   - useQuery for /api/stats/network
   - Auto-refresh every 30 seconds
   - Show loading skeletons during fetch
   - Handle errors gracefully

3. Make all cards clickable to navigate to detail views

4. Use Recharts or Tremor for visualizations

5. Implement responsive grid layout
```

#### Prompt 9: Node List Component
```
Create a comprehensive node list view with filtering and sorting.

REQUIREMENTS:
1. Create app/(dashboard)/nodes/page.tsx with:

   a) Filter Bar:
      - Status filter (All, Online, Degraded, Offline)
      - Search input (search by pubkey or IP)
      - Sort dropdown (uptime, cpu, ram, last_seen)

   b) Node Table/Grid:
      - Columns: Status, Pubkey (truncated), IP Address, Version, CPU, RAM, Uptime, Last Seen
      - Row click navigates to detail view
      - Sortable columns
      - Mobile: Switch to card view

   c) Pagination:
      - Show 20 nodes per page
      - Page numbers and prev/next buttons
      - Show total count

2. Table features:
   - Status indicator (colored dot + icon)
   - Pubkey with copy button
   - Resource usage with progress bars
   - Relative time for Last Seen ("2 min ago")

3. Use TanStack Table for:
   - Sorting (client and server)
   - Filtering (client-side for quick filters)
   - Pagination (server-side)

4. Implement useSearchParams for URL state (shareable filters)

5. Add loading states with skeleton rows
```

#### Prompt 10: Node Detail Page
```
Create a detailed node view page showing comprehensive node information.

REQUIREMENTS:
1. Create app/(dashboard)/nodes/[pubkey]/page.tsx with:

   a) Header Section:
      - Full pubkey with copy button
      - Status badge (large)
      - Version number
      - First seen / Last seen dates

   b) Stats Cards:
      - CPU Usage (gauge + percentage)
      - RAM Usage (gauge + percentage with used/total)
      - Uptime (duration + percentage)
      - Network Traffic (packets sent/received)

   c) Resource History Chart:
      - Line chart showing CPU and RAM over time
      - Time range selector (24h, 7d, 30d)
      - Zoom/pan capability
      - Show min/max/avg in tooltip

   d) Uptime History:
      - Calendar heatmap or timeline showing daily uptime
      - Color-coded by uptime percentage

   e) Technical Details:
      - IP Address with geolocation (optional)
      - Port number
      - Total bytes processed
      - Total pages stored

2. Use parallel data fetching:
   - Node details from /api/nodes/[pubkey]
   - History from /api/nodes/[pubkey]/history

3. Handle "node not found" with proper 404 UI

4. Include breadcrumb navigation back to node list
```

### 6.4 Deployment & Operations Prompts

#### Prompt 11: Deployment Configuration
```
Create deployment configuration for the pNode analytics platform on Vercel.

REQUIREMENTS:
1. Create vercel.json with:
   - Cron job configurations
   - Environment variable references
   - Redirect rules (if needed)
   - Headers for caching

2. Create .env.example with all required variables:
   - DATABASE_URL (Supabase)
   - UPSTASH_REDIS_REST_URL
   - UPSTASH_REDIS_REST_TOKEN
   - CRON_SECRET
   - NEXT_PUBLIC_APP_URL

3. Create deploy checklist document:
   a) Vercel Setup:
      - Create project
      - Link repository
      - Configure environment variables
   b) Supabase Setup:
      - Create project
      - Run database migrations
      - Configure connection pooling
   c) Upstash Setup:
      - Create Redis database
      - Copy credentials
   d) Post-deployment:
      - Verify cron jobs running
      - Test API endpoints
      - Monitor initial data ingestion

4. Create database migration script using Drizzle Kit

5. Include rollback procedures
```

#### Prompt 12: Documentation
```
Create comprehensive documentation for the pNode analytics platform.

REQUIREMENTS:
1. README.md:
   - Project overview and features
   - Quick start guide
   - Architecture diagram
   - Tech stack summary
   - Screenshots

2. DEPLOYMENT.md:
   - Prerequisites
   - Step-by-step deployment guide for Vercel
   - Environment variable reference
   - Database setup instructions
   - Troubleshooting guide

3. API.md:
   - All API endpoints with examples
   - Request/response schemas
   - Error codes and handling
   - Rate limiting information

4. DEVELOPMENT.md:
   - Local development setup
   - Running tests
   - Code structure overview
   - Contributing guidelines

5. Include code comments and JSDoc for all public functions

Format all documentation in clean Markdown with code blocks and diagrams where appropriate.
```

---

## 7. Risk & Failure Analysis

### 7.1 Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Seed nodes unreachable | Medium | High | Multiple seeds, fallback, caching |
| pRPC API changes | Low | High | Version detection, abstraction layer |
| Rate limiting by pNodes | Medium | Medium | Request throttling, caching |
| Gossip inconsistency | High | Low | Eventual consistency design |
| Database performance | Low | Medium | Indexing, aggregation, partitioning |
| Cache invalidation issues | Medium | Low | TTL-based expiry, manual invalidate |
| High node churn | Medium | Medium | Churn tracking, status history |

### 7.2 Failure Scenarios & Mitigations

#### Scenario 1: All Seed Nodes Unreachable
```
DETECTION:
- All seed requests fail within ingestion cycle
- Health check returns critical status

IMPACT:
- Cannot discover new nodes
- Cannot update existing node stats
- Dashboard shows stale data

MITIGATION:
1. Use cached data with "stale" indicator
2. Display clear warning to users: "Data may be outdated"
3. Exponential backoff on retry attempts
4. Alert operators via logging/monitoring

IMPLEMENTATION:
```typescript
if (allSeedsFailed) {
  const cachedData = await cache.get('nodes:list');
  if (cachedData) {
    return {
      ...cachedData,
      metadata: { is_stale: true, stale_reason: 'seed_nodes_unreachable' }
    };
  }
  throw new NetworkUnavailableError('All seed nodes unreachable');
}
```
```

#### Scenario 2: Individual Node Stats Unreachable
```
DETECTION:
- get_stats() call fails for specific node
- Consecutive failure counter increments

IMPACT:
- Missing stats for individual node
- Node may appear less reliable than it is

MITIGATION:
1. Mark node as "degraded" after threshold
2. Use last known stats with timestamp
3. Track collection success rate per node
4. Factor collection issues into reliability score

IMPLEMENTATION:
```typescript
try {
  stats = await client.getStats();
  node.consecutive_failures = 0;
  node.status = 'online';
} catch (error) {
  node.consecutive_failures++;
  if (node.consecutive_failures >= 5) {
    node.status = 'offline';
  } else if (node.consecutive_failures >= 3) {
    node.status = 'degraded';
  }
  // Use last known stats
  stats = await db.getLatestStats(node.pubkey);
}
```
```

#### Scenario 3: Gossip Data Inconsistency
```
DETECTION:
- Different seeds return different pod lists
- Node appears/disappears between queries

IMPACT:
- Inconsistent node counts
- Potential for duplicate entries
- Confusing user experience

MITIGATION:
1. Merge pod lists from all seeds
2. Deduplicate by pubkey (latest timestamp wins)
3. Use consensus for conflicting data
4. Track "seen by X seeds" metric

IMPLEMENTATION:
```typescript
function mergePodsFromSeeds(seedResults: PodsResponse[]): Pod[] {
  const podMap = new Map<string, { pod: Pod; seenCount: number }>();

  for (const result of seedResults) {
    for (const pod of result.pods) {
      const existing = podMap.get(pod.pubkey);
      if (!existing || pod.last_seen_timestamp > existing.pod.last_seen_timestamp) {
        podMap.set(pod.pubkey, {
          pod,
          seenCount: (existing?.seenCount || 0) + 1
        });
      } else {
        existing.seenCount++;
      }
    }
  }

  return Array.from(podMap.values())
    .filter(({ seenCount }) => seenCount >= Math.ceil(seedResults.length / 2)) // Seen by majority
    .map(({ pod }) => pod);
}
```
```

#### Scenario 4: Data Skew / Outliers
```
DETECTION:
- CPU > 100% (invalid data)
- RAM used > RAM total
- Negative values
- Timestamp in future

IMPACT:
- Corrupted charts and statistics
- Misleading performance metrics
- Lost trust in dashboard accuracy

MITIGATION:
1. Strict validation with Zod schemas
2. Reject invalid data points
3. Use rolling averages to smooth outliers
4. Flag suspicious data for review

IMPLEMENTATION:
```typescript
const NodeStatsSchema = z.object({
  cpu_percent: z.number().min(0).max(100),
  ram_used: z.number().int().min(0),
  ram_total: z.number().int().min(1),
  uptime: z.number().int().min(0),
}).refine(
  (data) => data.ram_used <= data.ram_total,
  { message: "RAM used cannot exceed RAM total" }
);

function validateAndSanitize(raw: unknown): NodeStats | null {
  const result = NodeStatsSchema.safeParse(raw);
  if (!result.success) {
    logger.warn('Invalid stats data', { errors: result.error.issues });
    return null;
  }
  return result.data;
}
```
```

#### Scenario 5: Vercel Cron Failures
```
DETECTION:
- No new snapshots for > 5 minutes
- Cron execution logs show failures

IMPACT:
- Stale data across entire platform
- Historical gaps in metrics

MITIGATION:
1. Health endpoint checks last ingestion time
2. Use QStash as backup scheduler
3. Manual trigger endpoint for recovery
4. Alert on prolonged staleness

IMPLEMENTATION:
```typescript
// Health check
export async function GET() {
  const lastIngestion = await cache.get('ingestion:last_run');
  const staleness = Date.now() - (lastIngestion || 0);

  if (staleness > 5 * 60 * 1000) {
    return Response.json({
      status: 'degraded',
      message: 'Data ingestion may be delayed',
      last_ingestion: lastIngestion,
      staleness_seconds: Math.floor(staleness / 1000)
    }, { status: 503 });
  }

  return Response.json({ status: 'healthy' });
}
```
```

### 7.3 Monitoring & Alerting Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MONITORING STACK                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Vercel Analytics          Sentry                 Custom Metrics         │
│  ┌────────────────┐        ┌────────────────┐     ┌────────────────┐    │
│  │ • Page views   │        │ • Exceptions   │     │ • Ingestion    │    │
│  │ • Web vitals   │        │ • API errors   │     │   success rate │    │
│  │ • Edge latency │        │ • Stack traces │     │ • Seed health  │    │
│  └────────────────┘        └────────────────┘     │ • Cache hits   │    │
│                                                    └────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    ALERT CONDITIONS                              │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │  CRITICAL:                                                       │    │
│  │  • Ingestion failure > 10 minutes                                │    │
│  │  • All seeds unreachable                                         │    │
│  │  • Database connection failed                                    │    │
│  │                                                                  │    │
│  │  WARNING:                                                        │    │
│  │  • > 50% of seeds unreachable                                   │    │
│  │  • Ingestion duration > 30 seconds                               │    │
│  │  • Error rate > 5%                                               │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Delivery Plan

### 8.1 Phase Breakdown

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DELIVERY TIMELINE                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 1: Foundation                                                     │
│  ════════════════════                                                    │
│  ☐ Project scaffolding (Next.js 14, TypeScript, Tailwind)               │
│  ☐ pRPC client implementation                                            │
│  ☐ Database schema & migrations                                          │
│  ☐ Redis cache setup                                                     │
│  ☐ Basic API routes (/api/nodes, /api/stats)                            │
│                                                                          │
│  Milestone: Can fetch and display raw node data                         │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 2: Core Features (MVP)                                           │
│  ═══════════════════════════                                            │
│  ☐ Data ingestion service                                               │
│  ☐ Cron job configuration                                               │
│  ☐ Dashboard layout & navigation                                        │
│  ☐ Network overview page                                                │
│  ☐ Node list with filtering                                             │
│  ☐ Node detail page                                                     │
│                                                                          │
│  Milestone: Functional analytics dashboard meeting all base requirements│
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 3: Polish & Enhancement                                          │
│  ═════════════════════════════                                          │
│  ☐ Historical charts implementation                                     │
│  ☐ Performance leaderboard                                              │
│  ☐ Uptime badge system                                                  │
│  ☐ Search functionality                                                 │
│  ☐ Mobile responsiveness                                                │
│  ☐ Error handling & edge cases                                          │
│                                                                          │
│  Milestone: Enhanced UX with innovation features                        │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 4: Production Ready                                              │
│  ═════════════════════════                                              │
│  ☐ Performance optimization                                             │
│  ☐ Comprehensive testing                                                │
│  ☐ Documentation completion                                             │
│  ☐ Deployment to production                                             │
│  ☐ Final testing & bug fixes                                            │
│                                                                          │
│  Milestone: Production-ready submission                                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Detailed Task Breakdown

#### Phase 1: Foundation
```
1.1 Project Setup
    ├── Initialize Next.js 14 with App Router
    ├── Configure TypeScript strict mode
    ├── Install dependencies (Tailwind, shadcn/ui, Recharts)
    ├── Set up ESLint & Prettier
    └── Create folder structure

1.2 pRPC Client
    ├── Implement PrpcClient class
    ├── Add Zod validation schemas
    ├── Implement error types
    ├── Add retry logic
    └── Write unit tests

1.3 Database Layer
    ├── Set up Supabase project
    ├── Create Drizzle schema
    ├── Run migrations
    ├── Implement query functions
    └── Set up connection pooling

1.4 Cache Layer
    ├── Set up Upstash Redis
    ├── Implement cache client
    ├── Define cache key patterns
    └── Add TTL configurations

1.5 Basic API
    ├── GET /api/nodes
    ├── GET /api/nodes/[pubkey]
    └── GET /api/stats/network
```

#### Phase 2: Core Features
```
2.1 Data Ingestion
    ├── Implement collectNetworkSnapshot()
    ├── Add rate limiting
    ├── Implement churn detection
    ├── Create storage functions
    └── Test with live network

2.2 Cron Jobs
    ├── Configure vercel.json
    ├── Implement /api/cron/ingest
    ├── Add authorization
    └── Test cron execution

2.3 Dashboard Layout
    ├── Create layout component
    ├── Build navigation sidebar
    ├── Add header with refresh indicator
    └── Implement loading states

2.4 Dashboard Home
    ├── Stats cards component
    ├── Status distribution chart
    ├── Version distribution chart
    └── Data fetching with TanStack Query

2.5 Node List
    ├── Node table component
    ├── Filter bar
    ├── Sorting implementation
    ├── Pagination
    └── Search functionality

2.6 Node Detail
    ├── Header with node info
    ├── Stats cards
    ├── History endpoint
    └── Basic history chart
```

#### Phase 3: Enhancement
```
3.1 Charts
    ├── Resource usage line chart
    ├── Uptime calendar heatmap
    ├── Time range selector
    └── Chart tooltips

3.2 Leaderboard
    ├── Scoring algorithm
    ├── Leaderboard page
    ├── Badge system
    └── Top nodes display

3.3 UX Polish
    ├── Loading skeletons
    ├── Error boundaries
    ├── Empty states
    ├── Toast notifications
    └── Responsive design

3.4 Search
    ├── Search by pubkey
    ├── Search by IP
    ├── Autocomplete
    └── Recent searches
```

#### Phase 4: Production
```
4.1 Performance
    ├── Bundle analysis
    ├── Image optimization
    ├── API response caching
    └── Lighthouse audit

4.2 Testing
    ├── Unit tests
    ├── Integration tests
    ├── E2E tests (critical paths)
    └── Manual QA

4.3 Documentation
    ├── README.md
    ├── DEPLOYMENT.md
    ├── API documentation
    └── Code comments

4.4 Deployment
    ├── Vercel production deploy
    ├── Environment variables
    ├── Domain configuration
    └── Monitoring setup
```

### 8.3 Judging Criteria Alignment

| Criteria | How We Address It |
|----------|-------------------|
| **Functionality** | Valid pRPC calls, accurate data display, working cron ingestion |
| **Clarity** | Clean UI, meaningful metrics, status indicators, tooltips |
| **User Experience** | Fast loading, intuitive navigation, mobile responsive, search |
| **Innovation** | Leaderboard, badges, historical charts, geographic view |

### 8.4 Submission Checklist

```
PRE-SUBMISSION:
☐ Live website deployed and accessible
☐ All API endpoints functioning
☐ Cron jobs running successfully
☐ Data refreshing automatically
☐ No console errors
☐ Mobile responsive
☐ README complete with deployment instructions
☐ Clean GitHub repository

TESTING:
☐ Node list loads correctly
☐ Node detail shows accurate stats
☐ Search finds nodes
☐ Filters work correctly
☐ Charts render properly
☐ No stale data (< 2 min old)

DOCUMENTATION:
☐ README with project overview
☐ Screenshots/demo GIF
☐ Deployment instructions
☐ API documentation
☐ Architecture explanation
```

---

## Appendix A: Reference Links

- [Xandeum Technical Docs](https://docs.xandeum.network/)
- [xandeum-prpc Crate](https://crates.io/crates/xandeum-prpc/0.1.1)
- [Xandeum Herrenberg Announcement](https://x.com/XandeumNetwork/status/1965507584519221422)
- [pNode Setup Guide](https://pnodes.xandeum.network/)
- [Solana Validator Dashboard (Reference)](https://www.validators.app/)
- [stakewiz.com (Reference)](https://stakewiz.com)
- [Grafana Solana Dashboard](https://grafana.com/grafana/dashboards/14625-solana-validator/)

---

## Appendix B: Quick Reference - pRPC Methods

```typescript
// Endpoint format (VERIFIED)
// URL: http://{IP}:6000/rpc
// Protocol: JSON-RPC 2.0

// Connect to pNode
const client = new PrpcClient("173.212.220.65", { timeout: 8000 });

// Get all pods from gossip
// JSON-RPC method: "get-pods"
const pods = await client.getPods();
// Returns: { pods: Pod[], total_count: number }

// Get node statistics
// JSON-RPC method: "get-stats"
const stats = await client.getStats();
// Returns: NodeStats

// Get pods with stats (combined)
// JSON-RPC method: "get-pods-with-stats"
const podsWithStats = await client.getPodsWithStats();

// Find specific node across seeds
const node = await findPnode("HjeRsvpPX4CnJAXW3ua2y1qrRA7t9nf8s4dYgJnavQnC");

// Default seed IPs
const SEEDS = [
  "173.212.220.65", "161.97.97.41", "192.190.136.36",
  "192.190.136.38", "207.244.255.1", "192.190.136.28",
  "192.190.136.29", "173.212.203.145"
];

// Raw JSON-RPC request example
fetch("http://173.212.220.65:6000/rpc", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "get-pods",
    params: []
  })
});
```

---

*This blueprint provides a complete technical roadmap for building a production-grade Xandeum pNode Analytics Platform. Execute against the prompt pack sequentially, and reference the architecture decisions when making implementation choices.*
