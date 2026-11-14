import { describe, expect, it } from 'vitest';

import { LYRIC_UNDO_LABEL, LYRIC_UNDO_TOOL_NAME } from './lyricChatHelpers';
import {
    SCREEN_CLAIM_PATTERN,
    SCREEN_SYSTEM_PROMPT,
    SCREEN_UNDO_KIND,
    checkIsScreenEdited,
    checkIsScreenThread,
    findScreenUndoIds,
    genScreenUndoAction,
    mergeEditedScreen,
    readAddedScreenId,
    readEditedScreen,
    readScreenControlAsk,
    toScreenAsk,
    toScreenReadText,
} from './screenChatHelpers';

describe('readScreenControlAsk', () => {
    it('reads the asks of the measured set, each by its control', () => {
        // `references/screen-asks.json`: the first ask of every scenario
        // (the ones after it ride the thread).
        const cases: [string, string][] = [
            ['Make the Bible verse on the screen bigger', 'style'],
            [
                "The verse on the projector is too small, people at the back can't read it",
                'style',
            ],
            ['Give the Bible text a thick black outline', 'style'],
            ['Put the lines of the verse closer together', 'style'],
            ['Set the Bible text style back to normal', 'style'],
            ['Make the verse on the screen yellow', 'style'],
            [
                'Add the Testish Bible to the verse on the screen so both versions show',
                'versions',
            ],
            ['Which Bible versions are on the screen now?', 'versions'],
            ['Line the two versions up verse by verse', 'lineSync'],
            ['Turn Line Sync on', 'lineSync'],
            ['Change the slide transition to zoom', 'transition'],
            ['Turn the background transition off', 'transition'],
            ['What transition does each screen use now?', 'transition'],
            ['Check the display: which monitor is each screen on?', 'display'],
            ['Move screen 1 to Virtual Display 1', 'display'],
            ['Group screen 0 and screen 1 together', 'group'],
            ['Take screen 1 out of the group', 'group'],
            ['Lock screen 0 so nothing can change it by accident', 'lock'],
            ['Use stage 1 on screen 1', 'stage'],
            ['Only work with screen 1 for now', 'select'],
            ['Select both screens again', 'select'],
            ['Take the Bible off screen 0', 'clear'],
            ['Can you make the Bible text bold?', 'style'],
        ];
        for (const [text, kind] of cases) {
            expect(readScreenControlAsk(text), text).toBe(kind);
        }
    });

    it('leaves how-tos, other conversations and look-alikes alone', () => {
        for (const text of [
            '',
            '/clear',
            'How do I make the Bible text bigger?',
            'Can I change the transition?',
            'What does the lock on the screen preview do?',
            'Can one song or one slide have its own transition?',
            'Who published the Bible version I am reading?',
            'Put John 3:16 on the screen',
            'Show John 3:16',
            'Display John 3:16 on the projector',
            'Is anything showing on the projector right now?',
            'Start a 5 minute countdown',
            'Make the countdown bigger',
            'Make the marquee text red',
            'Make the words on the slide bigger',
            'Make the song lyrics bigger on the screen',
            'Highlight John 3:16 in my notes',
            'Make the word grace red and bold in my note',
            'Make the text in the app bigger',
            'Help me find a Bible verse in "KJV": Moses parts the Red Sea',
            'Which verse says your sins shall be white as snow?',
            'Download another Bible version',
            'Save John 3:16 to my Bible list',
            'Pray for our small group on screen tonight',
            'Who is watching my virtual display?',
            'Which address do I give people to watch the virtual display?',
            'Add a new virtual display',
            'Change the display language to Testish',
            'Make a new running order for Sunday',
        ]) {
            expect(readScreenControlAsk(text), text).toBe(null);
        }
    });

    it('reads the ways a blind set asked for a control (EC-619)', () => {
        const cases: [string, string][] = [
            ['the slides change too slow, use no effect', 'transition'],
            [
                'the slides jump too quickly, can we have a gentle fade instead',
                'transition',
            ],
            [
                'which effect is the background using on the projector?',
                'transition',
            ],
            ['stop lining up the versions', 'lineSync'],
            ['verses wont line up between kjv and niv on the tv', 'lineSync'],
            ['is the verse sync turned on for screen two', 'lineSync'],
            ['put the second screen on the TV', 'display'],
            ['screen 1 is showing on my laptop instead of the TV', 'display'],
            ['how many displays are connected right now', 'display'],
            ['make the second screen show the same as screen 1', 'group'],
            ['link the tv and the projector so they mirror', 'group'],
            ['unlock all', 'lock'],
            ['which screens have a stage set?', 'stage'],
            ['can you add the NIV next to it', 'versions'],
            ['swap kjv for niv on screen 1', 'versions'],
            ['esv and nlt together on both screens', 'versions'],
            ['take off all extra translations, just one version', 'versions'],
            ['tick the projector and untick the TV', 'select'],
            [
                'stuff is going to the wrong screen, just target screen 0',
                'select',
            ],
            ['clear everything on both screens', 'clear'],
            ['remove the slide from the projector', 'clear'],
            ['take everything off the right-hand screen', 'clear'],
            ['the lyrics are stuck on screen 0, clear that one', 'clear'],
            ["people can't read the white text, make it darker", 'style'],
            ['more space between the lines of the verse pls', 'style'],
        ];
        for (const [text, kind] of cases) {
            expect(readScreenControlAsk(text), text).toBe(kind);
        }
    });

    it('leaves what only looks like those alone (EC-619)', () => {
        for (const text of [
            'blank screen, help!',
            'the screen went blank',
            'the text on the screen is so clear now',
            'pressing the button had no effect',
            'fade out the music',
            'add a transition between lyric lines in the song editor',
            'set the effects on the countdown to glow',
            'get a screenshot from the projector',
            'I just updated to the new version',
            'Could you explain how I would add a second Bible version to the verse?',
            'select verse 3 on screen 1',
            'make it the same as before on the screen',
            'pair my phone with the projector',
        ]) {
            expect(readScreenControlAsk(text), text).toBe(null);
        }
    });

    it('reads the shapes a third blind set asked in (EC-619)', () => {
        const cases: [string, string][] = [
            ['people at the back cannot read it', 'style'],
            ['more line spacing on screen 1 please', 'style'],
            ['show a second translation beside it', 'versions'],
            ['keep the versions line for line', 'lineSync'],
            ['remove the fade effect', 'transition'],
            [
                'the background changes too suddenly, make it smoother',
                'transition',
            ],
            ['move screen 1 to the HDMI output', 'display'],
            ['have the right screen mirror the left screen', 'group'],
            ['present on screen 1 and screen 2 only', 'select'],
            ['deselect all', 'select'],
            ['screen 2 should receive what we present', 'select'],
            ['get rid of the slide on the projector', 'clear'],
            ['clear only the foreground layer', 'clear'],
            ['clear whatever is on screen 1', 'clear'],
            ['the stage monitor needs bigger letters', 'style'],
            ['the verse lines are cramped on the projector', 'style'],
            ['change the bible on screen 1 from KJV to NKJV', 'versions'],
            ['drop the extra verison from screen 2', 'versions'],
            ['enable verse-sync on both screens', 'lineSync'],
            ['the ESV keeps running behind the NIV on screen 1', 'lineSync'],
            ['the slides fade in too slowly on the lobby tv', 'transition'],
            ['what transtion is screen 1 using', 'transition'],
            ["what is screen 1's display", 'display'],
            [
                'the projector went to the wrong monitor after the update',
                'display',
            ],
            ['unlink the foyer tv', 'group'],
            ['the side screen should copy whatever screen 0 shows', 'group'],
            ['freeze the left screen', 'lock'],
            ['protect screen 1 from changes', 'lock'],
            ['make screen 2 the stage monitor', 'stage'],
            ['uncheck the lobby tv', 'select'],
            [
                'add the overflow tv to the screens we are presenting to',
                'select',
            ],
            ['kill the background on screen 0', 'clear'],
            ['take the verse off the projecter', 'clear'],
        ];
        for (const [text, kind] of cases) {
            expect(readScreenControlAsk(text), text).toBe(kind);
        }
        // Not on a page of its own text: the Reader's _deselect all_ is its
        // own, and a layer cleared there names no screen.
        expect(readScreenControlAsk('deselect all', 'reader')).toBe(null);
        expect(
            readScreenControlAsk('clear only the foreground layer', 'reader'),
        ).toBe(null);
    });

    it('leaves what only looks like those alone too (EC-619)', () => {
        for (const text of [
            "this slide's transition should be a fade",
            "the back row can't hear the music",
            "people at the back can't see the countdown",
            "the congregation can't read the lyrics",
            'the projector does not receive a signal',
            'get rid of this song from the list',
            'clear the search box',
            'select all the slides',
            'my laptop has an hdmi port',
            'clear the background colour of this slide',
            'the background music fades too suddenly',
            'the left screen mirror is broken',
            'hide the projector output',
            "where's the lock button",
            'compare the KJV and NIV side by side in the reader',
            'which is more accurate, the NIV or the ESV?',
            'show the stage monitor',
            'put John 3:16 on the confidence monitor',
            'the projector keeps freezing',
            'set a countdown on the stage monitor',
        ]) {
            expect(readScreenControlAsk(text), text).toBe(null);
        }
    });

    it('reads a slip, a wall, a full name and the shapes of a fifth set (EC-619)', () => {
        const cases: [string, string][] = [
            ['screen 1 opened on the wrong moniter', 'display'],
            ['route screen 1 to the main tv', 'display'],
            ['point the left screen at the new monitor', 'display'],
            ["what size is screen two's display?", 'display'],
            [
                'we just hooked up a new projector, use it for screen 2',
                'display',
            ],
            ['clear the verse off the side wall', 'clear'],
            ['the old picture is still on the lobby tv, wipe it off', 'clear'],
            ['zap everything on screen 2', 'clear'],
            ['knock the video off screen 1', 'clear'],
            ['screen 2 should be a copy of the front screen', 'group'],
            ['the front and back screens need to match', 'group'],
            ['the verse on screen 1 needs more padding', 'style'],
            ['ok so could the scripture be white on screen 2', 'style'],
            ['the lines of the verse on screen 2 are too far apart', 'style'],
            ['what is the stage number of the left wall', 'stage'],
            ['take screen 3 out of the selection', 'select'],
            ['present to all screens except the stage tv', 'select'],
            ['the NIV and the New King James together on screen 1', 'versions'],
            ['give the background a zoom on screen 2', 'transition'],
            ['unlock the rear wall', 'lock'],
        ];
        for (const [text, kind] of cases) {
            expect(readScreenControlAsk(text), text).toBe(kind);
        }
    });

    it('leaves a how-to after a few words, the app and a call alone (EC-619)', () => {
        for (const text of [
            'quick question, how do I change the transition on screen 2?',
            'hi there, where do I lock screen 1?',
            'what does the stage number do on a screen?',
            'the buttons and menus on screen 1 look tiny, make the text bigger',
            'start a zoom call on the projector',
            'copy screen 1 to the clipboard',
            'put the King James beside the NIV in the reader',
        ]) {
            expect(readScreenControlAsk(text), text).toBe(null);
        }
    });

    it('takes the Bible text in the Reader or the editor only with a screen named', () => {
        expect(
            readScreenControlAsk('Make the Bible text bigger', 'reader'),
        ).toBe(null);
        expect(
            readScreenControlAsk('Make the Bible text bigger', 'editor'),
        ).toBe(null);
        expect(
            readScreenControlAsk('Make the Bible text bigger', 'presenter'),
        ).toBe('style');
        expect(
            readScreenControlAsk(
                'Make the Bible text on the projector bigger',
                'reader',
            ),
        ).toBe('style');
        expect(
            readScreenControlAsk('Add the KJV beside the verse', 'reader'),
        ).toBe(null);
        expect(
            readScreenControlAsk('Add the KJV version to screen 0', 'reader'),
        ).toBe('versions');
    });

    // 2026-11-14, EC-630: a screen added is asked for before what is done
    // with it, and never for a look-alike -- a how-to, a green screen, a
    // screen made to show the same as another, a version on another screen.
    it('reads a screen asked for as one added', () => {
        for (const text of [
            'add a new screen',
            'Add New Screen',
            'add screen',
            'new screen',
            'new screen please',
            'a new screen please',
            'please add another screen',
            'can you add a second screen?',
            'I need another screen',
            'we need a second screen for the lobby',
            'I need another screen for the stage',
            'create a second output screen',
            'set up a third screen',
            'add one more screen',
            'add 2 more screens',
            'give me another screen',
            "I'd like an extra screen",
            'make a new screen',
            'add another screen and group it with screen 1',
            'add a new screen to the group',
            'add another output',
            'add a new mini screen',
            'we want two screens',
        ]) {
            expect(readScreenControlAsk(text), text).toBe('newScreen');
        }
        for (const text of [
            'how do I add a new screen?',
            'can I add another screen?',
            'add a green screen',
            'add a welcome screen',
            'add a blank screen',
            'make another screen show the same as screen 1',
            'add another screen to the group',
            'we want two screens to show the same thing',
            'add a new virtual screen',
            'add another screen for my phone',
            'add a screen saver',
            'I need a new screen layout',
            'add the NIV to another screen',
            'add a second bible version to screen 1',
            'show it on another screen',
            'I need a screen to show the lyrics',
            'I want to know how to add a new screen',
            'add screen 2 to the group',
            'take a screenshot',
            'the screen is new',
            'open a new screen',
            'add a new display',
            'make the text bigger on another screen',
            'the add new screen button does nothing',
        ]) {
            expect(readScreenControlAsk(text), text).not.toBe('newScreen');
        }
    });
});

