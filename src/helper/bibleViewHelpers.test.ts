import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    settings: new Map<string, string>(),
    isPageReader: false,
    // `useSyncExternalStore` is the store's only reader; a pass-through hands
    // back the real subscribe/getSnapshot pair without needing a renderer.
    capturedSubscribe: null as null | ((listener: () => void) => () => void),
}));

vi.mock('../server/appProvider', () => ({
    default: {
        get isPageReader() {
            return h.isPageReader;
        },
        systemUtils: { isDev: false },
    },
}));
vi.mock('./settingHelpers', () => ({
    getSetting: (key: string) => h.settings.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        h.settings.set(key, value);
    },
}));
vi.mock('react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react')>();
    return {
        ...actual,
        useSyncExternalStore: (
            subscribe: (listener: () => void) => () => void,
            getSnapshot: () => unknown,
        ) => {
            h.capturedSubscribe = subscribe;
            return getSnapshot();
        },
    };
});

import {
    DEFAULT_BIBLE_TEXT_FONT_SIZE,
    getBibleViewFontSize,
    setBibleViewFontSize,
    useBibleViewFontSize,
    useBibleViewTextScale,
} from './bibleViewHelpers';
import { fontSizeSettingNames } from './constants';

function subscribe(listener: () => void) {
    useBibleViewFontSize();
    return h.capturedSubscribe!(listener);
}

// The in-memory cache is module-level; drop it between tests by letting the
// last listener go, which is what the store does in production too.
function resetStore() {
    const unsubscribe = subscribe(() => {});
    unsubscribe();
}

beforeEach(() => {
    h.settings.clear();
    h.isPageReader = false;
    resetStore();
});

describe('which setting the size is read from', () => {
    test('the presenter and the reader remember their own size', () => {
        h.isPageReader = false;
        setBibleViewFontSize(42);
        expect(h.settings.get(fontSizeSettingNames.BIBLE_PRESENTER)).toBe('42');
        expect(h.settings.has(fontSizeSettingNames.BIBLE_READING)).toBe(false);

        h.isPageReader = true;
        resetStore();
        setBibleViewFontSize(21);
        expect(h.settings.get(fontSizeSettingNames.BIBLE_READING)).toBe('21');
        // The presenter's own choice is untouched.
        expect(h.settings.get(fontSizeSettingNames.BIBLE_PRESENTER)).toBe('42');
    });
});

describe('reading the size', () => {
    test('falls back to the default when nothing is stored', () => {
        expect(getBibleViewFontSize()).toBe(DEFAULT_BIBLE_TEXT_FONT_SIZE);
    });

    // A settings file can hold anything; `Number.parseInt('') === NaN` would
    // otherwise propagate into a `font-size` and blank the text.
    test('falls back to the default for a non-numeric setting', () => {
        h.settings.set(fontSizeSettingNames.BIBLE_PRESENTER, 'not-a-number');
        expect(getBibleViewFontSize()).toBe(DEFAULT_BIBLE_TEXT_FONT_SIZE);

        resetStore();
        h.settings.set(fontSizeSettingNames.BIBLE_PRESENTER, '');
        expect(getBibleViewFontSize()).toBe(DEFAULT_BIBLE_TEXT_FONT_SIZE);
    });

    test('reads a stored size', () => {
        h.settings.set(fontSizeSettingNames.BIBLE_PRESENTER, '60');
        expect(getBibleViewFontSize()).toBe(60);
    });

    // `useSyncExternalStore` calls the snapshot on EVERY render and the setting
    // is a synchronous file read, so it must be read once and held.
    test('does not go back to the setting on every read', () => {
        h.settings.set(fontSizeSettingNames.BIBLE_PRESENTER, '60');
        expect(getBibleViewFontSize()).toBe(60);

        // A write behind the store's back is invisible while it is being read.
        h.settings.set(fontSizeSettingNames.BIBLE_PRESENTER, '99');
        expect(getBibleViewFontSize()).toBe(60);
    });

    // ...but the cache must not outlive the last reader, or two windows on the
    // same key drift apart for the rest of the session.
    test('re-reads the setting once nothing is subscribed', () => {
        const unsubscribe = subscribe(() => {});
        h.settings.set(fontSizeSettingNames.BIBLE_PRESENTER, '60');
        expect(getBibleViewFontSize()).toBe(DEFAULT_BIBLE_TEXT_FONT_SIZE);

        unsubscribe();
        expect(getBibleViewFontSize()).toBe(60);
    });
});

describe('writing the size', () => {
    test('notifies every subscriber', () => {
        const first = vi.fn();
        const second = vi.fn();
        const unsubscribeFirst = subscribe(first);
        const unsubscribeSecond = subscribe(second);

        setBibleViewFontSize(50);

        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
        expect(useBibleViewFontSize()).toBe(50);

        unsubscribeFirst();
        unsubscribeSecond();
    });

    test('an unsubscribed reader stops being notified', () => {
        const listener = vi.fn();
        subscribe(listener)();

        setBibleViewFontSize(50);

        expect(listener).not.toHaveBeenCalled();
    });
});

describe('the text scale chrome tracks', () => {
    // The panels' own base font size, which the scale is relative to so their
    // body text lands ON the bible text's size rather than merely moving with
    // it (dividing by the bible default would give 1x — 13.5px beside 35px).
    const PANEL_BASE_FONT_SIZE = 13.5;

    test('renders panel body text at the bible text size', () => {
        setBibleViewFontSize(DEFAULT_BIBLE_TEXT_FONT_SIZE);
        const scale = useBibleViewTextScale();
        expect(PANEL_BASE_FONT_SIZE * scale).toBeCloseTo(
            DEFAULT_BIBLE_TEXT_FONT_SIZE,
            1,
        );
    });

    test('follows the size in between', () => {
        setBibleViewFontSize(27);
        expect(useBibleViewTextScale()).toBeCloseTo(
            27 / PANEL_BASE_FONT_SIZE,
            5,
        );
    });

    // The font-size range is 5..150px; a panel at either end would be unusable,
    // so the scale is clamped even though the bible text itself is not.
    test('is clamped at both ends', () => {
        setBibleViewFontSize(5);
        expect(useBibleViewTextScale()).toBe(0.7);

        setBibleViewFontSize(150);
        expect(useBibleViewTextScale()).toBe(2.6);
    });
});
