/**
 * Custom error types for pRPC operations
 */

export class PrpcError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "PrpcError";
  }
}

export class NetworkError extends PrpcError {
  constructor(message: string, cause?: Error) {
    super(message, undefined, cause);
    this.name = "NetworkError";
  }
}

export class TimeoutError extends PrpcError {
  constructor(
    public readonly timeoutMs: number,
    public readonly endpoint: string
  ) {
    super(`Request to ${endpoint} timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
  }
}

export class RpcError extends PrpcError {
  constructor(
    message: string,
    public readonly rpcCode: number,
    public readonly rpcData?: unknown
  ) {
    super(message, rpcCode);
    this.name = "RpcError";
  }
}

export class ValidationError extends PrpcError {
  constructor(
    message: string,
    public readonly issues: Array<{ path: string; message: string }>
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Check if an error is a specific pRPC error type
 */
export function isPrpcError(error: unknown): error is PrpcError {
  return error instanceof PrpcError;
}

export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}
