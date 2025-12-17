import { z } from "zod";

/**
 * Zod schemas for runtime validation of pRPC responses
 */

export const PodSchema = z.object({
  pubkey: z.string().min(32).max(64),
  address: z.string(),
  version: z.string().optional(),
  last_seen_timestamp: z.number(),
  uptime: z.number().optional(),
  storage_used: z.number().optional(),
});

export const NodeStatsSchema = z.object({
  active_streams: z.number().int().min(0),
  cpu_percent: z.number().min(0).max(100),
  current_index: z.number().int().min(0),
  file_size: z.number().int().min(0),
  last_updated: z.number(),
  packets_received: z.number().int().min(0),
  packets_sent: z.number().int().min(0),
  ram_total: z.number().int().min(0),
  ram_used: z.number().int().min(0),
  total_bytes: z.number().int().min(0),
  total_pages: z.number().int().min(0),
  uptime: z.number().int().min(0),
});

export const PodsResponseSchema = z.object({
  pods: z.array(z.any()).transform((pods) =>
    pods.filter((pod) => {
      const result = PodSchema.safeParse(pod);
      return result.success;
    }).map((pod) => PodSchema.parse(pod))
  ),
  total_count: z.number().int().min(0),
});

// JSON-RPC response wrapper
export const JsonRpcResponseSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.number(), z.string()]),
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
      data: z.unknown().optional(),
    })
    .nullable()
    .optional(),
});

// Type exports
export type PodSchemaType = z.infer<typeof PodSchema>;
export type NodeStatsSchemaType = z.infer<typeof NodeStatsSchema>;
export type PodsResponseSchemaType = z.infer<typeof PodsResponseSchema>;
