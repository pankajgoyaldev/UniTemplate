import JSZip from 'jszip';
import type { UtsPackage } from './types.js';
import type { UtsManifest } from '../ast/types.js';
import { validateTemplateAst, validateUtsManifest } from '../ast/schemas.js';

export interface SerializeOptions {
  compressionLevel?: number; // 1 (fast) to 9 (max), default 6
}

/**
 * Serializes a UtsPackage into a standard .uts (ZIP) binary archive.
 */
export async function serializeUts(
  pkg: UtsPackage,
  options: SerializeOptions = {},
): Promise<Uint8Array> {
  // 1. Validate the template AST using Zod
  const validatedTemplate = validateTemplateAst(pkg.template);

  // 2. Compute or update manifest
  const manifest: UtsManifest = {
    format: 'UTS_PACKAGE',
    schemaVersion: '1.0.0',
    id: validatedTemplate.metadata.id,
    title: validatedTemplate.metadata.title,
    author: validatedTemplate.metadata.author,
    createdAt: validatedTemplate.metadata.createdAt,
    updatedAt: new Date().toISOString(),
    targetDpi: validatedTemplate.pageSettings.targetDpi,
    pageSize: {
      width: validatedTemplate.pageSettings.width,
      height: validatedTemplate.pageSettings.height,
      unit: validatedTemplate.pageSettings.unit,
    },
    assetCount: pkg.assets.size,
    hasTraceBackground: Boolean(
      pkg.traceBackground && validatedTemplate.traceBackground?.enabled,
    ),
  };

  // 3. Validate manifest
  const validatedManifest = validateUtsManifest(manifest);

  // 4. Build ZIP container
  const zip = new JSZip();

  // Root files
  zip.file('manifest.json', JSON.stringify(validatedManifest, null, 2));
  zip.file('template.json', JSON.stringify(validatedTemplate, null, 2));

  // Thumbnail (if available)
  if (pkg.thumbnail && pkg.thumbnail.byteLength > 0) {
    zip.file('thumbnail.png', pkg.thumbnail);
  }

  // Embedded assets (assets/)
  if (pkg.assets.size > 0) {
    const assetsFolder = zip.folder('assets');
    if (assetsFolder) {
      for (const [filename, asset] of pkg.assets.entries()) {
        assetsFolder.file(filename, asset.data);
      }
    }
  }

  // Trace background file (background/)
  if (pkg.traceBackground && pkg.traceBackground.data.byteLength > 0) {
    const backgroundFolder = zip.folder('background');
    if (backgroundFolder) {
      backgroundFolder.file(pkg.traceBackground.filename, pkg.traceBackground.data);
    }
  }

  // 5. Generate ZIP output
  const compressionLevel = options.compressionLevel ?? 6;
  const buffer = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: {
      level: compressionLevel,
    },
  });

  return buffer;
}

