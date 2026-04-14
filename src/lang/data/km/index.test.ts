import { describe, expect, test } from 'vitest';

import lang from './index';

describe('Khmer language data', () => {
    test('exposes Khmer metadata, fonts, and sanitized dictionary keys', () => {
        expect(lang.locale).toBe('km-KH');
        expect(lang.langCode).toBe('km');
        expect(lang.name).toBe('Khmer');
        expect(lang.fontFamily).toBe('km-font-family');
        expect(lang.fontFamilyName).toBe('Battambang');
        expect(lang.getFontFamilyFiles()).toHaveLength(5);
        expect(lang.genCss()).toContain('font-family: km-font-family');
        expect(lang.dictionary['open pptx']).toBe('បើក PPTX');
        expect(lang.dictionary['save']).toBe('រក្សាទុក');
        expect(lang.numList).toEqual(['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩']);
        expect(lang.stopWords).toContain('និង');
        expect(lang.bibleAudioAvailable).toBe(false);
        expect(lang.extraBibleContextMenuItems(null as any, null as any)).toEqual([]);
    });

    test('sanitizes search text, trims zero-width characters, and transforms bible names', () => {
        expect(lang.sanitizeText('ក\u200Bខ\u200Cគ')).toBe('កខគ');
        expect(lang.sanitizePreviewText(' ក ខ \u200Bគ ')).toBe('កខគ');
        expect(lang.sanitizeFindingText('abc ក១!ខ? ២')).toBe('ក១ ខ ២');
        expect(lang.trimText(' \u200Bព្រះគម្ពីរ\u200B ')).toBe('ព្រះគម្ពីរ');
        expect(lang.endWord('ពាក្យ')).toBe('ពាក្យ\u200B');
        expect(lang.sanitizeTranKey(' Open PPTX ')).toBe('open pptx');
        expect(lang.transformBibleBookName(' ពេត្រុសទី១ ')).toBe('១ ពេត្រុស');
        expect(lang.transformBibleBookName('លោកុប្បត្តិ')).toBe('លោកុប្បត្តិ');
    });
});
