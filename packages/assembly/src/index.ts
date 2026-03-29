export type { AssemblyConfig } from './selector';
export { selectSegments } from './selector';
export type { ValidationResult, ManifestStats } from './manifest';
export { buildManifest, validateManifest, getManifestStats } from './manifest';
export type { BridgingContext, LLMProvider, TTSProvider } from './bridging';
export {
  StubLLMProvider,
  StubTTSProvider,
  detectLowConfidence,
  generateBridge,
} from './bridging';
