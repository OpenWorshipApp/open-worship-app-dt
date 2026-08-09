import { useSyncExternalStore } from 'react';

import { BIBLE_KJV_KEY } from '../helper/bible-helpers/bibleModelHelpers';
import { appManagedDataDirNames } from '../helper/constants';
import { handleError } from '../helper/errorHelpers';
import appProvider from '../server/appProvider';
import {
    fsCheckFileExist,
    fsCreateDir,
    fsReadFile,
    fsWriteFile,
    pathJoin,
} from '../server/fileHelpers';
import { unlocking } from '../server/unlockingHelpers';
import { appLocalStorage } from '../setting/directory-setting/appLocalStorage';
import {
    LOOKUP_TEXT_INDEX_VERSION,
    type LookupTextIndexType,
} from './verseTextIndexTypes';

/**
 * The slim index that makes names and locations clickable inside verse text.
 *
 * This is NOT the lookup dataset. The dataset is ~35MB of JSON that materializes
 * into tens of MB of records and exists to answer "tell me everything about this
 * record". Decorating verse text only needs "is this word a name, and which
 * record is it here" — so the answer is derived ONCE into a ~0.5MB index in the
 * app data folder, exactly the way bible XML is cached beside its source, and
 * every later run reads only that. The full dataset is still loaded lazily, and
 * only when a user actually clicks through to a detail panel.
 */

export type LookupTextMatchType = {
    // Offsets into the verse text the match was found in.
    start: number;
    end: number;
    text: string;
    kind: 'name' | 'location';
    recordId: string;
};

const INDEX_FILE_NAME = 'verse-text-index.json';
const INDEX_LOCK_KEY = 'lookup-verse-text-index';

// Longest multi-word surface form worth probing ("Mary Magdalene", "Valley of
// the Son of Hinnom"). Every extra word costs one map probe per token.
const MAXIMUM_PHRASE_WORD_COUNT = 4;

