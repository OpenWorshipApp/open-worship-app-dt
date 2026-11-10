// Every non-English language is a runtime PLUGIN (2026-11-04, the user: the
// two languages then built in are modular, only English is built in, then the
// same day _everything related to a language have to be loaded from the language data
// (from language installation catalog), must not ship in the app, except
// english_). This script turns a language package's source folder
// (`src/lang/data/online/<code>/`) into a plugin folder the app loads at
// runtime. A plugin has two possible homes -- `electron-build/lang`
// (read-only, shipped with the app) and `<data-dir>/lang` (installed from the
// catalog), the same format through the same loader -- and today every
// language goes to the catalog alone: the app ships English and nothing else.
//
//   <plugin>/meta.json      {apiVersion, langCode, locale, name, nativeName,
//                            version, description, order, direction}
//   <plugin>/index.js       ONE self-contained script: a factory
//                           `(host) => LanguageDataType`. Under `require()` it
//                           is `module.exports`; as a page `<script>` (a
//                           remote browser viewer) it lands in
//                           `globalThis.__owaLangPluginFactories[<code>]`.
//   <plugin>/assets/...     fonts, the Open Lyric plugin's dictionaries and
//                           worker, the lookup datasets -- every URL resolved
//                           through `host.assetUrl()`, never `import.meta.url`
//   <plugin>/bb-cr.gz.bundle  opened with Node `fs` at `host.toFilePath()`
//   <plugin>/<side>.json    the package's small data files, copied verbatim
//   <plugin>/tran.json      the dictionary, sanitized, for the MCP server
//                           (`tools/owa-devtools-mcp/langPacks.mjs`), which
//                           reads a language's labels without loading it
//   <plugin>/langFacts.json {fonts, fontFiles, hasLookupData}: its `fonts.json`
//                           (or null) with where each font file was built to,
//                           carried inline in the plugin list, so a window that
//                           only DRAWS the language -- every screen, a song
//                           previewer, a font list -- registers its faces
//                           without loading it (`genLangFacts`, EN-59)
//   <plugin>/manual/...     the translated manual and its search index
//                           (`manual/index.json`, `genManualIndexEntries`)
//
// The `host` the app hands the factory: `{ langCode, baseUrl, dirPath,
// assetUrl(rel), toFilePath(rel), onOpenLyricInternal(cb),
// createWorker(url, options) }` -- every `new Worker(` in a plugin is turned
// into the last, so the host starts it from an origin the window accepts.
// `open-lyric/internal` is NOT bundled a second time: both the app and a
// language's Open
// Lyric plugin register into one registry, so the plugin gets live bindings the
// app fills from its own copy when it initializes the plugins.
//
// Usage:
//   node extra-work/build-lang-plugins.mjs            -> electron-build/lang/
//        (what ships: nothing, since every language is installed)
//   node extra-work/build-lang-plugins.mjs --out=<dir> --no-cache
//   node extra-work/build-lang-plugins.mjs --pack     -> extra-work/lang/ (the
//        dev mock catalog: every language, packed + info.json -- what
//        Settings > Languages installs from in dev)
//   --pack=<code>,<code>   pack only these (what a dev install needs; the
//                          catalog keeps what earlier runs packed)
//   --bump=<code>[:<ver>]  pack it under a higher version than its meta.json
//   --release              pack every language the catalog offers -- the
//                          built-in ones (their updates) and the online-only
//                          ones -- into extra-work/lang/release/ for
//                          s3-push-lang.js
//
// Every language lives in `src/lang/data/online/<code>/` and is only ever
// installed from the catalog. A language is DATA (2026-11-05, the user: _make
// all non-english languages be treated equally base on language data_): its
// folder holds no entry of its own. The entry is written HERE, from the files
// the folder has (`genLangEntrySource`), and hands them to the one factory
// every language shares, `src/lang/data/online/onlineLangPackage.ts` -- the
// folder's files and what each means: `src/lang/data/online/README.md`.
// English (`src/lang/data/en/`) is the app's own and is no plugin.
//
// A language's ONE dependency, its Open Lyric song plugin (a keyboard,
// spellcheck and fonts), is the LANGUAGE's: declared in its own
// `package.json` and installed into its own `node_modules` by
// `extra-work/install-lang-deps.mjs` (2026-11-05, the user: a language's song
// plugin has to ship with that language's bundle). The app's manifest names
// none, and a plugin may bundle nothing from outside its own folder.
//
// Node only. Builds are cached in node_modules/.cache/owa-lang/<code>, keyed
// on the package's files, so `npm run dev` pays a copy, not a rebuild.

