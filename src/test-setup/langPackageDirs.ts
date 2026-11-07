import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

// The language packages of the checkout, for a test that holds every one of
// them to something (Node only, tests only): English's folder,
// `src/lang/data/en/`, and every installable language's,
// `src/lang/data/online/<code>/` (2026-11-04, the user: _everything related
// to a language have to be loaded from the language data (from language
// installation catalog), must not ship in the app, except english_). Found by
// folder, so a test names no language and follows one added or taken out.

export const LANG_DATA_DIR = path.join(
    import.meta.dirname,
    '..',
    'lang',
    'data',
);
export const ONLINE_LANG_DATA_DIR = path.join(LANG_DATA_DIR, 'online');
const DEFAULT_LANG_CODE = 'en';
// What marks a package: an online language's labels (its folder is data,
// `online/README.md`), English's built-in `index.ts`.
const ONLINE_PACKAGE_MARKER = 'dictionary.json';
const ENGLISH_PACKAGE_MARKER = 'index.ts';

/** A language's source folder. */
export function toLangPackageDir(langCode: string) {
    return langCode === DEFAULT_LANG_CODE
        ? path.join(LANG_DATA_DIR, langCode)
        : path.join(ONLINE_LANG_DATA_DIR, langCode);
}

/**
 * Every package holding `fileName` (a path below its folder; by default the
 * package itself: an online language's `dictionary.json`, English's
 * `index.ts`), English first when it is asked for and has one.
 */
export function listLangPackageCodes({
    isEnglishIncluded = true,
    fileName,
}: { isEnglishIncluded?: boolean; fileName?: string } = {}) {
    const codeList = existsSync(ONLINE_LANG_DATA_DIR)
        ? readdirSync(ONLINE_LANG_DATA_DIR)
              .filter((langCode) => {
                  return existsSync(
                      path.join(
                          ONLINE_LANG_DATA_DIR,
                          langCode,
                          fileName ?? ONLINE_PACKAGE_MARKER,
                      ),
                  );
              })
              .sort()
        : [];
    if (
        isEnglishIncluded &&
        existsSync(
            path.join(
                toLangPackageDir(DEFAULT_LANG_CODE),
                fileName ?? ENGLISH_PACKAGE_MARKER,
            ),
        )
    ) {
        codeList.unshift(DEFAULT_LANG_CODE);
    }
    return codeList;
}

/**
 * Whether the checkout holds the package of `langCode`: a case about one
 * language's behaviour runs only while that language is there, so the suite
 * passes with every non-English package deleted.
 */
export function checkHasLangPackage(langCode: string) {
    return existsSync(
        path.join(
            toLangPackageDir(langCode),
            langCode === DEFAULT_LANG_CODE
                ? ENGLISH_PACKAGE_MARKER
                : ONLINE_PACKAGE_MARKER,
        ),
    );
}

/**
 * The first installable package on disk (folder order), by its code and its
 * `meta.json` locale, for a case about "a language the app knows besides
 * English"; null when only English is in the checkout.
 */
export function findOtherLangPackage(): {
    langCode: string;
    locale: string;
} | null {
    const [langCode] = listLangPackageCodes({
        isEnglishIncluded: false,
        fileName: 'meta.json',
    });
    if (langCode === undefined) {
        return null;
    }
    const meta = JSON.parse(
        readFileSync(
            path.join(toLangPackageDir(langCode), 'meta.json'),
            'utf8',
        ),
    );
    return { langCode, locale: meta.locale };
}

/**
 * Every package on disk the help window is written for (an
 * `assistant.json`), by its code and the English name it is called by there.
 */
export function listAssistantLangPackages() {
    return listLangPackageCodes({
        isEnglishIncluded: false,
        fileName: 'assistant.json',
    }).map((langCode) => {
        const assistant = JSON.parse(
            readFileSync(
                path.join(toLangPackageDir(langCode), 'assistant.json'),
                'utf8',
            ),
        );
        return { langCode, name: assistant.name as string };
    });
}

/**
 * One installable package's labels as `tran()` looks them up: its
 * `dictionary.json`, each key trimmed and lower-cased.
 */
export function readLangPackageDictionary(
    langCode: string,
): Record<string, string> {
    const dictionary: Record<string, string> = JSON.parse(
        readFileSync(
            path.join(toLangPackageDir(langCode), ONLINE_PACKAGE_MARKER),
            'utf8',
        ),
    );
    return Object.fromEntries(
        Object.entries(dictionary).map(([key, value]) => {
            return [key.trim().toLowerCase(), value];
        }),
    );
}

/**
 * Every installable package's labels (`readLangPackageDictionary`), for a
 * test that checks the labels it renders are translated. Every package holds
 * every key (`tranKeyCoverage.test.ts`); none when only English is in the
 * checkout, so the test still runs.
 */
export function readLangPackageDictionaries(): Record<string, string>[] {
    return listLangPackageCodes({ isEnglishIncluded: false }).map(
        readLangPackageDictionary,
    );
}

/**
 * Every installable package's `world.json` (what the Bible import and the
 * lyric tools know of it), as an app with every language installed holds
 * them: hand it to `configureWorldLanguageParts`.
 */
export function readLangPackageWorldParts(): unknown[] {
    return listLangPackageCodes({ isEnglishIncluded: false }).map(
        (langCode) => {
            const filePath = path.join(
                toLangPackageDir(langCode),
                'world.json',
            );
            return existsSync(filePath)
                ? JSON.parse(readFileSync(filePath, 'utf8'))
                : null;
        },
    );
}
