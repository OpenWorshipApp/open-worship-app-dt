import { describe, expect, test } from 'vitest';

import lang from './index';

describe('English language data', () => {
    test('exposes the expected static metadata and helper defaults', () => {
        expect(lang.locale).toBe('en-US');
        expect(lang.langCode).toBe('en');
        expect(lang.name).toBe('English');
        expect(lang.genCss()).toBe('');
        expect(lang.numList).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
        expect(lang.dictionary).toEqual({});
        expect(lang.flagSVG.trim().startsWith('<svg')).toBe(true);
        expect(lang.stopWords).toContain('the');
        expect(lang.bibleAudioAvailable).toBe(true);
        expect(lang.extraBibleContextMenuItems(null as any, null as any)).toEqual([]);
    });

    test('sanitizes, trims, and transforms text with English-specific rules', () => {
        expect(lang.sanitizeText('Hello')).toBe('Hello');
        expect(lang.sanitizePreviewText('Preview')).toBe('Preview');
        expect(lang.sanitizeFindingText('  Hello, WORLD!!  Psalm-23  ')).toBe(
            'hello world psalm 23',
        );
        expect(lang.trimText('  around  ')).toBe('around');
        expect(lang.endWord('word')).toBe('word ');
        expect(lang.sanitizeTranKey('Save')).toBe('Save');
        expect(lang.transformBibleBookName('1 Peter')).toBe('1 Peter');
    });
});
