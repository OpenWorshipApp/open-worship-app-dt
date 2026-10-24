import type { OpenLyric } from 'open-lyric';

import type LyricSlide from './LyricSlide';

/**
 * A song's slides, built ahead of the click — the way a PowerPoint's slides
 * already carry their HTML when one is presented.
 *
 * A song's slide is HTML that open-lyric renders per STAGE, and a screen on
 * another stage than the pane's (a band monitor on `St: 2` under a stage-0
 * pane) used to have the slide re-derived AT CLICK TIME: the whole deck rebuilt
 * for a look-ahead stage, a whole-song PNG for the First slide, and the song
 * re-read from disk and re-parsed two or three times because that stage's
 * document had no `OpenLyric` of its own. Seconds per click on a weak machine.
 *
 * So while a song's slides pane is mounted, it HOLDS the song here: its live
 * `OpenLyric` (which every stage of the song then derives from) and one built
 * deck per stage, keyed by everything the deck was built from. A click is then
 * a lookup.
 *
 * Bounded by what is on screen, not by time: nothing is stored for a song no
 * pane holds, and the last release deletes the entry with its decks — the
 * stage documents themselves are cached for good, so the decks must NOT live
 * on them. A leaf (type imports only), so `LyricAppDocument` and its stage
 * classes can read it without entering the `lyricHelpers` cycle.
 */

type WarmDeckType = { key: string; slides: LyricSlide[] };
type WarmEntryType = {
    openLyrics: OpenLyric[];
    // Bumped by every drop. A build reads it BEFORE it starts and may only
    // store under the same number, so a deck built from the text an edit has
    // just replaced cannot land after the drop that the edit caused.
    generation: number;
    decks: Map<number, WarmDeckType>;
};

const warmEntries = new Map<string, WarmEntryType>();
// One counter for every entry, never one per entry: a song deselected,
// edited and selected again gets a NEW entry, and a build still running from
// the first hold must not find its old number valid in the second.
let lastGeneration = 0;
function genGeneration() {
    lastGeneration += 1;
    return lastGeneration;
}

/**
 * Holds a song for as long as the returned release has not been called.
 * Ref-counted per `OpenLyric`: a floating preview of the same song holds it a
 * second time, and closing one of them must not free what the other still
 * shows.
 */
export function holdLyricWarmSlides(filePath: string, openLyric: OpenLyric) {
    let entry = warmEntries.get(filePath);
    if (entry === undefined) {
        entry = {
            openLyrics: [],
            generation: genGeneration(),
            decks: new Map(),
        };
        warmEntries.set(filePath, entry);
    }
    entry.openLyrics.push(openLyric);
    let isReleased = false;
    return () => {
        if (isReleased) {
            return;
        }
        isReleased = true;
        const currentEntry = warmEntries.get(filePath);
        if (currentEntry === undefined) {
            return;
        }
        const index = currentEntry.openLyrics.lastIndexOf(openLyric);
        if (index !== -1) {
            currentEntry.openLyrics.splice(index, 1);
        }
        if (currentEntry.openLyrics.length === 0) {
            warmEntries.delete(filePath);
        }
    };
}

/**
 * The live `OpenLyric` of a held song: the one its previewer keeps current on
 * the file's `update` event. The latest hold wins.
 */
export function getHeldOpenLyric(filePath: string): OpenLyric | null {
    return warmEntries.get(filePath)?.openLyrics.at(-1) ?? null;
}

/**
 * The held one FIRST, then the document's own. A stage document is cached for
 * good and nothing clears its `openLyric`, so a stage that was once a pane can
 * still carry the instance of a previewer that is long gone — and with it the
 * song as it stood then.
 */
export function resolveLiveOpenLyric(
    filePath: string,
    ownOpenLyric: OpenLyric | null,
) {
    return getHeldOpenLyric(filePath) ?? ownOpenLyric;
}

/** `null` when the song is not held: nothing may be stored for it then. */
export function getLyricWarmGeneration(filePath: string): number | null {
    return warmEntries.get(filePath)?.generation ?? null;
}

export function getLyricWarmDeck(filePath: string, stage: number, key: string) {
    const deck = warmEntries.get(filePath)?.decks.get(stage);
    if (deck === undefined || deck.key !== key) {
        return null;
    }
    return deck.slides;
}

export function setLyricWarmDeck(
    filePath: string,
    stage: number,
    key: string,
    slides: LyricSlide[],
    generation: number | null,
) {
    const entry = warmEntries.get(filePath);
    if (entry === undefined || entry.generation !== generation) {
        return;
    }
    entry.decks.set(stage, { key, slides });
}

/** The song changed: every stage's deck of it is stale. */
export function dropLyricWarmDecks(filePath: string) {
    const entry = warmEntries.get(filePath);
    if (entry === undefined) {
        return;
    }
    entry.generation = genGeneration();
    entry.decks.clear();
}
