import type { TemplateAst, UtsAsset, UtsTraceFile } from '@uts/core';

export interface StoredSessionAsset {
  filename: string;
  mimeType: string;
  data: Uint8Array | number[];
}

export interface SessionRecoveryRecord {
  version: 1;
  savedAt: string; // ISO 8601 timestamp
  filename: string;
  hasSavedFile: boolean;
  isDirty: boolean;
  template: TemplateAst;
  savedBaseline: TemplateAst;
  assets: StoredSessionAsset[];
  traceBackground?: StoredSessionAsset;
}

export interface SaveRecoveryParams {
  template: TemplateAst;
  savedBaseline: TemplateAst;
  filename: string;
  isDirty: boolean;
  assets: Map<string, UtsAsset>;
  hasSavedFile: boolean;
  traceBackground?: UtsTraceFile | null;
}

export type RecoveryNotificationType = 'recovered_unsaved' | 'recovered_saved' | null;
