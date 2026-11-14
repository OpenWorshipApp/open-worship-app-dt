import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The languages the window reads: none but English unless a test hands it
// a made-up one, so what the checkout's packages hold changes nothing here.
const mocks = vi.hoisted(() => {
    return {
        languages: [] as unknown[],
    };
});

vi.mock('./chatLangHelpers', async (importOriginal) => {
    return {
        ...(await importOriginal<object>()),
        listAssistantLanguages: () => {
            return mocks.languages;
        },
        listTypedLanguages: () => {
            return [];
        },
    };
});

import { setChatTranslator } from './chatTranHelpers';
import {
    genScreenChangeOffers,
    genScreenOfferText,
    readScreenStyleChange,
} from './screenChangeOfferHelpers';
import type { ScreenAskReadType } from './typedScreenAskHelpers';

// `owa_screen_edit`'s read, as the module's own test writes it: screen 0
// on and ticked, showing John 3:16 in the KJV; screen 1 off.
function genScreen(id: number, change: Record<string, unknown> = {}) {
    return {
        id,
        on: id === 0,
        ticked: id === 0,
        locked: false,
        group: null,
        stage: 0,
        display: `Virtual Display ${id + 1} (id ${id + 11}, virtual: on no monitor here)`,
        transition: { slide: 'fade', background: 'fade', foreground: 'fade' },
        lineSync: false,
        bible: id === 0 ? { reference: 'John 3:16', versions: ['KJV'] } : null,
        ...change,
    };
}

function genState(change: (state: any) => void = () => {}) {
    const state: any = {
        screens: [genScreen(0), genScreen(1)],
        bibleStyle: '65px, words #FFFFFF',
        displays: [
            { id: 1, name: 'Built-in Retina Display' },
            { id: 11, name: 'Virtual Display 1' },
            { id: 12, name: 'Virtual Display 2' },
        ],
        bibles: [
            'KJV: King James Version (English)',
            'NIV: New International Version (English)',
            'BSB: Berean Standard Bible (English)',
        ],
    };
    change(state);
    return state;
}

function offer(
    line: string,
    kind: ScreenAskReadType | null,
    state: any = genState(),
) {
    return genScreenChangeOffers(line, kind, state).map((action) => {
        return { label: action.label, ...(action.args as any) };
    });
}

function setTranslation(dictionary: Record<string, string>) {
    const translate = (key: string) => {
        return dictionary[key] ?? key;
    };
    setChatTranslator(translate, translate);
}

// Signs, not letters: a made-up window language's labels.
const STAR = '★';
const CROSS = '✚✚';
const DIAMONDS = '◆◆';
const TRIANGLES = '▲▲';

beforeEach(() => {
    mocks.languages = [];
});

afterEach(() => {
    setTranslation({});
});

describe('the Bible text look, read in English', () => {
    test.each([
        [
            'Put the Bible text back at the default size',
            { size: 'default' },
            'Font Size: Default',
        ],
        [
            'Make the verse smaller',
            { size: 'smaller' },
            'Make the words smaller',
        ],
        ['Put the verse in italics', { italic: true }, 'Italic'],
        ['Give the words a glow', { glow: true }, 'Glow'],
        ['Align it to the left', { align: 'left' }, 'Align left'],
        ['Right-align the verse', { align: 'right' }, 'Align right'],
        ['Justify the text', { align: 'justify' }, 'Justify'],
        [
            'Spread the lines further apart',
            { lineHeight: 'looser' },
            'Line Height +',
        ],
    ])('%s', (line, style, label) => {
        expect(offer(line, 'style')).toEqual([
            { label, kind: 'style', set: { style } },
        ]);
    });

    test('a thin outline, its colour said after it', () => {
        expect(readScreenStyleChange('Give it a thin outline in red')).toEqual(
            expect.objectContaining({
                set: expect.objectContaining({
                    outline: 'thin',
                    outlineColor: 'red',
                }),
            }),
        );
    });

    test('an alignment already so is not offered again', () => {
        expect(
            offer(
                'Align it to the right',
                'style',
                genState((state) => {
                    state.bibleStyle = '65px, words #FFFFFF, right';
                }),
            ),
        ).toEqual([]);
    });
});

