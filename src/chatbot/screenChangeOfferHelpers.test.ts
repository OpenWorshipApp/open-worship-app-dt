import { afterEach, describe, expect, test } from 'vitest';

import { setChatTranslator } from './chatTranHelpers';
import {
    genScreenChangeOffers,
    readNamedScreenIds,
    readScreenChangeArgs,
    readScreenStyleChange,
    SCREEN_CHANGE_TOOL_NAME,
} from './screenChangeOfferHelpers';
import { readScreenAsk } from './typedScreenAskHelpers';

// EC-627: with no assistant, a screen ask is offered the press that does
// it. The state is `owa_screen_edit`'s read as the scratch profile gives
// it: screen 0 on, ticked, showing John 3:16 in the KJV; screen 1 off; two
// virtual displays beside the computer's own.
function genState(change: (state: any) => void = () => {}) {
    const state: any = {
        screens: [
            {
                id: 0,
                on: true,
                ticked: true,
                locked: false,
                group: null,
                stage: 0,
                display:
                    'Virtual Display 1 (id 11, virtual: on no monitor here)',
                transition: {
                    slide: 'fade',
                    background: 'fade',
                    foreground: 'fade',
                },
                lineSync: false,
                bible: { reference: 'John 3:16', versions: ['KJV'] },
            },
            {
                id: 1,
                on: false,
                ticked: false,
                locked: false,
                group: null,
                stage: 0,
                display:
                    'Virtual Display 2 (id 12, virtual: on no monitor here)',
                transition: {
                    slide: 'fade',
                    background: 'fade',
                    foreground: 'fade',
                },
                lineSync: false,
                bible: null,
            },
        ],
        bibleStyle: '65px, words #FFFFFF',
        displays: [
            {
                id: 1,
                name: 'Built-in Retina Display',
                size: '1512x982',
                primary: true,
            },
            {
                id: 11,
                name: 'Virtual Display 1',
                size: '1920x1080',
                virtual: true,
            },
            {
                id: 12,
                name: 'Virtual Display 2',
                size: '1920x1080',
                virtual: true,
            },
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

// As the window asks it: the kind the screens' reader gives the line, or
// null for a plain line under a screen answer.
function offer(line: string, state = genState()) {
    return genScreenChangeOffers(
        line,
        readScreenAsk(line, 'presenter', 'en'),
        state,
    ).map((action) => {
        return { label: action.label, ...(action.args as any) };
    });
}

afterEach(() => {
    setChatTranslator(
        (key) => {
            return key;
        },
        (key) => {
            return key;
        },
    );
});

describe('the standing screen asks, each its one press', () => {
    test.each([
        [
            'Make the Bible verse on the screen bigger',
            'style',
            { style: { size: 'larger' } },
            'Make the words larger',
        ],
        [
            'Change its colour to yellow',
            'style',
            { style: { color: 'yellow' } },
            'Text Color: yellow',
        ],
        [
            'Make it bold and give it a shadow',
            'style',
            { style: { bold: true, shadow: true } },
            'Bold · Shadow',
        ],
        ['Centre it', 'style', { style: { align: 'center' } }, 'Align center'],
        [
            "The verse on the projector is too small, people at the back can't read it",
            'style',
            { style: { size: 'larger' } },
            'Make the words larger',
        ],
        [
            'Give the Bible text a thick black outline',
            'style',
            { style: { outline: 'thick', outlineColor: 'black' } },
            'Heavy Outline · Outline Color: black',
        ],
        [
            'Put the lines of the verse closer together',
            'style',
            { style: { lineHeight: 'tighter' } },
            'Line Height −',
        ],
        [
            'Set the Bible text style back to normal',
            'style',
            { style: { reset: true } },
            'Reset',
        ],
        [
            'Add the NIV Bible to the verse on the screen so both versions show',
            'versions',
            { screens: [0], versions: { add: ['NIV'] } },
            'Screen 0 · Add NIV',
        ],
        [
            'Change the slide transition to zoom',
            'transition',
            { screens: [0], transition: { slide: 'zoom' } },
            'Slide transition: zoom',
        ],
        [
            'Turn the background transition off',
            'transition',
            { screens: [0], transition: { background: 'none' } },
            'Background transition: none',
        ],
        [
            'Move screen 1 to Virtual Display 1',
            'display',
            { screens: [1], display: 11 },
            'Screen 1 · Display: Virtual Display 1',
        ],
        [
            'Group screen 0 and screen 1 together',
            'group',
            { screens: [0, 1], group: true },
            'Group: Screen 0, Screen 1',
        ],
        [
            'Lock screen 0 so nothing can change it by accident',
            'lock',
            { screens: [0], lock: true },
            'Screen 0 · Lock',
        ],
        [
            'Use stage 1 on screen 1',
            'stage',
            { screens: [1], stage: 1 },
            'Screen 1 · Stage: 1',
        ],
        [
            'Only work with screen 1 for now',
            'select',
            { screens: [1], select: 'only' },
            'Screen 1 · Solo',
        ],
        [
            'Take the Bible off screen 0',
            'clear',
            { screens: [0], clear: 'bible' },
            'Screen 0 · Clear Long Text',
        ],
    ])('%s', (line, kind, set, label) => {
        expect(offer(line)).toEqual([{ label, kind, set }]);
    });

    test('another version beside the one up: the Bibles not shown', () => {
        expect(
            offer('Add another version beside the KJV on the screen'),
        ).toEqual([
            {
                label: 'Screen 0 · Add NIV',
                kind: 'versions',
                set: { screens: [0], versions: { add: ['NIV'] } },
            },
            {
                label: 'Screen 0 · Add BSB',
                kind: 'versions',
                set: { screens: [0], versions: { add: ['BSB'] } },
            },
        ]);
    });

    test('the two versions lined up, and one taken off again', () => {
        const twoVersions = genState((state) => {
            state.screens[0].bible.versions = ['KJV', 'NIV'];
        });
        expect(
            offer('Line the two versions up verse by verse', twoVersions),
        ).toEqual([
            {
                label: 'Screen 0 · Set Line Sync',
                kind: 'lineSync',
                set: { screens: [0], lineSync: true },
            },
        ]);
        expect(offer('Take the NIV one off again', twoVersions)).toEqual([
            {
                label: 'Screen 0 · Remove NIV',
                kind: 'versions',
                set: { screens: [0], versions: { remove: ['NIV'] } },
            },
        ]);
    });

    test('a locked screen unlocked, a group left, both ticked again', () => {
        expect(
            offer(
                'Unlock it',
                genState((state) => {
                    state.screens[0].locked = true;
                }),
            ),
        ).toEqual([
            {
                label: 'Screen 0 · Unlock',
                kind: 'lock',
                set: { screens: [0], lock: false },
            },
        ]);
        expect(
            offer(
                'Take screen 1 out of the group',
                genState((state) => {
                    state.screens[0].group = 'blue';
                    state.screens[1].group = 'blue';
                }),
            ),
        ).toEqual([
            {
                label: 'Screen 1 · No Color',
                kind: 'group',
                set: { screens: [1], group: false },
            },
        ]);
        expect(
            offer(
                'Select both screens again',
                genState((state) => {
                    state.screens[0].ticked = false;
                    state.screens[1].ticked = true;
                }),
            ),
        ).toEqual([
            {
                label: 'Screen 0, Screen 1 · Select',
                kind: 'select',
                set: { select: 'all' },
            },
        ]);
    });

    test.each([
        'Which Bible versions are on the screen now?',
        'What transition does each screen use now?',
        'Check the display: which monitor is each screen on?',
    ])('a question names no value and gets no pick list: %s', (line) => {
        expect(offer(line)).toEqual([]);
    });

    test('every offer is the press the window runs', () => {
        const [action] = genScreenChangeOffers(
            'Lock screen 1',
            'lock',
            genState(),
        );
        expect(action.toolName).toBe(SCREEN_CHANGE_TOOL_NAME);
        expect(readScreenChangeArgs(action.args)).toEqual({
            kind: 'lock',
            set: { screens: [1], lock: true },
        });
    });
});

describe('what is not offered', () => {
    test('a change already so', () => {
        expect(
            offer(
                'Lock screen 0',
                genState((state) => {
                    state.screens[0].locked = true;
                }),
            ),
        ).toEqual([]);
        expect(
            offer(
                'Make the Bible text on the screen bold',
                genState((state) => {
                    state.bibleStyle = '65px, words #FFFFFF, bold';
                }),
            ),
        ).toEqual([]);
        expect(
            offer('Change the slide transition on screen 0 to fade'),
        ).toEqual([]);
    });

    test('a clear on a locked screen, which refuses it', () => {
        expect(
            offer(
                'Take the Bible off screen 0',
                genState((state) => {
                    state.screens[0].locked = true;
                }),
            ),
        ).toEqual([]);
    });

    test('a monitor no name in the line picks', () => {
        expect(offer('Move screen 1 to the other monitor')).toEqual([]);
    });

    test('a look asked for in words nothing reads', () => {
        expect(offer('Make the Bible text on the screen look nicer')).toEqual(
            [],
        );
    });

    test('a Bible not installed, and a version on a screen showing none', () => {
        expect(offer('Add the ESV to the verse on the screen')).toEqual([]);
        expect(offer('Add the NIV to the verse on screen 1')).toEqual([]);
    });

    test('a how-to typed under a screen answer, and a screen by its number', () => {
        expect(
            genScreenChangeOffers('How do I centre it?', null, genState()),
        ).toEqual([]);
        expect(
            genScreenChangeOffers('What is on screen 1?', 'screen', genState()),
        ).toEqual([]);
    });

    test('no state read', () => {
        expect(genScreenChangeOffers('Lock screen 0', 'lock', null)).toEqual(
            [],
        );
    });
});

// EC-630: a screen asked for is offered the Mini Screen menu's own press,
// with no screen there as well, never past the most the assistant adds to,
// and never off the Presenter, where the read holds no screens.
describe('a screen added', () => {
    const ADD_OFFER = {
        label: 'Add New Screen',
        kind: 'newScreen',
        set: { newScreen: true },
    };

    test('is the menu press, with screens there or none', () => {
        expect(offer('add a new screen')).toEqual([ADD_OFFER]);
        expect(offer('I need another screen for the stage')).toEqual([
            ADD_OFFER,
        ]);
        expect(
            offer(
                'add a screen',
                genState((state) => {
                    state.screens = [];
                }),
            ),
        ).toEqual([ADD_OFFER]);
    });

    test('is not offered at the most the assistant adds, or with no read', () => {
        const atMost = genState((state) => {
            state.screens = Array.from({ length: 8 }, (_item, id) => {
                return { ...state.screens[1], id };
            });
        });
        expect(offer('add a new screen', atMost)).toEqual([]);
        const underMost = genState((state) => {
            state.screens = Array.from({ length: 7 }, (_item, id) => {
                return { ...state.screens[1], id };
            });
        });
        expect(offer('add a new screen', underMost)).toEqual([ADD_OFFER]);
        expect(
            genScreenChangeOffers('add a screen', 'newScreen', null),
        ).toEqual([]);
        expect(
            genScreenChangeOffers('add a screen', 'newScreen', {
                needsPage: 'presenter',
                note: 'The screens are controlled from the Presenter page.',
            }),
        ).toEqual([]);
        expect(
            genScreenChangeOffers('add a screen', 'newScreen', {
                needsPage: 'presenter',
                screens: [],
            }),
        ).toEqual([]);
    });

    test('says the label in the window language', () => {
        setChatTranslator(
            (key) => {
                return key === 'Add New Screen' ? 'Zz Add Screen Zz' : key;
            },
            (key) => {
                return key;
            },
        );
        expect(
            genScreenChangeOffers('add a screen', 'newScreen', genState())[0]
                ?.label,
        ).toBe('Zz Add Screen Zz');
    });
});

describe('the reading', () => {
    test('a verse, a size and a Bible key name no screen', () => {
        expect(readNamedScreenIds('Put John 1:1 on screen 1', [0, 1])).toEqual([
            1,
        ]);
        expect(readNamedScreenIds('Make it 60px on screen 0', [0, 1])).toEqual([
            0,
        ]);
        expect(readNamedScreenIds('Add the B21 Bible', [0, 1, 21])).toEqual([]);
    });

    test('a size, a colour said of the outline, and no for an answer', () => {
        expect(readScreenStyleChange('make the verse 72 pixels')?.set).toEqual({
            size: 72,
        });
        expect(
            readScreenStyleChange('white words with a red outline')?.set,
        ).toEqual({ outline: true, outlineColor: 'red', color: 'white' });
        expect(readScreenStyleChange('make it not bold')).toBeNull();
    });

    // A made-up language: its panel labels are signs, so no language's own
    // words live outside the language packages.
    test('in a window shown in another language, the panel labels as shown', () => {
        const dictionary: Record<string, string> = {
            Bold: '\u271a\u271a',
            'Align center': '\u25c6\u25c6',
        };
        const translate = (key: string) => {
            return dictionary[key] ?? key;
        };
        setChatTranslator(translate, translate);
        expect(
            genScreenChangeOffers(
                '\u2605 \u271a\u271a \u2605 \u25c6\u25c6 \u2605',
                'style',
                genState(),
            ).map((action) => {
                return [action.label, action.args];
            }),
        ).toEqual([
            [
                '\u271a\u271a \u00b7 \u25c6\u25c6',
                {
                    kind: 'style',
                    set: { style: { bold: true, align: 'center' } },
                },
            ],
        ]);
    });

    test('in another language a lock goes the way the state does not', () => {
        expect(
            genScreenChangeOffers(
                '\u2605 1 \u2605',
                'lock',
                genState((state) => {
                    state.screens[1].locked = true;
                }),
            ).map((action) => {
                return action.args;
            }),
        ).toEqual([{ kind: 'lock', set: { screens: [1], lock: false } }]);
    });

    test('anything else than an offer is not one', () => {
        expect(readScreenChangeArgs({ kind: 'lock' })).toBeNull();
        expect(readScreenChangeArgs({ kind: 'lock', set: [] })).toBeNull();
        expect(readScreenChangeArgs(null)).toBeNull();
    });
});
