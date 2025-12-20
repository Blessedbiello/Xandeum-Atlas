/**
 * Database Client
 * Manages Postgres connection pool and provides type-safe queries
 * Supports multiple providers: Vercel Postgres, Neon, Supabase, etc.
 */

import { sql } from '@vercel/postgres';
import { isPostgresConfigured, getPostgresUrl, getPostgresUrlNonPooling } from '@/lib/env';
import type { NodeWithStats } from '@/types';

/**
 * Initialize Postgres environment variables for @vercel/postgres SDK
 * The SDK expects POSTGRES_URL, but providers like Neon use DATABASE_URL
 */
function initializePostgresEnv(): void {
  // Only run once
  if (process.env.__POSTGRES_INITIALIZED) return;

  const pooledUrl = getPostgresUrl();
  const nonPooledUrl = getPostgresUrlNonPooling();

  // Set POSTGRES_URL if not already set (for @vercel/postgres SDK compatibility)
  if (!process.env.POSTGRES_URL && pooledUrl) {
    process.env.POSTGRES_URL = pooledUrl;
  }

  // Set POSTGRES_URL_NON_POOLING if not already set
  if (!process.env.POSTGRES_URL_NON_POOLING && nonPooledUrl) {
    process.env.POSTGRES_URL_NON_POOLING = nonPooledUrl;
  }

  process.env.__POSTGRES_INITIALIZED = 'true';
}

// Initialize on module load
if (isPostgresConfigured()) {
  initializePostgresEnv();
}

/**
 * Check if database is available
 */
export function isDatabaseAvailable(): boolean {
  return isPostgresConfigured();
}

/**
 * Initialize database schema (idempotent - safe to run multiple times)
 */
export async function initializeDatabase(): Promise<void> {
  if (!isDatabaseAvailable()) {
    console.warn('[DB] Database not configured - skipping initialization');
    return;
  }

  try {
    // Create tables if they don't exist
    await sql`
      CREATE TABLE IF NOT EXISTS node_snapshots (
        id BIGSERIAL PRIMARY KEY,
        pubkey VARCHAR(64) NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        address VARCHAR(100) NOT NULL,
        version VARCHAR(50),
        status VARCHAR(20) NOT NULL CHECK (status IN ('online', 'degraded', 'offline', 'unknown')),
        last_seen_timestamp BIGINT NOT NULL,
        cpu_percent FLOAT,
        ram_used BIGINT,
        ram_total BIGINT,
        ram_percent FLOAT,
        uptime_seconds BIGINT,
        packets_sent BIGINT,
        packets_received BIGINT,
        total_bytes BIGINT,
        active_streams INTEGER,
        file_size BIGINT,
        total_pages BIGINT,
        current_index BIGINT,
        credits BIGINT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_node_snapshots_pubkey_timestamp
      ON node_snapshots(pubkey, timestamp DESC)`;

    await sql`CREATE INDEX IF NOT EXISTS idx_node_snapshots_timestamp
      ON node_snapshots(timestamp DESC)`;

    await sql`CREATE INDEX IF NOT EXISTS idx_node_snapshots_status_timestamp
      ON node_snapshots(status, timestamp DESC)`;

    console.log('[DB] Database initialized successfully');
  } catch (error) {
    console.error('[DB] Error initializing database:', error);
    throw error;
  }
}

/**
 * Insert node snapshot(s) into database
 */
export async function insertNodeSnapshots(nodes: NodeWithStats[]): Promise<number> {
  if (!isDatabaseAvailable() || nodes.length === 0) {
    return 0;
  }

  try {
    const timestamp = new Date().toISOString();
    let insertedCount = 0;

    // Insert nodes in batches of 50 for efficiency
    const batchSize = 50;
    for (let i = 0; i < nodes.length; i += batchSize) {
      const batch = nodes.slice(i, i + batchSize);

      const insertPromises = batch.map(async (node) => {
        try {
          const result = await sql`
            INSERT INTO node_snapshots (
              pubkey, timestamp, address, version, status, last_seen_timestamp,
              cpu_percent, ram_used, ram_total, ram_percent, uptime_seconds,
              packets_sent, packets_received, total_bytes, active_streams,
              file_size, total_pages, current_index, credits
            )
            VALUES (
              ${node.pubkey},
              ${timestamp}::timestamptz,
              ${node.address},
              ${node.version || null},
              ${node.status},
              ${node.last_seen_timestamp},
              ${node.stats?.cpu_percent || null},
              ${node.stats?.ram_used || null},
              ${node.stats?.ram_total || null},
              ${node.ram_percent || null},
              ${node.stats?.uptime || null},
              ${node.stats?.packets_sent || null},
              ${node.stats?.packets_received || null},
              ${node.stats?.total_bytes || null},
              ${node.stats?.active_streams || null},
              ${node.stats?.file_size || null},
              ${node.stats?.total_pages || null},
              ${node.stats?.current_index || null},
              ${node.credits || null}
            )
          `;
          return result.rowCount || 0;
        } catch (error) {
          console.error(`[DB] Failed to insert snapshot for ${node.pubkey}:`, error);
          return 0;
        }
      });

      const results = await Promise.all(insertPromises);
      insertedCount += results.reduce((sum, count) => sum + count, 0);
    }

    return insertedCount;
  } catch (error) {
    console.error('[DB] Error inserting node snapshots:', error);
    throw error;
  }
}

