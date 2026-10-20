/**
 * The app side of `owa_lookup_record`: what a Lookup Detail panel shows --
 * a person or a place of the names lookup, or a Bible passage -- read out
 * whole for the assistant.
 *
 * Asked for with a picture of three detail panels, the left of each title
 * circled (2026-10-18): _add robot icon, click to open chatbot, make sure mcp
 * tool provide all information to chatbot session then let user interact_.
 * The panel's 🤖 hands the chat WHICH record (`lookupAskHelpers.ts`); the
 * chat reads it here, once, and the model reads the people, places and
 * verses it leads to the same way.
 *
 * - Reached like every data tool (`owa-agent-data`, domain `lookup`,
 *   imported lazily by `domHelpers.ts`), in the window the panel is in when
 *   the chat knows it -- where the dataset is already held.
 * - A person or a place takes the names-and-places dataset through
 *   `acquireLookupData` and gives it back at once: held by an open panel, it
 *   is the copy the panel holds; otherwise it is loaded for the read and
 *   kept only the ten seconds `getLookupDataCached` keeps anything. Never a
 *   copy of its own.
 * - It reads; nothing is changed, opened or shown.
 */
import BibleItem from '../bible-list/BibleItem';
import {
    BIBLE_REFERENCE_KIND_BY_SCHEME,
    getLookupVerseBibleKey,
    shortToReferenceTitle,
    shortToVerseCopyData,
} from '../location-name-lookup/bibleVerseHelpers';
import { DEFAULT_LANG_CODE } from '../lang/langHelpers';
import type { LookupManagersType } from '../location-name-lookup/lookupDataHelpers';
import {
    acquireLookupData,
    releaseLookupData,
} from '../location-name-lookup/lookupDataHelpers';
import {
    getLookupLangCodeListAsync,
    getSelectedLookupLangCode,
} from '../location-name-lookup/lookupLangHelpers';
import { resolveLocationReference } from '../location-name-lookup/lookupRecordHelpers';
import type {
    LookupLocationRecordType,
    LookupNameRecordType,
    LookupRecordResolverType,
    QuotedVerseType,
} from './agentLookupRecordHelpers';
import {
    MAX_QUOTED_VERSES,
    toEnglishVerseRef,
    toLocationRecordResult,
    toNameRecordResult,
    toPlainRecordText,
    toQuotedText,
} from './agentLookupRecordHelpers';
import { getAllLocalBibleInfoList } from './bible-helpers/bibleDownloadHelpers';
import { getVerses } from './bible-helpers/bibleInfoHelpers';
import { checkVerseFitsChapter } from './bibleVerseFindHelpers';
import {
    getModelChapterCount,
    getModelKeyBookMap,
} from './bible-helpers/bibleLogicHelpers1';
import { kjvBibleModelInfo } from './bible-helpers/bibleModelHelpers';
import {
    checkIsCrossChapterTarget,
    getTargetChapterEnd,
} from './bible-helpers/bibleTargetHelpers';

