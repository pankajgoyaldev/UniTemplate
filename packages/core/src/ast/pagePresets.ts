export interface PageSizePreset {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
}

export const PAGE_SIZE_PRESETS: readonly PageSizePreset[] = [
  { id: 'a4', name: 'A4', widthMm: 210, heightMm: 297 },
  { id: 'a5', name: 'A5', widthMm: 148, heightMm: 210 },
  { id: 'letter', name: 'Letter', widthMm: 215.9, heightMm: 279.4 },
] as const;

export function getPageSizePresetId(widthMm: number, heightMm: number): string {
  for (const preset of PAGE_SIZE_PRESETS) {
    const isPortrait =
      Math.abs(preset.widthMm - widthMm) < 0.1 &&
      Math.abs(preset.heightMm - heightMm) < 0.1;
    const isLandscape =
      Math.abs(preset.widthMm - heightMm) < 0.1 &&
      Math.abs(preset.heightMm - widthMm) < 0.1;
    if (isPortrait || isLandscape) {
      return preset.id;
    }
  }
  return 'custom';
}

