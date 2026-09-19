// The lint gate's build CHECK (`npm run lint:build`): the same production
// vite build `npm run build` makes, written into a throwaway folder in the OS
// temp dir and deleted again. `npm run build` empties `dist/` and deletes
// `electron-build/` -- the running dev app's own main entry -- which is why the
// gate used to kill a live app, or skip its last stage (EN-16). The electron
// half is checked by `lint:all:error` (`tsc -p electron.tsconfig.json`);
// `copy-build`, `build-knowledge` and `build-info` still run in `pack:*`.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { build } from 'vite';

const outDir = mkdtempSync(join(tmpdir(), 'owa-check-build-'));
try {
    await build({
        build: { outDir, emptyOutDir: true },
        logLevel: 'warn',
    });
    console.log('Production build check passed.');
} finally {
    rmSync(outDir, { recursive: true, force: true });
}