describe('the Bible text look, as a window in another language shows it', () => {
    test('a label read by its English word and as shown is one change', () => {
        setTranslation({ Bold: CROSS });
        expect(offer(`bold ${CROSS}`, 'style')).toEqual([
            { label: CROSS, kind: 'style', set: { style: { bold: true } } },
        ]);
    });

    test('Reset as shown, with what it keeps said', () => {
        setTranslation({ Reset: TRIANGLES });
        const [action] = genScreenChangeOffers(
            `${STAR} ${TRIANGLES}`,
            'style',
            genState(),
        );
        expect(action.label).toBe(TRIANGLES);
        expect(action.title).toBe('Plain words again; the size stays');
        expect(action.args).toEqual({
            kind: 'style',
            set: { style: { reset: true } },
        });
    });

    test('a label the window shows as nothing is read in no line', () => {
        setTranslation({ Bold: '' });
        expect(offer(`${STAR} ${STAR}`, 'style')).toEqual([]);
        expect(readScreenStyleChange(`${STAR} ${DIAMONDS}`)).toBeNull();
    });
});

// A made-up language, its words invented: what its `assistant.json` says
// as patterns and colour words.
function genMadeUpLanguage() {
    return {
        code: 'xx',
        name: 'Madeup',
        colorWords: { zorbic: '#ff0000' },
        textSizeAskPatterns: {
            larger: [/^zib bigga$/u],
            smaller: [/^zib smolla$/u],
            set: [/^zib (?<size>\d{2,3})$/u],
        },
        noteStyleAskPatterns: {
            bold: [/^blorg$/u],
            italic: [/^slanta$/u],
            center: [/^midda$/u],
            left: [/^lefta$/u],
            right: [/^righta$/u],
            justify: [/^justa$/u],
            clear: [/^plainy$/u],
        },
    };
}

describe('the Bible text look, in a language’s own words', () => {
    beforeEach(() => {
        mocks.languages = [genMadeUpLanguage()];
    });

    test.each([
        ['zib bigga', { size: 'larger' }, 'Make the words larger'],
        ['zib smolla', { size: 'smaller' }, 'Make the words smaller'],
        ['zib 72', { size: 72 }, 'Font Size: 72'],
        ['blorg', { bold: true }, 'Bold'],
        ['slanta', { italic: true }, 'Italic'],
        ['midda', { align: 'center' }, 'Align center'],
        ['lefta', { align: 'left' }, 'Align left'],
        ['righta', { align: 'right' }, 'Align right'],
        ['justa', { align: 'justify' }, 'Justify'],
        ['zorbic', { color: '#ff0000' }, 'Text Color: zorbic'],
    ])('%s', (line, style, label) => {
        expect(offer(line, 'style')).toEqual([
            { label, kind: 'style', set: { style } },
        ]);
    });

    test('a size said inside a longer line', () => {
        expect(readScreenStyleChange('yes zib bigga now')?.set).toEqual({
            size: 'larger',
        });
        expect(readScreenStyleChange('yes zib smolla now')?.set).toEqual({
            size: 'smaller',
        });
    });

    test('plain words again, with what it keeps said', () => {
        const [action] = genScreenChangeOffers('plainy', 'style', genState());
        expect(action.label).toBe('Reset');
        expect(action.title).toBe('Plain words again; the size stays');
    });
});

describe('Line Sync', () => {
    const twoVersions = (change: Record<string, unknown> = {}) => {
        return genState((state) => {
            state.screens[0] = genScreen(0, {
                bible: { reference: 'John 3:16', versions: ['KJV', 'NIV'] },
                ...change,
            });
        });
    };

    test('a locked screen, and one already so, are not offered', () => {
        expect(
            offer(
                'Line the two versions up',
                'lineSync',
                twoVersions({ locked: true }),
            ),
        ).toEqual([]);
        expect(
            offer(
                'Line the two versions up',
                'lineSync',
                twoVersions({ lineSync: true }),
            ),
        ).toEqual([]);
    });

    test('turned off where it is on', () => {
        expect(
            offer(
                'Turn line sync off',
                'lineSync',
                twoVersions({ lineSync: true }),
            ),
        ).toEqual([
            {
                label: 'Screen 0 · Unset Line Sync',
                kind: 'lineSync',
                set: { screens: [0], lineSync: false },
            },
        ]);
    });

    test('in another language it goes the way the state does not', () => {
        expect(offer(`${STAR} 0`, 'lineSync', twoVersions())).toEqual([
            {
                label: 'Screen 0 · Set Line Sync',
                kind: 'lineSync',
                set: { screens: [0], lineSync: true },
            },
        ]);
    });
});

