import { describe, expect, it } from 'vitest';

import { toBibleTextStyleView } from '../_screen/bibleTextStyleHelpers';
import { describeScreenStyle } from '../helper/agentScreenControlRules';
import {
    checkIsScreenSettingKind,
    checkNeedsScreenEditRead,
    genScreenChangeLaterText,
    genScreenSettingText,
} from './screenStateAnswerHelpers';

// Three screens as `owa_list_screens` holds them: 0 on a named monitor with
// a passage in two Bibles, 1 on the primary monitor, locked and ticked, 2 on
// no monitor here (no `display`), ticked.
const LIST_STATE = {
    showingScreenIds: [0],
    displays: [
        { id: 7, label: 'DELL U2419H', width: 1920, height: 1080 },
        { id: 1, isPrimary: true, width: 2560, height: 1440 },
        { id: 9 },
    ],
    screens: [
        {
            screenId: 1,
            isLocked: true,
            isSelected: true,
            display: { id: 1 },
            stage: 2,
            bible: null,
        },
        {
            screenId: 0,
            isLocked: false,
            isSelected: false,
            display: { id: 7, label: 'DELL U2419H' },
            stage: 0,
            bible: {
                reference: 'John 3:16',
                version: 'KJV',
                versions: ['KJV', 'NIV'],
            },
        },
        {
            screenId: 2,
            isLocked: false,
            isSelected: true,
            stage: 0,
            bible: { reference: 'Psalm 23:1', version: 'ESV' },
        },
    ],
};

// The same screens as `owa_screen_edit`'s read has them.
const EDIT_STATE = {
    screens: [
        {
            id: 0,
            group: 'red',
            transition: {
                slide: 'zoom',
                background: 'none',
                foreground: 'fade',
            },
            lineSync: true,
        },
        {
            id: 1,
            group: null,
            transition: {
                slide: 'fade',
                background: 'fade',
                foreground: 'move',
            },
            lineSync: false,
        },
        {
            id: 2,
            group: 'red',
            transition: {
                slide: 'fade',
                background: 'fade',
                foreground: 'fade',
            },
            lineSync: false,
        },
    ],
    bibleStyle: describeScreenStyle(
        toBibleTextStyleView({ fontSize: 72, isBold: true }),
    ),
};

