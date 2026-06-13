import { normalizePath, type Plugin } from 'vite';

const GZ_BUNDLE_SUFFIX = '.gz.bundle';

/**
 * Allow importing `*.gz.bundle` files and expose only the resolved, clean
 * absolute on-disk path as `{ filePath: string }`:
 *
 * ```ts
 * import bundle from './bb-cr.gz.bundle';
 * bundle.filePath; // e.g. C:/path/to/src/lang/data/km/bb-cr.gz.bundle
 * ```
 *
 * The binary content is never read, parsed, or inlined. The path is emitted
 * verbatim (not through Vite's `?url` asset pipeline), so it stays a real
 * filesystem path that Node's `fs` can open directly, instead of a dev-server
 * URL such as `/@fs/...` or a hashed `/assets/...` build URL.
 */
export function gzBundlePlugin(): Plugin {
    return {
        name: 'gz-bundle-file-path',
        enforce: 'pre',
        load(id) {
            const filePath = id.split('?', 1)[0];
            if (!filePath.endsWith(GZ_BUNDLE_SUFFIX)) {
                return null;
            }
            const cleanFilePath = normalizePath(filePath);
            return (
                `export default { filePath: ${JSON.stringify(cleanFilePath)} };\n`
            );
        },
    };
}
