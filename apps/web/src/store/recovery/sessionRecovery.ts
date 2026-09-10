import { validateTemplateAst, type UtsAsset } from '@uts/core';
import type { SaveRecoveryParams, SessionRecoveryRecord, StoredSessionAsset } from './recoveryTypes.js';
import { getRecoveryStorage } from './recoveryStorage.js';
import { useTemplateStore } from '../useTemplateStore.js';
import { useDocumentStore } from '../document/useDocumentStore.js';
import { useUIStore } from '../useUIStore.js';
import { cloneTemplateAst } from '../history/historyUtils.js';

export const RECOVERY_STORAGE_KEY = 'active_session';

function deserializeBinaryData(raw: unknown): Uint8Array {
  if (raw instanceof Uint8Array) return raw;
  if (Array.isArray(raw)) return new Uint8Array(raw);
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.data)) return new Uint8Array(obj.data as number[]);
    const values = Object.values(obj);
    if (values.length > 0 && typeof values[0] === 'number') {
      return new Uint8Array(values as number[]);
    }
  }
  return new Uint8Array();
}

/**
 * Saves the current editing session state to local recovery storage.
 * Debounced by callers during continuous editing; called immediately on explicit document actions.
 */
export async function saveSessionRecovery(params: SaveRecoveryParams): Promise<boolean> {
  try {
    const storedAssets: StoredSessionAsset[] = [];
    if (params.assets && params.assets.size > 0) {
      for (const [key, asset] of params.assets.entries()) {
        const data = asset.data instanceof Uint8Array ? Array.from(asset.data) : asset.data;
        storedAssets.push({
          filename: asset.filename || key,
          mimeType: asset.mimeType || 'application/octet-stream',
          data,
        });
      }
    }

    let storedTrace: StoredSessionAsset | undefined;
    if (params.traceBackground && params.traceBackground.data && params.traceBackground.data.byteLength > 0) {
      storedTrace = {
        filename: params.traceBackground.filename,
        mimeType: params.traceBackground.mimeType || 'image/png',
        data: Array.from(params.traceBackground.data),
      };
    }

    const record: SessionRecoveryRecord = {
      version: 1,
      savedAt: new Date().toISOString(),
      filename: params.filename,
      hasSavedFile: params.hasSavedFile,
      isDirty: params.isDirty,
      template: cloneTemplateAst(params.template),
      savedBaseline: cloneTemplateAst(params.savedBaseline),
      assets: storedAssets,
      traceBackground: storedTrace,
    };

    return await getRecoveryStorage().set(RECOVERY_STORAGE_KEY, record);
  } catch (err) {
    console.warn('Failed to save session recovery record:', err);
    return false;
  }
}

/**
 * Loads and validates a persisted session recovery record from storage.
 * Discards malformed or schema-violating data safely without throwing.
 */
export async function loadSessionRecovery(): Promise<SessionRecoveryRecord | null> {
  try {
    const raw = await getRecoveryStorage().get(RECOVERY_STORAGE_KEY);
    if (!raw) return null;

    if (raw.version !== 1 || !raw.template || typeof raw.template !== 'object') {
      await clearSessionRecovery();
      return null;
    }

    // Strict validation of the recovered TemplateAst using @uts/core Zod schema
    try {
      validateTemplateAst(raw.template);
    } catch (valErr) {
      console.warn('Persisted recovery template failed schema validation, clearing record:', valErr);
      await clearSessionRecovery();
      return null;
    }

    // Validate savedBaseline or safely fall back to template
    try {
      if (raw.savedBaseline && typeof raw.savedBaseline === 'object') {
        validateTemplateAst(raw.savedBaseline);
      } else {
        raw.savedBaseline = cloneTemplateAst(raw.template);
      }
    } catch {
      raw.savedBaseline = cloneTemplateAst(raw.template);
    }

    return raw;
  } catch (err) {
    console.warn('Error reading session recovery storage:', err);
    return null;
  }
}

/**
 * Clears the active session recovery record from storage.
 */
export async function clearSessionRecovery(): Promise<boolean> {
  try {
    return await getRecoveryStorage().delete(RECOVERY_STORAGE_KEY);
  } catch {
    return false;
  }
}

/**
 * Restores a validated session recovery record into the runtime stores.
 * Generates fresh Blob URLs for assets via AssetCache.
 * Resets undo/redo history (history stack is intentionally NOT persisted).
 */
export function restoreSessionRecovery(record: SessionRecoveryRecord): {
  recovered: boolean;
  isDirty: boolean;
  filename: string;
} {
  // 1. Set template in template store (this also resets useHistoryStore with recovered template)
  useTemplateStore.getState().setTemplate(record.template);

  // 2. Reconstruct binary assets and populate AssetCache for live rendering
  const assetMap = new Map<string, UtsAsset>();
  if (Array.isArray(record.assets)) {
    for (const item of record.assets) {
      if (!item || !item.filename) continue;
      const data = deserializeBinaryData(item.data);
      const asset: UtsAsset = {
        filename: item.filename,
        mimeType: item.mimeType || 'application/octet-stream',
        data,
      };
      assetMap.set(item.filename, asset);
      const bareName = item.filename.replace(/^assets\//, '').replace(/^\.\//, '');
      if (bareName !== item.filename) {
        assetMap.set(bareName, asset);
      }
    }
  }

  const docStore = useDocumentStore.getState();
  docStore.setAssets(assetMap);

  if (record.traceBackground && record.traceBackground.filename) {
    const data = deserializeBinaryData(record.traceBackground.data);
    docStore.setTraceBackgroundFile({
      filename: record.traceBackground.filename,
      mimeType: record.traceBackground.mimeType || 'image/png',
      data,
    });
  } else {
    docStore.setTraceBackgroundFile(null);
  }

  docStore.setFilename(record.filename);
  docStore.setFileHandle(null);

  // 3. Establish baseline and dirty state
  useDocumentStore.setState({
    savedBaseline: cloneTemplateAst(record.savedBaseline),
    isDirty: record.isDirty,
  });

  // Re-verify dirty status against template
  docStore.checkDirty(record.template);

  // 4. Clear transient selection
  useUIStore.getState().clearSelection();

  return {
    recovered: true,
    isDirty: useDocumentStore.getState().isDirty,
    filename: record.filename,
  };
}
