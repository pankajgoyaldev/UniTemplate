import JSZip from 'jszip';
import type { UtsPackage, UtsAsset, UtsTraceFile } from './types.js';
import { validateTemplateAst, validateUtsManifest } from '../ast/schemas.js';

export function getMimeTypeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'svg':
      return 'image/svg+xml';
    case 'webp':
      return 'image/webp';
    case 'pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Parses and validates a binary .uts ZIP archive.
 * Throws an error if the archive is corrupt, missing manifest/template,
 * or fails schema validation.
 */
export async function parseUts(buffer: ArrayBuffer | Uint8Array): Promise<UtsPackage> {
  const zip = await JSZip.loadAsync(buffer);

  // 1. Read & validate manifest.json
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    throw new Error('Invalid .uts archive: "manifest.json" is missing from package root.');
  }
  const manifestText = await manifestFile.async('text');
  let parsedManifestJson: unknown;
  try {
    parsedManifestJson = JSON.parse(manifestText);
  } catch (err) {
    throw new Error(`Invalid .uts archive: "manifest.json" is not valid JSON: ${(err as Error).message}`);
  }
  const manifest = validateUtsManifest(parsedManifestJson);

  if (manifest.schemaVersion !== '1.0.0') {
    throw new Error(
      `Unsupported .uts schema version: "${manifest.schemaVersion}". Expected "1.0.0".`,
    );
  }

  // 2. Read & validate template.json
  const templateFile = zip.file('template.json');
  if (!templateFile) {
    throw new Error('Invalid .uts archive: "template.json" is missing from package root.');
  }
  const templateText = await templateFile.async('text');
  let parsedTemplateJson: unknown;
  try {
    parsedTemplateJson = JSON.parse(templateText);
  } catch (err) {
    throw new Error(`Invalid .uts archive: "template.json" is not valid JSON: ${(err as Error).message}`);
  }
  const template = validateTemplateAst(parsedTemplateJson);

  // 3. Read thumbnail (optional)
  let thumbnail: Uint8Array | undefined;
  const thumbnailFile = zip.file('thumbnail.png');
  if (thumbnailFile) {
    thumbnail = await thumbnailFile.async('uint8array');
  }

  // 4. Read embedded assets in assets/
  const assets = new Map<string, UtsAsset>();
  const assetFiles = zip.file(/^assets\/.+/);
  for (const file of assetFiles) {
    if (file.dir) continue;
    // Strip leading "assets/" to get bare filename
    const filename = file.name.replace(/^assets\//, '');
    const data = await file.async('uint8array');
    assets.set(filename, {
      filename,
      mimeType: getMimeTypeFromFilename(filename),
      data,
    });
  }

  // 5. Read trace background in background/ (if present)
  let traceBackground: UtsTraceFile | undefined;
  const backgroundFiles = zip.file(/^background\/.+/);
  for (const file of backgroundFiles) {
    if (file.dir) continue;
    const filename = file.name.replace(/^background\//, '');
    const data = await file.async('uint8array');
    traceBackground = {
      filename,
      mimeType: getMimeTypeFromFilename(filename),
      data,
    };
    break; // Take primary trace file
  }

  return {
    manifest,
    template,
    thumbnail,
    assets,
    traceBackground,
  };
}

