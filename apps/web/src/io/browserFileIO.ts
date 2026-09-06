import type { IFileIOAdapter, FileOpenResult, FileSaveResult } from './fileIOAdapter.js';
import { normalizeUtsFilename } from '../store/document/documentTypes.js';

export class BrowserFileIO implements IFileIOAdapter {
  /**
   * Opens a .uts file from disk. Returns null if cancelled.
   */
  public async openUts(): Promise<FileOpenResult | null> {
    // 1. Modern File System Access API (Chromium)
    if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
      try {
        const pickerOpts = {
          types: [
            {
              description: 'Universe Template Studio Package (*.uts)',
              accept: {
                'application/vnd.uts+zip': ['.uts'],
                'application/zip': ['.uts'],
                'application/octet-stream': ['.uts'],
              },
            },
          ],
          excludeAcceptAllOption: false,
          multiple: false,
        };

        const [handle] = await (window as unknown as { showOpenFilePicker: (opts: unknown) => Promise<FileSystemFileHandle[]> }).showOpenFilePicker(pickerOpts);
        if (!handle) return null;

        const file = await handle.getFile();
        const arrayBuffer = await file.arrayBuffer();
        return {
          data: new Uint8Array(arrayBuffer),
          filename: normalizeUtsFilename(file.name),
          handle,
        };
      } catch (err) {
        // AbortError indicates the user cancelled the picker
        if ((err as Error).name === 'AbortError') {
          return null;
        }
        // Other errors bubble up to caller error handler
        throw err;
      }
    }

    // 2. Browser fallback using hidden file input
    return new Promise((resolve, reject) => {
      if (typeof document === 'undefined') {
        resolve(null);
        return;
      }

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.uts,application/zip,application/octet-stream';
      input.style.display = 'none';

      input.onchange = async () => {
        try {
          const file = input.files?.[0];
          if (!file) {
            resolve(null);
            return;
          }
          const arrayBuffer = await file.arrayBuffer();
          resolve({
            data: new Uint8Array(arrayBuffer),
            filename: normalizeUtsFilename(file.name),
            handle: null,
          });
        } catch (err) {
          reject(err);
        } finally {
          input.remove();
        }
      };

      input.oncancel = () => {
        resolve(null);
        input.remove();
      };

      document.body.appendChild(input);
      input.click();
    });
  }

  /**
   * Saves to an existing file handle if available, or delegates to saveUtsAs.
   */
  public async saveUts(
    data: Uint8Array,
    defaultFilename: string,
    existingHandle?: FileSystemFileHandle | null,
  ): Promise<FileSaveResult | null> {
    if (existingHandle) {
      try {
        const writable = await existingHandle.createWritable();
        await writable.write(data as any);
        await writable.close();
        return {
          saved: true,
          filename: normalizeUtsFilename(existingHandle.name),
          handle: existingHandle,
        };
      } catch (err) {
        // If permission was denied or handle became stale, fallback to saveUtsAs
        if ((err as Error).name === 'AbortError') {
          return null;
        }
      }
    }

    return this.saveUtsAs(data, defaultFilename);
  }

  /**
   * Saves to a new file location prompted to user.
   */
  public async saveUtsAs(
    data: Uint8Array,
    defaultFilename: string,
  ): Promise<FileSaveResult | null> {
    const filename = normalizeUtsFilename(defaultFilename);

    // 1. Modern File System Access API (Chromium)
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        const pickerOpts = {
          suggestedName: filename,
          types: [
            {
              description: 'Universe Template Studio Package (*.uts)',
              accept: {
                'application/vnd.uts+zip': ['.uts'],
              },
            },
          ],
        };

        const handle = await (window as unknown as { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker(pickerOpts);
        if (!handle) return null;

        const writable = await handle.createWritable();
        await writable.write(data as any);
        await writable.close();

        return {
          saved: true,
          filename: normalizeUtsFilename(handle.name),
          handle,
        };
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return null;
        }
        throw err;
      }
    }

    // 2. Standard browser download fallback
    if (typeof document !== 'undefined') {
      const blob = new Blob([data as any], { type: 'application/vnd.uts+zip' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        link.remove();
      }, 1000);

      return {
        saved: true,
        filename,
        handle: null,
      };
    }

    return null;
  }
}

export const browserFileIO = new BrowserFileIO();
