// `qr-image` ships no typings; only what Screen Mirror uses is declared.
declare module 'qr-image' {
    export function svgObject(
        text: string,
        options?: { ec_level?: 'L' | 'M' | 'Q' | 'H'; margin?: number },
    ): { size: number; path: string };
}
