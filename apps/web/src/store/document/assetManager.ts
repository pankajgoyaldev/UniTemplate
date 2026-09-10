import type { UtsAsset, UtsTraceFile } from '@uts/core';

// Subtle inline SVG placeholder for missing/unresolvable assets (does not crash or delete element)
const MISSING_ASSET_PLACEHOLDER = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%2327272a" stroke="%2352525b" stroke-dasharray="4 4"/><text x="50" y="55" fill="%23a1a1aa" font-size="10" font-family="sans-serif" text-anchor="middle">Asset Missing</text></svg>`;

export class AssetCache {
  private urls = new Map<string, string>();
  private traceUrl: string | null = null;
  private traceKey: string | null = null;

  /**
   * Cleans up all generated object URLs.
   */
  public revokeAll(): void {
    this.revokeTrace();
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      for (const url of this.urls.values()) {
        try {
          if (url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
          }
        } catch {
          // Ignore revocation errors in non-DOM test environments
        }
      }
    }
    this.urls.clear();
  }

  /**
   * Revokes the current trace background URL.
   */
  public revokeTrace(): void {
    if (this.traceUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      try {
        if (this.traceUrl.startsWith('blob:')) {
          URL.revokeObjectURL(this.traceUrl);
        }
      } catch {
        // Ignore
      }
    }
    this.traceUrl = null;
    this.traceKey = null;
  }

  /**
   * Resolves an assetRef against the in-memory UtsAsset map.
   */
  public resolve(assetRef: string | undefined | null, assets: Map<string, UtsAsset>): string | undefined {
    if (!assetRef) return undefined;

    const trimmed = assetRef.trim();
    if (!trimmed) return undefined;

    // 1. Direct inline data URIs, blob URLs, or web URLs
    if (
      trimmed.startsWith('data:') ||
      trimmed.startsWith('blob:') ||
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://')
    ) {
      return trimmed;
    }

    // 2. Strip standard package folder prefixes like 'assets/' or './'
    const bareFilename = trimmed.replace(/^assets\//, '').replace(/^\.\//, '');

    // 3. Check if already cached as an object URL
    const cached = this.urls.get(bareFilename);
    if (cached) {
      return cached;
    }

    // 4. Look up asset in UtsAsset map
    const asset = assets.get(bareFilename);
    if (!asset || !asset.data || asset.data.byteLength === 0) {
      // Safe fallback placeholder: does not crash the canvas or delete the element
      return MISSING_ASSET_PLACEHOLDER;
    }

    // 5. Create and cache object URL (or base64 fallback in node/testing)
    try {
      if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        const blob = new Blob([asset.data as any], { type: asset.mimeType || 'image/png' });
        const objectUrl = URL.createObjectURL(blob);
        this.urls.set(bareFilename, objectUrl);
        return objectUrl;
      }
    } catch {
      // Fallback
    }

    // Node.js test environment fallback: convert buffer to base64 data URI
    try {
      const nodeBuffer = (globalThis as any).Buffer;
      if (typeof nodeBuffer !== 'undefined') {
        const base64 = nodeBuffer.from(asset.data).toString('base64');
        const dataUri = `data:${asset.mimeType || 'image/png'};base64,${base64}`;
        this.urls.set(bareFilename, dataUri);
        return dataUri;
      }
    } catch {
      // Ignore
    }

    return MISSING_ASSET_PLACEHOLDER;
  }

  /**
   * Resolves a UtsTraceFile into an object URL for background rendering.
   */
  public resolveTrace(traceFile: UtsTraceFile | null | undefined): string | null {
    if (!traceFile || !traceFile.data || traceFile.data.byteLength === 0) {
      return null;
    }

    const key = `${traceFile.filename}:${traceFile.data.byteLength}`;
    if (this.traceUrl && this.traceKey === key) {
      return this.traceUrl;
    }

    // Revoke previous trace URL before creating a new one
    this.revokeTrace();

    try {
      if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        const blob = new Blob([traceFile.data as any], { type: traceFile.mimeType || 'image/png' });
        const objectUrl = URL.createObjectURL(blob);
        this.traceUrl = objectUrl;
        this.traceKey = key;
        return objectUrl;
      }
    } catch {
      // Fallback
    }

    // Node.js test environment fallback: convert buffer to base64 data URI
    try {
      const nodeBuffer = (globalThis as any).Buffer;
      if (typeof nodeBuffer !== 'undefined') {
        const base64 = nodeBuffer.from(traceFile.data).toString('base64');
        const dataUri = `data:${traceFile.mimeType || 'image/png'};base64,${base64}`;
        this.traceUrl = dataUri;
        this.traceKey = key;
        return dataUri;
      }
    } catch {
      // Ignore
    }

    return null;
  }
}
