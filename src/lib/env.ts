/**
 * Environment Variable Validation
 * Validates required environment variables on app startup
 * Provides type-safe access to environment variables
 */

import { z } from 'zod';

/**
 * Environment variables schema
 */
const envSchema = z.object({
  // Redis (required for production caching)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

  // Postgres (required for production historical data)
  POSTGRES_URL: z.string().url().optional(),
  POSTGRES_URL_NON_POOLING: z.string().url().optional(),

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
  POSTGRES_URL: z.string().url({
    message: 'POSTGRES_URL is required in production',
  }),
  POSTGRES_URL_NON_POOLING: z.string().url({
    message: 'POSTGRES_URL_NON_POOLING is required in production',
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
      if (!env.POSTGRES_URL || !env.POSTGRES_URL_NON_POOLING) {
        console.warn('[ENV] Warning: Postgres not configured - historical data disabled');
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
 */
export function isPostgresConfigured(): boolean {
  const env = getEnv();
  return !!(env.POSTGRES_URL && env.POSTGRES_URL_NON_POOLING);
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
