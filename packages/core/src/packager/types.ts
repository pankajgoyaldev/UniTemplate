import type { TemplateAst, UtsManifest } from '../ast/types.js';

export interface UtsAsset {
  filename: string;
  mimeType: string;
  data: Uint8Array;
}

export interface UtsTraceFile {
  filename: string;
  mimeType: string;
  data: Uint8Array;
}

export interface UtsPackage {
  manifest: UtsManifest;
  template: TemplateAst;
  thumbnail?: Uint8Array;
  assets: Map<string, UtsAsset>;
  traceBackground?: UtsTraceFile;
}

