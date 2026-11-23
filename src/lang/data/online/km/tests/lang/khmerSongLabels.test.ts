// @vitest-environment jsdom
import type { LanguageDataType } from '../../../../../langHelpers';
import { OpenLyric } from 'open-lyric';
import { KHMER_CALL_TO_WORSHIP_EXAMPLE } from 'open-lyric-plugin-km-kh';
import { describe, expect, test, vi } from 'vitest';

import { loadSourceLangData } from '../../../../../langSourceFiles';

// The package as the plugin build makes it: its folder's data through the
// one factory every language shares (`../../../onlineLangPackage.ts`).
const khmer: LanguageDataType = await loadSourceLangData('km');

const LOCALES_PATTERN = /^(\s*-\s*Locales:\s*).*$/m;

// A Khmer song's card read "Attachments:" and "Key:" in English in a Khmer
// app: the song plugin went to the editor alone (robot run 20261120-2021
// F-10), and a song with no `Locales` was English even after that.
function genPreview(value: string, labelLocale?: string) {
    const openLyric = new OpenLyric();
    openLyric.value = value;
    khmer.initOpenLyricPlugins!({
        openLyric,
        genOpenLyricFontFaces: vi.fn(),
    });
    if (labelLocale !== undefined) {
        // What the app does: its own language, not the song's.
        openLyric.labelLocale = labelLocale;
    }
    return openLyric;
}

function expectKhmerLabels(labels: Record<string, string>) {
    for (const label of ['Attachments', 'Key', 'Time', 'Tempo']) {
        expect([label, labels[label]]).not.toEqual([label, label]);
        expect(labels[label]).toMatch(/\p{Script=Khmer}/u);
    }
}

describe('song labels with the Khmer package', () => {
    test('a song saying km-KH reads them in Khmer even on its own', () => {
        expectKhmerLabels(
            genPreview(KHMER_CALL_TO_WORSHIP_EXAMPLE).resolvedLabels,
        );
    });

    test('in a Khmer app every song does, whatever its Locales say', () => {
        const english = KHMER_CALL_TO_WORSHIP_EXAMPLE.replace(
            LOCALES_PATTERN,
            '$1en-US',
        );
        const none = KHMER_CALL_TO_WORSHIP_EXAMPLE.replace(LOCALES_PATTERN, '');
        expect(english).not.toBe(KHMER_CALL_TO_WORSHIP_EXAMPLE);
        expect(none).not.toMatch(/Locales/);
        expectKhmerLabels(genPreview(english, khmer.locale).resolvedLabels);
        expectKhmerLabels(genPreview(none, khmer.locale).resolvedLabels);
    });

    test('in an English app a Khmer song keeps English labels', () => {
        const labels = genPreview(
            KHMER_CALL_TO_WORSHIP_EXAMPLE,
            'en-US',
        ).resolvedLabels;
        expect(labels.Attachments ?? 'Attachments').toBe('Attachments');
    });
});