/**
 * Get node history for a specific pubkey
 */
export interface NodeHistoryPoint {
  timestamp: string;
  status: string;
  cpu_percent: number | null;
  ram_percent: number | null;
  uptime_seconds: number | null;
  packets_sent: number | null;
  packets_received: number | null;
}

export async function getNodeHistory(
  pubkey: string,
  hours: number = 24
): Promise<NodeHistoryPoint[]> {
  if (!isDatabaseAvailable()) {
    return [];
  }

  try {
    // Calculate the timestamp for the time range
    const sinceTimestamp = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const result = await sql<NodeHistoryPoint>`
      SELECT
        timestamp,
        status,
        cpu_percent,
        ram_percent,
        uptime_seconds,
        packets_sent,
        packets_received
      FROM node_snapshots
      WHERE pubkey = ${pubkey}
        AND timestamp > ${sinceTimestamp}::timestamptz
      ORDER BY timestamp ASC
    `;

    return result.rows;
  } catch (error) {
    console.error('[DB] Error fetching node history:', error);
    return [];
  }
}

/**
 * Get node uptime statistics
 */
export interface NodeUptimeStats {
  pubkey: string;
  total_snapshots: number;
  online_snapshots: number;
  uptime_percent: number;
  last_seen: string;
  first_seen: string;
  avg_cpu: number | null;
  avg_ram: number | null;
  max_uptime_seconds: number | null;
}

export async function getNodeUptimeStats(
  pubkey: string,
  days: number = 30
): Promise<NodeUptimeStats | null> {
  if (!isDatabaseAvailable()) {
    return null;
  }

  try {
    // Calculate the timestamp for the time range
    const sinceTimestamp = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const result = await sql<NodeUptimeStats>`
      SELECT
        pubkey,
        COUNT(*) as total_snapshots,
        COUNT(*) FILTER (WHERE status = 'online') as online_snapshots,
        (COUNT(*) FILTER (WHERE status = 'online')::FLOAT / NULLIF(COUNT(*), 0) * 100) as uptime_percent,
        MAX(timestamp)::text as last_seen,
        MIN(timestamp)::text as first_seen,
        AVG(cpu_percent) as avg_cpu,
        AVG(ram_percent) as avg_ram,
        MAX(uptime_seconds) as max_uptime_seconds
      FROM node_snapshots
      WHERE pubkey = ${pubkey}
        AND timestamp > ${sinceTimestamp}::timestamptz
      GROUP BY pubkey
    `;

    return result.rows[0] || null;
  } catch (error) {
    console.error('[DB] Error fetching node uptime stats:', error);
    return null;
  }
}

/**
 * Get network-wide statistics over time
 */
export interface NetworkHistoryPoint {
  timestamp: string;
  total_nodes: number;
  online_nodes: number;
  degraded_nodes: number;
  offline_nodes: number;
  health_percent: number;
  avg_cpu: number | null;
  avg_ram: number | null;
}

export async function getNetworkHistory(
  hours: number = 24,
  interval: 'hour' | 'day' = 'hour'
): Promise<NetworkHistoryPoint[]> {
  if (!isDatabaseAvailable()) {
    return [];
  }

  try {
    const truncFunction = interval === 'hour' ? 'hour' : 'day';
    // Calculate the timestamp for the time range
    const sinceTimestamp = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const result = await sql<NetworkHistoryPoint>`
      SELECT
        date_trunc(${truncFunction}, timestamp) as timestamp,
        COUNT(DISTINCT pubkey) as total_nodes,
        COUNT(DISTINCT pubkey) FILTER (WHERE status = 'online') as online_nodes,
        COUNT(DISTINCT pubkey) FILTER (WHERE status = 'degraded') as degraded_nodes,
        COUNT(DISTINCT pubkey) FILTER (WHERE status = 'offline') as offline_nodes,
        (COUNT(DISTINCT pubkey) FILTER (WHERE status = 'online')::FLOAT /
         NULLIF(COUNT(DISTINCT pubkey), 0) * 100) as health_percent,
        AVG(cpu_percent) as avg_cpu,
        AVG(ram_percent) as avg_ram
      FROM node_snapshots
      WHERE timestamp > ${sinceTimestamp}::timestamptz
      GROUP BY date_trunc(${truncFunction}, timestamp)
      ORDER BY timestamp ASC
    `;

    return result.rows;
  } catch (error) {
    console.error('[DB] Error fetching network history:', error);
    return [];
  }
}

/**
 * Cleanup old snapshots based on retention policy
 */
export async function cleanupOldSnapshots(): Promise<number> {
  if (!isDatabaseAvailable()) {
    return 0;
  }

  try {
    // Keep detailed snapshots for 30 days
    const result = await sql`
      DELETE FROM node_snapshots
      WHERE timestamp < NOW() - INTERVAL '30 days'
    `;

    const deletedCount = result.rowCount || 0;
    console.log(`[DB] Cleaned up ${deletedCount} old snapshots`);
    return deletedCount;
  } catch (error) {
    console.error('[DB] Error cleaning up old snapshots:', error);
    throw error;
  }
}

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  if (!isDatabaseAvailable()) {
    return false;
  }

  try {
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error('[DB] Health check failed:', error);
    return false;
  }
}
