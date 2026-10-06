import { ipcRenderer } from 'electron';
import path from 'node:path';
import type { MirrorScreenContext } from '../screenMirrorProtocol';

export function withScreenProvider<
    T extends { browserUtils: any; pathUtils: any },
>(provider: T) {
    if (globalThis.location?.pathname !== '/screen.html') return provider;
    const screenId = Number(
        new URLSearchParams(globalThis.location.search).get('screenId'),
    );
    const initial: MirrorScreenContext | null = ipcRenderer.sendSync(
        'mirror:screen-context',
        screenId,
    );
    let current = initial;
    ipcRenderer.on('mirror:context', (_, update) => {
        if (current) current = { ...current, ...update };
    });
    const pathApi = initial?.isWindows ? path.win32 : path.posix;
    return {
        ...provider,
        screenUtils: { getContext: () => current },
        pathUtils: initial
            ? {
                  sep: pathApi.sep,
                  basename: pathApi.basename,
                  dirname: pathApi.dirname,
                  resolve: pathApi.resolve,
                  join: pathApi.join,
              }
            : provider.pathUtils,
        browserUtils: {
            ...provider.browserUtils,
            pathToFileURL: (filePath: string) =>
                ipcRenderer.sendSync('mirror:resource', { screenId, filePath }),
        },
    };
}
