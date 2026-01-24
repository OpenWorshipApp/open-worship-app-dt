import type { CSSProperties } from 'react';
import { createContext, use } from 'react';

export const BIBLE_VIEW_TEXT_CLASS = 'bible-view-text';
export const VERSE_TEXT_CLASS = 'verse-text';

export function fontSizeToHeightStyle(fontSize: number): CSSProperties {
    return { height: fontSize >= 20 ? fontSize + 30 : undefined };
}

export const DEFAULT_BIBLE_TEXT_FONT_SIZE = 35;
export const BibleViewFontSizeContext = createContext<number>(
    DEFAULT_BIBLE_TEXT_FONT_SIZE,
);

export function useBibleViewFontSizeContext() {
    const fontSize = use(BibleViewFontSizeContext);
    return fontSize;
}
