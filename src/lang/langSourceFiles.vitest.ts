import {
    LANG_PLUGIN_API_VERSION,
    type LangPluginType,
} from '../../electron/langPluginProtocol';
import {
    genLangData,
    type LangFolderType,
} from './data/online/onlineLangPackage';

// `langSourceFiles.ts` under vitest (`vitest.config.ts` resolves the one to the
// other): the language packages of the checkout (`data/online/<code>/`, every
// language but English) stand in for installed plugins, so a test of one
// language's behaviour runs against the package it is about -- and an
// English-only tree (every package deleted) has none. Never part of the app:
// nothing but that alias reaches it.
//
// A package is a folder with a `dictionary.json`, made into a language the way
// the plugin build makes it: each file the folder has, handed to the one
// factory (`data/online/onlineLangPackage.ts`; the files: `data/online/README.md`).

type SourceMetaType = LangFolderType['meta'];
type LoaderMapType = Record<string, () => Promise<unknown>>;

const ONLINE_DIR = './data/online';

const META_FILE_MAP = import.meta.glob<SourceMetaType>(
    './data/online/*/meta.json',
    {
        eager: true,
        import: 'default',
    },
);
// What a plugin carries inline (`LANG_PLUGIN_INLINE_FILE_NAMES`), plus
// `assistant.json`, `typed.json` and `bibleSource.json`, which a window preloads.
const INLINE_FILE_MAP = import.meta.glob<unknown>(
    [
        './data/online/*/appMenus.json',
        './data/online/*/assistant.json',
        './data/online/*/typed.json',
        './data/online/*/bibleSource.json',
        './data/online/*/bibleKeyMap.json',
        './data/online/*/world.json',
        './data/online/*/bibleReference.json',
        './data/online/*/script.json',
    ],
    { eager: true, import: 'default' },
);
const LAZY_FILE_LOADER_MAP = import.meta.glob<unknown>(
    ['./data/online/*/bibleBooks.json', './data/online/*/questions.json'],
    { import: 'default' },
);

// The files a language is made of, as the plugin build reads them.
const DICTIONARY_LOADER_MAP: LoaderMapType = import.meta.glob(
    './data/online/*/dictionary.json',
    { import: 'default' },
);
const FLAG_LOADER_MAP: LoaderMapType = import.meta.glob(
    './data/online/*/flag.svg',
    { query: '?raw', import: 'default' },
);
const JSON_LOADER_MAP: LoaderMapType = import.meta.glob(
    [
        './data/online/*/script.json',
        './data/online/*/words.json',
        './data/online/*/bibleBooks.json',
        './data/online/*/bibleKeyMap.json',
        './data/online/*/bibleReference.json',
        './data/online/*/fonts.json',
    ],
    { import: 'default' },
);
const CROSS_REF_LOADER_MAP: LoaderMapType = import.meta.glob(
    './data/online/*/bb-cr.gz.bundle',
    { import: 'default' },
);
const URL_LOADER_MAP: LoaderMapType = import.meta.glob(
    [
        './data/online/*/location-name-map-data/*.json',
        './data/online/*/fonts/**/*.ttf',
    ],
    { query: '?url', import: 'default' },
);
const OPEN_LYRIC_PLUGIN_LOADER_MAP: LoaderMapType = import.meta.glob(
    './data/online/*/openLyricPlugin.ts',
    { import: 'default' },
);

function toLangCode(filePath: string) {
    return filePath.split('/').at(-2) ?? '';
}

function toFileName(filePath: string) {
    return filePath.split('/').at(-1) ?? '';
}

function checkIsPackage(langCode: string) {
    return `${ONLINE_DIR}/${langCode}/dictionary.json` in DICTIONARY_LOADER_MAP;
}

function genInlineFiles(langCode: string) {
    const inlineFiles: { [fileName: string]: unknown } = {};
    for (const [filePath, data] of Object.entries(INLINE_FILE_MAP)) {
        if (toLangCode(filePath) === langCode) {
            inlineFiles[toFileName(filePath)] = data;
        }
    }
    return inlineFiles;
}

