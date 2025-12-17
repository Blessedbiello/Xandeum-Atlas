import { z } from "zod";
import { PRPC_CONFIG, PRPC_METHODS } from "./seeds";
import {
  PrpcError,
  NetworkError,
  TimeoutError,
  RpcError,
  ValidationError,
} from "./errors";
import {
  PodSchema,
  NodeStatsSchema,
  PodsResponseSchema,
  JsonRpcResponseSchema,
} from "./schemas";
import type { Pod, NodeStats, PodsResponse } from "@/types";
import { httpPost } from "./http-client";

/**
 * Configuration options for PrpcClient
 */
export interface PrpcClientOptions {
  /** Request timeout in milliseconds (default: 8000) */
  timeout?: number;
  /** Custom port override (default: 6000) */
  port?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Xandeum pNode pRPC Client
 *
 * Implements JSON-RPC 2.0 protocol for communicating with pNodes.
 * Endpoint format: http://{ip}:6000/rpc
 *
 * @example
 * ```typescript
 * const client = new PrpcClient("173.212.220.65");
 * const pods = await client.getPods();
 * const stats = await client.getStats();
 * ```
 */
export class PrpcClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly debug: boolean;
  public readonly ip: string;

  constructor(ip: string, options: PrpcClientOptions = {}) {
    this.ip = ip;
    const port = options.port ?? PRPC_CONFIG.PORT;
    this.baseUrl = `http://${ip}:${port}${PRPC_CONFIG.PATH}`;
    this.timeout = Math.min(
      options.timeout ?? PRPC_CONFIG.DEFAULT_TIMEOUT,
      PRPC_CONFIG.MAX_TIMEOUT
    );
    this.debug = options.debug ?? false;
  }

  /**
   * Make a JSON-RPC 2.0 call to the pNode
   */
  private async call<T>(
    method: string,
    params: unknown[] = [],
    schema?: z.ZodSchema<T>
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const requestBody = {
      jsonrpc: "2.0" as const,
      id: 1,
      method,
      params,
    };

    if (this.debug) {
      console.log(`[pRPC] Request to ${this.baseUrl}:`, requestBody);
    }

    try {
      const response = await httpPost(
        this.baseUrl,
        JSON.stringify(requestBody),
        controller.signal
      );

      if (response.status !== 200) {
        throw new NetworkError(
          `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const rawData = await response.json();

      if (this.debug) {
        console.log(`[pRPC] Response from ${this.ip}:`, rawData);
      }

      // Validate JSON-RPC envelope
      const rpcResponse = JsonRpcResponseSchema.safeParse(rawData);
      if (!rpcResponse.success) {
        // Try to use raw data if it's the result directly
        if (schema) {
          const directResult = schema.safeParse(rawData);
          if (directResult.success) {
            return directResult.data;
          }
        }
        throw new ValidationError("Invalid JSON-RPC response format", [
          { path: "root", message: "Response does not match JSON-RPC 2.0 format" },
        ]);
      }

      // Check for RPC error
      if (rpcResponse.data.error) {
        throw new RpcError(
          rpcResponse.data.error.message,
          rpcResponse.data.error.code,
          rpcResponse.data.error.data
        );
      }

      const result = rpcResponse.data.result;

      // Validate result against schema if provided
      if (schema) {
        const validated = schema.safeParse(result);
        if (!validated.success) {
          throw new ValidationError(
            "Response validation failed",
            validated.error.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
            }))
          );
        }
        return validated.data;
      }

      return result as T;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new TimeoutError(this.timeout, this.baseUrl);
      }
      if (error instanceof PrpcError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new NetworkError(error.message, error);
      }
      throw new PrpcError("Unknown error occurred");
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get list of all pods (pNodes) from gossip network
   */
  async getPods(): Promise<PodsResponse> {
    return this.call(PRPC_METHODS.GET_PODS, [], PodsResponseSchema);
  }

  /**
   * Get statistics for this specific node
   */
  async getStats(): Promise<NodeStats> {
    return this.call(PRPC_METHODS.GET_STATS, [], NodeStatsSchema);
  }

  /**
   * Get pods with their statistics included
   */
  async getPodsWithStats(): Promise<PodsResponse> {
    return this.call(PRPC_METHODS.GET_PODS_WITH_STATS, [], PodsResponseSchema);
  }

  /**
   * Health check - attempts to fetch pods and returns success status
   */
  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number }> {
    const start = Date.now();
    try {
      await this.getPods();
      return {
        healthy: true,
        latency_ms: Date.now() - start,
      };
    } catch {
      return {
        healthy: false,
        latency_ms: Date.now() - start,
      };
    }
  }
}

/**
 * Create a new pRPC client for a given IP
 */
export function createClient(
  ip: string,
  options?: PrpcClientOptions
): PrpcClient {
  return new PrpcClient(ip, options);
}
