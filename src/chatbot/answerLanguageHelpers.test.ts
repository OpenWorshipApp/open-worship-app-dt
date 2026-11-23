import { describe, expect, test } from 'vitest';

import { OPEN_LYRIC_FENCE_LIST } from '../../tools/owa-devtools-mcp/openLyric.mjs';
import {
    LYRIC_PART_NAME_LIST,
    NATIVE_MENU_ITEM_MAP,
    repairHalfTranslatedLabels,
} from './answerLanguageHelpers';

describe('toAnswerShownInLanguage', () => {
    test('the native menu items are the ones electronMenu.ts writes', async () => {
        const { readFileSync } = await import('node:fs');
        const source = readFileSync('electron/electronMenu.ts', 'utf-8');
        const labelList = [...source.matchAll(/label: ['`]([^'`$]+)['`]/g)]
            .map((match) => {
                return match[1];
            })
            .filter((label) => {
                return ![
                    'File',
                    'Edit',
                    'View',
                    'Tools',
                    'Window',
                    'Insert',
                    'Preferences...',
                ].includes(label);
            });
        const listed = Object.values(NATIVE_MENU_ITEM_MAP).flat();
        // Two are written as a constant, shared with the taskbar's jump list
        // and with the reset's own dialog; `appMenuAgentHelpers.test` holds
        // the reset's words.
        expect(source).toContain('label: RESET_WINDOW_BOUNDS_LABEL');
        expect(source).toContain('label: FACTORY_RESET_LABEL');
        expect(new Set(listed)).toEqual(
            new Set([...labelList, 'Reset Position and Size', 'Factory Reset']),
        );
    });

    test('the song part names are the Open Lyric fences', () => {
        expect(LYRIC_PART_NAME_LIST).toEqual(
            OPEN_LYRIC_FENCE_LIST.map((fence) => {
                return fence.header;
            }),
        );
    });
});

describe('a window button named half translated (2026-11-21)', () => {
    // a made-up language: the Undo button's three words are "Zundo zeta zange"
    const translateLabel = (label: string) => {
        return label === 'Undo this change' ? 'Zundo zeta zange' : label;
    };

    test('its start in the language, its end in English: written whole', () => {
        // the shape seen live: the first word translated, "this change"
        // left in English
        expect(
            repairHalfTranslatedLabels(
                'Zuse "Zundo this change" zo zack.',
                translateLabel,
            ),
        ).toBe('Zuse "Zundo zeta zange" zo zack.');
        expect(
            repairHalfTranslatedLabels('**Zundo zeta change**', translateLabel),
        ).toBe('**Zundo zeta zange**');
    });

    test('anything else is left as it is', () => {
        for (const text of [
            'Zundo zeta zange is the button.',
            // the English alone is the next pass's: a whole label
            'Undo this change puts it back.',
            // a word that only ends like it
            'Mazundo this change',
            'Zundo changes',
        ]) {
            expect(repairHalfTranslatedLabels(text, translateLabel)).toBe(text);
        }
        // a language with no word of its own for it
        expect(
            repairHalfTranslatedLabels('Zundo this change', (label) => label),
        ).toBe('Zundo this change');
    });
});