export type AgentLookupRequestType = {
    kind?: unknown;
    id?: unknown;
    name?: unknown;
    ref?: unknown;
    bible?: unknown;
    lang?: unknown;
    // A passage's neighbour instead of the passage: the chapter (or, for one
    // verse, the verse) before or after it.
    near?: unknown;
    // With a passage, the people and places of the names lookup in it.
    names?: unknown;
    // Find people (kind "name") or places (kind "location") by words --
    // what the lookup panel's own **Search names** box does. Answers the
    // matches with their ids; nothing is read whole (2026-10-19, EC-370).
    search?: unknown;
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

// A passage asked for is at most a few references at once, and a passage
// over chapters is read whole only this far.
const MAX_PASSAGES = 6;
const MAX_PASSAGE_CHARS = 6000;
const MAX_OTHER_MATCHES = 5;

const englishBookNameMap = kjvBibleModelInfo.keyBookMap;

/** The installed Bible asked for, or the one the lookup reads verses in. */
async function resolveBibleKey(
    asked: string,
    langCode: string,
): Promise<string | RefusalType> {
    const infoList = (await getAllLocalBibleInfoList()) ?? [];
    if (infoList.length === 0) {
        return toReason(
            'No Bible is installed on this computer, so no verse can be ' +
                'read. A Bible is added in Settings, under the Bible tab.',
        );
    }
    const wanted = asked.length > 0 ? asked : getLookupVerseBibleKey(langCode);
    const found = infoList.find((info) => {
        return info.key.toLowerCase() === wanted.toLowerCase();
    });
    if (found !== undefined) {
        return found.key;
    }
    if (asked.length > 0) {
        return toReason(
            `No Bible called "${asked}" is installed. Installed: ` +
                `${infoList.map((info) => info.key).join(', ')}.`,
        );
    }
    return infoList[0].key;
}

/**
 * One passage by the key a record or a panel carries (`GEN 2:19-21`,
 * `JHN 18:33-19:16`), every chapter of it: null when it is not a key.
 */
async function readKeyedPassage(
    bibleKey: string,
    key: string,
    limit: number,
): Promise<QuotedVerseType | null> {
    let bibleItem: BibleItem | null;
    try {
        bibleItem = await BibleItem.fromVerseKey(bibleKey, key);
    } catch {
        bibleItem = null;
    }
    if (bibleItem === null) {
        return null;
    }
    // A verse past the end of its chapter is not a verse: the reader would
    // quote `??`, the renderer's placeholder (2026-10-18).
    const target = bibleItem.target;
    if (!checkIsCrossChapterTarget(target)) {
        const verseCount = await countChapterVerses(
            bibleKey,
            target.bookKey,
            target.chapter,
        );
        if (
            !checkVerseFitsChapter(
                verseCount,
                target.verseStart,
                target.verseEnd,
            )
        ) {
            return null;
        }
    }
    const data = await shortToVerseCopyData(bibleKey, key).catch(() => {
        return null;
    });
    if (data === null || data.text.trim().length === 0) {
        return null;
    }
    // One chapter is its words alone -- the title is said beside them;
    // over chapters, each under its own.
    const text =
        data.sectionList.length === 1
            ? data.sectionList[0].text
            : data.sectionList
                  .map((section) => {
                      return `${section.title}\n${section.text}`;
                  })
                  .join('\n');
    const verseKey = bibleItem.toVerseFullKey();
    const ref = toEnglishVerseRef(verseKey, englishBookNameMap);
    return {
        key: verseKey,
        ref,
        ...(data.title === ref ? {} : { title: data.title }),
        text: toQuotedText(text, limit),
    };
}

async function readPassages(bibleKey: string, refs: string) {
    const refList = refs
        .split(/\s*;\s*/)
        .map((one) => one.trim())
        .filter((one) => one.length > 0)
        .slice(0, MAX_PASSAGES);
    const passages: QuotedVerseType[] = [];
    const others: string[] = [];
    for (const ref of refList) {
        const passage = await readKeyedPassage(
            bibleKey,
            ref,
            MAX_PASSAGE_CHARS,
        );
        if (passage === null) {
            others.push(ref);
        } else {
            passages.push(passage);
        }
    }
    let unread: string[] = [];
    let notFound: { ref: string; reason: string }[] = [];
    // Written the way a person or a model writes it (`John 3:16`, a book's
    // own name in the Bible's language): the verse finder's reader, which
    // takes every way of writing one.
    if (others.length > 0) {
        const { handleAgentBibleFindRequest } =
            await import('./agentBibleFindHelpers');
        const found: any = await handleAgentBibleFindRequest({
            bible: bibleKey,
            refs: others.join('; '),
        });
        for (const verse of found?.verses ?? []) {
            passages.push({
                key: String(verse.key),
                ref: String(verse.ref),
                ...(typeof verse.title === 'string'
                    ? { title: verse.title }
                    : {}),
                text: String(verse.text),
            });
        }
        unread = Array.isArray(found?.unread) ? found.unread : [];
        notFound = Array.isArray(found?.notFound)
            ? found.notFound.filter((one: any) => {
                  return (
                      typeof one?.ref === 'string' &&
                      typeof one?.reason === 'string'
                  );
              })
            : [];
    }
    return { passages, unread, notFound };
}

async function countChapterVerses(
    bibleKey: string,
    bookKey: string,
    chapter: number,
) {
    const verses = await getVerses(bibleKey, bookKey, chapter).catch(() => {
        return null;
    });
    return verses === null ? 0 : Object.keys(verses).length;
}

// The chapter before or after, across a book's end into the next book in
// the Bible's own order; null past Genesis 1 or Revelation 22.
function stepChapter(
    bookKey: string,
    chapter: number,
    near: 'previous' | 'next',
) {
    const bookKeyList = Object.keys(getModelKeyBookMap());
    const bookIndex = bookKeyList.indexOf(bookKey);
    if (near === 'next') {
        if (chapter < getModelChapterCount(bookKey)) {
            return { bookKey, chapter: chapter + 1 };
        }
        const nextBookKey = bookKeyList[bookIndex + 1];
        return bookIndex === -1 || nextBookKey === undefined
            ? null
            : { bookKey: nextBookKey, chapter: 1 };
    }
    if (chapter > 1) {
        return { bookKey, chapter: chapter - 1 };
    }
    const previousBookKey = bookIndex > 0 ? bookKeyList[bookIndex - 1] : null;
    return previousBookKey === null
        ? null
        : {
              bookKey: previousBookKey,
              chapter: getModelChapterCount(previousBookKey),
          };
}

async function toWholeChapterKey(
    bibleKey: string,
    bookKey: string,
    chapter: number,
) {
    const count = await countChapterVerses(bibleKey, bookKey, chapter);
    if (count === 0) {
        return null;
    }
    return count === 1
        ? `${bookKey} ${chapter}:1`
        : `${bookKey} ${chapter}:1-${count}`;
}

/**
 * The passage beside one: for a single verse the verse before or after it
 * (into the next or previous chapter at a chapter's end), for anything
 * longer the whole chapter before or after. Null when there is none in
 * this Bible.
 */
async function findNearKey(
    bibleKey: string,
    key: string,
    near: 'previous' | 'next',
) {
    const bibleItem = await BibleItem.fromVerseKey(bibleKey, key).catch(() => {
        return null;
    });
    if (bibleItem === null) {
        return null;
    }
    const target = bibleItem.target;
    const isCrossChapter = checkIsCrossChapterTarget(target);
    if (target.verseStart === target.verseEnd && !isCrossChapter) {
        if (near === 'next') {
            const count = await countChapterVerses(
                bibleKey,
                target.bookKey,
                target.chapter,
            );
            if (target.verseStart < count) {
                return `${target.bookKey} ${target.chapter}:${target.verseStart + 1}`;
            }
            const nextChapter = stepChapter(
                target.bookKey,
                target.chapter,
                'next',
            );
            return nextChapter === null
                ? null
                : `${nextChapter.bookKey} ${nextChapter.chapter}:1`;
        }
        if (target.verseStart > 1) {
            return `${target.bookKey} ${target.chapter}:${target.verseStart - 1}`;
        }
        const previousChapter = stepChapter(
            target.bookKey,
            target.chapter,
            'previous',
        );
        if (previousChapter === null) {
            return null;
        }
        const count = await countChapterVerses(
            bibleKey,
            previousChapter.bookKey,
            previousChapter.chapter,
        );
        return count === 0
            ? null
            : `${previousChapter.bookKey} ${previousChapter.chapter}:${count}`;
    }
    const lastChapter = isCrossChapter
        ? getTargetChapterEnd(target)
        : target.chapter;
    const nearChapter =
        near === 'next'
            ? stepChapter(target.bookKey, lastChapter, 'next')
            : stepChapter(target.bookKey, target.chapter, 'previous');
    return nearChapter === null
        ? null
        : await toWholeChapterKey(
              bibleKey,
              nearChapter.bookKey,
              nearChapter.chapter,
          );
}

// A long passage is looked through this far for its people and places.
const MAX_NAMES_VERSES = 200;
const MAX_NAMES_LISTED = 40;

/**
 * Every verse key a passage covers (`GEN 4:1` …), chapter by chapter, as
 * the names lookup keys its verses.
 */
async function listPassageVerseKeys(bibleKey: string, key: string) {
    const bibleItem = await BibleItem.fromVerseKey(bibleKey, key).catch(() => {
        return null;
    });
    if (bibleItem === null) {
        return [];
    }
    const target = bibleItem.target;
    const lastChapter = checkIsCrossChapterTarget(target)
        ? getTargetChapterEnd(target)
        : target.chapter;
    const keyList: string[] = [];
    for (
        let chapter = target.chapter;
        chapter <= lastChapter && keyList.length < MAX_NAMES_VERSES;
        chapter++
    ) {
        const first = chapter === target.chapter ? target.verseStart : 1;
        const last =
            chapter === lastChapter
                ? target.verseEnd
                : await countChapterVerses(bibleKey, target.bookKey, chapter);
        for (
            let verse = first;
            verse <= last && keyList.length < MAX_NAMES_VERSES;
            verse++
        ) {
            keyList.push(`${target.bookKey} ${chapter}:${verse}`);
        }
    }
    return keyList;
}

type PassageNameType = {
    id: string;
    name: string;
    kjvName?: string;
    verses: string[];
};

function collectPassageNames(
    verseKeyList: string[],
    search: (verseKey: string) => {
        id: string;
        name: string;
        kjvName: string | null;
    }[],
) {
    const byId = new Map<string, PassageNameType>();
    for (const verseKey of verseKeyList) {
        for (const record of search(verseKey)) {
            const verse = verseKey.replace(/^\S+ /, '');
            const found = byId.get(record.id);
            if (found !== undefined) {
                found.verses.push(verse);
                continue;
            }
            if (byId.size >= MAX_NAMES_LISTED) {
                continue;
            }
            byId.set(record.id, {
                id: record.id,
                name: record.name,
                ...(record.kjvName && record.kjvName !== record.name
                    ? { kjvName: record.kjvName }
                    : {}),
                verses: [verse],
            });
        }
    }
    return Array.from(byId.values());
}

/**
 * The people and places the names lookup has in a passage, each with the
 * verses that name it -- what the Reader's "Names and locations in your
 * reading" lists. Takes the dataset and gives it back at once, like a record.
 */
async function readPassageNames(
    bibleKey: string,
    key: string,
    langCode: string,
) {
    const verseKeyList = await listPassageVerseKeys(bibleKey, key);
    if (verseKeyList.length === 0) {
        return {};
    }
    const managers = await acquireLookupData(langCode);
    try {
        return {
            people: collectPassageNames(verseKeyList, (verseKey) => {
                return managers.namesLookupManager.searchByShortVerse(verseKey);
            }),
            places: collectPassageNames(verseKeyList, (verseKey) => {
                return managers.locationsLookupManager.searchByShortVerse(
                    verseKey,
                );
            }),
            lang: langCode,
        };
    } finally {
        releaseLookupData(langCode);
    }
}

async function readPassageRequest(request: AgentLookupRequestType) {
    const askedRefs = toText(request.ref, 400);
    if (askedRefs.length === 0) {
        return toReason(
            'Give ref: the passage to read, "GEN 2:19-21" or "Genesis 2:19".',
        );
    }
    const askedBible = toText(request.bible, 40);
    const bibleKey = await resolveBibleKey(
        askedBible,
        getSelectedLookupLangCode(),
    );
    if (typeof bibleKey !== 'string') {
        return bibleKey;
    }
    // No Bible asked: read it in the one that NAMES the book the way it was
    // written -- a Khmer reference from the Khmer Bible, not from the KJV
    // the lookup happens to be on (2026-10-18).
    let readBibleKey = bibleKey;
    if (askedBible.length === 0) {
        try {
            const { pickBibleForRefs } =
                await import('./agentBibleFindHelpers');
            readBibleKey = await pickBibleForRefs(bibleKey, askedRefs);
        } catch (_error) {
            readBibleKey = bibleKey;
        }
    }
    const near = toText(request.near, 10);
    let refs = askedRefs;
    if (near === 'previous' || near === 'next') {
        const firstRef = askedRefs.split(/\s*;\s*/)[0] ?? '';
        const nearKey = await findNearKey(readBibleKey, firstRef, near);
        if (nearKey === null) {
            return toReason(
                `There is no passage ${
                    near === 'next' ? 'after' : 'before'
                } "${firstRef}" in ${readBibleKey}.`,
            );
        }
        refs = nearKey;
    }
    const { passages, unread, notFound } = await readPassages(
        readBibleKey,
        refs,
    );
    if (passages.length === 0) {
        // A reason with a number in it ("Genesis 3 has 24 verses.") is the
        // answer, not a generic "could not be read".
        if (notFound.length > 0) {
            return toReason(
                notFound
                    .map((one) => {
                        return one.reason;
                    })
                    .join(' '),
            );
        }
        return toReason(
            `"${refs}" could not be read in ${readBibleKey}. Write a ` +
                'reference as book, chapter and verse -- "Genesis 2:19" or ' +
                '"GEN 2:19".',
        );
    }
    const namesLang =
        request.names === true
            ? await resolveLangCode(toText(request.lang, 12))
            : null;
    return {
        kind: 'verse',
        bible: readBibleKey,
        passages,
        ...(unread.length > 0 ? { unread } : {}),
        ...(notFound.length > 0 ? { notFound } : {}),
        ...(namesLang === null
            ? {}
            : await readPassageNames(readBibleKey, passages[0].key, namesLang)),
    };
}

async function resolveLangCode(asked: string) {
    if (asked.length === 0) {
        return getSelectedLookupLangCode();
    }
    const langCodeList = await getLookupLangCodeListAsync();
    return langCodeList.includes(asked) ? asked : null;
}

function genResolver(managers: LookupManagersType): LookupRecordResolverType {
    return {
        findName: (id) => {
            return managers.namesLookupManager.getRecordById(id);
        },
        findLocation: (idOrName) => {
            return resolveLocationReference(
                managers.locationsLookupManager,
                idOrName,
            );
        },
    };
}

type FoundRecordType<T> = { record: T; others: T[] } | null;

/**
 * The record by its id; else by its name -- the dataset's own name or its
 * English one -- the exact name first, then the lookup panel's own search.
 */
function findRecord<T extends { id: string; name: string }>(
    manager: {
        getRecordById: (id: string) => T | null;
        getRecordsByName: (name: string) => T[];
    },
    search: (query: string) => T[],
    id: string,
    name: string,
): FoundRecordType<T> {
    if (id.length > 0) {
        const record = manager.getRecordById(id);
        return record === null ? null : { record, others: [] };
    }
    if (name.length === 0) {
        return null;
    }
    const exact = manager.getRecordsByName(name);
    const found = exact.length > 0 ? exact : search(name);
    if (found.length === 0) {
        return null;
    }
    return { record: found[0], others: found.slice(1, MAX_OTHER_MATCHES + 1) };
}

// A book, a chapter or a verse a record's words name inline.
const REFERENCE_TOKEN_PATTERN =
    /\[([^\]]+)\]\((book-key|chapter-key|verse-key):\/\/([^)]*)\)/g;

