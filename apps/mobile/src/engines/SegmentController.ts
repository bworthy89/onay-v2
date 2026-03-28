// SegmentController.ts — Stub for v2.

export interface SegmentController {
  generateNext(context: Record<string, unknown>): Promise<string>;
  generateEjectTransition(context: Record<string, unknown>): Promise<string>;
  shouldStaySilent(): boolean;
  startSession(stationId: string, vibe?: string): void;
}

export function createSegmentController(): SegmentController {
  return {
    generateNext: async () => '',
    generateEjectTransition: async () => '',
    shouldStaySilent: () => false,
    startSession: () => {},
  };
}

export const segmentController: SegmentController = createSegmentController();