describe('the thread', () => {
    const undoAction = {
        label: LYRIC_UNDO_LABEL,
        toolName: LYRIC_UNDO_TOOL_NAME,
        args: { id: 'a1', ids: ['a1', 'b2'], kind: SCREEN_UNDO_KIND },
    };

    it('keeps a plain line under a screen answer in the conversation', () => {
        const messages = [
            { author: 'you' as const },
            {
                author: 'bot' as const,
                isScreenAnswer: true as const,
                actions: [undoAction],
            },
            // The window's sentence after an Undo press is no answer.
            { author: 'bot' as const, isFollowUp: true as const },
        ];
        expect(checkIsScreenThread(messages, 'Centre it')).toBe(true);
        // Read by no word: any language's line is more of it.
        expect(checkIsScreenThread(messages, '80?')).toBe(true);
        expect(checkIsScreenThread(messages, '/help')).toBe(false);
        expect(checkIsScreenThread(messages, '  ')).toBe(false);
        expect(
            checkIsScreenThread(
                [...messages, { author: 'bot' as const }],
                'Centre it',
            ),
        ).toBe(false);
    });

    it('names the last change for an undo typed under it, newest first', () => {
        expect(
            findScreenUndoIds([
                {
                    author: 'bot',
                    isScreenAnswer: true,
                    actions: [{ toolName: 'other' }, undoAction],
                },
            ]),
        ).toEqual(['b2', 'a1']);
        expect(
            findScreenUndoIds([
                {
                    author: 'bot',
                    isScreenAnswer: true,
                    actions: [
                        {
                            toolName: LYRIC_UNDO_TOOL_NAME,
                            args: { id: 'c3', kind: SCREEN_UNDO_KIND },
                        },
                    ],
                },
            ]),
        ).toEqual(['c3']);
        // A song's Undo, an answer of another conversation, an id that is
        // not one: nothing.
        expect(
            findScreenUndoIds([
                {
                    author: 'bot',
                    isScreenAnswer: true,
                    actions: [
                        { toolName: LYRIC_UNDO_TOOL_NAME, args: { id: 'd4' } },
                    ],
                },
            ]),
        ).toEqual([]);
        expect(
            findScreenUndoIds([{ author: 'bot', actions: [undoAction] }]),
        ).toEqual([]);
        expect(
            findScreenUndoIds([
                {
                    author: 'bot',
                    isScreenAnswer: true,
                    actions: [
                        {
                            toolName: LYRIC_UNDO_TOOL_NAME,
                            args: { id: 'a "b"', kind: SCREEN_UNDO_KIND },
                        },
                    ],
                },
            ]),
        ).toEqual([]);
    });
});

