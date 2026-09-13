import type { UtsTraceFile } from '@uts/core';
import { useTemplateStore } from '../store/useTemplateStore.js';
import { useDocumentStore } from '../store/document/useDocumentStore.js';

export const SUPPORTED_BACKGROUND_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.svg'] as const;

export const SUPPORTED_BACKGROUND_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
] as const;

export function getMimeTypeForImage(filename: string, fileType?: string): string {
  if (fileType && (SUPPORTED_BACKGROUND_MIME_TYPES as readonly string[]).includes(fileType)) {
    return fileType;
  }
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return 'image/png';
}

export function isSupportedImageFile(file: { name: string; type?: string }): boolean {
  if (file.type && (SUPPORTED_BACKGROUND_MIME_TYPES as readonly string[]).includes(file.type)) {
    return true;
  }
  const lower = file.name.toLowerCase();
  return SUPPORTED_BACKGROUND_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Imports an image file (PNG, JPG, WebP, SVG) as the template's trace background.
 * The trace background is locked to page dimensions and sits behind all canvas elements.
 */
export async function importBackgroundImage(file: File): Promise<boolean> {
  if (!isSupportedImageFile(file)) {
    alert('Unsupported file format. Please import a PNG, JPG, WebP, or SVG image.');
    return false;
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const mimeType = getMimeTypeForImage(file.name, file.type);

    const traceFile: UtsTraceFile = {
      filename: file.name,
      mimeType,
      data,
    };

    const docStore = useDocumentStore.getState();
    const tplStore = useTemplateStore.getState();

    // 1. Store trace background binary in document store & cache
    docStore.setTraceBackgroundFile(traceFile);

    // 2. Commit traceBackground in Template AST
    const currentTrace = tplStore.template.traceBackground;
    tplStore.setTraceBackground({
      enabled: true,
      fileRef: `background/${file.name}`,
      opacity: currentTrace?.opacity !== undefined ? currentTrace.opacity : 0.3,
      pageIndex: 0,
    });

    return true;
  } catch (err) {
    alert(`Failed to import background image: ${(err as Error).message}`);
    return false;
  }
}

/**
 * Removes the trace background from the template AST.
 */
export function removeTraceBackground(): void {
  useTemplateStore.getState().setTraceBackground(undefined);
}

/**
 * Updates the opacity of the trace background (0.05 to 1.0).
 */
export function setTraceBackgroundOpacity(opacity: number): void {
  const clamped = Math.max(0.05, Math.min(1, Number(opacity.toFixed(2))));
  useTemplateStore.getState().updateTraceBackground({ opacity: clamped });
}

/**
 * Toggles the visibility of the trace background.
 */
export function toggleTraceBackgroundVisibility(): void {
  const current = useTemplateStore.getState().template.traceBackground;
  if (!current) return;
  useTemplateStore.getState().updateTraceBackground({ enabled: !current.enabled });
}

/**
 * Sets the active page index for multi-page background references.
 */
export function setTraceBackgroundPageIndex(pageIndex: number): void {
  const safeIndex = Math.max(0, Math.floor(pageIndex));
  useTemplateStore.getState().updateTraceBackground({ pageIndex: safeIndex });
}
