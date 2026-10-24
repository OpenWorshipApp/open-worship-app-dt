/**
 * `owa_bible_suggest`: what the chat box's input aid reads as a volunteer
 * types -- the books, chapters and verses of the Bible being read, and the
 * people and places of the names lookup (2026-10-18).
 *
 * Asked for with a picture of a lookup conversation whose box held `១` and
 * offered nothing: _assistant should help the input ... book auto complete ->
 * chapter -> verse_, then _if for location/name then should recommend the
 * auto-complete_. The window asks on a debounce (`bibleInputSuggestHelpers.ts`
 * decides WHEN); this reads what the app holds.
 *
 * - A reference is completed in the Bible the READER is on: the lookup's
 *   language's Bible, so a Khmer reader is offered `យ៉ូហាន ៣:១៦`, its own
 *   digits and name. Books come from that Bible's `keyBookMap`, chapters from
 *   the model's chapter count, verses from the chapter itself.
 * - A name or a place comes from the names lookup, taken through
 *   `acquireLookupData` and given back at once, like `owa_lookup_record`. The
 *   dataset is ~34MB, so the WINDOW only asks for a name when the person is
 *   naming one, or the panel already holds it (`checkIsLookupDataHeld`).
 * Reads only; nothing is opened or shown.
 */
import {
    acquireLookupData,
    getHeldLookupData,
    releaseLookupData,
} from '../location-name-lookup/lookupDataHelpers';
import { getLookupVerseBibleKey } from '../location-name-lookup/bibleVerseHelpers';
import { getSelectedLookupLangCode } from '../location-name-lookup/lookupLangHelpers';
import { getAllLocalBibleInfoList } from './bible-helpers/bibleDownloadHelpers';
import { getBibleInfo } from './bible-helpers/bibleInfoHelpers';
import {
    getModelChapterCount,
    getModelKeyBookMap,
} from './bible-helpers/bibleLogicHelpers1';
import {
    fromLocaleNumBible,
    getVersesCount,
    toLocaleNumBible,
} from './bible-helpers/bibleLogicHelpers2';
import {
    listNumberPrefixMatches,
    matchBibleBooks,
    readBibleReferencePrefix,
    toCompactBookName,
    toReferenceDraft,
    type BibleBookOptionType,
} from './bibleSuggestHelpers';

export type AgentBibleSuggestRequestType = {
    kind?: unknown;
    prefix?: unknown;
    // The book the draft is already inside: the lookup card it came from
    // (`JHN`), so digits alone (`១`) can still be completed.
    book?: unknown;
    // A NAME may load the ~34MB dataset only when the person is clearly
    // naming one (a who/where question). A bare name waits for a lookup panel
    // to hold it; nothing is fetched behind their back.
    allowLoad?: unknown;
    limit?: unknown;
};

type SuggestRowType = {
    /** What the row says, and what choosing it puts in the box. */
    label: string;
    fill: string;
    /** The English name or reference beside it; '' for none. */
    detail: string;
};

type SuggestResultType = {
    kind: 'reference' | 'name';
    suggestions: SuggestRowType[];
};

const MAX_SUGGESTIONS = 300;

function toText(value: unknown, limit: number) {
    return typeof value === 'string'
        ? value.replaceAll(/\s+/g, ' ').trim().slice(0, limit)
        : '';
}

function toSuggestionLimit(value: unknown) {
    const number = Number(value);
    return Number.isInteger(number)
        ? Math.min(MAX_SUGGESTIONS, Math.max(1, number))
        : 100;
}

async function toLocaleText(bibleKey: string, value: number) {
    const text = await toLocaleNumBible(bibleKey, value).catch(() => {
        return null;
    });
    return typeof text === 'string' ? text : String(value);
}

/** The Bible the completion speaks: the one the Reader is reading. */
async function resolveSuggestBible() {
    const infoList = (await getAllLocalBibleInfoList()) ?? [];
    if (infoList.length === 0) {
        return null;
    }
    const langCode = getSelectedLookupLangCode();
    const own = infoList.find((info) => {
        return String(info.locale)
            .toLowerCase()
            .startsWith(langCode.toLowerCase());
    });
    const lookupKey = getLookupVerseBibleKey(langCode);
    const looked = infoList.find((info) => {
        return info.key === lookupKey;
    });
    // The lookup's own Bible is the one the Reader draws, so its names are
    // the ones on screen. Preferring "the first Bible in their language"
    // picked a DIFFERENT Khmer edition whose book list did not include
    // Genesis or Psalms: typing `លោកុប្បត្តិ` offered nothing while
    // `ម៉ាថាយ` offered chapters (seen live 2026-10-19). `own` stays as the
    // fallback for a lookup Bible in another language.
    const chosen = looked ?? own ?? infoList[0];
    const info = await getBibleInfo(chosen.key).catch(() => {
        return null;
    });
    const keyBookMap = info?.keyBookMap ?? {};
    const available = info?.booksAvailable ?? [];
    const englishMap = getModelKeyBookMap();
    const bookList: BibleBookOptionType[] = Object.keys(keyBookMap)
        .filter((bookKey) => {
            return available.length === 0 || available.includes(bookKey);
        })
        .map((bookKey) => {
            return {
                bookKey,
                name: keyBookMap[bookKey],
                englishName: englishMap[bookKey] ?? bookKey,
            };
        });
    return { key: chosen.key, bookList };
}