describe('genScreenSettingText', () => {
    it('names the monitor each screen is on, or that it is on none here', () => {
        expect(genScreenSettingText('display', LIST_STATE, null)).toBe(
            'Screen 0 is on DELL U2419H (1920×1080). ' +
                'Screen 1 is on Primary display (2560×1440). ' +
                'Screen 2 is on no monitor here.',
        );
    });

    it('names a monitor with no label by its number', () => {
        const state = {
            displays: [{ id: 9 }],
            screens: [{ screenId: 0, display: { id: 9 } }],
        };
        expect(genScreenSettingText('display', state, null)).toBe(
            'Screen 0 is on Display 9.',
        );
    });

    // The computer's own monitor, named by the system: the display menu
    // marks it primary, and a screen there covers the operator's window.
    it('marks a named primary monitor, and one no longer here', () => {
        const state = {
            displays: [
                {
                    id: 3,
                    label: 'Display',
                    width: 1920,
                    height: 1080,
                    isPrimary: true,
                },
            ],
            screens: [
                { screenId: 0, display: { id: 3, label: 'Display' } },
                { screenId: 1, display: { id: 4, label: 'Gone' } },
            ],
        };
        expect(genScreenSettingText('display', state, null)).toBe(
            'Screen 0 is on Display (1920×1080, primary). ' +
                'Screen 1 is on no monitor here.',
        );
    });

    it('says which screens are locked, their stages and the tick', () => {
        expect(genScreenSettingText('lock', LIST_STATE, null)).toBe(
            'Screen 0 is not locked. Screen 1 is locked. ' +
                'Screen 2 is not locked.',
        );
        expect(genScreenSettingText('stage', LIST_STATE, null)).toBe(
            'Screen 0 is on stage 0. Screen 1 is on stage 2. ' +
                'Screen 2 is on stage 0.',
        );
        expect(genScreenSettingText('select', LIST_STATE, null)).toBe(
            'Screens 1, 2 are ticked, so what you present next goes there.',
        );
        const one = {
            screens: [
                { screenId: 0, isSelected: false },
                { screenId: 1, isSelected: true },
            ],
        };
        expect(genScreenSettingText('select', one, null)).toBe(
            'Screen 1 is ticked, so what you present next goes there.',
        );
        const none = { screens: [{ screenId: 0, isSelected: false }] };
        expect(genScreenSettingText('select', none, null)).toBe(
            'No screen is ticked, so what you present next goes to none of ' +
                'them.',
        );
    });

    it('names each screen passage with every Bible it is shown in', () => {
        expect(genScreenSettingText('versions', LIST_STATE, null)).toBe(
            'Screen 0 shows John 3:16 (KJV, NIV). ' +
                'Screen 1 shows no Bible passage. ' +
                'Screen 2 shows Psalm 23:1 (ESV).',
        );
    });

    it('reads the transitions, the groups and Line Sync off the read', () => {
        expect(genScreenSettingText('transition', LIST_STATE, EDIT_STATE)).toBe(
            'Screen 0 changes slides with zoom, the background with none and ' +
                'the foreground with fade. Screen 1 changes slides with fade, ' +
                'the background with fade and the foreground with move. ' +
                'Screen 2 changes slides with fade, the background with fade ' +
                'and the foreground with fade.',
        );
        expect(genScreenSettingText('group', LIST_STATE, EDIT_STATE)).toBe(
            'Screens 0, 2 are grouped, so they show the same thing.',
        );
        expect(genScreenSettingText('lineSync', LIST_STATE, EDIT_STATE)).toBe(
            'Line Sync is on for screen 0. Line Sync is off for screen 1. ' +
                'Line Sync is off for screen 2.',
        );
    });

    it('says no screens are grouped when one colour holds a screen alone', () => {
        const alone = {
            screens: [
                { id: 0, group: 'blue' },
                { id: 1, group: null },
            ],
        };
        expect(genScreenSettingText('group', LIST_STATE, alone)).toBe(
            'No screens are grouped.',
        );
    });

    // The size is read off the front of `describeScreenStyle`'s words: a
    // change to how they start fails here.
    it('says the Bible text size off the style the read describes', () => {
        expect(genScreenSettingText('style', LIST_STATE, EDIT_STATE)).toBe(
            'The Bible text is 72 pixels high on every screen.',
        );
    });

    // EC-630: after a screen is added, the screens there are -- the
    // monitor each is on, and which are ticked; a new one is ticked by
    // nobody.
    it('says the screens there are after one is added', () => {
        expect(genScreenSettingText('newScreen', LIST_STATE, null)).toBe(
            'Screen 0 is on DELL U2419H (1920×1080). ' +
                'Screen 1 is on Primary display (2560×1440). ' +
                'Screen 2 is on no monitor here. ' +
                'Screens 1, 2 are ticked, so what you present next goes ' +
                'there.',
        );
        expect(genScreenSettingText('newScreen', {}, null)).toBe(null);
        // Once added, its own monitor alone, by its number; a number the
        // read lacks says them all.
        expect(genScreenSettingText('newScreen', LIST_STATE, null, 2)).toBe(
            'Screen 2 is on no monitor here. ' +
                'Screens 1, 2 are ticked, so what you present next goes ' +
                'there.',
        );
        expect(
            genScreenSettingText('newScreen', LIST_STATE, null, 5),
        ).toContain('Screen 0 is on DELL U2419H (1920×1080).');
        expect(genScreenSettingText('display', LIST_STATE, null, 2)).toContain(
            'Screen 0 is on DELL U2419H (1920×1080).',
        );
    });

    it('says nothing for a kind the state does not answer, or no state', () => {
        expect(genScreenSettingText('clear', LIST_STATE, EDIT_STATE)).toBe(
            null,
        );
        expect(genScreenSettingText('screen', LIST_STATE, EDIT_STATE)).toBe(
            null,
        );
        expect(genScreenSettingText(null, LIST_STATE, EDIT_STATE)).toBe(null);
        expect(genScreenSettingText('transition', LIST_STATE, null)).toBe(null);
        expect(genScreenSettingText('style', LIST_STATE, {})).toBe(null);
        expect(genScreenSettingText('display', {}, null)).toBe(null);
    });
});

describe('the kinds', () => {
    it('reads the screens’ own controls, the quiet read for four', () => {
        for (const kind of [
            'display',
            'lock',
            'stage',
            'select',
            'versions',
            'transition',
            'group',
            'lineSync',
            'style',
        ] as const) {
            expect(checkIsScreenSettingKind(kind)).toBe(true);
        }
        expect(checkIsScreenSettingKind('clear')).toBe(false);
        // A screen added is a change, never a setting the state answers.
        expect(checkIsScreenSettingKind('newScreen')).toBe(false);
        expect(checkNeedsScreenEditRead('newScreen')).toBe(false);
        expect(checkIsScreenSettingKind('screen')).toBe(false);
        expect(checkIsScreenSettingKind(null)).toBe(false);
        expect(
            ['transition', 'group', 'lineSync', 'style'].every((kind) => {
                return checkNeedsScreenEditRead(kind as 'group');
            }),
        ).toBe(true);
        expect(checkNeedsScreenEditRead('display')).toBe(false);
        expect(checkNeedsScreenEditRead(null)).toBe(false);
    });

    it('closes with how the change will be made', () => {
        expect(genScreenChangeLaterText()).toBe(
            'To change it, ask again when an assistant can answer, or ask ' +
                'me how to do it yourself.',
        );
    });
});