// Biblical names are always capitalized in scripture, so requiring an uppercase
// first letter costs nothing and removes the false positives that short entries
// ("Amos", "Abba", "Ben") would otherwise produce against ordinary prose.
const TOKEN_PATTERN = /[A-Za-z][A-Za-z'’-]*/g;

const POSSESSIVE_PATTERN = /['’]s?$/;

type IndexEnvelopeType = {
    _cachingTime: number;
    // The shipped dataset only ever changes with the app itself, so the app
    // version is what tells a cache built by an earlier install apart.
    _appVersion: string;
    value: LookupTextIndexType;
};

async function getIndexFilePath() {
    const dirPath = pathJoin(
        appLocalStorage.defaultStorage,
        appManagedDataDirNames.LOOKUP_DATA,
    );
    try {
        await fsCreateDir(dirPath);
    } catch (error: any) {
        if (
            error.code !== 'EEXIST' &&
            !error.message?.includes('file already exists')
        ) {
            handleError(error);
            return null;
        }
    }
    return pathJoin(dirPath, INDEX_FILE_NAME);
}

async function readCachedIndex(filePath: string) {
    if (!(await fsCheckFileExist(filePath))) {
        return null;
    }
    try {
        const jsonText = await fsReadFile(filePath);
        if (jsonText === null) {
            return null;
        }
        const envelope = JSON.parse(jsonText) as IndexEnvelopeType;
        if (
            envelope._appVersion !== appProvider.appInfo.version ||
            envelope.value?.version !== LOOKUP_TEXT_INDEX_VERSION ||
            !Array.isArray(envelope.value.ids)
        ) {
            return null;
        }
        return envelope.value;
    } catch (error) {
        handleError(error);
        return null;
    }
}

async function writeCachedIndex(filePath: string, index: LookupTextIndexType) {
    try {
        const envelope: IndexEnvelopeType = {
            _cachingTime: Date.now(),
            _appVersion: appProvider.appInfo.version,
            value: index,
        };
        await fsWriteFile(filePath, JSON.stringify(envelope));
    } catch (error) {
        handleError(error);
    }
}

async function loadLookupTextIndex(): Promise<LookupTextIndexType | null> {
    return await unlocking(INDEX_LOCK_KEY, async () => {
        const filePath = await getIndexFilePath();
        if (filePath === null) {
            return null;
        }
        const cachedIndex = await readCachedIndex(filePath);
        if (cachedIndex !== null) {
            return cachedIndex;
        }
        // DYNAMIC on purpose: this is the only path that reads the full ~35MB
        // dataset, and it runs at most once per app version.
        const { buildLookupTextIndex } =
            await import('./verseTextIndexBuilder');
        const builtIndex = await buildLookupTextIndex();
        if (builtIndex === null) {
            return null;
        }
        await writeCachedIndex(filePath, builtIndex);
        return builtIndex;
    });
}

let loadedIndex: LookupTextIndexType | null = null;
let isLoading = false;
const listeners = new Set<() => void>();

function notify() {
    for (const listener of listeners) {
        listener();
    }
}

function startLoading() {
    if (loadedIndex !== null || isLoading) {
        return;
    }
    isLoading = true;
    loadLookupTextIndex()
        .then((index) => {
            isLoading = false;
            // Everything may have unmounted while this was in flight; then there
            // is nothing to hold it for and it must not be retained.
            if (listeners.size > 0 && index !== null) {
                loadedIndex = index;
                notify();
            }
        })
        .catch((error) => {
            isLoading = false;
            handleError(error);
        });
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    startLoading();
    return () => {
        listeners.delete(listener);
        // Dropped as soon as the last verse view goes away rather than parked in
        // a cache: re-reading a ~0.5MB local file is far cheaper than holding it
        // resident for a reader the user has navigated away from.
        if (listeners.size === 0) {
            loadedIndex = null;
        }
    };
}

function getSnapshot() {
    return loadedIndex;
}

/**
 * The index, or null while it is still loading. Subscribing is what triggers the
 * single shared load, and unsubscribing the last consumer releases it.
 */
export function useLookupTextIndex() {
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Whether verse text in this bible may be decorated at all.
 *
 * KJV ONLY, because the whole dataset was extracted from the KJV: the verse
 * evidence is keyed by KJV references and the surface forms are KJV spellings
 * ("Galilaeans", "Elias", "Elisabeth"). Another translation renders the same
 * verse with different words, so matching it against this index would both miss
 * names and, worse, attach KJV verse evidence to text that does not say the same
 * thing. In a multi-version view this gates per column, so the KJV column is
 * decorated and the others are left alone.
 *
 * The screen output window is excluded too — it renders text nobody can click.
 */
export function checkCanLookupVerseText(bibleKey: string) {
    return !appProvider.isPageScreen && bibleKey === BIBLE_KJV_KEY;
}

// The single candidate this verse actually attests, or null when the verse
// attests none or more than one. Guessing between the 24 Zechariahs would
// silently open the wrong record, so anything unresolved stays plain text.
function resolveByVerseEvidence(
    candidateList: number[] | undefined,
    verseRecordIndexSet: Set<number>,
) {
    if (candidateList === undefined) {
        return null;
    }
    let resolvedIndex: number | null = null;
    for (const candidateIndex of candidateList) {
        if (!verseRecordIndexSet.has(candidateIndex)) {
            continue;
        }
        if (resolvedIndex !== null) {
            return null;
        }
        resolvedIndex = candidateIndex;
    }
    return resolvedIndex;
}

/**
 * Decides which record a surface form denotes, across BOTH kinds at once.
 *
 * Names and locations have to be weighed together or a word that is both silently
 * collapses to the wrong kind: "Haran" is three different people AND a city, so
 * resolving names first and falling back to locations turns Terah's son in
 * Genesis 11:26 — a verse attesting neither — into the city, purely because the
 * city list happened to hold exactly one entry. Verse evidence decides; without
 * it, only a form borne by exactly one record in the whole dataset is safe.
 */
function resolveNeedle(
    nameCandidateList: number[] | undefined,
    locationCandidateList: number[] | undefined,
    verseNameIndexSet: Set<number>,
    verseLocationIndexSet: Set<number>,
): { kind: 'name' | 'location'; recordIndex: number } | null {
    const nameByEvidence = resolveByVerseEvidence(
        nameCandidateList,
        verseNameIndexSet,
    );
    const locationByEvidence = resolveByVerseEvidence(
        locationCandidateList,
        verseLocationIndexSet,
    );
    if (nameByEvidence !== null && locationByEvidence === null) {
        return { kind: 'name', recordIndex: nameByEvidence };
    }
    if (locationByEvidence !== null && nameByEvidence === null) {
        return { kind: 'location', recordIndex: locationByEvidence };
    }
    // Attested as both a person and a place in the same verse: genuinely
    // ambiguous, so it is left alone.
    if (nameByEvidence !== null || locationByEvidence !== null) {
        return null;
    }
    const nameCount = nameCandidateList?.length ?? 0;
    const locationCount = locationCandidateList?.length ?? 0;
    if (nameCount + locationCount !== 1) {
        return null;
    }
    return nameCount === 1
        ? { kind: 'name', recordIndex: nameCandidateList![0] }
        : { kind: 'location', recordIndex: locationCandidateList![0] };
}

/**
 * Finds every name/location in `text` that resolves to exactly one record.
 *
 * `kjvShortVerse` is the KJV reference of the verse (`data-kjv-verse-key`, e.g.
 * `GEN 11:26`) and supplies the evidence that disambiguates repeated names.
 * Measured at ~0.03ms per verse, so a whole chapter costs well under a frame.
 */
export function findLookupTextMatches(
    index: LookupTextIndexType,
    text: string,
    kjvShortVerse: string,
): LookupTextMatchType[] {
    const verseNameIndexSet = new Set(index.verseNames[kjvShortVerse] ?? []);
    const verseLocationIndexSet = new Set(
        index.verseLocations[kjvShortVerse] ?? [],
    );
    const tokenList: { text: string; start: number }[] = [];
    TOKEN_PATTERN.lastIndex = 0;
    let tokenMatch = TOKEN_PATTERN.exec(text);
    while (tokenMatch !== null) {
        tokenList.push({ text: tokenMatch[0], start: tokenMatch.index });
        tokenMatch = TOKEN_PATTERN.exec(text);
    }
    // Longest phrase first, so "Mary Magdalene" wins over "Mary".
    const matchPhraseAt = (startTokenIndex: number) => {
        const token = tokenList[startTokenIndex];
        const maximumSpan = Math.min(
            MAXIMUM_PHRASE_WORD_COUNT,
            tokenList.length - startTokenIndex,
        );
        for (let span = maximumSpan; span >= 1; span--) {
            const lastToken = tokenList[startTokenIndex + span - 1];
            const rawText = text.slice(
                token.start,
                lastToken.start + lastToken.text.length,
            );
            const needle = rawText
                .toLowerCase()
                .replace(POSSESSIVE_PATTERN, '');
            const resolved = resolveNeedle(
                index.names[needle],
                index.locations[needle],
                verseNameIndexSet,
                verseLocationIndexSet,
            );
            if (resolved === null) {
                continue;
            }
            // The possessive belongs to the sentence, not to the name: highlight
            // "Abram" in "Abram's", not "Abram's".
            const possessiveMatch = POSSESSIVE_PATTERN.exec(rawText);
            const matchedText =
                possessiveMatch === null
                    ? rawText
                    : rawText.slice(0, possessiveMatch.index);
            return {
                span,
                match: {
                    start: token.start,
                    end: token.start + matchedText.length,
                    text: matchedText,
                    kind: resolved.kind,
                    recordId: index.ids[resolved.recordIndex],
                } as LookupTextMatchType,
            };
        }
        return null;
    };

    const matchList: LookupTextMatchType[] = [];
    let nextTokenIndex = 0;
    for (let i = 0; i < tokenList.length; i++) {
        const firstCharacter = tokenList[i].text[0];
        if (
            i < nextTokenIndex ||
            firstCharacter !== firstCharacter.toUpperCase()
        ) {
            continue;
        }
        const matched = matchPhraseAt(i);
        if (matched !== null) {
            matchList.push(matched.match);
            nextTokenIndex = i + matched.span;
        }
    }
    return matchList;
}

const LOOKUP_LINK_SELECTOR = '.verse-lookup-link';

/**
 * Decorates matches inside ALREADY-RENDERED HTML, in place.
 *
 * Verses carry custom HTML whenever they are edited or carry the words-of-Christ
 * markup (`app-god-word`), and in the gospels that is most of the chapter. Those
 * go through `dangerouslySetInnerHTML`, so there is no React text node to split —
 * the matches have to be found in the DOM the same way `reformCustomTitle` post-
 * processes its own injected markup.
 *
 * Matching runs per text node, so a phrase split across inline tags is missed;
 * that is a deliberate simplification over re-parsing the fragment.
 */
export function decorateLookupMatchesInElement(
    element: HTMLElement,
    index: LookupTextIndexType,
    kjvShortVerse: string,
    onActivate: (event: MouseEvent, match: LookupTextMatchType) => void,
) {
    // Idempotence is checked against the CONTENT, not a flag on the element: the
    // host re-sets `dangerouslySetInnerHTML` on later commits, which wipes these
    // spans while the element itself survives. A one-shot flag would then block
    // the re-decoration and the verse would end up permanently undecorated.
    if (element.querySelector(LOOKUP_LINK_SELECTOR) !== null) {
        return;
    }
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const textNodeList: Text[] = [];
    let currentNode = walker.nextNode();
    while (currentNode !== null) {
        textNodeList.push(currentNode as Text);
        currentNode = walker.nextNode();
    }
    for (const textNode of textNodeList) {
        const text = textNode.nodeValue ?? '';
        if (text.trim() === '') {
            continue;
        }
        const matchList = findLookupTextMatches(index, text, kjvShortVerse);
        if (matchList.length === 0) {
            continue;
        }
        const fragment = document.createDocumentFragment();
        let cursor = 0;
        for (const match of matchList) {
            if (match.start > cursor) {
                fragment.append(text.slice(cursor, match.start));
            }
            const linkElement = document.createElement('span');
            linkElement.className = `verse-lookup-link ${match.kind}`;
            linkElement.title = match.text;
            linkElement.textContent = match.text;
            linkElement.onclick = (event) => {
                onActivate(event, match);
            };
            fragment.append(linkElement);
            cursor = match.end;
        }
        if (cursor < text.length) {
            fragment.append(text.slice(cursor));
        }
        textNode.replaceWith(fragment);
    }
}

export type VerseTextSegmentType =
    | { kind: 'text'; text: string }
    | { kind: 'match'; match: LookupTextMatchType };

/**
 * Splits verse text into plain runs and clickable matches. Returns null when
 * there is nothing to decorate, so the caller keeps rendering the original
 * single text node instead of an equivalent one-element array.
 */
export function toVerseTextSegments(
    index: LookupTextIndexType | null,
    text: string,
    kjvShortVerse: string,
): VerseTextSegmentType[] | null {
    if (index === null || text === '') {
        return null;
    }
    const matchList = findLookupTextMatches(index, text, kjvShortVerse);
    if (matchList.length === 0) {
        return null;
    }
    const segmentList: VerseTextSegmentType[] = [];
    let cursor = 0;
    for (const match of matchList) {
        if (match.start > cursor) {
            segmentList.push({
                kind: 'text',
                text: text.slice(cursor, match.start),
            });
        }
        segmentList.push({ kind: 'match', match });
        cursor = match.end;
    }
    if (cursor < text.length) {
        segmentList.push({ kind: 'text', text: text.slice(cursor) });
    }
    return segmentList;
}