function findBook(bookList: BibleBookOptionType[], bookKeyOrName: string) {
    const wanted = toCompactBookName(bookKeyOrName);
    if (wanted.length === 0) {
        return null;
    }
    return (
        bookList.find((book) => {
            return book.bookKey.toLowerCase() === wanted;
        }) ??
        bookList.find((book) => {
            return (
                toCompactBookName(book.name) === wanted ||
                toCompactBookName(book.englishName) === wanted
            );
        }) ??
        null
    );
}

async function suggestReferences(
    request: AgentBibleSuggestRequestType,
    limit: number,
): Promise<SuggestResultType> {
    const bible = await resolveSuggestBible();
    if (bible === null) {
        return { kind: 'reference', suggestions: [] };
    }
    const { key: bibleKey, bookList } = bible;
    const prefix = readBibleReferencePrefix(toText(request.prefix, 80));
    const bookHint = toText(request.book, 12);
    const exactBook = findBook(bookList, prefix.bookPart);
    // A book still being typed: every name that starts with the letters. No
    // digits yet, and no exact book, so the next pick is the book itself.
    if (!prefix.hasDigits && prefix.bookPart.length > 0 && exactBook === null) {
        const matches = matchBibleBooks(prefix.bookPart, bookList);
        return {
            kind: 'reference',
            suggestions: matches.slice(0, limit).map((book) => {
                return {
                    label: book.name,
                    fill: `${book.name} `,
                    detail: book.englishName,
                };
            }),
        };
    }
    const book = exactBook ?? findBook(bookList, bookHint);
    if (book === null) {
        return { kind: 'reference', suggestions: [] };
    }
    const chapterPrefix =
        prefix.chapterDigits.length === 0
            ? null
            : await fromLocaleNumBible(bibleKey, prefix.chapterDigits).catch(
                  () => {
                      return null;
                  },
              );
    const chapterText = (chapter: number) => toLocaleText(bibleKey, chapter);
    if (!prefix.hasColon) {
        // The chapter: the list advances to its verses once picked (a colon
        // is what the reference writes between them).
        const max = getModelChapterCount(book.bookKey);
        const chapterList = listNumberPrefixMatches(
            chapterPrefix === null ? '' : String(chapterPrefix),
            max,
        );
        const suggestions = await Promise.all(
            chapterList.slice(0, limit).map(async (chapter) => {
                const localized = await chapterText(chapter);
                return {
                    label: `${book.name} ${localized}`,
                    fill: `${book.name} ${localized}:`,
                    detail: `${book.englishName} ${chapter}`,
                };
            }),
        );
        return { kind: 'reference', suggestions };
    }
    const chapter = chapterPrefix;
    if (chapter === null || chapter < 1) {
        return { kind: 'reference', suggestions: [] };
    }
    const verseCount = await getVersesCount(
        bibleKey,
        book.bookKey,
        chapter,
    ).catch(() => {
        return null;
    });
    if (verseCount === null || verseCount < 1) {
        return { kind: 'reference', suggestions: [] };
    }
    const versePrefix =
        prefix.verseDigits.length === 0
            ? null
            : await fromLocaleNumBible(bibleKey, prefix.verseDigits).catch(
                  () => {
                      return null;
                  },
              );
    const verseList = listNumberPrefixMatches(
        versePrefix === null ? '' : String(versePrefix),
        verseCount,
    );
    const localizedChapter = await chapterText(chapter);
    const suggestions = await Promise.all(
        verseList.slice(0, limit).map(async (verse) => {
            const localizedVerse = await toLocaleText(bibleKey, verse);
            return {
                label: `${book.name} ${localizedChapter}:${localizedVerse}`,
                fill: `${book.name} ${localizedChapter}:${localizedVerse}`,
                detail: `${book.englishName} ${chapter}:${verse}`,
            };
        }),
    );
    return { kind: 'reference', suggestions };
}

async function suggestNames(
    request: AgentBibleSuggestRequestType,
    limit: number,
): Promise<SuggestResultType> {
    const query = toReferenceDraft(toText(request.prefix, 40));
    if (query.length < 2) {
        return { kind: 'name', suggestions: [] };
    }
    const langCode = getSelectedLookupLangCode();
    const held = getHeldLookupData(langCode);
    const managers =
        held !== null
            ? held
            : request.allowLoad === true
              ? await acquireLookupData(langCode).catch(() => {
                    return null;
                })
              : null;
    if (managers === null) {
        return { kind: 'name', suggestions: [] };
    }
    try {
        const nameList = managers.namesLookupManager.searchNames(query, {
            limit,
        });
        const locationList = managers.locationsLookupManager.searchLocations(
            query,
            {
                limit,
            },
        );
        const toRow = (record: {
            name: string;
            kjvName?: string | null;
        }): SuggestRowType => {
            return {
                label: record.name,
                fill: record.name,
                detail: record.kjvName ?? '',
            };
        };
        return {
            kind: 'name',
            suggestions: [...nameList, ...locationList]
                .map(toRow)
                .slice(0, limit),
        };
    } finally {
        if (held === null) {
            releaseLookupData(langCode);
        }
    }
}

export async function handleAgentBibleSuggestRequest(
    request: AgentBibleSuggestRequestType,
) {
    const limit = toSuggestionLimit(request.limit);
    if (request.kind === 'name') {
        return await suggestNames(request, limit);
    }
    return await suggestReferences(request, limit);
}
