/**
 * API Request Validation Schemas
 * Zod schemas for validating query parameters and request bodies
 */

import { z } from 'zod';

/**
 * Nodes API query parameters schema
 */
export const NodesQuerySchema = z.object({
  status: z.enum(['online', 'degraded', 'offline', 'unknown']).optional(),
  sort: z.enum(['uptime', 'cpu', 'ram', 'last_seen']).default('last_seen'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  search: z.string().max(100).optional(),
});

export type NodesQuery = z.infer<typeof NodesQuerySchema>;

/**
 * Leaderboard API query parameters schema
 */
export const LeaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  badge: z.enum(['Elite', 'Reliable', 'Standard', 'New', 'At Risk']).optional(),
});

export type LeaderboardQuery = z.infer<typeof LeaderboardQuerySchema>;

/**
 * Export API query parameters schema
 */
export const ExportQuerySchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
  scores: z.enum(['true', 'false']).transform(val => val === 'true').default('false'),
  stats: z.enum(['true', 'false']).transform(val => val === 'true').default('true'),
});

export type ExportQuery = z.infer<typeof ExportQuerySchema>;

/**
 * Node detail (pubkey) path parameter schema
 */
export const NodePubkeySchema = z.object({
  pubkey: z.string().min(32).max(64),
});

export type NodePubkey = z.infer<typeof NodePubkeySchema>;

/**
 * Helper function to validate and parse query parameters
 * Returns validated data or throws a detailed validation error
 */
export function validateQuery<T extends z.ZodType>(
  schema: T,
  searchParams: URLSearchParams
): z.infer<T> {
  const rawData: Record<string, string> = {};

  // Convert URLSearchParams to object
  searchParams.forEach((value, key) => {
    rawData[key] = value;
  });

  // Validate with Zod
  const result = schema.safeParse(rawData);

  if (!result.success) {
    const errorMessage = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');

    throw new ValidationError(
      `Invalid query parameters: ${errorMessage}`,
      result.error.issues
    );
  }

  return result.data;
}

/**
 * Helper function to validate path parameters
 */
export function validateParams<T extends z.ZodType>(
  schema: T,
  params: Record<string, string>
): z.infer<T> {
  const result = schema.safeParse(params);

  if (!result.success) {
    const errorMessage = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');

    throw new ValidationError(
      `Invalid path parameters: ${errorMessage}`,
      result.error.issues
    );
  }

  return result.data;
}

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  public readonly issues: Array<{ path: string; message: string }>;

  constructor(message: string, zodIssues: z.ZodIssue[]) {
    super(message);
    this.name = 'ValidationError';
    this.issues = zodIssues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
  }

  toJSON() {
    return {
      error: 'Validation failed',
      message: this.message,
      issues: this.issues,
    };
  }
}