const READ_RESULT = {
    screens: [
        {
            id: 0,
            on: true,
            ticked: true,
            locked: false,
            group: 'yellow',
            groupWith: [1],
            stage: 0,
            display: 'Virtual Display 1 (id 9, virtual: on no monitor here)',
            transition: {
                slide: 'fade',
                background: 'zoom',
                foreground: 'none',
            },
            lineSync: false,
            bible: { reference: 'John 3:16', versions: ['KJV', 'TST'] },
            foreground: ['countdown'],
        },
        {
            id: 1,
            on: false,
            ticked: false,
            locked: true,
            group: null,
            stage: 2,
            display: null,
            transition: {
                slide: 'none',
                background: 'fade',
                foreground: 'fade',
            },
            lineSync: true,
            bible: null,
            slide: 'slide "Welcome", slide 1',
            background: 'image sunrise.jpg',
        },
    ],
    bibleStyle: '65px, words #ffffff, bold',
    displays: [
        { id: 1, name: 'Built-in', size: '1440x900', primary: true },
        { id: 9, name: 'Virtual Display 1', size: '1920x1080', virtual: true },
    ],
    bibles: ['KJV: King James Version (English)', 'TST: Test Bible (Testish)'],
    looks: ['normal', 'outline'],
    groupColors: ['yellow', 'lime'],
    note: 'never handed on',
};