import { createHash } from 'node:crypto';
import {
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseAst } from 'rolldown/parseAst';
import * as tar from 'tar';
import { build, normalizePath } from 'vite';

import {
    genManualIndexEntries,
    MANUAL_DIR_NAME,
    MANUAL_INDEX_FILE_NAME,
} from '../tools/owa-devtools-mcp/manualI18n.mjs';
import {
    LANG_PACK_TRAN_FILE_NAME,
    readSourceDictionary,
} from '../tools/owa-devtools-mcp/langPacks.mjs';
import {
    LANG_DATA_DIR,
    ONLINE_LANG_DATA_DIR,
    REPO_ROOT,
    listPackageCodes,
    toPackageDir,
} from './language-packages.mjs';
import { ensureLangPackageDeps } from './install-lang-deps.mjs';

// Bumped when the factory's contract with the app changes; the app refuses a
// plugin built for another one (`electron/langPluginHelpers.ts`).
export const LANG_PLUGIN_API_VERSION = 1;
export const LANG_PLUGIN_HOST_NAME = '__owaLangHost';
export const LANG_PLUGIN_FACTORIES_NAME = '__owaLangPluginFactories';
// Copied as is when a package has them; the manual is copied with its index,
// and everything else in the source folder (tests, eval sets, title fixes,
// experiments) stays behind.
export const LANG_PLUGIN_SIDE_FILE_NAMES = [
    'appMenus.json',
    'assistant.json',
    'questions.json',
    'script.json',
    'bibleReference.json',
    'bibleBooks.json',
    'bibleKeyMap.json',
    // How a question typed in the language is told apart (the help window),
    // what studying a Bible in it needs (the word study), and what the Bible
    // import and lyric tools know of it (the MCP server): language data that
    // ships with the language, never with the app (2026-11-04).
    'typed.json',
    'bibleSource.json',
    'world.json',
];
const SKIPPED_SOURCE_DIR_NAMES = new Set([
    'tests',
    'chatbot-asks',
    'experiment',
    // The language's installed dependencies: its lockfile stands for them.
    'node_modules',
]);
export const ONLINE_LANG_DIR = ONLINE_LANG_DATA_DIR;
export const DEFAULT_OUT_DIR = path.join(REPO_ROOT, 'electron-build', 'lang');
export const DEV_PACK_DIR = path.join(REPO_ROOT, 'extra-work', 'lang');
export const RELEASE_PACK_DIR = path.join(DEV_PACK_DIR, 'release');
const CACHE_DIR = path.join(REPO_ROOT, 'node_modules', '.cache', 'owa-lang');
const OPEN_LYRIC_INTERNAL_ID = 'open-lyric/internal';
const OPEN_LYRIC_INTERNAL_VIRTUAL_ID = '\0owa-lang-open-lyric-internal';

