import { readFileSync } from 'node:fs';

import { normalizePath, type Plugin } from 'vite';

const GZ_BUNDLE_SUFFIX = '.gz.bundle';

/**
 * Map a `*.gz.bundle` source path to its on-disk location inside the build
 * output (`dist`). The path is kept verbatim relative to the project `src`
 * directory (e.g. `lang/data/km/bb-cr.gz.bundle`) so the emitted asset is not
 * hashed and the runtime can resolve it deterministically against the `dist`
 * directory of the packaged app.
 */
function toDistRelativePath(cleanFilePath: string) {
    const marker = '/src/';
    const index = cleanFilePath.lastIndexOf(marker);
    if (index !== -1) {
        return cleanFilePath.slice(index + marker.length);
    }
    return cleanFilePath.slice(cleanFilePath.lastIndexOf('/') + 1);
}

/**
 * Allow importing `*.gz.bundle` files and expose them as
 * `{ filePath: string; fileName: string | null }`:
 *
 * ```ts
 * import bundle from './bb-cr.gz.bundle';
 * bundle.filePath; // absolute source path, valid during dev/tests
 * bundle.fileName; // dist-relative path of the emitted asset (build only)
 * ```
 *
 * During a production build the binary is copied verbatim into `dist` (so it
 * gets packaged) and `fileName` is the deterministic `dist`-relative location.
 * During dev/tests nothing is emitted (`fileName` is `null`) and `filePath`
 * points at the real source file. The consumer resolves the correct path with
 * `resolveGzBundleFilePath` so Node's `fs` can `openSync` it directly, instead
 * of a dev-server `/@fs/...` or hashed `/assets/...` URL it cannot open.
 */
export function gzBundlePlugin(): Plugin {
    let isBuild = false;
    const emittedFileNames = new Set<string>();
    return {
        name: 'gz-bundle-file-path',
        enforce: 'pre',
        configResolved(config) {
            isBuild = config.command === 'build';
        },
        load(id) {
            const filePath = id.split('?', 1)[0];
            if (!filePath.endsWith(GZ_BUNDLE_SUFFIX)) {
                return null;
            }
            const cleanFilePath = normalizePath(filePath);
            let fileName: string | null = null;
            if (isBuild) {
                fileName = toDistRelativePath(cleanFilePath);
                if (!emittedFileNames.has(fileName)) {
                    emittedFileNames.add(fileName);
                    this.emitFile({
                        type: 'asset',
                        fileName,
                        source: readFileSync(cleanFilePath),
                    });
                }
            }
            return (
                'export default ' +
                JSON.stringify({ filePath: cleanFilePath, fileName }) +
                ';\n'
            );
        },
    };
}