describe('toScreenReadText', () => {
    it('says each screen, the style, the displays and the Bibles in lines', () => {
        const text = toScreenReadText(READ_RESULT) ?? '';
        expect(text.split('\n')).toEqual([
            'Screen 0: ON (the room sees it), ticked, in the yellow group with ' +
                'screen 1, stage 0, display Virtual Display 1 (id 9, virtual: ' +
                'on no monitor here), transitions: slide fade, background ' +
                'zoom, foreground none, Line Sync off. Shows: the Bible, John ' +
                '3:16 in KJV + TST; foreground countdown.',
            'Screen 1: off, not ticked, locked, stage 2, display none, ' +
                'transitions: slide none, background fade, foreground fade, ' +
                'Line Sync on. Shows: slide "Welcome", slide 1; background ' +
                'image sunrise.jpg.',
            'The Bible text style, one for every screen: 65px, words #ffffff, bold.',
            'Displays: Built-in (id 1, 1440x900, primary); Virtual Display 1 ' +
                '(id 9, 1920x1080, virtual).',
            'Bibles installed: KJV: King James Version (English); TST: Test ' +
                'Bible (Testish).',
            'Text looks: normal, outline.',
            'Group colours: yellow, lime.',
        ]);
    });

    it('says where to go off the Presenter, and nothing for no answer', () => {
        expect(toScreenReadText({ needsPage: 'presenter' })).toContain(
            'owa_goto_page presenter.html',
        );
        expect(toScreenReadText(null)).toBe(null);
        expect(toScreenReadText('a sentence')).toBe(null);
        expect(toScreenReadText({ did: 'x' })).toBe(null);
        expect(toScreenReadText({ screens: [] })).toBe(
            'No screen is set up yet.',
        );
    });

    it('cuts a long read', () => {
        const screens = Array.from({ length: 40 }, (_, index) => {
            return { ...READ_RESULT.screens[0], id: index };
        });
        const text = toScreenReadText({ screens }) ?? '';
        expect(text.length).toBeLessThanOrEqual(3500);
        expect(text).not.toContain('Screen 12:');
    });
});

