// One small data file out of ONE language, by the language's code --
// `data/<code>/bibleBooks.json` for the Bible import, and the like.
//
// English's is the app's own; every other language is a plugin
// (`langPluginRegistry.ts`) and its file is read from the plugin
// (`langFileStore.ts`), so no code outside `src/lang/data` imports a
// language's file by its path: a language that is not installed simply has no
// file here. Read when asked, one file of one language, so a window pays only
// for the language it asks for -- never for a whole package (its dictionary,
// fonts and plugins) to read one small map. A leaf: no app imports, so a node
// test and a startup path can both take it.

import type { BibleBookType } from './langHelpers';
import { listLangFileCodes, loadLangFile } from './langFileStore';

/** The language codes this window has; one without the file reads as `[]`. */
export function listBibleBooksLangCodes(): string[] {
    return listLangFileCodes();
}

/**
 * Every Bible book name every installed language package writes, each name
 * once: a book named in a language other than the open Bible's still names
 * a book (Matthew's name in another language, with the KJV open). Read only when asked -- one small
 * file per package.
 */
export async function listLangBibleBookNames(): Promise<string[]> {
    const setsList = await Promise.all(
        listBibleBooksLangCodes().map((langCode) => {
            return loadLangBibleBooks(langCode);
        }),
    );
    return [
        ...new Set(
            setsList.flatMap((sets) => {
                return sets.flatMap((set) => {
                    return set.books;
                });
            }),
        ),
    ];
}

/**
 * A language's Bible book name sets (`data/<code>/bibleBooks.json`), or `[]`
 * for a language with no package or no file.
 */
export async function loadLangBibleBooks(
    langCodeOrLocale: string,
): Promise<BibleBookType[]> {
    const langCode = langCodeOrLocale.split('-')[0];
    if (langCode === 'en') {
        return (await import('./data/en/bibleBooks.json')).default;
    }
    return (
        (await loadLangFile<BibleBookType[]>(langCode, 'bibleBooks.json')) ?? []
    );
}
