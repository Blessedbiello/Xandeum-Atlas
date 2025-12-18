# Redis Caching Setup Guide

This application uses **Upstash Redis** for persistent caching to dramatically improve performance.

## Why Redis Caching?

Without caching, every API request triggers a full network data collection from all pNode seed nodes, which takes 30-70 seconds. With Redis caching, most requests return in under 100ms.

### Performance Impact

- **Before Redis:** 60-120 second initial page load
- **After Redis:** 1-3 second initial page load (20-40x faster!)

## Setup Instructions

### 1. Create Upstash Redis Database

1. Go to [upstash.com](https://upstash.com) and sign up for a free account
2. Click "Create Database"
3. Choose settings:
   - **Name:** `xandeum-atlas` (or your preferred name)
   - **Type:** Regional (for lowest latency)
   - **Region:** Choose closest to your Vercel deployment region
   - **Eviction:** Enable eviction (recommended)
4. Click "Create"

### 2. Get Redis Credentials

After creating the database:

1. Navigate to the database details page
2. Scroll to the "REST API" section
3. Copy the following values:
   - **UPSTASH_REDIS_REST_URL** - The REST URL endpoint
   - **UPSTASH_REDIS_REST_TOKEN** - The REST Token

### 3. Add Environment Variables

#### For Local Development

Add to your `.env.local` file:

```env
UPSTASH_REDIS_REST_URL="https://your-db-id.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your_rest_token_here"
```

#### For Vercel Deployment

1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add both variables:
   - `UPSTASH_REDIS_REST_URL` = `https://your-db-id.upstash.io`
   - `UPSTASH_REDIS_REST_TOKEN` = `your_rest_token_here`
4. Make sure to add them for all environments (Production, Preview, Development)

### 4. Verify Installation

After deploying with Redis credentials:

1. Open your application
2. Open browser DevTools > Network tab
3. Refresh the page and check API responses
4. Look for the `X-Cache` header in responses:
   - `X-Cache: MISS` = Data fetched from pNodes (slow)
   - `X-Cache: HIT` = Data served from cache (fast!)

## Cache Strategy

### API Routes and TTLs

| Route | Cache Duration | Purpose |
|-------|---------------|---------|
| `/api/stats` | 30 seconds | Network statistics |
| `/api/nodes` | 60 seconds | Node list snapshot |
| `/api/geo` | 5 minutes | Full geolocation data |
| Individual IP geos | 30 days | Per-IP geolocation cache |

### How It Works

1. **First Request (Cache Miss):**
   - Collects data from all pNode seed nodes (~30-70 seconds)
   - Caches the result in Redis
   - Returns data with `X-Cache: MISS` header

2. **Subsequent Requests (Cache Hit):**
   - Retrieves data from Redis (~50-100ms)
   - Returns cached data with `X-Cache: HIT` header
   - No pNode network requests needed

3. **Cache Expiration:**
   - After TTL expires, next request triggers fresh data collection
   - New data is cached for subsequent requests
   - Continuous refresh cycle ensures data stays relatively fresh

### IP Geolocation Caching

The `/api/geo` route uses a two-level caching strategy:

1. **Full Response Cache** (5 minutes):
   - Complete geo response with all nodes
   - Fastest for map page loads

2. **Per-IP Cache** (30 days):
   - Individual IP geolocation data
   - Eliminates redundant external API calls
   - IP locations rarely change, so long TTL is safe

This dramatically reduces the 60-second wait between IP-API batches!

## Monitoring Cache Performance

### Check Response Headers

Every API response includes cache debugging headers:

```
X-Cache: HIT                    # Cache hit or miss
X-Response-Time: 45ms           # Total response time
X-Collection-Duration: 35421ms  # Data collection time (MISS only)
```

For `/api/geo` specifically:
```
X-Cached-IPs: 75   # Number of IPs served from cache
X-New-IPs: 5       # Number of IPs that needed fresh lookup
```

### Upstash Dashboard

Monitor your Redis usage at [console.upstash.com](https://console.upstash.com):

- **Commands:** Number of Redis operations
- **Storage:** Cache data size
- **Bandwidth:** Network usage
- **Latency:** Redis response times

## Free Tier Limits

Upstash free tier includes:

- **10,000 commands/day** - More than enough for typical usage
- **256 MB storage** - Plenty for network data
- **1 GB bandwidth/month**

Typical usage for this app:
- ~100-200 commands/day for low traffic
- ~1-2 MB storage
- Well within free tier limits

## Troubleshooting

### Redis Not Working

If caching isn't working:

1. **Check environment variables are set:**
   ```bash
   # In Vercel dashboard or locally
   echo $UPSTASH_REDIS_REST_URL
   echo $UPSTASH_REDIS_REST_TOKEN
   ```

2. **Verify Redis credentials:**
   - Make sure URL and token are correct
   - Check for trailing spaces or quotes

3. **Check application logs:**
   - Look for "Redis not configured" warnings
   - Redis errors will be logged to console

4. **Test Redis connection:**
   - Visit `/api/stats`
   - Check response headers for `X-Cache`
   - If always `MISS`, Redis may not be connected

### Graceful Degradation

The application works without Redis:

- If Redis is not configured, caching is disabled
- All requests will be cache misses (slower, but functional)
- Console will show: `Redis not configured - caching disabled`

This ensures the app never breaks due to Redis issues.

## Cost Optimization

To optimize Redis usage:

1. **Adjust cache TTLs** in `src/lib/cache/redis.ts`:
   - Longer TTLs = fewer cache misses = less pNode traffic
   - Shorter TTLs = fresher data = more accurate stats

2. **Monitor usage patterns:**
   - Track `X-Cache` hit/miss ratio
   - Identify frequently requested endpoints
   - Tune TTLs based on actual usage

3. **Consider upgrading for high traffic:**
   - If hitting 10K commands/day limit
   - Upstash Pro starts at $10/month
   - Much cheaper than slow load times losing users!

## Next Steps

After setting up Redis caching:

1. ✅ Install Redis credentials
2. ✅ Deploy application
3. ✅ Verify cache hits in headers
4. 🚀 **Optional:** Set up background data collection with Vercel Cron (see Phase 2 in performance docs)

For Phase 2 setup (background cron jobs), see the main performance optimization guide.
