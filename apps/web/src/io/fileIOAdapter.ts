export interface FileOpenResult {
  data: Uint8Array;
  filename: string;
  handle?: FileSystemFileHandle | null;
}

export interface FileSaveResult {
  saved: boolean;
  filename: string;
  handle?: FileSystemFileHandle | null;
}

export interface IFileIOAdapter {
  openUts(): Promise<FileOpenResult | null>;
  saveUts(
    data: Uint8Array,
    defaultFilename: string,
    existingHandle?: FileSystemFileHandle | null,
  ): Promise<FileSaveResult | null>;
  saveUtsAs(data: Uint8Array, defaultFilename: string): Promise<FileSaveResult | null>;
}

