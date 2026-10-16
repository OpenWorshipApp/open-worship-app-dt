import { describe, expect, test } from 'vitest';

import {
    dropLyricWarmDecks,
    getHeldOpenLyric,
    getLyricWarmDeck,
    getLyricWarmGeneration,
    holdLyricWarmSlides,
    resolveLiveOpenLyric,
    setLyricWarmDeck,
} from './lyricWarmSlidesHelpers';

// The module keeps one map for the whole renderer, so every test uses a path
// of its own and releases what it holds.
const DECK = [{ id: 0 }, { id: 1 }] as any[];
const OPEN_LYRIC_A = { name: 'a' } as any;
const OPEN_LYRIC_B = { name: 'b' } as any;

describe('lyricWarmSlidesHelpers', () => {
    test('nothing is stored for a song no pane holds', () => {
        const filePath = '/not-held.owl';
        expect(getLyricWarmGeneration(filePath)).toBeNull();
        setLyricWarmDeck(filePath, 0, 'k', DECK, null);
        setLyricWarmDeck(filePath, 0, 'k', DECK, 0);
        expect(getLyricWarmDeck(filePath, 0, 'k')).toBeNull();
        expect(getHeldOpenLyric(filePath)).toBeNull();
    });

    test('a held deck is served only for its own stage and key', () => {
        const filePath = '/held.owl';
        const release = holdLyricWarmSlides(filePath, OPEN_LYRIC_A);
        const generation = getLyricWarmGeneration(filePath);
        expect(generation).not.toBeNull();
        setLyricWarmDeck(filePath, 2, 'key-2', DECK, generation);

        expect(getLyricWarmDeck(filePath, 2, 'key-2')).toBe(DECK);
        // The stage's style, font or display moved on since it was built.
        expect(getLyricWarmDeck(filePath, 2, 'key-2-changed')).toBeNull();
        expect(getLyricWarmDeck(filePath, 1, 'key-2')).toBeNull();
        release();
    });

    test('the last release frees the song and its decks', () => {
        const filePath = '/ref-counted.owl';
        const releaseA = holdLyricWarmSlides(filePath, OPEN_LYRIC_A);
        const releaseB = holdLyricWarmSlides(filePath, OPEN_LYRIC_B);
        setLyricWarmDeck(
            filePath,
            0,
            'k',
            DECK,
            getLyricWarmGeneration(filePath),
        );
        // The latest hold is the live one.
        expect(getHeldOpenLyric(filePath)).toBe(OPEN_LYRIC_B);

        releaseB();
        // A floating preview closing must not free what the main one shows.
        expect(getHeldOpenLyric(filePath)).toBe(OPEN_LYRIC_A);
        expect(getLyricWarmDeck(filePath, 0, 'k')).toBe(DECK);
        // A release called twice (StrictMode) must not drop the other hold.
        releaseB();
        expect(getHeldOpenLyric(filePath)).toBe(OPEN_LYRIC_A);

        releaseA();
        expect(getHeldOpenLyric(filePath)).toBeNull();
        expect(getLyricWarmGeneration(filePath)).toBeNull();
        expect(getLyricWarmDeck(filePath, 0, 'k')).toBeNull();
    });

    test('a deck built before an edit is refused after the drop', () => {
        const filePath = '/edited.owl';
        const release = holdLyricWarmSlides(filePath, OPEN_LYRIC_A);
        setLyricWarmDeck(
            filePath,
            0,
            'k',
            DECK,
            getLyricWarmGeneration(filePath),
        );
        // A build starts from the text as it stands...
        const staleGeneration = getLyricWarmGeneration(filePath);
        // ...and the song is edited while it runs.
        dropLyricWarmDecks(filePath);
        expect(getLyricWarmDeck(filePath, 0, 'k')).toBeNull();

        setLyricWarmDeck(filePath, 0, 'k', DECK, staleGeneration);
        expect(getLyricWarmDeck(filePath, 0, 'k')).toBeNull();

        // A build started after the drop is kept.
        const freshDeck = [{ id: 0 }] as any[];
        setLyricWarmDeck(
            filePath,
            0,
            'k',
            freshDeck,
            getLyricWarmGeneration(filePath),
        );
        expect(getLyricWarmDeck(filePath, 0, 'k')).toBe(freshDeck);
        release();
    });

    test('a build from an earlier hold is refused by the next one', () => {
        const filePath = '/reselected.owl';
        const releaseFirst = holdLyricWarmSlides(filePath, OPEN_LYRIC_A);
        // A build starts while the song is selected...
        const firstGeneration = getLyricWarmGeneration(filePath);
        // ...the song is deselected, edited and selected again before it ends.
        releaseFirst();
        const releaseSecond = holdLyricWarmSlides(filePath, OPEN_LYRIC_B);
        setLyricWarmDeck(filePath, 0, 'k', DECK, firstGeneration);
        expect(getLyricWarmDeck(filePath, 0, 'k')).toBeNull();
        releaseSecond();
    });

    test('the held OpenLyric wins over a document’s own', () => {
        const filePath = '/live.owl';
        const stale = { name: 'stale' } as any;
        expect(resolveLiveOpenLyric(filePath, stale)).toBe(stale);
        expect(resolveLiveOpenLyric(filePath, null)).toBeNull();

        const release = holdLyricWarmSlides(filePath, OPEN_LYRIC_A);
        // A stage document cached from an earlier previewer still carries
        // that previewer's instance — the song as it stood then.
        expect(resolveLiveOpenLyric(filePath, stale)).toBe(OPEN_LYRIC_A);
        release();
        expect(resolveLiveOpenLyric(filePath, stale)).toBe(stale);
    });
});
