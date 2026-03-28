// SegmentController.ts — Stub for v2.

export interface SegmentController {
  generateNext(context: Record<string, unknown>): Promise<string>;
  generateEjectTransition(context: Record<string, unknown>): Promise<string>;
  shouldStaySilent(): boolean;
}

export function createSegmentController(): SegmentController {
  return {
    generateNext: async () => '',
    generateEjectTransition: async () => '',
    shouldStaySilent: () => false,
  };
}
