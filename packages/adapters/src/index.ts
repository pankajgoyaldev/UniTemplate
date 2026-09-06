export interface IStorageAdapter {
  getItem<T>(key: string): Promise<T | null>;
  setItem<T>(key: string, value: T): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface IFileSystemAdapter {
  openTemplate(): Promise<{ buffer: ArrayBuffer; filename: string } | null>;
  saveTemplate(filename: string, buffer: Uint8Array): Promise<boolean>;
  pickImage(): Promise<{ buffer: ArrayBuffer; mimeType: string; filename: string } | null>;
  pickPdfTrace(): Promise<{ buffer: ArrayBuffer; filename: string } | null>;
}

