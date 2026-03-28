// logger.ts — Stub for v2.

export function initLogger(): void {
  // TODO: Initialize error tracking
}

export function logError(error: unknown, context?: string): void {
  console.error(`[${context ?? 'Error'}]`, error);
}
