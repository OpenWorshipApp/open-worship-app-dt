// What a language plugin bundles beyond its own files -- its song plugin, the
// one dependency a language may have -- is declared by the LANGUAGE, in a
// `package.json` of its own (`src/lang/data/online/<code>/package.json`,
// with its `package-lock.json` and an `.npmrc`), and installed into that
// folder's `node_modules`. 2026-11-05, the user: a language's song plugin has
// to ship with that language's bundle -- the app's own manifest names no
// language's package, and `extra-work/build-lang-plugins.mjs` bundles only
// what lies inside the language's folder.
//
// Run by the `install` npm lifecycle (`extra-work/build.sh`, with
// `--warn-only`: a failed language install must not fail the app's), and by
// the plugin build before it builds a language that has a manifest (which
// fails loudly). A folder whose installed tree already matches its lockfile
// is left alone, so both cost nothing on a second run.
//
//   node extra-work/install-lang-deps.mjs [--warn-only]

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { ONLINE_LANG_DATA_DIR, REPO_ROOT } from './language-packages.mjs';

// The song plugins are pre-built git repos (`…-dist#<tag>`), which npm 12
// refuses without `--allow-git`; their own scripts never need to run.
const NPM_CI_COMMAND =
    'npm ci --allow-git=all --no-audit --no-fund --ignore-scripts';

function readJson(filePath) {
    try {
        return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (_error) {
        return null;
    }
}

/** Every language folder that declares dependencies of its own. */
export function listLangDepDirs() {
    if (!existsSync(ONLINE_LANG_DATA_DIR)) {
        return [];
    }
    return readdirSync(ONLINE_LANG_DATA_DIR, { withFileTypes: true })
        .filter((entry) => {
            return entry.isDirectory();
        })
        .map((entry) => {
            return path.join(ONLINE_LANG_DATA_DIR, entry.name);
        })
        .filter((dirPath) => {
            return existsSync(path.join(dirPath, 'package.json'));
        });
}

/**
 * Whether the folder's `node_modules` holds exactly what its lockfile names
 * (npm's own record of the installed tree, `node_modules/.package-lock.json`).
 */
export function checkIsLangDepsInstalled(dirPath) {
    const lock = readJson(path.join(dirPath, 'package-lock.json'));
    const installed = readJson(
        path.join(dirPath, 'node_modules', '.package-lock.json'),
    );
    if (lock?.packages === undefined || installed?.packages === undefined) {
        return false;
    }
    const toKey = (entry) => {
        return JSON.stringify([entry?.version, entry?.resolved]);
    };
    const wantedList = Object.entries(lock.packages).filter(([name]) => {
        return name !== '';
    });
    return (
        wantedList.length === Object.keys(installed.packages).length &&
        wantedList.every(([name, entry]) => {
            return toKey(installed.packages[name]) === toKey(entry);
        })
    );
}

/** Installs a language folder's dependencies when they are not in place. */
export function ensureLangPackageDeps(dirPath) {
    if (!existsSync(path.join(dirPath, 'package.json'))) {
        return false;
    }
    if (checkIsLangDepsInstalled(dirPath)) {
        return false;
    }
    const shown = path.relative(REPO_ROOT, dirPath).split(path.sep).join('/');
    if (!existsSync(path.join(dirPath, 'package-lock.json'))) {
        throw new Error(
            `${shown} has a package.json and no package-lock.json: run ` +
                '`npm install --allow-git=all` in that folder once and ' +
                'commit the lockfile.',
        );
    }
    try {
        execSync(NPM_CI_COMMAND, { cwd: dirPath, stdio: 'inherit' });
    } catch (error) {
        throw new Error(
            `Could not install the dependencies of ${shown} ` +
                `(\`${NPM_CI_COMMAND}\` in that folder): ${error.message}`,
        );
    }
    return true;
}

async function main() {
    const isWarnOnly = process.argv.includes('--warn-only');
    let failedCount = 0;
    for (const dirPath of listLangDepDirs()) {
        try {
            if (ensureLangPackageDeps(dirPath)) {
                console.log(
                    `Installed the dependencies of ${path.relative(REPO_ROOT, dirPath)}.`,
                );
            }
        } catch (error) {
            failedCount += 1;
            console.error(error.message);
        }
    }
    if (failedCount > 0 && !isWarnOnly) {
        process.exit(1);
    }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    await main();
}
