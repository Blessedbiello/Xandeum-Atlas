/**
 * Environment Variable Validation
 * Validates required environment variables on app startup
 * Provides type-safe access to environment variables
 */

import { z } from 'zod';

/**
 * Helper to make URL fields optional and handle empty/invalid values gracefully
 */
const optionalUrl = () =>
  z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val.trim() === '') return undefined;
      // Check if it contains placeholder text
      if (val.includes('[') && val.includes(']')) return undefined;
      try {
        new URL(val);
        return val;
      } catch {
        return undefined;
      }
    });

/**
 * Environment variables schema
 */
const envSchema = z.object({
  // Redis (required for production caching)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

  // Postgres (required for production historical data)
  // Support multiple provider naming conventions
  POSTGRES_URL: optionalUrl(),
  POSTGRES_URL_NON_POOLING: optionalUrl(),
  DATABASE_URL: optionalUrl(), // Neon, Supabase
  DATABASE_URL_UNPOOLED: optionalUrl(), // Neon non-pooled

  // Cron job secret (required for production)
  CRON_SECRET: z.string().min(32).optional(),

  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Vercel deployment info (optional)
  VERCEL_URL: z.string().optional(),
  VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),
});

/**
 * Strict production schema - all critical vars required
 */
const prodEnvSchema = envSchema.extend({
  UPSTASH_REDIS_REST_URL: z.string().url({
    message: 'UPSTASH_REDIS_REST_URL is required in production',
  }),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1, {
    message: 'UPSTASH_REDIS_REST_TOKEN is required in production',
  }),
  CRON_SECRET: z.string().min(32, {
    message: 'CRON_SECRET must be at least 32 characters',
  }),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validate environment variables
 * @throws {ZodError} if validation fails
 */
export function validateEnv(): Env {
  const isProduction = process.env.NODE_ENV === 'production';
  const schema = isProduction ? prodEnvSchema : envSchema;

  try {
    const env = schema.parse(process.env);

    // Log warnings for missing optional vars in development
    if (!isProduction) {
      if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
        console.warn('[ENV] Warning: Redis not configured - caching will be disabled');
      }
      const hasPostgres = !!(
        (env.POSTGRES_URL && env.POSTGRES_URL_NON_POOLING) ||
        (env.DATABASE_URL && env.DATABASE_URL_UNPOOLED) ||
        env.DATABASE_URL
      );
      if (!hasPostgres) {
        console.warn('[ENV] Warning: Postgres not configured - historical data disabled');
        console.warn('[ENV] Set DATABASE_URL (Neon/Supabase) or POSTGRES_URL (Vercel)');
      }
      if (!env.CRON_SECRET) {
        console.warn('[ENV] Warning: CRON_SECRET not set - cron endpoints unprotected');
      }
    }

    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[ENV] Environment validation failed:');
      error.issues.forEach((issue) => {
        console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
      });
      throw new Error('Environment validation failed. Check logs for details.');
    }
    throw error;
  }
}

/**
 * Get validated environment variables
 * Safe to call multiple times (cached after first call)
 */
let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = validateEnv();
  }
  return cachedEnv;
}

/**
 * Check if Redis is configured
 */
export function isRedisConfigured(): boolean {
  const env = getEnv();
  return !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

/**
 * Check if Postgres is configured
 * Supports multiple provider naming conventions:
 * - Vercel Postgres: POSTGRES_URL + POSTGRES_URL_NON_POOLING
 * - Neon: DATABASE_URL + DATABASE_URL_UNPOOLED
 * - Supabase/Others: DATABASE_URL
 */
export function isPostgresConfigured(): boolean {
  const env = getEnv();

  // Check for Vercel Postgres style
  if (env.POSTGRES_URL && env.POSTGRES_URL_NON_POOLING) {
    return true;
  }

  // Check for Neon style with unpooled connection
  if (env.DATABASE_URL && env.DATABASE_URL_UNPOOLED) {
    return true;
  }

  // Check for single DATABASE_URL (Supabase, Neon pooled, etc.)
  if (env.DATABASE_URL) {
    return true;
  }

  return false;
}

/**
 * Get Postgres connection URL (pooled)
 */
export function getPostgresUrl(): string | undefined {
  const env = getEnv();
  return env.POSTGRES_URL || env.DATABASE_URL;
}

/**
 * Get Postgres connection URL (non-pooled/direct)
 * Falls back to pooled URL if non-pooled not available
 */
export function getPostgresUrlNonPooling(): string | undefined {
  const env = getEnv();
  return env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL_UNPOOLED || env.DATABASE_URL;
}

/**
 * Check if cron secret is configured
 */
export function isCronSecretConfigured(): boolean {
  const env = getEnv();
  return !!env.CRON_SECRET;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  const env = getEnv();
  return env.NODE_ENV === 'production';
}

// Validate on module load in production (but not during build)
if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PHASE) {
  try {
    validateEnv();
    console.log('[ENV] Environment validation passed');
  } catch (error) {
    console.error('[ENV] CRITICAL: Environment validation failed');
    // In production runtime, we want to fail fast
    process.exit(1);
  }
}