/**
 * A record's words with every book, chapter and verse they name written as
 * the lookup's Bible writes it, the way the panel draws them: the datasets
 * carry the KJV's English label (`[Genesis](book-key://GEN)`) in Khmer
 * prose, and a model handed it wrote _Genesis_ in a Khmer answer
 * (2026-10-18, seen live). An English record, and a key the Bible does not
 * know, keep the dataset's label.
 */
async function toLocalizedReferences(
    text: string,
    bibleKey: string | null,
    langCode: string,
) {
    if (bibleKey === null || langCode === DEFAULT_LANG_CODE) {
        return text;
    }
    const matchList = Array.from(text.matchAll(REFERENCE_TOKEN_PATTERN));
    if (matchList.length === 0) {
        return text;
    }
    const titleList = await Promise.all(
        matchList.map((match) => {
            return shortToReferenceTitle(
                bibleKey,
                BIBLE_REFERENCE_KIND_BY_SCHEME[match[2]],
                match[3],
            ).catch(() => {
                return null;
            });
        }),
    );
    let index = 0;
    return text.replace(
        REFERENCE_TOKEN_PATTERN,
        (whole, _label: string, scheme: string, target: string) => {
            const title = titleList[index++];
            return title ? `[${title}](${scheme}://${target})` : whole;
        },
    );
}

