/// <reference types="vite/client" />

declare module '*.gz.bundle' {
    const bundle: { filePath: string; fileName: string | null };
    export default bundle;
}