describe('toScreenAsk', () => {
    it('puts the read under the question, and the undo id under a change', () => {
        const ask = toScreenAsk('Undo that', 'Screen 0: on.', ['b2', 'a1']);
        expect(ask).toBe(
            'Undo that\n\nThe screens as they are now, read just now:\n' +
                'Screen 0: on.\n\nThe last change in this conversation is ' +
                'taken back with owa_undo action "undo", ids "b2", "a1", one ' +
                'call each in that order -- only when they ask to undo it, ' +
                'and never write an id in the answer.',
        );
        expect(toScreenAsk('Make it bigger', null)).toContain(
            'could not be read just now',
        );
        expect(toScreenAsk('', 'Screen 0: on.')).toContain(
            'They sent no words',
        );
        expect(toScreenAsk('Centre it', 'x', ['c3'])).toContain('id "c3"');
    });
});

describe('the change it made', () => {
    it('reads a change off its result, never a read or a refusal', () => {
        const edited = readEditedScreen(
            JSON.stringify({ did: 'the Bible text larger', undoId: 'u1' }),
        );
        expect(edited).toEqual({
            name: 'screens',
            undoId: 'u1',
            listName: 'Mini Screen',
            shownName: 'Screens',
        });
        expect(checkIsScreenEdited(edited)).toBe(true);
        expect(readEditedScreen(JSON.stringify({ screens: [] }))).toBe(null);
        expect(
            readEditedScreen(
                JSON.stringify({ did: 'nothing: it is already so' }),
            ),
        ).toBe(null);
        expect(readEditedScreen('Screen 3 is not set up.')).toBe(null);
        // Stopped half way: the sentence carries the id of what was done.
        expect(
            readEditedScreen(
                'Part of it could not be done (x). What was done is undone ' +
                    'with owa_undo id "20261113-1-ab".',
            )?.undoId,
        ).toBe('20261113-1-ab');
        expect(checkIsScreenEdited({ name: 'Hymn', undoId: 'x' })).toBe(false);
        expect(checkIsScreenEdited(null)).toBe(false);
    });

    it('keeps every change of one answer under its one Undo', () => {
        const first = readEditedScreen(
            JSON.stringify({ did: 'a', undoId: 'u1' }),
        )!;
        const second = readEditedScreen(
            JSON.stringify({ did: 'b', undoId: 'u2' }),
        )!;
        const merged = mergeEditedScreen(first, second);
        expect(merged.undoIdList).toEqual(['u1', 'u2']);
        expect(mergeEditedScreen(merged, second).undoIdList).toEqual([
            'u1',
            'u2',
        ]);
        // A song's change before it is not the screens'.
        expect(
            mergeEditedScreen({ name: 'Hymn', undoId: 's1' }, second),
        ).toEqual(second);
        expect(mergeEditedScreen(null, first)).toEqual(first);
        expect(genScreenUndoAction(merged)).toEqual({
            label: LYRIC_UNDO_LABEL,
            toolName: LYRIC_UNDO_TOOL_NAME,
            args: {
                id: 'u2',
                name: 'screens',
                kind: SCREEN_UNDO_KIND,
                ids: ['u1', 'u2'],
            },
        });
        expect(genScreenUndoAction({ name: 'screens', undoId: null })).toBe(
            null,
        );
    });

    // EC-630: a screen added whose Undo could not be kept is still a change
    // -- the answer may say it was added -- with no Undo of its own, and
    // it never takes away the Undo of a change made before it.
    it('reads a screen added, with or without an Undo kept', () => {
        const added = readEditedScreen(
            JSON.stringify({ did: 'added screen 2', newScreen: 2 }),
        );
        expect(added?.undoId).toBe(null);
        expect(checkIsScreenEdited(added)).toBe(true);
        expect(genScreenUndoAction(added!)).toBe(null);
        expect(
            readEditedScreen(
                JSON.stringify({
                    did: 'added screen 2',
                    newScreen: 2,
                    undoId: 'u3',
                }),
            )?.undoId,
        ).toBe('u3');
        expect(readEditedScreen(JSON.stringify({ newScreen: 2 }))).toBe(null);
        expect(
            readAddedScreenId(
                JSON.stringify({ did: 'added screen 2', newScreen: 2 }),
            ),
        ).toBe(2);
        expect(readAddedScreenId(JSON.stringify({ newScreen: 2 }))).toBe(null);
        expect(
            readAddedScreenId(JSON.stringify({ did: 'x', newScreen: -1 })),
        ).toBe(null);
        expect(readAddedScreenId('There are 8 screens already.')).toBe(null);
        const first = readEditedScreen(
            JSON.stringify({ did: 'a', undoId: 'u1' }),
        );
        const merged = mergeEditedScreen(first, added!);
        expect(merged.undoId).toBe('u1');
        expect(genScreenUndoAction(merged)?.args.id).toBe('u1');
    });
});