async function toLocalizedRecord<
    T extends { title: string; description: string },
>(record: T, bibleKey: string | null, langCode: string): Promise<T> {
    return {
        ...record,
        title: await toLocalizedReferences(record.title, bibleKey, langCode),
        description: await toLocalizedReferences(
            record.description,
            bibleKey,
            langCode,
        ),
    };
}

async function readQuotedVerses(bibleKey: string | null, verses: string[]) {
    if (bibleKey === null) {
        return [];
    }
    const quoted: QuotedVerseType[] = [];
    for (const key of verses.slice(0, MAX_QUOTED_VERSES)) {
        const passage = await readKeyedPassage(bibleKey, key, 600);
        if (passage !== null) {
            quoted.push(passage);
        }
    }
    return quoted;
}

async function readRecordRequest(
    kind: 'name' | 'location',
    request: AgentLookupRequestType,
) {
    const id = toText(request.id, 200);
    const name = toText(request.name, 120);
    if (id.length === 0 && name.length === 0) {
        return toReason(
            `Give id (from a result's lists) or name: the ${
                kind === 'name' ? 'person' : 'place'
            } to read.`,
        );
    }
    const askedLang = toText(request.lang, 12);
    const langCode = await resolveLangCode(askedLang);
    if (langCode === null) {
        return toReason(
            `The names lookup has no "${askedLang}" language. ` +
                `It has: ${(await getLookupLangCodeListAsync()).join(', ')}.`,
        );
    }
    // A Bible for the verses, when one is installed: a record still reads
    // without them.
    const bibleKey = await resolveBibleKey(toText(request.bible, 40), langCode);
    const managers = await acquireLookupData(langCode);
    try {
        const resolver = genResolver(managers);
        if (kind === 'name') {
            const manager = managers.namesLookupManager;
            const found = findRecord(
                manager,
                (query) => {
                    return manager.searchNames(query, {
                        limit: MAX_OTHER_MATCHES + 1,
                    });
                },
                id,
                name,
            );
            if (found === null) {
                return toReason(
                    `No person or name "${id || name}" is in the names ` +
                        'lookup. Try the English name, or another spelling.',
                );
            }
            const quoted = await readQuotedVerses(
                typeof bibleKey === 'string' ? bibleKey : null,
                found.record.verses,
            );
            return {
                ...toNameRecordResult(
                    await toLocalizedRecord(
                        found.record as LookupNameRecordType,
                        typeof bibleKey === 'string' ? bibleKey : null,
                        langCode,
                    ),
                    resolver,
                    quoted,
                ),
                lang: langCode,
                ...(typeof bibleKey === 'string' ? { bible: bibleKey } : {}),
                ...toOtherMatches(found.others),
            };
        }
        const manager = managers.locationsLookupManager;
        const found = findRecord(
            manager,
            (query) => {
                return manager.searchLocations(query, {
                    limit: MAX_OTHER_MATCHES + 1,
                });
            },
            id,
            name,
        );
        if (found === null) {
            return toReason(
                `No place "${id || name}" is in the names lookup. Try the ` +
                    'English name, or another spelling.',
            );
        }
        const quoted = await readQuotedVerses(
            typeof bibleKey === 'string' ? bibleKey : null,
            found.record.verses,
        );
        return {
            ...toLocationRecordResult(
                await toLocalizedRecord(
                    found.record as LookupLocationRecordType,
                    typeof bibleKey === 'string' ? bibleKey : null,
                    langCode,
                ),
                resolver,
                quoted,
            ),
            lang: langCode,
            ...(typeof bibleKey === 'string' ? { bible: bibleKey } : {}),
            ...toOtherMatches(found.others),
        };
    } finally {
        releaseLookupData(langCode);
    }
}

