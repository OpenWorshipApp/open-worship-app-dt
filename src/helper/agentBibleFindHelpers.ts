/**
 * The app side of `owa_find_verse`: find a verse somebody half-remembers in
 * one of the Bibles installed here, read references in it, and open the one
 * they wanted in the Bible Lookup.
 *
 * Asked for with a picture of the Reader's **Find** panel (2026-10-16): _as a
 * user I want to consult with assistant in chatbot to find verses I forgot …
 * user can provide list of words or similar behavior of verse_, then _when
 * found verse then it should allow user to click to open in bible lookup_.
 * Bible Find matches the words as they are typed, in that order, so "enemies
 * love pray" finds nothing where the verse says "Love your enemies … pray";
 * the ranking here is `bibleVerseFindHelpers.ts`'s. A verse remembered by
 * what it MEANS is the model's half: it searches the words such a verse
 * would use, and reads the references it thinks of (`refs`) in THIS Bible,
 * so it never quotes a verse from memory in another translation.
 *
 * - Reached like every data tool (`owa-agent-data`, domain `bible-find`,
 *   imported lazily by `domHelpers.ts`), in the main window, whichever of
 *   its three pages it is on.
 * - It searches the table Bible Find builds and keeps for each Bible
 *   (`BibleFindController.getInstant`), so a Bible is indexed once -- the
 *   first search of one builds it, which is the wait Bible Find's own first
 *   search has -- and that instance is the one Bible Find keeps.
 * - It reads; only `open` changes anything, and only the Bible Lookup's
 *   passage -- never a screen. Opening is the lookup's own path
 *   (`applyTargetOrBibleKey`, as the names panel's **Open in bible lookup**
 *   does), so the lookup's history takes the passage it replaced.
 */
import BibleFindController from '../bible-find/BibleFindController';
import BibleItem from '../bible-list/BibleItem';
import LookupBibleItemController, {
    getCurrentLookupBibleItemController,
} from '../bible-reader/LookupBibleItemController';
import { getBibleLookupPopupOpener } from '../others/bibleLookupPopupOpener';
import {
    checkIsStopWord,
    getBookMarkerWords,
    getFindFrameWords,
    sanitizeFindingText,
    type LocaleType,
} from '../lang/langHelpers';
import { getAllLocalBibleInfoList } from './bible-helpers/bibleDownloadHelpers';
import { getBibleInfo } from './bible-helpers/bibleInfoHelpers';
import { getVersesCount } from './bible-helpers/bibleLogicHelpers2';
import { kjvBibleModelInfo } from './bible-helpers/bibleModelHelpers';
import { getBibleLocale } from './bible-helpers/bibleStyleHelpers';
import {
    DEFAULT_FIND_LIMIT,
    LONG_UNSPACED_TERM_LENGTH,
    NOT_IN_LANGUAGE_REASON,
    MAX_FIND_CANDIDATES,
    MAX_FIND_LIMIT,
    checkIsSpacedLocale,
    checkVerseFitsChapter,
    countWordHits,
    cutFoundText,
    cutNamedBooks,
    findNamedBooks,
    genChapterCountSql,
    genVerseFindSql,
    genVerseRangeReason,
    parseFoundVerseRow,
    parseRefParts,
    pickBibleKeyForBookName,
    pickRareTerms,
    readChapterCountRow,
    readVerseKey,
    resolveBookFilter,
    resolveBookKey,
    segmentByVocabulary,
    splitRefList,
    stripLeadingFrameWords,
    toBookCounts,
    toFindTermList,
    toEnglishStem,
    toNeededHits,
    toPassageRunName,
    toPassageRuns,
    toSingleVerseText,
    toTermWeight,
    toVerseKey,
    withExactCounts,
    type ChapterCountType,
} from './bibleVerseFindHelpers';
import { cloneJson } from './helpers';
import type { SQLiteDatabaseType } from '../server/appProvider';

export type AgentBibleFindRequestType = {
    bible?: unknown;
    words?: unknown;
    refs?: unknown;
    book?: unknown;
    open?: unknown;
    limit?: unknown;
    // Where a page of the verses found starts: a search's `next`.
    from?: unknown;
};

type RefusalType = { isError: true; reason: string };

function toReason(reason: string): RefusalType {
    return { isError: true, reason };
}

function toText(value: unknown, limit: number) {
    return typeof value === 'string'
        ? value.replaceAll(/\s+/g, ' ').trim().slice(0, limit)
        : '';
}

const englishBookNameMap = kjvBibleModelInfo.keyBookMap;

/** `Matthew 5:44`: the English name, which every model and every Bible reads. */
function toEnglishRef(
    bookKey: string,
    chapter: number,
    verseStart: number,
    verseEnd?: number | null,
) {
    const book = englishBookNameMap[bookKey] ?? bookKey;
    const end =
        typeof verseEnd === 'number' && verseEnd > verseStart
            ? `-${verseEnd}`
            : '';
    return `${book} ${chapter}:${verseStart}${end}`;
}

