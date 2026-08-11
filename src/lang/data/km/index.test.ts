// @vitest-environment jsdom

import { describe, expect, test } from 'vitest';

import lang from './index';

describe('Khmer language data', () => {
    test('exposes Khmer metadata, fonts, and sanitized dictionary keys', () => {
        expect(lang.locale).toBe('km-KH');
        expect(lang.langCode).toBe('km');
        expect(lang.name).toBe('Khmer');
        expect(lang.fontFamily).toBe('app-Battambang');
        expect(lang.getFontFamilyFiles?.()).toHaveLength(6);
        expect(lang.genCss()).toContain('font-family: app-Battambang');
        expect(lang.dictionary['open pptx']).toBe('បើក PPTX');
        expect(lang.dictionary['save']).toBe('រក្សាទុក');
        expect(lang.numList).toEqual([
            '០',
            '១',
            '២',
            '៣',
            '៤',
            '៥',
            '៦',
            '៧',
            '៨',
            '៩',
        ]);
        expect(lang.stopWords).toContain('និង');
        expect(lang.bibleAudioAvailable).toBe(false);
        expect(
            lang.extraBibleContextMenuItems(null as any, null as any),
        ).toEqual([]);
    });

    // `tran()` throws in dev on a key the dictionary does not have, so every
    // string newly routed through it needs an entry or it blanks the page.
    test('carries the download sub-titles and hidden-widget names', () => {
        for (const key of [
            'Video URL:',
            'Audio URL:',
            'Image URL:',
            'Web URL:',
            'Note',
            'Document List',
            'Lyric List',
            'Presenting Flow List',
            'Background',
            'Presenter',
            // Both reached `toWidgetLabel` — and therefore `tran` — while the
            // dictionary still only held the labels they REPLACED ('Document
            // List' and 'Slides'), so a Khmer dev run blanked the slide editor
            // and the presenter's note pane.
            'Canvas',
            'Slide Notes',
            'Enable',
            'Disable',
            'This item is disabled',
            'This item is disabled in this presenting flow',
            'This item is disabled in its document',
            'Duplicate',
            'Move to Top',
            'Move to Bottom',
            // Every export/import opens a dialog whose title goes through
            // `tran`, plus the optional password protection on top of it.
            'Export Document',
            'Import Document',
            'Export Bible List',
            'Import Bible List',
            'Export Presenting Flow',
            'Import Presenting Flow',
            'Export Bible Note Item',
            'Import Bible Note Item',
            'Password',
            'Confirm Password',
            'Show Password',
            'Hide Password',
            'Leave empty to export without a password',
            'Passwords do not match',
            'This archive is password protected',
            'Wrong password, try again',
            // The `Slide: Media Control` action, its row label and every field of
            // its settings panel — six fields plus three refusals, all new keys.
            'Slide: Media Control',
            'Add Media Control',
            'Media Control Settings',
            'Play',
            'Pause',
            'Stop',
            'Action',
            'Settings',
            'Delay Before',
            'Media Start At',
            'Then Pause',
            'Never',
            'After',
            'At Media Time',
            'Media Pause At',
            'Pause After',
            'Volume',
            'Speed',
            'Set Volume',
            'Set Speed',
            'Please enter a number that is 0 or greater',
            'Please enter a volume between 0 and 100',
            'The stop point must be after the start point',
            // Handing a `Next: Timeout` follower back to the element it points
            // at — the one new string of the per-attachment clock, the question
            // itself reusing `Change Timing` from the element's own menu.
            'Use Element Timing',
            // Every control of the find bar: the whole panel is icon-only, so
            // these live in `title`/`aria-label` and are the only strings a
            // Khmer operator ever sees there.
            'Find',
            'Match case',
            'Match count',
            'Next match',
            'Previous match',
            'Close find',
            'Drag to move the find panel',
            // The canvas item preview section in the slide editor's properties
            // panel, plus its camera item's opt-in live feed button.
            'Preview',
            'Start Camera',
            'Stop Camera',
            // The bible translation info popup opened from the lookup pane
            // header. Every row label goes through `tran`, and `Title` must
            // keep resolving through the pre-existing lowercase entry.
            'Bible Information',
            'Title',
            'Key',
            'Version',
            'Locale',
            'Publisher',
            'Copy Rights',
            'Legal Note',
            'Description',
            'Books',
        ]) {
            expect(lang.dictionary[lang.sanitizeTranKey(key)]).toBeDefined();
        }
    });

    test('sanitizes search text, trims zero-width characters, and transforms bible names', () => {
        expect(lang.sanitizeText('ក\u200Bខ\u200Cគ')).toBe('កខគ');
        expect(lang.sanitizePreviewText(' ក ខ \u200Bគ ')).toBe('កខគ');
        expect(lang.sanitizeFindingText('abc ក១!ខ? ២')).toBe('ក១ ខ ២');
        expect(lang.trimText(' \u200Bព្រះគម្ពីរ\u200B ')).toBe('ព្រះគម្ពីរ');
        expect(lang.endWord('ពាក្យ')).toBe('ពាក្យ\u200B');
        expect(lang.sanitizeTranKey(' Open PPTX ')).toBe('open pptx');
        expect(lang.transformBibleBookName(' ពេត្រុសទី១ ')).toEqual([
            'ពេត្រុសទី១',
            '១ ពេត្រុស',
        ]);
        expect(lang.transformBibleBookName('លោកុប្បត្តិ')).toEqual([
            'លោកុប្បត្តិ',
        ]);
    });
});