describe('transitions', () => {
    test('one that moves', () => {
        expect(offer('Make the slide transition move', 'transition')).toEqual([
            {
                label: 'Slide transition: move',
                kind: 'transition',
                set: { screens: [0], transition: { slide: 'move' } },
            },
        ]);
    });

    test('no effect named: every one but the one it has', () => {
        expect(
            offer('Change the background transition', 'transition').map(
                (one) => {
                    return one.label;
                },
            ),
        ).toEqual([
            'Background transition: none',
            'Background transition: move',
            'Background transition: zoom',
        ]);
    });
});

describe('displays', () => {
    test('no screen to move when the line names none and two are ticked', () => {
        expect(
            offer(
                'Move it to Virtual Display 2',
                'display',
                genState((state) => {
                    state.screens[1].ticked = true;
                }),
            ),
        ).toEqual([]);
    });

    test('the one ticked screen moves, its own display left out', () => {
        expect(offer('Move it to Virtual Display 2', 'display')).toEqual([
            {
                label: 'Screen 0 · Display: Virtual Display 2',
                kind: 'display',
                set: { screens: [0], display: 12 },
            },
        ]);
        expect(offer('Move it to Virtual Display 1', 'display')).toEqual([]);
    });
});

describe('groups', () => {
    const grouped = (groups: (string | null)[]) => {
        return genState((state) => {
            state.screens = groups.map((group, id) => {
                return genScreen(id, { group });
            });
        });
    };

    test('every screen grouped when none is named', () => {
        expect(offer('Group the screens together', 'group')).toEqual([
            {
                label: 'Group: Screen 0, Screen 1',
                kind: 'group',
                set: { screens: [0, 1], group: true },
            },
        ]);
    });

    test('screens already one group: nothing in English, the way out in another language', () => {
        const together = grouped(['blue', 'blue']);
        expect(offer('Group the screens together', 'group', together)).toEqual(
            [],
        );
        expect(
            offer(`${STAR} 0 1`, 'group', together).map((one) => {
                return one.set;
            }),
        ).toEqual([
            { screens: [0], group: false },
            { screens: [1], group: false },
        ]);
    });

    test('one screen alone is grouped with nothing', () => {
        expect(
            offer(
                'Group it',
                'group',
                genState((state) => {
                    state.screens = [genScreen(0)];
                }),
            ),
        ).toEqual([]);
    });

    test('one screen named: out of its group, or into the one group there is', () => {
        expect(
            offer('Put screen 1 in a group', 'group', grouped([null, 'blue'])),
        ).toEqual([
            {
                label: 'Screen 1 · No Color',
                kind: 'group',
                set: { screens: [1], group: false },
            },
        ]);
        expect(
            offer(
                'Add screen 1 to the group',
                'group',
                grouped(['blue', null]),
            ),
        ).toEqual([
            {
                label: 'Screen 1 · Group: blue',
                kind: 'group',
                set: { screens: [1], group: 'blue' },
            },
        ]);
        expect(
            offer(
                'Add screen 1 to the group',
                'group',
                grouped(['blue', null, 'red']),
            ),
        ).toEqual([]);
    });
});

describe('stages', () => {
    test('in other words, the one number no screen has', () => {
        expect(offer(`${STAR} 2`, 'stage')).toEqual([
            {
                label: 'Screen 0 · Stage: 2',
                kind: 'stage',
                set: { screens: [0], stage: 2 },
            },
        ]);
        expect(offer(`${STAR} 1 2`, 'stage')).toEqual([
            {
                label: 'Screen 1 · Stage: 2',
                kind: 'stage',
                set: { screens: [1], stage: 2 },
            },
        ]);
        expect(offer(`${STAR} 2 3`, 'stage')).toEqual([]);
    });

    test('a stage the screens are on already', () => {
        expect(offer('Use stage 0', 'stage')).toEqual([]);
    });
});

describe('ticking screens', () => {
    const bothTicked = genState((state) => {
        state.screens[1].ticked = true;
    });

    test('a tick taken off, never the last one', () => {
        expect(offer('Deselect screen 1', 'select', bothTicked)).toEqual([
            {
                label: 'Screen 1 · Deselect',
                kind: 'select',
                set: { screens: [1], select: 'remove' },
            },
        ]);
        expect(offer('Untick screen 0', 'select')).toEqual([]);
    });

    test('a screen ticked too', () => {
        expect(offer('Tick screen 1 as well', 'select')).toEqual([
            {
                label: 'Screen 1 · Select',
                kind: 'select',
                set: { screens: [1], select: 'add' },
            },
        ]);
        expect(offer('Tick screen 0 as well', 'select')).toEqual([]);
    });

    test('every screen ticked already', () => {
        expect(offer('Use all screens', 'select', bothTicked)).toEqual([]);
    });

    test('in another language: its Solo and the tick it does not have', () => {
        expect(
            offer(`${STAR} 1`, 'select').map((one) => {
                return one.label;
            }),
        ).toEqual(['Screen 1 · Solo', 'Screen 1 · Select']);
        expect(
            offer(`${STAR} 1`, 'select', bothTicked).map((one) => {
                return one.label;
            }),
        ).toEqual(['Screen 1 · Solo', 'Screen 1 · Deselect']);
        // The one ticked screen is its own Solo already.
        expect(offer(`${STAR} 0`, 'select')).toEqual([]);
    });
});