describe('SCREEN_SYSTEM_PROMPT', () => {
    it('names every field the tool takes, and the rules around them', () => {
        for (const word of [
            'owa_screen_edit',
            '`style`',
            '`versions`',
            '`lineSync`',
            '`transition`',
            '`display`',
            '`group`',
            '`lock`',
            '`select`',
            '`stage`',
            '`show`',
            '`clear`',
            '`newScreen`',
            'only a person removes a screen',
            'never turned on unasked',
            'owa_undo',
            'owa_present_bible',
            'owa_goto_page presenter.html',
            "'OPTIONS: a | b | c'",
        ]) {
            expect(SCREEN_SYSTEM_PROMPT, word).toContain(word);
        }
    });

    // 2026-11-14: after an owa_undo, the answer said _The button below will
    // put it back_ under an answer with no button -- the window draws one
    // for a screen change alone, and owa_undo's own answer carries an id.
    it('promises the button for a screen change only, never an undo', () => {
        expect(SCREEN_SYSTEM_PROMPT).toContain(
            'ONLY when an owa_screen_edit answer carries an undoId',
        );
        expect(SCREEN_SYSTEM_PROMPT).toContain(
            'an owa_undo has no button: say what is back as it was',
        );
    });
});

describe('SCREEN_CLAIM_PATTERN', () => {
    // 2026-11-14: _I have undone the last change_ after five refused
    // undos, every one of them; nothing had been put back.
    it('reads an undo claimed in the first person', () => {
        for (const claim of [
            'I have undone the last change.',
            "I've undone the centering of the text.",
            'I\u2019ve undone that.',
            'I undid the colour change.',
            "I've grouped screens 0 and 1.",
            'I locked screen 1.',
            "I've added screen 2.",
            'I created a new screen for you.',
        ]) {
            expect(SCREEN_CLAIM_PATTERN.test(claim), claim).toBe(true);
        }
    });

    it('leaves a read, a question and an offer alone', () => {
        for (const words of [
            'Screen 0 is locked and shows John 3:16.',
            'The change can be undone with the button under this answer.',
            'Shall I undo that?',
            'Nothing was undone.',
        ]) {
            expect(SCREEN_CLAIM_PATTERN.test(words), words).toBe(false);
        }
    });
});