// Two people of one name are two records: the first is read, the rest are
// named with their ids so the right one can be read next.
function toOtherMatches(
    others: { id: string; name: string; kjvName: string | null }[],
) {
    if (others.length === 0) {
        return {};
    }
    return {
        otherMatches: others.map((one) => {
            return {
                id: one.id,
                name: one.name,
                ...(one.kjvName && one.kjvName !== one.name
                    ? { kjvName: one.kjvName }
                    : {}),
            };
        }),
    };
}

// How many matches a search answers with: enough to choose from, never the
// whole dataset (the panel pages its own list at a hundred).
const MAX_SEARCH_MATCHES = 25;

/**
 * People or places found by words -- what the lookup panel's own **Search
 * names** box does (2026-10-19, EC-370; the user, with that box circled:
 * _mpc tool should provide a way for assistant to search for user_). A
 * person's spelling, a partial name, or a place's name: the matches come
 * back with their ids, and reading one is the next call.
 */
async function readSearchRequest(
    kind: 'name' | 'location',
    request: AgentLookupRequestType,
) {
    const query = toText(request.search, 120);
    if (query.length === 0) {
        return toReason('Give search: the words to find a person or place by.');
    }
    const askedLang = toText(request.lang, 12);
    const langCode = await resolveLangCode(askedLang);
    if (langCode === null) {
        return toReason(
            `The names lookup has no "${askedLang}" language. ` +
                `It has: ${(await getLookupLangCodeListAsync()).join(', ')}.`,
        );
    }
    const managers = await acquireLookupData(langCode);
    try {
        const found =
            kind === 'name'
                ? managers.namesLookupManager.searchNames(query, {
                      limit: MAX_SEARCH_MATCHES,
                  })
                : managers.locationsLookupManager.searchLocations(query, {
                      limit: MAX_SEARCH_MATCHES,
                  });
        return {
            kind,
            search: query,
            lang: langCode,
            count: found.length,
            records: found.map((record) => {
                const kjvName = (record.kjvName ?? '').trim();
                const title = toPlainRecordText(record.title);
                return {
                    id: record.id,
                    name: record.name,
                    ...(kjvName !== '' && kjvName !== record.name.trim()
                        ? { kjvName }
                        : {}),
                    ...(title === '' ? {} : { title }),
                    ...(typeof record.type === 'string' && record.type !== ''
                        ? { type: record.type }
                        : {}),
                };
            }),
        };
    } finally {
        releaseLookupData(langCode);
    }
}

export async function handleAgentLookupRequest(
    request: AgentLookupRequestType,
) {
    const kind = toText(request.kind, 20);
    if (kind === 'verse') {
        return await readPassageRequest(request);
    }
    if (kind === 'name' || kind === 'location') {
        if (toText(request.search, 120).length > 0) {
            return await readSearchRequest(kind, request);
        }
        return await readRecordRequest(kind, request);
    }
    return toReason(
        'Give kind: "name" for a person, "location" for a place, or ' +
            '"verse" for a Bible passage.',
    );
}
