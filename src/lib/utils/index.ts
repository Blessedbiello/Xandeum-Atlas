import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes with conflict resolution
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Truncate a pubkey for display
 * @example truncatePubkey("HjeRsvpPX4CnJAXW3ua2y1qrRA7t9nf8s4dYgJnavQnC") => "HjeR...nQnC"
 */
export function truncatePubkey(pubkey: string, chars = 4): string {
  if (pubkey.length <= chars * 2 + 3) return pubkey;
  return `${pubkey.slice(0, chars)}...${pubkey.slice(-chars)}`;
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Format a number with thousands separators
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

/**
 * Format a percentage value
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format uptime in seconds to human-readable string
 */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Format a timestamp to relative time (e.g., "2 min ago")
 */
export function formatRelativeTime(timestamp: number | Date | string): string {
  const now = Date.now();
  let time: number;
  if (typeof timestamp === "number") {
    time = timestamp * 1000;
  } else if (typeof timestamp === "string") {
    time = new Date(timestamp).getTime();
  } else {
    time = timestamp.getTime();
  }
  const diff = now - time;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  if (seconds > 10) return `${seconds}s ago`;
  return "just now";
}

/**
 * Format ISO date string to locale date
 */
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format ISO date string to locale datetime
 */
export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Calculate RAM percentage
 */
export function calculateRamPercent(used: number, total: number): number {
  if (total === 0) return 0;
  return (used / total) * 100;
}

/**
 * Get status color class based on node status
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case "online":
      return "text-status-online";
    case "degraded":
      return "text-status-degraded";
    case "offline":
      return "text-status-offline";
    default:
      return "text-status-unknown";
  }
}

/**
 * Get status background color class
 */
export function getStatusBgColor(status: string): string {
  switch (status) {
    case "online":
      return "bg-status-online";
    case "degraded":
      return "bg-status-degraded";
    case "offline":
      return "bg-status-offline";
    default:
      return "bg-status-unknown";
  }
}

/**
 * Get metric color based on value (for CPU/RAM)
 */
export function getMetricColor(value: number): string {
  if (value < 50) return "text-green-500";
  if (value < 80) return "text-yellow-500";
  return "text-red-500";
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
  } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000 } = options;
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt === maxRetries) break;

      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      await sleep(delay + Math.random() * 1000);
    }
  }

  throw lastError!;
}
