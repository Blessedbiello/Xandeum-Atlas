/**
 * Xandeum pNode seed node configuration
 * These are the bootstrap nodes used to discover the gossip network
 */

export const SEED_IPS = [
  "173.212.220.65",
  "161.97.97.41",
  "192.190.136.36",
  "192.190.136.38",
  "207.244.255.1",
  "192.190.136.28",
  "192.190.136.29",
  "173.212.203.145",
] as const;

export type SeedIP = (typeof SEED_IPS)[number];

/**
 * pRPC endpoint configuration
 * Verified from xandeum-prpc Rust source code
 */
export const PRPC_CONFIG = {
  /** Default port for pRPC endpoints */
  PORT: 6000,
  /** Endpoint path */
  PATH: "/rpc",
  /** Default timeout in milliseconds */
  DEFAULT_TIMEOUT: 8000,
  /** Maximum timeout allowed */
  MAX_TIMEOUT: 30000,
} as const;

/**
 * JSON-RPC method names (verified from Rust source)
 * Note: Uses hyphens, not underscores
 */
export const PRPC_METHODS = {
  GET_PODS: "get-pods",
  GET_STATS: "get-stats",
  GET_PODS_WITH_STATS: "get-pods-with-stats",
} as const;