describe('clearing', () => {
    const full = genState((state) => {
        state.screens[0].slide = 'Amazing Grace';
        state.screens[0].background = 'sunrise.jpg';
        state.screens[1].foreground = [{ kind: 'clock' }];
    });

    test('each layer named, on the screens that hold it', () => {
        expect(
            offer('Clear the song and the background', 'clear', full),
        ).toEqual([
            {
                label: 'Screen 0 · Clear Slide',
                kind: 'clear',
                set: { screens: [0], clear: 'slide' },
            },
            {
                label: 'Screen 0 · Clear Background',
                kind: 'clear',
                set: { screens: [0], clear: 'background' },
            },
        ]);
        expect(offer('Take the clock off', 'clear', full)).toEqual([
            {
                label: 'Screen 1 · Clear Foreground',
                kind: 'clear',
                set: { screens: [1], clear: 'foreground' },
            },
        ]);
    });

    test('everything, on every screen that holds something', () => {
        expect(offer('Clear everything', 'clear', full)).toEqual([
            {
                label: 'Screen 0, Screen 1 · Clear All',
                kind: 'clear',
                set: { screens: [0, 1], clear: 'all' },
            },
        ]);
    });

    test('no layer named: Clear All first, then each layer something is on', () => {
        expect(
            offer('Clear the screen', 'clear', full).map((one) => {
                return one.label;
            }),
        ).toEqual([
            'Screen 0, Screen 1 · Clear All',
            'Screen 0 · Clear Long Text',
            'Screen 0 · Clear Slide',
            'Screen 0 · Clear Background',
        ]);
        // One layer up: no Clear All beside it.
        expect(
            offer('Clear the screen', 'clear').map((one) => {
                return one.label;
            }),
        ).toEqual(['Screen 0 · Clear Long Text']);
    });
});

describe('Bible versions', () => {
    const twoVersions = genState((state) => {
        state.screens[0].bible.versions = ['KJV', 'NIV'];
    });

    test('only one version: the others taken off, it put up', () => {
        expect(offer('Show only the NIV', 'versions')).toEqual([
            {
                label: 'Screen 0 · Remove KJV',
                kind: 'versions',
                set: {
                    screens: [0],
                    versions: { add: ['NIV'], remove: ['KJV'] },
                },
            },
        ]);
        expect(offer('Show only the KJV', 'versions', twoVersions)).toEqual([
            {
                label: 'Screen 0 · Remove NIV',
                kind: 'versions',
                set: { screens: [0], versions: { remove: ['NIV'] } },
            },
        ]);
        expect(offer('Show only the KJV', 'versions')).toEqual([]);
    });

    test('the last version up is not taken off, and a removal names one', () => {
        expect(offer('Remove the KJV', 'versions')).toEqual([]);
        expect(offer('Remove a version', 'versions', twoVersions)).toEqual([]);
    });

    test('a line all in capitals is not read for a Bible not installed', () => {
        expect(
            offer('ADD THE ESV', 'versions').map((one) => {
                return one.label;
            }),
        ).toEqual(['Screen 0 · Add NIV', 'Screen 0 · Add BSB']);
        // In ordinary letters, the ESV asked for is not here: no offer.
        expect(offer('Add the ESV', 'versions')).toEqual([]);
    });
});

describe('a state with no screen', () => {
    test('offers nothing', () => {
        expect(
            offer('Lock screen 0', 'lock', {
                screens: [{ id: -1 }, { id: 'one' }, null],
            }),
        ).toEqual([]);
        expect(offer('Lock screen 0', 'lock', { screens: 'none' })).toEqual([]);
    });
});

describe('genScreenOfferText', () => {
    test('says nothing was changed and the press does it', () => {
        expect(genScreenOfferText()).toBe(
            'Nothing has been changed yet. Press a button below to change ' +
                'it now, or ask me how to do it yourself.',
        );
    });
});