export function listSourceLangPlugins(): LangPluginType[] {
    return Object.entries(META_FILE_MAP)
        .map(([filePath, meta]): LangPluginType => {
            const langCode = toLangCode(filePath);
            return {
                apiVersion: LANG_PLUGIN_API_VERSION,
                langCode,
                locale: meta.locale,
                name: meta.name ?? langCode,
                nativeName: meta.nativeName ?? meta.name ?? langCode,
                version: meta.version ?? '0.0.1',
                description: meta.description ?? '',
                order: meta.order,
                direction: meta.direction === 'rtl' ? 'rtl' : undefined,
                isEnabled: true,
                isBuiltIn: true,
                isRemovable: false,
                builtInVersion: meta.version ?? '0.0.1',
                dirPath: '',
                removableDirPaths: [],
                inlineFiles: genInlineFiles(langCode),
            };
        })
        .filter((plugin) => {
            return plugin.langCode !== 'en' && checkIsPackage(plugin.langCode);
        })
        .sort((a, b) => {
            return (
                (a.order ?? Number.MAX_SAFE_INTEGER) -
                    (b.order ?? Number.MAX_SAFE_INTEGER) ||
                a.langCode.localeCompare(b.langCode)
            );
        });
}

async function loadOptional(loaderMap: LoaderMapType, filePath: string) {
    const loader = loaderMap[filePath];
    return loader === undefined ? undefined : ((await loader()) as any);
}

export async function loadSourceLangData(langCode: string) {
    if (!checkIsPackage(langCode)) {
        return null;
    }
    const dir = `${ONLINE_DIR}/${langCode}`;
    const loadJson = (fileName: string) => {
        return loadOptional(JSON_LOADER_MAP, `${dir}/${fileName}`);
    };
    const fonts = await loadJson('fonts.json');
    const fontUrls: Record<string, string> = {};
    if (fonts !== undefined) {
        const fileList: string[] = [
            ...fonts.faces.map((face: { file: string }) => {
                return face.file;
            }),
            ...(fonts.stickyNote ? [fonts.stickyNote.file] : []),
        ];
        for (const file of fileList) {
            fontUrls[file] = await loadOptional(
                URL_LOADER_MAP,
                `${dir}/${file}`,
            );
        }
    }
    const namesMap = await loadOptional(
        URL_LOADER_MAP,
        `${dir}/location-name-map-data/namesMap.json`,
    );
    const locationsMap = await loadOptional(
        URL_LOADER_MAP,
        `${dir}/location-name-map-data/locationsMap.json`,
    );
    return genLangData({
        langCode,
        meta: META_FILE_MAP[`${dir}/meta.json`],
        dictionary: await loadOptional(
            DICTIONARY_LOADER_MAP,
            `${dir}/dictionary.json`,
        ),
        flagSVG: (await loadOptional(FLAG_LOADER_MAP, `${dir}/flag.svg`)) ?? '',
        script: await loadJson('script.json'),
        words: await loadJson('words.json'),
        bibleBooks: await loadJson('bibleBooks.json'),
        bibleKeyMap: await loadJson('bibleKeyMap.json'),
        bibleReference: await loadJson('bibleReference.json'),
        crossRefBundle: await loadOptional(
            CROSS_REF_LOADER_MAP,
            `${dir}/bb-cr.gz.bundle`,
        ),
        lookupDataUrls:
            namesMap !== undefined && locationsMap !== undefined
                ? { namesMap, locationsMap }
                : undefined,
        fonts,
        fontUrls,
        OpenLyricPlugin: await loadOptional(
            OPEN_LYRIC_PLUGIN_LOADER_MAP,
            `${dir}/openLyricPlugin.ts`,
        ),
    });
}

export async function loadSourceLangFile(langCode: string, fileName: string) {
    const loader =
        LAZY_FILE_LOADER_MAP[`${ONLINE_DIR}/${langCode}/${fileName}`];
    if (loader !== undefined) {
        return await loader();
    }
    return genInlineFiles(langCode)[fileName] ?? null;
}