function readJson(filePath, fallback = null) {
    try {
        return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (_error) {
        return fallback;
    }
}

/**
 * Every language that can be built: `{code, srcDir, meta, isOnlineOnly}`,
 * in the picker's order. None ships with the app (the default, what
 * electron-build/lang gets, is empty); asked for the catalog's, all of them.
 */
export function listLangPluginSources({ isOnlineIncluded = false } = {}) {
    if (!isOnlineIncluded) {
        return [];
    }
    return listPackageCodes({ isEnglishIncluded: false }).map((code) => {
        const srcDir = toPackageDir(code);
        return {
            code,
            srcDir,
            meta: readJson(path.join(srcDir, 'meta.json'), {}),
            isOnlineOnly: true,
        };
    });
}

// -- build plugins --------------------------------------------------------

/** The export names of the real `open-lyric/internal`, read off its source. */
function readOpenLyricInternalExportNames() {
    const require = createRequire(path.join(REPO_ROOT, 'package.json'));
    const pkgDir = path.dirname(require.resolve('open-lyric/package.json'));
    const pkg = readJson(path.join(pkgDir, 'package.json'), {});
    const entry = pkg.exports?.['./internal']?.import?.default;
    if (typeof entry !== 'string') {
        throw new Error('Cannot find the ESM entry of open-lyric/internal.');
    }
    const ast = parseAst(readFileSync(path.join(pkgDir, entry), 'utf8'));
    const names = [];
    for (const node of ast.body) {
        if (node.type === 'ExportAllDeclaration') {
            throw new Error(
                'open-lyric/internal re-exports a whole module; list its ' +
                    'names here before building language plugins.',
            );
        }
        if (node.type !== 'ExportNamedDeclaration') {
            continue;
        }
        for (const specifier of node.specifiers ?? []) {
            names.push(specifier.exported.name ?? specifier.exported.value);
        }
        if (node.declaration?.declarations) {
            for (const declaration of node.declaration.declarations) {
                names.push(declaration.id.name);
            }
        } else if (node.declaration?.id) {
            names.push(node.declaration.id.name);
        }
    }
    return names;
}

/**
 * `open-lyric/internal` as live bindings the HOST fills: the app's own copy is
 * the one whose registry the editor reads, and a second copy here would also
 * double its dictionaries in memory.
 */
function openLyricInternalPlugin() {
    let names = null;
    return {
        name: 'owa-lang-open-lyric-internal',
        enforce: 'pre',
        resolveId(source) {
            return source === OPEN_LYRIC_INTERNAL_ID
                ? OPEN_LYRIC_INTERNAL_VIRTUAL_ID
                : null;
        },
        load(id) {
            if (id !== OPEN_LYRIC_INTERNAL_VIRTUAL_ID) {
                return null;
            }
            names ??= readOpenLyricInternalExportNames();
            return (
                `export let ${names.join(', ')};\n` +
                `${LANG_PLUGIN_HOST_NAME}.onOpenLyricInternal((m) => {\n` +
                names.map((name) => `    ${name} = m.${name};\n`).join('') +
                '});\n'
            );
        },
    };
}

/**
 * A `*.gz.bundle` is opened by Node `fs`, so it is emitted UNHASHED at the
 * plugin's root and its path is asked of the host at load time -- a plugin
 * folder can sit anywhere.
 */
function langGzBundlePlugin() {
    return {
        name: 'owa-lang-gz-bundle',
        enforce: 'pre',
        load(id) {
            const filePath = id.split('?', 1)[0];
            if (!filePath.endsWith('.gz.bundle')) {
                return null;
            }
            const fileName = path.basename(filePath);
            this.emitFile({
                type: 'asset',
                fileName,
                source: readFileSync(filePath),
            });
            return (
                'export default { filePath: ' +
                `${LANG_PLUGIN_HOST_NAME}.toFilePath(${JSON.stringify(fileName)}),` +
                ' fileName: null };\n'
            );
        },
    };
}

/**
 * What an online-only language may share with the others: the files lying
 * directly in `src/lang/data/online/` (`onlineLangPackage.ts`), never another
 * language's folder. Null for a package, which shares nothing.
 */
function getOnlineSharedDir(srcDir) {
    const onlineDir = path.resolve(ONLINE_LANG_DIR);
    return path.dirname(path.resolve(srcDir)) === onlineDir ? onlineDir : null;
}

/** The shared files an online-only language's build reads, tests aside. */
function listOnlineSharedFiles(srcDir) {
    const sharedDir = getOnlineSharedDir(srcDir);
    if (sharedDir === null) {
        return [];
    }
    return readdirSync(sharedDir, { withFileTypes: true })
        .filter((entry) => {
            return entry.isFile() && !/\.test\.[cm]?[jt]sx?$/.test(entry.name);
        })
        .map((entry) => {
            return path.join(sharedDir, entry.name);
        });
}

/**
 * Only the package's own folder may be bundled -- its files and what its own
 * `package.json` installed into its own `node_modules` (its Open Lyric
 * plugin): a stray value import of an app module (`../../langHelpers`) would
 * carry half the app into every language, and a package resolved from the
 * app's `node_modules` would be a language's dependency the app declares.
 */
function moduleContainmentPlugin(srcDir) {
    const allowedDirs = [path.resolve(srcDir), path.resolve(LANG_DATA_DIR, 'en')];
    const onlineSharedDir = getOnlineSharedDir(srcDir);
    return {
        name: 'owa-lang-module-containment',
        generateBundle(_options, bundle) {
            const strayList = [];
            for (const chunk of Object.values(bundle)) {
                if (chunk.type !== 'chunk') {
                    continue;
                }
                for (const moduleId of chunk.moduleIds) {
                    if (moduleId.startsWith('\0')) {
                        continue;
                    }
                    const filePath = path.resolve(moduleId.split('?', 1)[0]);
                    const isAllowed =
                        allowedDirs.some((dir) => {
                            return filePath.startsWith(dir + path.sep);
                        }) ||
                        (onlineSharedDir !== null &&
                            path.dirname(filePath) === onlineSharedDir);
                    if (!isAllowed) {
                        strayList.push(path.relative(REPO_ROOT, filePath));
                    }
                }
            }
            if (strayList.length > 0) {
                this.error(
                    `A language plugin may bundle only its own package: ${strayList.join(', ')}`,
                );
            }
        },
    };
}

/**
 * Wraps the CommonJS output in the factory envelope. Inside, `module` and
 * `exports` are the factory's own, so the same file works under `require()`
 * and as a classic `<script>`. Anything still reaching for Node or the page's
 * own URL is a build error: the factory must answer from `host` alone.
 */
function envelopePlugin(code) {
    return {
        name: 'owa-lang-envelope',
        renderChunk(chunkCode, chunk) {
            if (!chunk.isEntry) {
                return null;
            }
            let body = chunkCode.replace(/^(['"])use strict\1;?/, '');
            // `import.meta.url` as the CJS output polyfills it: the host's base.
            body = body.replace(
                /require\((['"])(node:)?url\1\)\.pathToFileURL\(__filename\)\.href/g,
                `${LANG_PLUGIN_HOST_NAME}.assetUrl('index.js')`,
            );
            body = body.replace(
                /\bimport\.meta\.url\b/g,
                `${LANG_PLUGIN_HOST_NAME}.assetUrl('index.js')`,
            );
            // A worker is started by the host: its script is served from
            // `owa://local/@lang/...`, which only a window on `owa://local`
            // may start a worker from (the same-origin rule, and the pages'
            // `worker-src 'self' blob:`). A dev window gets it as a `blob:`.
            // A language's song plugin's spellcheck worker died that way when
            // the plugin left the app's bundle (2026-11-05).
            body = body.replace(
                /\bnew\s+Worker\s*\(/g,
                `${LANG_PLUGIN_HOST_NAME}.createWorker(`,
            );
            const leftover = /\brequire\s*\(|\b__filename\b|\b__dirname\b/.exec(
                body,
            );
            if (leftover !== null) {
                const at = Math.max(0, leftover.index - 80);
                this.error(
                    'A language plugin must not reach Node directly: ' +
                        JSON.stringify(body.slice(at, leftover.index + 80)),
                );
            }
            const code_ = JSON.stringify(code);
            return {
                code:
                    `(function (factory) {\n` +
                    `    if (typeof module === 'object' && module !== null && typeof module.exports === 'object') {\n` +
                    `        module.exports = factory;\n` +
                    `    } else {\n` +
                    `        (globalThis.${LANG_PLUGIN_FACTORIES_NAME} ??= {})[${code_}] = factory;\n` +
                    `    }\n` +
                    `})(function (${LANG_PLUGIN_HOST_NAME}) {\n` +
                    `'use strict';\n` +
                    `var exports = {};\n` +
                    `var module = { exports: exports };\n` +
                    `${body}\n` +
                    `return module.exports.default ?? module.exports;\n` +
                    `});\n`,
                map: null,
            };
        },
    };
}

// The entry of a language's plugin, written from what its folder holds: each
// file the folder has is imported and handed to `genLangData`, each it lacks
// is left out (the factory's plain behaviour). The README in
// `src/lang/data/online/` lists the same files; `langSourceFiles.vitest.ts`
// reads them the same way for a test.
const LANG_ENTRY_JSON_FILES = [
    ['script', 'script.json'],
    ['words', 'words.json'],
    ['bibleBooks', 'bibleBooks.json'],
    ['bibleKeyMap', 'bibleKeyMap.json'],
    ['bibleReference', 'bibleReference.json'],
    ['fonts', 'fonts.json'],
];
const LANG_ENTRY_FILE_NAME = '__owa_lang_entry__.js';
const LOOKUP_DATA_DIR_NAME = 'location-name-map-data';
// `electron/langPluginProtocol.ts`'s `LANG_PLUGIN_FACTS_FILE_NAME`: carried
// inline in the plugin list (`LANG_PLUGIN_INLINE_FILE_NAMES`).
export const LANG_PLUGIN_FACTS_FILE_NAME = 'langFacts.json';

function checkHasLookupData(srcDir) {
    return (
        existsSync(path.join(srcDir, LOOKUP_DATA_DIR_NAME, 'namesMap.json')) &&
        existsSync(path.join(srcDir, LOOKUP_DATA_DIR_NAME, 'locationsMap.json'))
    );
}

/** Every font file a `fonts.json` names, each once, as the factory lists them. */
function listFontFileNames(fonts) {
    const fileNames = [
        ...(fonts.faces ?? []).map((face) => {
            return face.file;
        }),
        ...(fonts.stickyNote?.file ? [fonts.stickyNote.file] : []),
    ];
    return [...new Set(fileNames)];
}

function toSourceKey(filePath) {
    const normalized = normalizePath(path.resolve(filePath));
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

/** Records, for each asset the build emits, the source file(s) it came from. */
export function assetSourcePlugin(assetMap) {
    return {
        name: 'owa-lang-asset-sources',
        generateBundle(_options, bundle) {
            for (const output of Object.values(bundle)) {
                if (output.type !== 'asset') {
                    continue;
                }
                for (const original of output.originalFileNames ?? []) {
                    assetMap.set(toSourceKey(original), output.fileName);
                }
            }
        },
    };
}

/**
 * `langFacts.json`: what a window needs to DRAW the language without
 * loading it (EN-59) -- its `fonts.json`, or null, with each file it names
 * mapped to the asset the build wrote it as, and whether it ships a
 * names-lookup dataset. `assetMap` is `assetSourcePlugin`'s, from the build
 * of the same folder; a font it did not emit fails the build.
 */
export function genLangFacts({ code, srcDir, assetMap }) {
    const hasLookupData = checkHasLookupData(srcDir);
    const fontsFilePath = path.join(srcDir, 'fonts.json');
    if (!existsSync(fontsFilePath)) {
        return { fonts: null, hasLookupData };
    }
    const fonts = readJson(fontsFilePath, {});
    const fontFiles = {};
    for (const fileName of listFontFileNames(fonts)) {
        const assetFileName = assetMap.get(
            toSourceKey(path.join(srcDir, fileName)),
        );
        if (assetFileName === undefined) {
            throw new Error(
                `${code}: fonts.json names ${fileName}, which the build ` +
                    'did not write.',
            );
        }
        fontFiles[fileName] = assetFileName;
    }
    return { fonts, fontFiles, hasLookupData };
}

export function genLangEntrySource({ code, srcDir }) {
    const checkHas = (relPath) => {
        return existsSync(path.join(srcDir, relPath));
    };
    for (const required of ['meta.json', 'dictionary.json', 'flag.svg']) {
        if (!checkHas(required)) {
            throw new Error(`${code}: a language folder needs ${required}.`);
        }
    }
    const importList = [
        "import { genLangData } from '../onlineLangPackage';",
        "import meta from './meta.json';",
        "import dictionary from './dictionary.json';",
        "import flagSVG from './flag.svg?raw';",
    ];
    const fieldList = [
        `langCode: ${JSON.stringify(code)}`,
        'meta',
        'dictionary',
        'flagSVG',
    ];
    for (const [name, fileName] of LANG_ENTRY_JSON_FILES) {
        if (checkHas(fileName)) {
            importList.push(`import ${name} from './${fileName}';`);
            fieldList.push(name);
        }
    }
    if (checkHas('bb-cr.gz.bundle')) {
        importList.push("import crossRefBundle from './bb-cr.gz.bundle';");
        fieldList.push('crossRefBundle');
    }
    if (checkHasLookupData(srcDir)) {
        importList.push(
            `import namesMap from './${LOOKUP_DATA_DIR_NAME}/namesMap.json?url';`,
            `import locationsMap from './${LOOKUP_DATA_DIR_NAME}/locationsMap.json?url';`,
        );
        fieldList.push('lookupDataUrls: { namesMap, locationsMap }');
    }
    if (checkHas('fonts.json')) {
        const fonts = readJson(path.join(srcDir, 'fonts.json'), {});
        const urlEntryList = listFontFileNames(fonts).map((fileName, i) => {
            if (!checkHas(fileName)) {
                throw new Error(`${code}: fonts.json names ${fileName}.`);
            }
            importList.push(`import fontUrl${i} from './${fileName}';`);
            return `${JSON.stringify(fileName)}: fontUrl${i}`;
        });
        fieldList.push(`fontUrls: { ${urlEntryList.join(', ')} }`);
    }
    if (checkHas('openLyricPlugin.ts')) {
        importList.push("import OpenLyricPlugin from './openLyricPlugin';");
        fieldList.push('OpenLyricPlugin');
    }
    return (
        importList.join('\n') +
        `\n\nexport default genLangData({ ${fieldList.join(', ')} });\n`
    );
}

/** Serves the written entry as if it were a file in the language's folder. */
function langEntryPlugin(entryFilePath, source) {
    const entryId = normalizePath(entryFilePath);
    return {
        name: 'owa-lang-entry',
        enforce: 'pre',
        resolveId(id) {
            return normalizePath(id) === entryId ? entryId : null;
        },
        load(id) {
            return normalizePath(id) === entryId ? source : null;
        },
    };
}

async function viteBuildEntry({
    code,
    srcDir,
    entryFilePath,
    entrySource,
    outDir,
    assetMap,
}) {
    await build({
        configFile: false,
        root: REPO_ROOT,
        logLevel: 'warn',
        base: './',
        publicDir: false,
        plugins: [
            langEntryPlugin(entryFilePath, entrySource),
            langGzBundlePlugin(),
            openLyricInternalPlugin(),
            moduleContainmentPlugin(srcDir),
            envelopePlugin(code),
            assetSourcePlugin(assetMap),
        ],
        experimental: {
            renderBuiltUrl(fileName, { hostType }) {
                if (hostType === 'js') {
                    return {
                        runtime: `${LANG_PLUGIN_HOST_NAME}.assetUrl(${JSON.stringify(fileName)})`,
                    };
                }
                return { relative: true };
            },
        },
        build: {
            outDir,
            emptyOutDir: true,
            copyPublicDir: false,
            assetsInlineLimit: 0,
            sourcemap: false,
            minify: false,
            modulePreload: false,
            reportCompressedSize: false,
            target: 'es2022',
            rollupOptions: {
                input: { index: entryFilePath },
                preserveEntrySignatures: 'strict',
                // What is left of `import.meta.url` once the asset plugin took
                // the `new URL('assets/...', import.meta.url)` it recognizes:
                // a CJS output would make it `{}.url`, and `new URL(x,
                // "undefined")` throws. The plugin's own address instead.
                transform: {
                    define: {
                        'import.meta.url': `${LANG_PLUGIN_HOST_NAME}.assetUrl("index.js")`,
                    },
                },
                output: {
                    format: 'cjs',
                    exports: 'named',
                    codeSplitting: false,
                    entryFileNames: '[name].js',
                    assetFileNames: 'assets/[name]-[hash][extname]',
                },
            },
        },
    });
}

// -- one language ---------------------------------------------------------

function listSourceFiles(dirPath, baseDir = dirPath) {
    const fileList = [];
    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (dirPath === baseDir && SKIPPED_SOURCE_DIR_NAMES.has(entry.name)) {
                continue;
            }
            fileList.push(
                ...listSourceFiles(path.join(dirPath, entry.name), baseDir),
            );
        } else if (!entry.name.startsWith('cross-ref-title-')) {
            fileList.push(path.join(dirPath, entry.name));
        }
    }
    return fileList;
}

/** A key that changes whenever anything the build reads changes. */
function genBuildKey({ code, srcDir, meta }) {
    const hash = createHash('sha256');
    hash.update(readFileSync(new URL(import.meta.url)));
    hash.update(JSON.stringify({ code, meta, api: LANG_PLUGIN_API_VERSION }));
    // The app's `open-lyric` decides the names `open-lyric/internal` binds;
    // the language's own dependencies are its `package-lock.json`, one of
    // the source files hashed below.
    const pkg = readJson(path.join(REPO_ROOT, 'package.json'), {});
    const appDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    hash.update(
        JSON.stringify({
            vite: appDeps.vite,
            openLyric: appDeps['open-lyric'],
        }),
    );
    const fileList = [
        ...listSourceFiles(srcDir),
        ...listOnlineSharedFiles(srcDir),
    ].sort();
    for (const filePath of fileList) {
        const { size, mtimeMs } = statSync(filePath);
        hash.update(`${path.relative(srcDir, filePath)}:${size}:${mtimeMs}\n`);
    }
    return hash.digest('hex');
}

function genPluginMeta({ code, meta }, versionOverride = null) {
    return {
        apiVersion: LANG_PLUGIN_API_VERSION,
        langCode: code,
        locale: meta.locale,
        name: meta.name ?? code,
        nativeName: meta.nativeName ?? meta.name ?? code,
        version: versionOverride ?? meta.version ?? '0.0.1',
        description: meta.description ?? '',
        order: Number.isFinite(meta.order) ? meta.order : undefined,
        direction: meta.direction === 'rtl' ? 'rtl' : undefined,
    };
}

async function buildLangPluginFresh(source, outDir) {
    const { code, srcDir } = source;
    if (source.meta.locale === undefined) {
        throw new Error(`${code}: meta.json has no "locale".`);
    }
    // What the package's own `package.json` names, in its own folder.
    ensureLangPackageDeps(srcDir);
    const assetMap = new Map();
    await viteBuildEntry({
        code,
        srcDir,
        entryFilePath: path.join(srcDir, LANG_ENTRY_FILE_NAME),
        entrySource: genLangEntrySource({ code, srcDir }),
        outDir,
        assetMap,
    });
    writeFileSync(
        path.join(outDir, LANG_PLUGIN_FACTS_FILE_NAME),
        JSON.stringify(genLangFacts({ code, srcDir, assetMap })),
    );
    for (const fileName of LANG_PLUGIN_SIDE_FILE_NAMES) {
        const filePath = path.join(srcDir, fileName);
        if (existsSync(filePath)) {
            cpSync(filePath, path.join(outDir, fileName));
        }
    }
    writeFileSync(
        path.join(outDir, LANG_PACK_TRAN_FILE_NAME),
        JSON.stringify(readSourceDictionary(srcDir)),
    );
    const manualEntries = genManualIndexEntries(srcDir);
    if (manualEntries.length > 0) {
        const manualOutDir = path.join(outDir, MANUAL_DIR_NAME);
        cpSync(path.join(srcDir, MANUAL_DIR_NAME), manualOutDir, {
            recursive: true,
        });
        writeFileSync(
            path.join(manualOutDir, MANUAL_INDEX_FILE_NAME),
            JSON.stringify({ entries: manualEntries }),
        );
    }
    writeFileSync(
        path.join(outDir, 'meta.json'),
        JSON.stringify(genPluginMeta(source), null, 4) + '\n',
    );
}

/** Builds one language into `outDir/<code>/`, from the cache when it can. */
export async function buildLangPlugin(source, { outRootDir, isCached = true }) {
    const destDir = path.join(outRootDir, source.code);
    if (!isCached) {
        await buildLangPluginFresh(source, destDir);
        return destDir;
    }
    const cacheDir = path.join(CACHE_DIR, source.code);
    const keyFilePath = path.join(CACHE_DIR, `${source.code}.key`);
    const buildKey = genBuildKey(source);
    const isFresh =
        existsSync(path.join(cacheDir, 'index.js')) &&
        readJson(keyFilePath, {}).key === buildKey;
    if (!isFresh) {
        rmSync(cacheDir, { recursive: true, force: true });
        await buildLangPluginFresh(source, cacheDir);
        mkdirSync(CACHE_DIR, { recursive: true });
        writeFileSync(keyFilePath, JSON.stringify({ key: buildKey }));
    }
    rmSync(destDir, { recursive: true, force: true });
    cpSync(cacheDir, destDir, { recursive: true });
    return destDir;
}

// -- packing (the catalog) ------------------------------------------------

function toSha512(filePath) {
    return createHash('sha512').update(readFileSync(filePath)).digest('hex');
}

function bumpVersion(version) {
    const parts = `${version}`.split('.').map((part) => Number(part) || 0);
    while (parts.length < 3) {
        parts.push(0);
    }
    parts[parts.length - 1] += 1;
    return parts.join('.');
}

/**
 * Packs a built plugin as `<code>-<version>.tar.gz` (the plugin's files at the
 * archive root) and returns its catalog entry.
 */
async function packLangPlugin(source, builtDir, packDir, versionOverride) {
    const meta = genPluginMeta(source, versionOverride);
    const stagingDir = mkdtempSync(path.join(tmpdir(), 'owa-lang-pack-'));
    try {
        cpSync(builtDir, stagingDir, { recursive: true });
        writeFileSync(
            path.join(stagingDir, 'meta.json'),
            JSON.stringify(meta, null, 4) + '\n',
        );
        const fileFullName = `${source.code}-${meta.version}.tar.gz`;
        const archiveFilePath = path.join(packDir, fileFullName);
        await tar.c(
            { gzip: true, file: archiveFilePath, cwd: stagingDir, portable: true },
            readdirSync(stagingDir),
        );
        return {
            ...meta,
            fileFullName,
            checksum: toSha512(archiveFilePath),
            size: statSync(archiveFilePath).size,
        };
    } finally {
        rmSync(stagingDir, { recursive: true, force: true });
    }
}

/**
 * The catalog: `{version: 1, languages: {<code>: [entry, ...]}}`, one entry per
 * published version, newest first -- cumulative, so an older app still finds
 * the newest pack built for ITS `apiVersion`.
 */
export function mergeCatalogEntry(catalog, entry) {
    const next = {
        version: 1,
        languages: { ...(catalog?.languages ?? {}) },
    };
    const list = (next.languages[entry.langCode] ?? []).filter((item) => {
        return !(
            item.version === entry.version &&
            item.apiVersion === entry.apiVersion
        );
    });
    list.unshift(entry);
    next.languages[entry.langCode] = list;
    return next;
}

// -- CLI ------------------------------------------------------------------

function parseArgs(argv) {
    const args = { pack: null, bump: new Map(), isRelease: false };
    for (const arg of argv) {
        if (arg.startsWith('--out=')) {
            args.out = path.resolve(arg.slice('--out='.length));
        } else if (arg === '--no-cache') {
            args.isNoCache = true;
        } else if (arg === '--release') {
            args.isRelease = true;
        } else if (arg === '--pack') {
            args.pack = args.pack ?? [];
        } else if (arg.startsWith('--pack=')) {
            args.pack = [
                ...(args.pack ?? []),
                ...arg.slice('--pack='.length).split(',').filter(Boolean),
            ];
        } else if (arg.startsWith('--bump=')) {
            for (const item of arg.slice('--bump='.length).split(',')) {
                const [code, version = null] = item.split(':');
                if (code) {
                    args.bump.set(code, version);
                }
            }
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }
    return args;
}

async function packCatalog(args) {
    const packDir = args.isRelease ? RELEASE_PACK_DIR : DEV_PACK_DIR;
    // A release is this run's packs and nothing else: `s3-push-lang.js`
    // uploads what the folder's catalog lists and merges it into the published
    // one. The dev catalog is cumulative, like the published one.
    if (args.isRelease) {
        rmSync(packDir, { recursive: true, force: true });
    }
    mkdirSync(packDir, { recursive: true });
    const sourceList = listLangPluginSources({ isOnlineIncluded: true });
    const wantedCodes = new Set([...(args.pack ?? []), ...args.bump.keys()]);
    // Languages named: those alone. None named: every one the catalog offers.
    const isNamed = wantedCodes.size > 0;
    const packList = sourceList.filter((source) => {
        return (
            args.isRelease ||
            (isNamed ? wantedCodes.has(source.code) : source.isOnlineOnly)
        );
    });
    const catalogFilePath = path.join(packDir, 'info.json');
    let catalog = readJson(catalogFilePath, { version: 1, languages: {} });
    const outRootDir = mkdtempSync(path.join(tmpdir(), 'owa-lang-built-'));
    try {
        for (const source of packList) {
            const builtDir = await buildLangPlugin(source, {
                outRootDir,
                isCached: !args.isNoCache,
            });
            let versionOverride = null;
            if (args.bump.has(source.code)) {
                const currentList = catalog.languages?.[source.code] ?? [];
                const baseVersion =
                    currentList[0]?.version ?? source.meta.version ?? '0.0.1';
                versionOverride =
                    args.bump.get(source.code) ?? bumpVersion(baseVersion);
            }
            const entry = await packLangPlugin(
                source,
                builtDir,
                packDir,
                versionOverride,
            );
            catalog = mergeCatalogEntry(catalog, entry);
            console.log(
                `"${source.code}" ${entry.version} is packed: ` +
                    path.relative(REPO_ROOT, path.join(packDir, entry.fileFullName)),
            );
        }
    } finally {
        rmSync(outRootDir, { recursive: true, force: true });
    }
    writeFileSync(catalogFilePath, JSON.stringify(catalog, null, 4) + '\n');
    console.log(
        `The language catalog is written: ${path.relative(REPO_ROOT, catalogFilePath)}`,
    );
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.pack !== null || args.bump.size > 0 || args.isRelease) {
        await packCatalog(args);
        return;
    }
    const outRootDir = args.out ?? DEFAULT_OUT_DIR;
    mkdirSync(outRootDir, { recursive: true });
    const shippedList = listLangPluginSources();
    if (shippedList.length === 0) {
        console.log(
            'No language plugin ships with the app: every language but ' +
                'English is installed from the catalog (--pack for the dev one).',
        );
    }
    for (const source of shippedList) {
        const startTime = Date.now();
        await buildLangPlugin(source, {
            outRootDir,
            isCached: !args.isNoCache,
        });
        console.log(
            `"${source.code}" language plugin is built (${Date.now() - startTime} ms)`,
        );
    }
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
    await main();
}
