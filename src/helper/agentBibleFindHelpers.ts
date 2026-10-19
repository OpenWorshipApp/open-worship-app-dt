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
    genVerseFindSql,
    genVerseRangeReason,
    parseFoundVerseRow,
    parseRefParts,
    pickBibleKeyForBookName,
    readVerseKey,
    resolveBookFilter,
    resolveBookKey,
    segmentByVocabulary,
    splitRefList,
    toFindTermList,
    toEnglishStem,
    toNeededHits,
    toSingleVerseText,
    toTermWeight,
    toVerseKey,
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

async function listInstalledBibles() {
    const infoList = (await getAllLocalBibleInfoList()) ?? [];
    return infoList.map((info) => {
        return { key: info.key, title: info.title };
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
async function toSearchTerms(locale: LocaleType, words: string) {
    const sanitized = (await sanitizeFindingText(locale, words)) ?? words;
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

async function findVerses(
    bibleKey: string,
    words: string,
    book: string,
    limit: number,
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
    let terms = await toSearchTerms(locale, words);
    if (terms.length === 0) {
        // Not one word in this Bible's script: `findVersesAcross` looks for
        // a Bible that reads them.
        return NO_TERMS;
    }
    if (!isSpaced && database !== null) {
        terms = splitByBibleWords(database, terms, locale);
    }
    const base = {
        bible: bibleKey,
        words: terms,
        ...(filter.bookKeys.length > 0
            ? {
                  books: filter.bookKeys.map((key) => {
                      return englishBookNameMap[key] ?? key;
                  }),
              }
            : {}),
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
            bookKeys: filter.bookKeys,
            fromLineNumber: 0,
            toLineNumber: limit - 1,
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
        bookKeys: filter.bookKeys,
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
        bookKeys: filter.bookKeys,
        need,
        limit: isSpaced ? MAX_FIND_CANDIDATES : limit,
    });
    const candidates = database
        .getAll(sql.selectSql)
        .map((item) => {
            const row = parseFoundVerseRow(String(item.text));
            return row === null
                ? null
                : { row, hits: Number(item.hits), order: Number(item.r) };
        })
        .filter((one) => one !== null);
    let ranked = candidates;
    let total = Number(database.getAll(sql.countSql)[0]?.count ?? 0);
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
        }
    }
    const verses = ranked.slice(0, limit).map(({ row, hits }) => {
        return {
            key: toVerseKey(row.bookKey, row.chapter, row.verse),
            ref: toEnglishRef(row.bookKey, row.chapter, row.verse),
            text: cutFoundText(row.text),
            hits,
        };
    });
    return {
        ...base,
        of: foundTerms.length,
        total,
        verses,
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
) {
    const result = await findVerses(bibleKey, words, book, limit);
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
        const found = await findVerses(other.key, words, book, limit);
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
    if (parts === null || parts.verseStart === null) {
        return null;
    }
    const bookKey = resolveBookKey(parts.book, await toNameMapList(bibleKey));
    return bookKey === null
        ? null
        : {
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

async function withBibleTitles<
    T extends { bible?: unknown; verses?: { key: string }[] },
>(bibleKey: string, result: T): Promise<T> {
    if (!Array.isArray(result?.verses) || result.verses.length === 0) {
        return result;
    }
    const locale = String(await getBibleLocale(bibleKey)).toLowerCase();
    if (locale.startsWith('en')) {
        return result;
    }
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
    return { ...result, verses };
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
        const found = await findVersesAcross(bible.key, words, book, limit);
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
