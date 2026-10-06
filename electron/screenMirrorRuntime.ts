import type { MirrorScreenContext } from './screenMirrorProtocol';

// The window controller and preload use this seam without importing the server
// (or ws) into every renderer's preload dependency graph.
export const screenMirrorRuntime: {
    screenUrl?: (screenId: number) => string;
    context?: (screenId: number) => MirrorScreenContext | undefined;
} = {};
