/**
 * Redis Cache Client
 * Provides persistent caching using Upstash Redis
 */

import { Redis } from '@upstash/redis';
import { getEnv, isRedisConfigured } from '@/lib/env';

// Initialize Redis client (lazy initialization for serverless)
let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  // Check if Redis is configured using validated env
  if (!isRedisConfigured()) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Redis] Not configured - caching disabled');
    }
    return null;
  }

  // Return existing client or create new one
  if (!redisClient) {
    const env = getEnv();
    redisClient = new Redis({
      url: env.UPSTASH_REDIS_REST_URL!,
      token: env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }

  return redisClient;
}

// Cache key prefixes
export const CACHE_KEYS = {
  NETWORK_SNAPSHOT_PRIMARY: 'network:snapshot:primary', // Source of truth - all endpoints check this first
  NETWORK_STATS: 'network:stats',
  NETWORK_SNAPSHOT: 'network:snapshot',
  NODES_LIST: 'network:nodes',
  GEO_DATA: 'network:geo',
  GEO_IP: 'geo:ip:',  // Prefix for individual IP lookups
  POD_CREDITS: 'network:pod-credits', // Pod credits data
} as const;

// Cache TTL (Time To Live) in seconds
export const CACHE_TTL = {
  SNAPSHOT_PRIMARY: 300,  // 5 minutes - source of truth for all data
  STATS: 300,             // 5 minutes - derived from primary snapshot
  SNAPSHOT: 300,          // 5 minutes - same as primary
  NODES: 300,             // 5 minutes
  GEO_DATA: 600,          // 10 minutes - geo data changes slowly
  GEO_IP: 86400 * 30,     // 30 days - individual IP geolocation (rarely changes)
  CREDITS: 3600,          // 1 hour - credits change slowly
} as const;

/**
 * Get value from cache
 */
export async function getCache<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const value = await redis.get<T>(key);
    return value;
  } catch (error) {
    console.error('Redis GET error:', error);
    return null;
  }
}

/**
 * Set value in cache with TTL
 */
export async function setCache<T>(
  key: string,
  value: T,
  ttl: number
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;

  try {
    await redis.setex(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Redis SET error:', error);
    return false;
  }
}

/**
 * Delete value from cache
 */
export async function deleteCache(key: string): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;

  try {
    await redis.del(key);
    return true;
  } catch (error) {
    console.error('Redis DEL error:', error);
    return false;
  }
}

/**
 * Get multiple cache values by pattern
 */
export async function getCacheByPattern(pattern: string): Promise<Record<string, any>> {
  const redis = getRedisClient();
  if (!redis) return {};

  try {
    // Note: Upstash Redis doesn't support SCAN, so we'll need to manage keys differently
    // For now, return empty object and rely on individual key lookups
    console.warn('Pattern matching not fully supported on Upstash - use specific keys');
    return {};
  } catch (error) {
    console.error('Redis pattern search error:', error);
    return {};
  }
}

/**
 * Hash operations for IP geolocation cache
 */
export async function getIpGeo(ip: string): Promise<any | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const value = await redis.get(`${CACHE_KEYS.GEO_IP}${ip}`);
    return value;
  } catch (error) {
    console.error('Redis IP geo GET error:', error);
    return null;
  }
}

export async function setIpGeo(ip: string, geoData: any): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;

  try {
    await redis.setex(
      `${CACHE_KEYS.GEO_IP}${ip}`,
      CACHE_TTL.GEO_IP,
      JSON.stringify(geoData)
    );
    return true;
  } catch (error) {
    console.error('Redis IP geo SET error:', error);
    return false;
  }
}

/**
 * Health check for Redis connection
 */
export async function checkRedisHealth(): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;

  try {
    await redis.ping();
    return true;
  } catch (error) {
    console.error('Redis health check failed:', error);
    return false;
  }
}
