declare module 'bwip-js' {
  export interface ToSVGOptions {
    bcid: string;
    text: string;
    scale?: number;
    height?: number;
    width?: number;
    includetext?: boolean;
    textxalign?: string;
    eclevel?: string;
    [key: string]: any;
  }

  export function toSVG(options: ToSVGOptions): string;

  const bwipjs: {
    toSVG(options: ToSVGOptions): string;
  };

  export default bwipjs;
}

