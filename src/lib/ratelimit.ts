/**
 * API Rate Limiting with Upstash
 * Protects API endpoints from abuse and controls costs
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';
import { getEnv, isRedisConfigured } from '@/lib/env';

// Initialize Redis client for rate limiting
let redis: Redis | null = null;

function getRedisForRatelimit(): Redis | null {
  if (!isRedisConfigured()) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[RateLimit] Disabled - Redis not configured');
    }
    return null;
  }

  if (!redis) {
    const env = getEnv();
    redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL!,
      token: env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }

  return redis;
}

// Rate limiter instances
let apiRateLimiter: Ratelimit | null = null;
let cronRateLimiter: Ratelimit | null = null;

/**
 * Get API rate limiter instance (100 requests per minute per IP)
 */
function getApiRateLimiter(): Ratelimit | null {
  const redisClient = getRedisForRatelimit();
  if (!redisClient) return null;

  if (!apiRateLimiter) {
    apiRateLimiter = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(100, '1 m'),
      analytics: true,
      prefix: 'ratelimit:api',
    });
  }

  return apiRateLimiter;
}

/**
 * Get cron rate limiter instance (10 requests per hour)
 */
function getCronRateLimiter(): Ratelimit | null {
  const redisClient = getRedisForRatelimit();
  if (!redisClient) return null;

  if (!cronRateLimiter) {
    cronRateLimiter = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(10, '1 h'),
      analytics: true,
      prefix: 'ratelimit:cron',
    });
  }

  return cronRateLimiter;
}

/**
 * Extract IP address from request
 */
function getIpAddress(request: NextRequest): string {
  // Try Vercel's forwarded IP header first
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  // Fallback to other headers
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Last resort fallback
  return 'unknown';
}

/**
 * Apply rate limiting to an API endpoint
 * Returns NextResponse with 429 status if rate limit exceeded
 */
export async function withRateLimit(
  request: NextRequest,
  handler: () => Promise<NextResponse> | NextResponse
): Promise<NextResponse> {
  const rateLimiter = getApiRateLimiter();

  // If rate limiting is disabled (no Redis), allow all requests
  if (!rateLimiter) {
    return handler();
  }

  const ip = getIpAddress(request);
  const identifier = `api:${ip}`;

  try {
    const { success, limit, remaining, reset } = await rateLimiter.limit(identifier);

    if (!success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          limit,
          remaining: 0,
          reset: new Date(reset).toISOString(),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': reset.toString(),
            'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Rate limit passed, execute handler
    const response = await handler();

    // Add rate limit headers to successful response
    response.headers.set('X-RateLimit-Limit', limit.toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set('X-RateLimit-Reset', reset.toString());

    return response;
  } catch (error) {
    console.error('[RateLimit] Error checking rate limit:', error);
    // On rate limit check failure, allow request but log error
    return handler();
  }
}

/**
 * Apply rate limiting to cron endpoints
 * More restrictive limits for expensive background jobs
 */
export async function withCronRateLimit(
  request: NextRequest,
  handler: () => Promise<NextResponse> | NextResponse
): Promise<NextResponse> {
  const rateLimiter = getCronRateLimiter();

  // If rate limiting is disabled, allow requests
  if (!rateLimiter) {
    return handler();
  }

  const ip = getIpAddress(request);
  const identifier = `cron:${ip}`;

  try {
    const { success, limit, remaining, reset } = await rateLimiter.limit(identifier);

    if (!success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Cron endpoint rate limit exceeded',
          limit,
          remaining: 0,
          reset: new Date(reset).toISOString(),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': reset.toString(),
          },
        }
      );
    }

    const response = await handler();
    response.headers.set('X-RateLimit-Limit', limit.toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set('X-RateLimit-Reset', reset.toString());

    return response;
  } catch (error) {
    console.error('[RateLimit] Error checking cron rate limit:', error);
    return handler();
  }
}

/**
 * Type-safe wrapper for API routes with rate limiting
 */
export function createRateLimitedRoute(
  handler: (request: NextRequest) => Promise<NextResponse> | NextResponse
) {
  return async (request: NextRequest) => {
    return withRateLimit(request, () => handler(request));
  };
}

/**
 * Type-safe wrapper for cron routes with rate limiting
 */
export function createRateLimitedCronRoute(
  handler: (request: NextRequest) => Promise<NextResponse> | NextResponse
) {
  return async (request: NextRequest) => {
    return withCronRateLimit(request, () => handler(request));
  };
}
