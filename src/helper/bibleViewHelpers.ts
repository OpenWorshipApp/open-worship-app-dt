import { createContext, use, useSyncExternalStore } from 'react';

import appProvider from '../server/appProvider';
import { fontSizeSettingNames } from './constants';
import { getSetting, setSetting } from './settingHelpers';

export const BIBLE_VIEW_TEXT_CLASS = 'bible-view-text';
export const VERSE_TEXT_CLASS = 'verse-text';

export const DEFAULT_BIBLE_TEXT_FONT_SIZE = 35;
export const BibleViewFontSizeContext = createContext<number>(
    DEFAULT_BIBLE_TEXT_FONT_SIZE,
);

export function useBibleViewFontSizeContext() {
    const fontSize = use(BibleViewFontSizeContext);
    return fontSize;
}

// The reader and the presenter each remember their own bible text size.
function getFontSizeSettingName() {
    return appProvider.isPageReader
        ? fontSizeSettingNames.BIBLE_READING
        : fontSizeSettingNames.BIBLE_PRESENTER;
}

// A shared store, because the size is set by the previewer's zoom control but
// read by UI outside it (the names & locations panels). Settings are FILE
// backed, so the value is held in memory here: `useSyncExternalStore` calls its
// snapshot on every render, and going to disk each time would be a real cost on
// the low-spec machines this app targets.
let cachedFontSize: number | null = null;
const listeners = new Set<() => void>();

export function getBibleViewFontSize() {
    if (cachedFontSize === null) {
        const parsed = Number.parseInt(
            getSetting(getFontSizeSettingName()) ?? '',
            10,
        );
        cachedFontSize = Number.isNaN(parsed)
            ? DEFAULT_BIBLE_TEXT_FONT_SIZE
            : parsed;
    }
    return cachedFontSize;
}

export function setBibleViewFontSize(fontSize: number) {
    cachedFontSize = fontSize;
    setSetting(getFontSizeSettingName(), `${fontSize}`);
    for (const listener of listeners) {
        listener();
    }
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
        // Nothing is reading it any more, so the next reader re-reads the
        // setting. `useStateSettingNumber` used to do that on every mount; the
        // presenter window and the note window share the BIBLE_PRESENTER key,
        // and a cache that lived for the whole session let them drift apart
        // permanently. `appLocalStorage` caches the read itself, so a re-read
        // here costs nothing on the render path.
        if (listeners.size === 0) {
            cachedFontSize = null;
        }
    };
}

export function useBibleViewFontSize() {
    return useSyncExternalStore(
        subscribe,
        getBibleViewFontSize,
        getBibleViewFontSize,
    );
}

// The lookup panels' own base font size (`LocationNameLookupPanelComp.scss`),
// which everything inside them is sized against. Scaling by THIS rather than by
// the bible's default is what makes their body text come out at the bible text's
// size instead of merely moving in step with it: dividing by the bible default
// yields 1x at the default setting, i.e. 13.5px body beside 35px scripture.
const PANEL_BASE_FONT_SIZE = 13.5;

// Clamped because the underlying range is 5..150px: unclamped, either end leaves
// the panel unreadable or too large to show a record at all. The ceiling is the
// bible default (35 / 13.5 ≈ 2.59) rounded up, so the normal setting is reached
// exactly and only extreme zoom is capped.
const MIN_TEXT_SCALE = 0.7;
const MAX_TEXT_SCALE = 2.6;

/**
 * Zoom factor that renders panel text at the bible text's size.
 *
 * Applied as CSS `zoom` (not `transform: scale`) so the panel's layout box grows
 * with it and its content keeps scrolling inside its own widget.
 */
export function useBibleViewTextScale() {
    const fontSize = useBibleViewFontSize();
    return Math.min(
        MAX_TEXT_SCALE,
        Math.max(MIN_TEXT_SCALE, fontSize / PANEL_BASE_FONT_SIZE),
    );
}
