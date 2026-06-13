/// <reference types="vite/client" />

declare module '*.gz.bundle' {
    const bundle: { filePath: string };
    export default bundle;
}
