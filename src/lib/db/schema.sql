-- Xandeum Atlas Historical Data Schema
-- Optimized for time-series analytics and fast queries

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Node snapshots: Hourly captures of all node metrics
CREATE TABLE IF NOT EXISTS node_snapshots (
  id BIGSERIAL PRIMARY KEY,
  pubkey VARCHAR(64) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Node identification
  address VARCHAR(100) NOT NULL,
  version VARCHAR(50),

  -- Status and health
  status VARCHAR(20) NOT NULL CHECK (status IN ('online', 'degraded', 'offline', 'unknown')),
  last_seen_timestamp BIGINT NOT NULL,

  -- Performance metrics
  cpu_percent FLOAT,
  ram_used BIGINT,
  ram_total BIGINT,
  ram_percent FLOAT,

  -- Uptime and activity
  uptime_seconds BIGINT,
  packets_sent BIGINT,
  packets_received BIGINT,
  total_bytes BIGINT,
  active_streams INTEGER,

  -- Storage
  file_size BIGINT,
  total_pages BIGINT,
  current_index BIGINT,

  -- Credits
  credits BIGINT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast time-series queries
CREATE INDEX IF NOT EXISTS idx_node_snapshots_pubkey_timestamp
  ON node_snapshots(pubkey, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_node_snapshots_timestamp
  ON node_snapshots(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_node_snapshots_status_timestamp
  ON node_snapshots(status, timestamp DESC);

-- Partial index for recent data (most queried)
CREATE INDEX IF NOT EXISTS idx_node_snapshots_recent
  ON node_snapshots(pubkey, timestamp DESC)
  WHERE timestamp > NOW() - INTERVAL '30 days';

-- ============================================================================
-- AGGREGATION TABLES
-- ============================================================================

-- Network-wide metrics aggregated by hour
CREATE TABLE IF NOT EXISTS network_metrics_hourly (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,

  -- Node counts
  total_nodes INTEGER NOT NULL,
  online_nodes INTEGER NOT NULL,
  degraded_nodes INTEGER NOT NULL,
  offline_nodes INTEGER NOT NULL,
  health_percent FLOAT NOT NULL,

  -- Performance aggregates
  avg_cpu FLOAT,
  avg_ram_percent FLOAT,
  total_storage_bytes BIGINT,

  -- Activity aggregates
  total_packets_sent BIGINT,
  total_packets_received BIGINT,
  total_active_streams BIGINT,

  -- Version distribution (JSONB for flexibility)
  version_distribution JSONB,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(timestamp)
);

CREATE INDEX IF NOT EXISTS idx_network_metrics_timestamp
  ON network_metrics_hourly(timestamp DESC);

-- Daily rollup for long-term storage efficiency
CREATE TABLE IF NOT EXISTS network_metrics_daily (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,

  -- Averages
  avg_total_nodes FLOAT NOT NULL,
  avg_online_nodes FLOAT NOT NULL,
  avg_health_percent FLOAT NOT NULL,
  avg_cpu FLOAT,
  avg_ram_percent FLOAT,

  -- Min/Max for insights
  min_health_percent FLOAT,
  max_health_percent FLOAT,
  peak_nodes INTEGER,

  -- Storage growth
  avg_storage_bytes BIGINT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(date)
);

CREATE INDEX IF NOT EXISTS idx_network_metrics_daily_date
  ON network_metrics_daily(date DESC);

-- ============================================================================
-- EVENT TRACKING
-- ============================================================================

-- Significant node events for timeline/alerts
CREATE TABLE IF NOT EXISTS node_events (
  id BIGSERIAL PRIMARY KEY,
  pubkey VARCHAR(64) NOT NULL,
  event_type VARCHAR(50) NOT NULL CHECK (
    event_type IN ('joined', 'left', 'status_change', 'version_upgrade', 'degraded', 'recovered')
  ),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Event metadata
  previous_value TEXT,
  new_value TEXT,
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_node_events_pubkey_timestamp
  ON node_events(pubkey, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_node_events_type_timestamp
  ON node_events(event_type, timestamp DESC);

-- ============================================================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- ============================================================================

-- Node uptime summary (refreshed hourly)
CREATE MATERIALIZED VIEW IF NOT EXISTS node_uptime_summary AS
SELECT
  pubkey,
  COUNT(*) as total_snapshots,
  COUNT(*) FILTER (WHERE status = 'online') as online_snapshots,
  (COUNT(*) FILTER (WHERE status = 'online')::FLOAT / NULLIF(COUNT(*), 0) * 100) as uptime_percent,
  MAX(timestamp) as last_seen,
  MIN(timestamp) as first_seen,
  AVG(cpu_percent) as avg_cpu,
  AVG(ram_percent) as avg_ram,
  MAX(uptime_seconds) as max_uptime_seconds
FROM node_snapshots
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY pubkey;

CREATE UNIQUE INDEX IF NOT EXISTS idx_node_uptime_summary_pubkey
  ON node_uptime_summary(pubkey);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to clean up old data (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_snapshots()
RETURNS void AS $$
BEGIN
  -- Keep detailed snapshots for 30 days
  DELETE FROM node_snapshots
  WHERE timestamp < NOW() - INTERVAL '30 days';

  -- Keep hourly metrics for 90 days
  DELETE FROM network_metrics_hourly
  WHERE timestamp < NOW() - INTERVAL '90 days';

  -- Keep daily metrics for 1 year
  DELETE FROM network_metrics_daily
  WHERE date < CURRENT_DATE - INTERVAL '1 year';

  -- Keep events for 60 days
  DELETE FROM node_events
  WHERE timestamp < NOW() - INTERVAL '60 days';
END;
$$ LANGUAGE plpgsql;

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_node_uptime_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY node_uptime_summary;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE node_snapshots IS 'Hourly snapshots of individual node metrics';
COMMENT ON TABLE network_metrics_hourly IS 'Hourly aggregated network-wide statistics';
COMMENT ON TABLE network_metrics_daily IS 'Daily rollup of network metrics for long-term trends';
COMMENT ON TABLE node_events IS 'Significant events in node lifecycle';
COMMENT ON MATERIALIZED VIEW node_uptime_summary IS 'Pre-computed uptime statistics per node (30-day rolling)';
