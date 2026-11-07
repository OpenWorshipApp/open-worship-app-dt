// The lint gate's build CHECK (`npm run lint:build`): the same production
// vite build `npm run build` makes, written into a throwaway folder in the OS
// temp dir and deleted again. `npm run build` empties `dist/` and deletes
// `electron-build/` -- the running dev app's own main entry -- which is why the
// gate used to kill a live app, or skip its last stage (EN-16). The electron
// half is checked by `lint:all:error` (`tsc -p electron.tsconfig.json`);
// `copy-build`, `build-knowledge` and `build-info` still run in `pack:*`.
//
// Every language but English is a runtime plugin (2026-11-04), so this also
// builds each language plugin into the same throwaway folder -- uncached, so
// nothing is written in the repo -- and fails when the app's own build still
// carries a non-English package: its files, or its dictionary.
import {
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';

import { build } from 'vite';

import {
    buildLangPlugin,
    listLangPluginSources,
} from './build-lang-plugins.mjs';
import { readSourceDictionary } from '../tools/owa-devtools-mcp/langPacks.mjs';
import { listPackageCodes, toPackageDir } from './language-packages.mjs';

function listFiles(dirPath) {
    return readdirSync(dirPath, { withFileTypes: true }).flatMap((entry) => {
        const filePath = join(dirPath, entry.name);
        return entry.isDirectory() ? listFiles(filePath) : [filePath];
    });
}

// One translated label of a package, which only its dictionary holds: the
// same key in every package (`tranKeyCoverage.test.ts` holds them equal).
const SENTINEL_KEY = 'Manage Languages';
function readSentinelValue(code) {
    const value =
        readSourceDictionary(toPackageDir(code))[SENTINEL_KEY.toLowerCase()];
    return typeof value === 'string' && value !== SENTINEL_KEY ? value : null;
}

function checkEnglishOnly(outDir) {
    const problemList = [];
    const codeList = listPackageCodes({ isEnglishIncluded: false });
    const sentinelList = codeList
        .map((code) => {
            return { code, value: readSentinelValue(code) };
        })
        .filter(({ value }) => {
            return value !== null;
        });
    for (const filePath of listFiles(outDir)) {
        const relativePath = relative(outDir, filePath).split(sep).join('/');
        for (const code of codeList) {
            if (
                relativePath.includes(`lang/data/${code}/`) ||
                relativePath.includes(`lang/data/online/${code}/`)
            ) {
                problemList.push(`${relativePath} (the "${code}" package)`);
            }
        }
        if (!/\.(?:js|css|html|json)$/.test(filePath)) {
            continue;
        }
        if (statSync(filePath).size > 64 * 1024 * 1024) {
            continue;
        }
        const text = readFileSync(filePath, 'utf8');
        for (const { code, value } of sentinelList) {
            if (text.includes(value)) {
                problemList.push(
                    `${relativePath} (the "${code}" dictionary)`,
                );
            }
        }
    }
    if (problemList.length > 0) {
        throw new Error(
            'The app build must carry English only -- every other language ' +
                'is a plugin (extra-work/build-lang-plugins.mjs):\n  ' +
                problemList.join('\n  '),
        );
    }
}

const outDir = mkdtempSync(join(tmpdir(), 'owa-check-build-'));
const langOutDir = mkdtempSync(join(tmpdir(), 'owa-check-lang-'));
try {
    await build({
        build: { outDir, emptyOutDir: true },
        logLevel: 'warn',
    });
    checkEnglishOnly(outDir);
    for (const source of listLangPluginSources({ isOnlineIncluded: true })) {
        await buildLangPlugin(source, {
            outRootDir: langOutDir,
            isCached: false,
        });
    }
    console.log('Production build check passed.');
} finally {
    rmSync(outDir, { recursive: true, force: true });
    rmSync(langOutDir, { recursive: true, force: true });
}
