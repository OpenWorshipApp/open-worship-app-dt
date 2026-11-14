import { getAllLocalBibleInfoList } from './bibleDownloadHelpers';
import { getBibleInfo } from './bibleInfoHelpers';
import { getModelKeyBookMap } from './bibleLogicHelpers1';

// The Bibles whose names `books` reads: a study names its books as one of
// them does. The user's dev profile holds 21, nine of them naming every book
// alike, so a set of names is sent once with every Bible that writes it.
const MAX_BOOK_NAME_BIBLES = 40;

export type BibleBookNameListType = {
    kind: 'books';
    bookKeys: string[];
    english: string[];
    bibles: { keys: string[]; locale: string; books: string[] }[];
};

/**
 * Every installed Bible's book names in the model's order ('' for a book it
 * does not name), with its locale, and the book keys and English names: read
 * when asked, nothing kept. Bibles of one locale naming every book alike are
 * one entry, `keys` listing them.
 *
 * Its own module so the two that read it -- `owa_bible_suggest books` (the
 * help window's study check) and the Markdown Preview's verse links -- share
 * it without the preview loading the suggestion helpers and the names
 * dataset they hold.
 */
export async function listBibleBookNames(): Promise<BibleBookNameListType> {
    const englishMap = getModelKeyBookMap();
    const bookKeyList = Object.keys(englishMap);
    const infoList = ((await getAllLocalBibleInfoList()) ?? []).slice(
        0,
        MAX_BOOK_NAME_BIBLES,
    );
    const readList = await Promise.all(
        infoList.map(async (one) => {
            const info = await getBibleInfo(one.key).catch(() => {
                return null;
            });
            const keyBookMap = info?.keyBookMap ?? {};
            return {
                key: one.key,
                locale: String(one.locale ?? ''),
                books: bookKeyList.map((bookKey) => {
                    return keyBookMap[bookKey] ?? '';
                }),
            };
        }),
    );
    const groupMap = new Map<
        string,
        { keys: string[]; locale: string; books: string[] }
    >();
    for (const { key, locale, books } of readList) {
        const groupKey = `${locale}\n${books.join('\n')}`;
        const group = groupMap.get(groupKey);
        if (group === undefined) {
            groupMap.set(groupKey, { keys: [key], locale, books });
        } else {
            group.keys.push(key);
        }
    }
    return {
        kind: 'books',
        bookKeys: bookKeyList,
        english: bookKeyList.map((bookKey) => {
            return englishMap[bookKey];
        }),
        bibles: [...groupMap.values()],
    };
}