/** The Bible the Bible Lookup is on -- what Bible Find opens on too. */
function getLookupBibleKey(): string | null {
    try {
        const live = getCurrentLookupBibleItemController();
        return (
            live?.selectedBibleItem.bibleKey ??
            new LookupBibleItemController().selectedBibleItem.bibleKey
        );
    } catch {
        return null;
    }
}

const WHOLE_BIBLE_BOOK_COUNT = 66;

// A Bible that holds only some books says how many (`books`), so the one
// chosen to quote from can be a whole one (2026-10-29): the first Khmer
// Bible here is the 2019 New Testament, and a question under Noah's card
// asked in Khmer read Genesis 6:15 from it, found nothing and ran out of
// rounds. A whole Bible says nothing, so the list grows by a word or two.
async function listInstalledBibles() {
    const infoList = (await getAllLocalBibleInfoList()) ?? [];
    return infoList.map((info) => {
        // Both lists hand over the whole info, which the minimal type does
        // not promise: read as maybe there.
        const { booksAvailable } = info as { booksAvailable?: unknown };
        const bookCount = Array.isArray(booksAvailable)
            ? booksAvailable.length
            : 0;
        return {
            key: info.key,
            title: info.title,
            ...(bookCount > 0 && bookCount < WHOLE_BIBLE_BOOK_COUNT
                ? { books: bookCount }
                : {}),
        };
    });
}

async function resolveBible(
    asked: string,
): Promise<{ key: string; title: string } | RefusalType> {
    const bibles = await listInstalledBibles();
    if (bibles.length === 0) {
        return toReason(
            'No Bible is installed on this computer, so there is nothing ' +
                'to search. A Bible is added in Settings, under the Bible tab.',
        );
    }
    const wanted = asked.length > 0 ? asked : getLookupBibleKey();
    const found =
        bibles.find((bible) => {
            return bible.key.toLowerCase() === (wanted ?? '').toLowerCase();
        }) ?? (asked.length > 0 ? undefined : bibles[0]);
    if (found === undefined) {
        return toReason(
            `No Bible called "${asked}" is installed. Installed: ` +
                `${bibles.map((bible) => bible.key).join(', ')}.`,
        );
    }
    return found;
}

async function toNameMapList(bibleKey: string) {
    const info = await getBibleInfo(bibleKey);
    const mapList: { [bookKey: string]: string }[] = [
        info?.keyBookMap ?? {},
        englishBookNameMap,
    ];
    // A reference written in another installed Bible's language (`លោកុប្បត្តិ
    // 4:1` with the KJV chosen) names the same book: its key is read here
    // and the verse is quoted from the chosen Bible (2026-10-18).
    try {
        const infoList = (await getAllLocalBibleInfoList()) ?? [];
        for (const one of infoList.slice(0, 4)) {
            if (one.key === bibleKey) {
                continue;
            }
            const other = await getBibleInfo(one.key).catch(() => {
                return null;
            });
            if (other?.keyBookMap !== undefined) {
                mapList.push(other.keyBookMap);
            }
        }
    } catch (_error) {
        // The chosen Bible's own names and the English ones still read.
    }
    return mapList;
}

/**
 * The installed Bible that names the book the way it was written, for a
 * reference with no `bible` asked: a Khmer reference is quoted from the
 * Khmer Bible, not from the KJV the lookup happened to be on (2026-10-18).
 * Exported for `owa_lookup_record`'s passage reader.
 */
export async function pickBibleForRefs(bibleKey: string, refs: string) {
    const firstRef = splitRefList(refs)[0];
    if (firstRef === undefined) {
        return bibleKey;
    }
    const parts = parseRefParts(firstRef);
    if (parts === null) {
        return bibleKey;
    }
    const infoList = (await getAllLocalBibleInfoList()) ?? [];
    const withMaps = await Promise.all(
        infoList.map(async (one) => {
            const info = await getBibleInfo(one.key).catch(() => {
                return null;
            });
            return { key: one.key, keyBookMap: info?.keyBookMap };
        }),
    );
    return pickBibleKeyForBookName(parts.book, withMaps, bibleKey);
}

const NO_TERMS = { noTerms: true } as const;

/**
 * Khmer, Thai and their neighbours are typed with no space between words,
 * so a remembered phrase arrives as one run of letters and matches nothing
 * (seen 2026-10-16, the user's own: "ព្រះយេស៊ូសួរពេត្រុសច្រើនដង"). It is cut
 * into the Bible's OWN words -- the vocabulary Bible Find keeps for its
 * suggestions -- read for this one search and let go after it.
 */
function splitByBibleWords(
    database: SQLiteDatabaseType,
    terms: string[],
    locale: LocaleType,
) {
    if (
        !terms.some((term) => {
            return term.length >= LONG_UNSPACED_TERM_LENGTH;
        })
    ) {
        return terms;
    }
    const vocabulary = new Set(
        database.getAll('SELECT text FROM spell;').map((row) => {
            return String(row.text).replaceAll(' ', '');
        }),
    );
    const pieces = terms.flatMap((term) => {
        return term.length >= LONG_UNSPACED_TERM_LENGTH && !vocabulary.has(term)
            ? segmentByVocabulary(term, vocabulary)
            : [term];
    });
    return toFindTermList(pieces, (word) => {
        return checkIsStopWord(locale, word);
    });
}

/**
 * The words to search a Bible of this language for: sanitized the way its
 * table was, each once, stop words out, and English ones cut back to what
 * their forms share ("enemy" finds "enemies"), matched as the start of a
 * word in `findVerses`. None for words in another script.
 */
function toTermsOfSanitized(locale: LocaleType, sanitized: string) {
    const isEnglish = locale.toLowerCase().startsWith('en');
    return Array.from(
        new Set(
            toFindTermList(sanitized.split(' '), (word) => {
                return checkIsStopWord(locale, word);
            }).map((term) => {
                return isEnglish ? toEnglishStem(term) : term;
            }),
        ),
    );
}

async function toSearchTerms(locale: LocaleType, words: string) {
    const sanitized = (await sanitizeFindingText(locale, words)) ?? words;
    return toTermsOfSanitized(locale, sanitized);
}

// In how many verses a word is, run together the way the table keeps them.
function countVersesHolding(database: SQLiteDatabaseType, word: string) {
    const term = word.replaceAll(/['"%_\\;\s]/g, '');
    if (term.length === 0) {
        return 0;
    }
    const sql = genVerseFindSql({
        terms: [term],
        weights: [],
        bookKeys: [],
        need: 1,
        limit: 1,
    });
    return Number(database.getAll(sql.termCountSql(term))[0]?.count ?? 0);
}

/**
 * A book NAMED in what they remember (2026-10-22, the user's own:
 * `ស្វែងរកក្នុងគម្ពីរលោកប្បត្តិណូអេលែងព្រាប` -- search in the book of Genesis,
 * misspelt, Noah released the dove -- whose search was "search", "in",
 * "book" and two scraps of the misspelt name, and found Isaiah 34:16's
 * "search in the book of the LORD"). A name is the book to search when a
 * word like "in" says so, or when this Bible's verses never use it (no verse
 * says "Genesis"); a name verses DO use is a word of the verse ("Daniel in
 * the lions' den"). One letter off only where the misspelling itself is in
 * no verse. Null when no book was named, or when nothing would be left to
 * search for.
 */
function readNamedBooks(
    database: SQLiteDatabaseType,
    text: string,
    nameMapList: { [bookKey: string]: string }[],
    locale: LocaleType,
    isSpaced: boolean,
) {
    const taken = findNamedBooks(
        text,
        nameMapList,
        getBookMarkerWords(locale),
        isSpaced,
    ).filter((named) => {
        if (named.isNear && countVersesHolding(database, named.typed) > 0) {
            return false;
        }
        return (
            named.isAfterMarker ||
            countVersesHolding(database, named.name.toLowerCase()) === 0
        );
    });
    if (taken.length === 0) {
        return null;
    }
    const rest = cutNamedBooks(text, taken);
    if (rest.length < 2) {
        return null;
    }
    return {
        rest,
        bookKeys: Array.from(
            new Set(
                taken.map((named) => {
                    return named.bookKey;
                }),
            ),
        ),
        typed: taken.map((named) => {
            return named.typed;
        }),
    };
}

/**
 * Where the verses found gather -- the passages a story is told in, and the
 * books -- named in English for every tool, and keyed for `open`.
 */
function toWhereFound(
    chapters: ChapterCountType[],
    total: number,
    shownCount: number,
) {
    const passages = toPassageRuns(chapters).map((run) => {
        return {
            ref: toPassageRunName(
                englishBookNameMap[run.bookKey] ?? run.bookKey,
                run,
            ),
            key: `${run.bookKey} ${run.densest}`,
            verses: run.verses,
        };
    });
    return {
        ...(passages.length > 0 ? { passages } : {}),
        // Every book they are in, when the page does not show them all.
        ...(total > shownCount
            ? {
                  byBook: toBookCounts(chapters).map((one) => {
                      return {
                          book: englishBookNameMap[one.bookKey] ?? one.bookKey,
                          key: one.bookKey,
                          verses: one.verses,
                      };
                  }),
              }
            : {}),
    };
}

async function findVerses(
    bibleKey: string,
    words: string,
    book: string,
    limit: number,
    from = 0,
) {
    const controller = await BibleFindController.getInstant(bibleKey);
    if (controller === null) {
        return toReason(
            `The Bible ${bibleKey} could not be opened for searching. Open ` +
                'it once in Bible Find, or pick another Bible.',
        );
    }
    const nameMapList = await toNameMapList(bibleKey);
    const filter =
        book.length > 0
            ? resolveBookFilter(book, nameMapList)
            : { bookKeys: [], unknown: [] };
    if (book.length > 0 && filter.bookKeys.length === 0) {
        return toReason(
            `"${book}" is not a book of the Bible. Name it in full -- ` +
                '"Psalms", "1 John" -- or leave book out.',
        );
    }
    const locale = await getBibleLocale(bibleKey);
    const isSpaced = checkIsSpacedLocale(locale);
    const database = controller.databaseFindHandler?.database ?? null;
    let searchText = (await sanitizeFindingText(locale, words)) ?? words;
    if (toTermsOfSanitized(locale, searchText).length === 0) {
        // Not one word in this Bible's script: `findVersesAcross` looks for
        // a Bible that reads them.
        return NO_TERMS;
    }
    let bookKeys = filter.bookKeys;
    let readAsBook: string[] = [];
    if (book.length === 0 && database !== null) {
        const named = readNamedBooks(
            database,
            searchText,
            nameMapList,
            locale,
            isSpaced,
        );
        if (named !== null) {
            searchText = named.rest;
            bookKeys = named.bookKeys;
            readAsBook = named.typed;
        }
    }
    searchText = stripLeadingFrameWords(
        searchText,
        getFindFrameWords(locale),
        (word) => {
            return checkIsStopWord(locale, word);
        },
        isSpaced,
    );
    let terms = toTermsOfSanitized(locale, searchText);
    if (terms.length === 0) {
        return NO_TERMS;
    }
    if (!isSpaced && database !== null) {
        terms = splitByBibleWords(database, terms, locale);
    }
    const base = {
        bible: bibleKey,
        words: terms,
        ...(bookKeys.length > 0
            ? {
                  books: bookKeys.map((key) => {
                      return englishBookNameMap[key] ?? key;
                  }),
              }
            : {}),
        ...(readAsBook.length > 0 ? { readAsBook } : {}),
        ...(filter.unknown.length > 0 ? { notBooks: filter.unknown } : {}),
    };
    if (database === null) {
        // A Bible downloaded in the old format is searched by Bible Find's
        // online service, which reads the words as one phrase, in order.
        const online = controller.onlineFindHandler;
        if (online === null) {
            return toReason(`The Bible ${bibleKey} cannot be searched.`);
        }
        const result = await online.doFinding({
            text: terms.join(' '),
            bookKeys,
            fromLineNumber: from,
            toLineNumber: from + limit - 1,
        });
        const verses = (result?.content ?? [])
            .map((item) => parseFoundVerseRow(item.text))
            .filter((row) => row !== null)
            .map((row) => {
                return {
                    key: toVerseKey(row.bookKey, row.chapter, row.verse),
                    ref: toEnglishRef(row.bookKey, row.chapter, row.verse),
                    text: cutFoundText(row.text),
                };
            });
        return {
            ...base,
            total: result?.maxLineNumber ?? verses.length,
            verses,
            note:
                'This Bible is searched online, as one phrase in the order ' +
                'given: try fewer words, or other ones, if nothing came back.',
        };
    }
    const verseCount = Number(
        database.getAll('SELECT COUNT(*) AS count FROM verses;')[0]?.count ?? 0,
    );
    const counter = genVerseFindSql({
        terms,
        weights: [],
        bookKeys,
        need: 1,
        limit,
    });
    const foundCountList = terms.map((term) => {
        return Number(
            database.getAll(counter.termCountSql(term))[0]?.count ?? 0,
        );
    });
    const foundTerms = terms.filter((_term, index) => {
        return foundCountList[index] > 0;
    });
    const missing = terms.filter((_term, index) => {
        return foundCountList[index] === 0;
    });
    if (foundTerms.length === 0) {
        return {
            ...base,
            total: 0,
            verses: [],
            notInBible: missing,
            note:
                'None of these words is in this Bible. Try other forms of ' +
                'them (forgive / forgave / forgiveness) or other words for ' +
                'the same thing.',
        };
    }
    const weights = foundTerms.map((term) => {
        return toTermWeight(verseCount, foundCountList[terms.indexOf(term)]);
    });
    const need = toNeededHits(foundTerms.length);
    const sql = genVerseFindSql({
        terms: foundTerms,
        weights,
        bookKeys,
        need,
        // Every language takes as many as may be ranked: the verses where
        // the words gather go first among equals, below.
        limit: MAX_FIND_CANDIDATES,
    });
    const candidates = database
        .getAll(sql.selectSql)
        .map((item) => {
            const row = parseFoundVerseRow(String(item.text));
            return row === null
                ? null
                : {
                      row,
                      hits: Number(item.hits),
                      score: Number(item.score),
                      order: Number(item.r),
                  };
        })
        .filter((one) => one !== null);
    let ranked = candidates;
    // Every verse found, counted by chapter: the total, and where they
    // gather -- one scan, where the total alone was one before.
    let chapters = database
        .getAll(
            genChapterCountSql({
                terms: foundTerms,
                weights,
                rareTerms: pickRareTerms(
                    foundTerms,
                    foundTerms.map((term) => {
                        return foundCountList[terms.indexOf(term)];
                    }),
                    verseCount,
                ),
                bookKeys,
                need,
                isSpaced,
            }),
        )
        .map(readChapterCountRow)
        .filter((one) => {
            return one !== null;
        });
    let total = chapters.reduce((sum, one) => {
        return sum + one.count;
    }, 0);
    if (isSpaced) {
        // Read word by word: the table's run-together match counts words
        // that only meet across a space.
        const rescored = [];
        for (const candidate of candidates) {
            const verseWords = (
                (await sanitizeFindingText(locale, candidate.row.text)) ??
                candidate.row.text
            ).split(' ');
            const matched = countWordHits(verseWords, foundTerms);
            const hits = matched.filter(Boolean).length;
            if (hits < need) {
                continue;
            }
            const score = matched.reduce((sum, isMatched, index) => {
                return isMatched ? sum + weights[index] : sum;
            }, 0);
            rescored.push({ ...candidate, hits, score });
        }
        rescored.sort((one, other) => {
            return (
                other.hits - one.hits ||
                other.score - one.score ||
                one.order - other.order
            );
        });
        ranked = rescored;
        // Exact while the table handed over fewer than it may; past that
        // the run-together count is the nearest there is.
        if (candidates.length < MAX_FIND_CANDIDATES) {
            total = rescored.length;
            chapters = withExactCounts(
                chapters,
                rescored.map(({ row }) => {
                    return row;
                }),
            );
        }
    }
    // Among verses holding as many of the words, as strongly, the ones in
    // the chapters where the words GATHER come first, then the Bible's own
    // order (2026-10-22, EC-391): "shepherd" was every verse alike and
    // listed from Genesis 46, so an assistant quoted John 10:11 from memory
    // -- in words of its own -- rather than from a list that had none of
    // the verses it knew.
    const densityMap = new Map<string, number>();
    for (const one of chapters) {
        densityMap.set(`${one.bookKey}.${one.chapter}`, one.count);
    }
    const toDensity = (row: { bookKey: string; chapter: number }) => {
        return densityMap.get(`${row.bookKey}.${row.chapter}`) ?? 0;
    };
    ranked = [...ranked].sort((one, other) => {
        return (
            other.hits - one.hits ||
            other.score - one.score ||
            toDensity(other.row) - toDensity(one.row) ||
            one.order - other.order
        );
    });
    const verses = ranked.slice(from, from + limit).map(({ row, hits }) => {
        return {
            key: toVerseKey(row.bookKey, row.chapter, row.verse),
            ref: toEnglishRef(row.bookKey, row.chapter, row.verse),
            text: cutFoundText(row.text),
            hits,
        };
    });
    // A page further on: as far as the verses the table hands over go.
    const next = from + verses.length;
    const canPage =
        verses.length > 0 && next < total && next < MAX_FIND_CANDIDATES;
    return {
        ...base,
        of: foundTerms.length,
        total,
        ...(from > 0 ? { from } : {}),
        verses,
        ...(canPage ? { next } : {}),
        ...toWhereFound(chapters, total, verses.length),
        ...(missing.length > 0 ? { notInBible: missing } : {}),
        ...(verses.length === 0
            ? {
                  note:
                      'No verse has these words together. Try fewer words, ' +
                      'or other forms of them.',
              }
            : isSpaced
              ? {}
              : {
                    // Seen live 2026-10-16 in the Khmer Bible: "ឥន្ទ្រី"
                    // (eagle) found Hebrews 5:14 by "ឥន្ទ្រីយ" (senses).
                    note:
                        'This script has no spaces, so a word was matched ' +
                        'as letters and may be part of a longer word: check ' +
                        'each verse says what they remember.',
                }),
    };
}

/** The installed Bibles, but `exceptKey`, each with its language. */
async function listBiblesWithLocale(exceptKey = '') {
    const bibles = (await listInstalledBibles()).filter((bible) => {
        return bible.key !== exceptKey;
    });
    return await Promise.all(
        bibles.map(async (bible) => {
            return { ...bible, locale: await getBibleLocale(bible.key) };
        }),
    );
}

const ENGLISH_SOURCE_BIBLE_KEY = 'KJV';

/** KJV 0, another English Bible 1, any other 2. */
function toSearchRank(bible: { key: string; locale: string }) {
    if (bible.key.toUpperCase() === ENGLISH_SOURCE_BIBLE_KEY) {
        return 0;
    }
    return bible.locale.toLowerCase().startsWith('en') ? 1 : 2;
}

/**
 * The English Bible installed -- the KJV first -- for a model to search the
 * words it has put into English, then read what that finds here with
 * `refs`. Null when the Bible searched is English already, or none is.
 */
async function findEnglishBible(bibleKey: string) {
    if ((await getBibleLocale(bibleKey)).toLowerCase().startsWith('en')) {
        return null;
    }
    const englishList = (await listBiblesWithLocale(bibleKey)).filter(
        (bible) => {
            return bible.locale.toLowerCase().startsWith('en');
        },
    );
    return (
        (
            englishList.find((bible) => {
                return bible.key.toUpperCase() === ENGLISH_SOURCE_BIBLE_KEY;
            }) ?? englishList[0]
        )?.key ?? null
    );
}

/**
 * A search that does not stop at the Bible's own language (2026-10-16, the
 * user's ask: _if user input local text (non-english) then try translate to
 * english … then lookup in KJV, plus try in the input language as well. to
 * make maximum result_). Words in another script than this Bible's --
 * English under the Khmer Bible, Khmer under the KJV -- are searched in an
 * installed Bible whose language reads them, and every verse found is then
 * quoted from THIS one, so the person reads it in the Bible they chose.
 * Translating is the model's half: a result from a Bible not in English
 * names the English one installed, to search the words put into English.
 */
async function findVersesAcross(
    bibleKey: string,
    words: string,
    book: string,
    limit: number,
    from: number,
) {
    const result = await findVerses(bibleKey, words, book, limit, from);
    if (!('noTerms' in result)) {
        if ('isError' in result) {
            return result;
        }
        const englishBible = await findEnglishBible(bibleKey);
        return englishBible === null ? result : { ...result, englishBible };
    }
    // The KJV first, the user's word: it is the English source every other
    // Bible here is read against -- then any other English one, then the
    // rest.
    const otherList = (await listBiblesWithLocale(bibleKey)).sort(
        (one, other) => {
            return toSearchRank(one) - toSearchRank(other);
        },
    );
    for (const other of otherList) {
        // Asked of the language first, which is cheap: searching builds a
        // Bible's index the first time, which is not.
        if ((await toSearchTerms(other.locale, words)).length === 0) {
            continue;
        }
        const found = await findVerses(other.key, words, book, limit, from);
        if ('noTerms' in found || 'isError' in found) {
            continue;
        }
        const quoted =
            found.verses.length === 0
                ? null
                : await readRefs(
                      bibleKey,
                      found.verses
                          .map((verse) => {
                              return verse.key;
                          })
                          .join('; '),
                  );
        const verses = found.verses.map((verse) => {
            const here = quoted?.verses.find((one) => {
                return one.key === verse.key;
            });
            // A verse this Bible numbers otherwise keeps the other one's
            // words, and says whose they are.
            return here === undefined
                ? { ...verse, in: other.key }
                : { ...verse, text: here.text };
        });
        return {
            ...found,
            bible: bibleKey,
            searchedIn: other.key,
            verses,
            note:
                `These words are not in ${bibleKey}’s language, so they ` +
                `were searched in ${other.key} and each verse is quoted ` +
                `from ${bibleKey}. Put them into ${bibleKey}’s language and ` +
                'search again for more.',
        };
    }
    // Seen live 2026-10-16: English words asked of the Khmer Bible, round
    // after round, by a model that never thought to translate.
    return toReason(
        `${NOT_IN_LANGUAGE_REASON} ${bibleKey} is written in ` +
            `"${await getBibleLocale(bibleKey)}": put the words they ` +
            'remember into that language, or read the verses you think of ' +
            'with refs, which work in any language.',
    );
}

async function readRefs(bibleKey: string, refs: string) {
    const nameMapList = await toNameMapList(bibleKey);
    const verses: { key: string; ref: string; text: string }[] = [];
    const unread: string[] = [];
    // A reference past the end of its chapter is not a verse: the renderer
    // would answer it with `??`, its missing-verse placeholder, and that was
    // quoted to the model as scripture (2026-10-18).
    const notFound: { ref: string; reason: string }[] = [];
    for (const ref of splitRefList(refs)) {
        const parts = parseRefParts(ref);
        const bookKey =
            parts === null ? null : resolveBookKey(parts.book, nameMapList);
        if (parts !== null && bookKey !== null && parts.verseStart !== null) {
            const verseCount = await getVersesCount(
                bibleKey,
                bookKey,
                parts.chapter,
            ).catch(() => {
                return null;
            });
            if (
                !checkVerseFitsChapter(
                    verseCount,
                    parts.verseStart,
                    parts.verseEnd,
                )
            ) {
                unread.push(ref);
                notFound.push({
                    ref,
                    reason: genVerseRangeReason(
                        englishBookNameMap[bookKey] ?? bookKey,
                        parts.chapter,
                        verseCount as number,
                    ),
                });
                continue;
            }
        }
        let bibleItem: BibleItem | null;
        let text = '';
        try {
            bibleItem =
                parts !== null && bookKey !== null
                    ? await BibleItem.fromVerseKey(
                          bibleKey,
                          parts.verseStart === null
                              ? `${bookKey} ${parts.chapter}:1-`
                              : toVerseKey(
                                    bookKey,
                                    parts.chapter,
                                    parts.verseStart,
                                    parts.verseEnd,
                                ),
                      )
                    : // The Bible's own way of writing it, which the app's
                      // parser reads in every language it knows.
                      await BibleItem.fromTitleText(bibleKey, ref);
            // One chapter at most: the text is cut to a line below, and a
            // range over chapters would be read to be thrown away.
            text = bibleItem === null ? '' : await bibleItem.toText(1);
        } catch {
            bibleItem = null;
        }
        if (
            bibleItem === null ||
            text.trim().length === 0 ||
            /^[?\s]+$/u.test(text.trim())
        ) {
            unread.push(ref);
            continue;
        }
        const { target } = bibleItem;
        verses.push({
            key: toVerseKey(
                target.bookKey,
                target.chapter,
                target.verseStart,
                target.verseEnd,
            ),
            ref: toEnglishRef(
                target.bookKey,
                target.chapter,
                target.verseStart,
                target.verseEnd,
            ),
            text: cutFoundText(
                target.verseEnd > target.verseStart
                    ? text
                    : toSingleVerseText(text),
            ),
        });
    }
    return {
        bible: bibleKey,
        verses,
        ...(unread.length > 0
            ? {
                  unread,
                  note:
                      'Write a reference as book, chapter and verse -- ' +
                      '"Matthew 6:34", "1 John 4:18" -- or a whole chapter ' +
                      'as "Psalm 23".',
              }
            : {}),
        ...(notFound.length > 0 ? { notFound } : {}),
    };
}

/**
 * A verse to open, by the key a result carries (`JHN 3:16`) or written the
 * way a person or a model writes it (`John 3:16`, `Psalm 23:1-6`).
 */
async function readOpenParts(bibleKey: string, key: string) {
    const asKey = readVerseKey(key);
    if (asKey !== null) {
        return asKey;
    }
    const parts = parseRefParts(key);
    if (parts === null) {
        return null;
    }
    const bookKey = resolveBookKey(parts.book, await toNameMapList(bibleKey));
    if (bookKey === null) {
        return null;
    }
    if (parts.verseStart === null) {
        // A whole chapter -- a passage a search found, `GEN 7` -- opens as
        // every verse of it (2026-10-22).
        const verseCount = await getVersesCount(
            bibleKey,
            bookKey,
            parts.chapter,
        ).catch(() => {
            return null;
        });
        return verseCount === null || verseCount <= 0
            ? null
            : {
                  bookKey,
                  chapter: parts.chapter,
                  verseStart: 1,
                  verseEnd: verseCount,
              };
    }
    return {
        bookKey,
        chapter: parts.chapter,
        verseStart: parts.verseStart,
        verseEnd: parts.verseEnd ?? parts.verseStart,
    };
}

async function openInLookup(bibleKey: string, key: string) {
    const parts = await readOpenParts(bibleKey, key);
    if (parts !== null && parts.verseStart !== null) {
        const verseCount = await getVersesCount(
            bibleKey,
            parts.bookKey,
            parts.chapter,
        ).catch(() => {
            return null;
        });
        if (
            !checkVerseFitsChapter(verseCount, parts.verseStart, parts.verseEnd)
        ) {
            return toReason(
                genVerseRangeReason(
                    englishBookNameMap[parts.bookKey] ?? parts.bookKey,
                    parts.chapter,
                    verseCount as number,
                ),
            );
        }
    }
    const bibleItem =
        parts === null
            ? null
            : await BibleItem.fromVerseKey(
                  bibleKey,
                  toVerseKey(
                      parts.bookKey,
                      parts.chapter,
                      parts.verseStart,
                      parts.verseEnd,
                  ),
              ).catch(() => null);
    if (parts === null || bibleItem === null) {
        return toReason(
            `"${key}" is not a verse of ${bibleKey}. Open a verse by the ` +
                'key a search answered with, such as "JHN 3:16", or as ' +
                '"John 3:16".',
        );
    }
    const target = { bibleKey, target: cloneJson(bibleItem.target) };
    const live = getCurrentLookupBibleItemController();
    if (live !== null) {
        live.applyTargetOrBibleKey(live.selectedBibleItem, target);
    } else {
        // The Presenter and the editor keep the lookup in a popup that is
        // shut: the passage is set the way the Bibles list's own Lookup
        // sets it, then the popup is opened on it.
        const openPopup = getBibleLookupPopupOpener();
        if (openPopup === null) {
            return toReason(
                'This window has no Bible Lookup to open the verse in.',
            );
        }
        const controller = new LookupBibleItemController();
        controller.applyTargetOrBibleKey(controller.selectedBibleItem, target);
        openPopup();
    }
    const title = await toBibleTitle(bibleKey, bibleItem);
    return {
        opened: toEnglishRef(
            parts.bookKey,
            parts.chapter,
            parts.verseStart,
            parts.verseEnd,
        ),
        ...(title === null ? {} : { title }),
        bible: bibleKey,
        note: 'It is in the Bible Lookup now; nothing went on a screen.',
    };
}

// The reference as the Bible itself writes it -- its book's own name and its
// own digits, `ម៉ាថាយ ៥:៤៤` -- for a Bible not in English (2026-10-17): the
// help window draws a found verse's button and lines with it for a person
// who reads no English, and the model names the verse by it. `ref` stays
// English, the one every tool reads. Null for an English Bible (the two
// would be the same words) and when the title cannot be had.
async function toBibleTitle(bibleKey: string, bibleItem: BibleItem) {
    try {
        const locale = String(await getBibleLocale(bibleKey)).toLowerCase();
        if (locale.startsWith('en')) {
            return null;
        }
        const title = String(await bibleItem.toTitle()).trim();
        return title.length === 0 ? null : title;
    } catch {
        return null;
    }
}

// A passage's `Genesis 7-9` as the Bible writes it -- `លោកុប្បត្តិ ៧-៩` --
// off its book's own name and its digits, with the chapter its key opens
// (`keyTitle`, `លោកុប្បត្តិ ៨`), and each book a count is of by its name.
async function withPassageTitles<
    T extends {
        passages?: { ref: string; key: string }[];
        byBook?: { key: string }[];
    },
>(bibleKey: string, result: T): Promise<T> {
    const hasPassages =
        Array.isArray(result?.passages) && result.passages.length > 0;
    const hasBooks = Array.isArray(result?.byBook) && result.byBook.length > 0;
    if (!hasPassages && !hasBooks) {
        return result;
    }
    const info = await getBibleInfo(bibleKey).catch(() => {
        return null;
    });
    const numbersMap: { [digit: string]: string } = info?.numbersMap ?? {};
    const toDigits = (text: string) => {
        return text.replaceAll(/\d/g, (digit) => {
            return numbersMap[digit] ?? digit;
        });
    };
    const passages = (result.passages ?? []).map((passage) => {
        const bookName = info?.keyBookMap?.[passage.key.slice(0, 3)];
        const chapters = /(\d+(?:-\d+)?)$/.exec(passage.ref)?.[1];
        const keyChapter = /(\d+)$/.exec(passage.key)?.[1];
        if (bookName === undefined || chapters === undefined) {
            return passage;
        }
        return {
            ...passage,
            title: `${bookName} ${toDigits(chapters)}`,
            ...(keyChapter === undefined
                ? {}
                : { keyTitle: `${bookName} ${toDigits(keyChapter)}` }),
        };
    });
    const byBook = (result.byBook ?? []).map((one) => {
        const bookName = info?.keyBookMap?.[one.key];
        return bookName === undefined ? one : { ...one, title: bookName };
    });
    return {
        ...result,
        ...(hasPassages ? { passages } : {}),
        ...(hasBooks ? { byBook } : {}),
    };
}

async function withBibleTitles<
    T extends {
        bible?: unknown;
        verses?: { key: string }[];
        passages?: { ref: string; key: string }[];
        byBook?: { key: string }[];
    },
>(bibleKey: string, result: T): Promise<T> {
    if (!Array.isArray(result?.verses) || result.verses.length === 0) {
        return result;
    }
    const locale = String(await getBibleLocale(bibleKey)).toLowerCase();
    if (locale.startsWith('en')) {
        return result;
    }
    const titled = await withPassageTitles(bibleKey, result);
    const verses = await Promise.all(
        result.verses.map(async (verse) => {
            const bibleItem = await BibleItem.fromVerseKey(
                bibleKey,
                verse.key,
            ).catch(() => {
                return null;
            });
            const title =
                bibleItem === null
                    ? null
                    : await toBibleTitle(bibleKey, bibleItem);
            return title === null ? verse : { ...verse, title };
        }),
    );
    return { ...titled, verses };
}

export async function handleAgentBibleFindRequest(
    request: AgentBibleFindRequestType,
) {
    const askedBible = toText(request.bible, 40);
    const words = toText(request.words, 300);
    const refs = toText(request.refs, 400);
    const book = toText(request.book, 120);
    const open = toText(request.open, 20);
    const askedLimit = Number(request.limit);
    const limit = Number.isFinite(askedLimit)
        ? Math.min(MAX_FIND_LIMIT, Math.max(1, Math.floor(askedLimit)))
        : DEFAULT_FIND_LIMIT;
    const askedFrom = Number(request.from);
    const from = Number.isFinite(askedFrom)
        ? Math.min(MAX_FIND_CANDIDATES, Math.max(0, Math.floor(askedFrom)))
        : 0;
    let bible = await resolveBible(askedBible);
    if ('isError' in bible) {
        return bible;
    }
    // No Bible asked: read the reference in the one that NAMES the book the
    // way it was written, so a Khmer reference is quoted from the Khmer
    // Bible rather than from the KJV the lookup happened to be on.
    if (askedBible.length === 0 && (open.length > 0 || refs.length > 0)) {
        try {
            const pickedKey = await pickBibleForRefs(
                bible.key,
                open.length > 0 ? open : refs,
            );
            if (pickedKey !== bible.key) {
                const picked = await resolveBible(pickedKey);
                if (!('isError' in picked)) {
                    bible = picked;
                }
            }
        } catch (_error) {
            // The chosen Bible still reads what it can.
        }
    }
    if (open.length > 0) {
        return await openInLookup(bible.key, open);
    }
    // Every verse quoted is quoted from `bible` (a search crossing to the
    // KJV reads its verses back from it), so its titles are that Bible's.
    if (refs.length > 0) {
        return await withBibleTitles(
            bible.key,
            await readRefs(bible.key, refs),
        );
    }
    if (words.length > 0) {
        const found = await findVersesAcross(
            bible.key,
            words,
            book,
            limit,
            from,
        );
        return 'isError' in found
            ? found
            : await withBibleTitles(bible.key, found);
    }
    // Nothing to look for: which Bibles there are, in which language, and
    // which one a search with no `bible` goes to.
    return {
        bible: bible.key,
        bibles: await listBiblesWithLocale(),
        note: 'Give words to search for, or refs to read.',
    };
}
