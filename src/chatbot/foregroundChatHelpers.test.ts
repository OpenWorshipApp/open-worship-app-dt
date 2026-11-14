import { describe, expect, it } from 'vitest';

import {
    FOREGROUND_EDIT_TOOL_NAME,
    FOREGROUND_SYSTEM_PROMPT,
    findForegroundBlank,
    findForegroundEchoedWords,
    findOpenForegroundAttachments,
    genForegroundAttachment,
    genForegroundBlankRefusal,
    genForegroundEchoQuestion,
    genForegroundOpeningAnswer,
    genForegroundUndoneText,
    mergeEditedForeground,
    readEditedForeground,
    readForegroundButtonHint,
    readForegroundComponentAsk,
    readForegroundUndoParts,
    readHeldForeground,
    resolveForegroundSession,
    toForegroundAsk,
    toForegroundAskList,
    toForegroundChipName,
    toForegroundEditArgs,
    toForegroundReadText,
    toUnquotedAskLine,
} from './foregroundChatHelpers';
import { genLyricUndoAction } from './lyricChatHelpers';

const SESSION_2 = {
    widget: 'quick-text' as const,
    sessionId: 's5k1',
    sessionName: 'Session 2',
};
const DEFAULT_COUNTDOWN = {
    widget: 'countdown' as const,
    sessionId: '',
    sessionName: 'Default',
};

describe('a foreground session as a chip', () => {
    it('is named by its component and its session, no bytes', () => {
        const chip = genForegroundAttachment(SESSION_2);
        expect(chip.kind).toBe('foreground');
        expect(chip.name).toBe('Quick Text › Session 2');
        expect(chip.byteSize).toBe(0);
        expect(chip.foreground).toEqual(SESSION_2);
        expect(
            toForegroundChipName({
                widget: 'camera',
                sessionId: '',
                sessionName: '',
                itemId: 'dev1',
                itemLabel: 'USB Camera',
            }),
        ).toBe('Camera Show › USB Camera');
    });

    it('stays open past later questions and a picture, until put away', () => {
        const chip = genForegroundAttachment(SESSION_2);
        const messages = [
            { id: 1, author: 'you', attachments: [chip] },
            { id: 2, author: 'bot' },
            {
                id: 3,
                author: 'you',
                attachments: [
                    {
                        id: 'p',
                        kind: 'image' as const,
                        name: 'my screen',
                        mimeType: 'image/png',
                        byteSize: 1,
                    },
                ],
            },
        ];
        expect(findOpenForegroundAttachments(messages)).toEqual([chip]);
        expect(findOpenForegroundAttachments(messages, 3)).toEqual([]);
        expect(toForegroundAskList([chip, chip])).toEqual([SESSION_2]);
    });

    it('holds what an answer put up, newest first, beside the attached one (EC-520)', () => {
        const attached = genForegroundAttachment(SESSION_2);
        const held = genForegroundAttachment(DEFAULT_COUNTDOWN);
        // "Start a 5 minute countdown", typed: the answer holds it, so
        // "pause it" under it is about that countdown.
        expect(
            findOpenForegroundAttachments([
                { id: 1, author: 'you' },
                { id: 2, author: 'bot', attachments: [held] },
                { id: 3, author: 'you' },
            ]),
        ).toEqual([held]);
        // In a chat about an attached session, a new one the answer made is
        // held too, newest first, and the attached one stays.
        expect(
            findOpenForegroundAttachments([
                { id: 1, author: 'you', attachments: [attached] },
                { id: 2, author: 'bot', attachments: [held] },
            ]),
        ).toEqual([held, attached]);
        // An answer holding the session already open is not two of it.
        expect(
            findOpenForegroundAttachments([
                { id: 1, author: 'you', attachments: [attached] },
                {
                    id: 2,
                    author: 'bot',
                    attachments: [genForegroundAttachment(SESSION_2)],
                },
            ]).map((one) => {
                return one.foreground;
            }),
        ).toEqual([SESSION_2]);
        // Held before the person's own pick, and put away with it.
        expect(
            findOpenForegroundAttachments([
                { id: 1, author: 'bot', attachments: [held] },
                { id: 2, author: 'you', attachments: [attached] },
            ]),
        ).toEqual([attached]);
        expect(
            findOpenForegroundAttachments(
                [
                    { id: 1, author: 'you' },
                    { id: 2, author: 'bot', attachments: [held] },
                ],
                2,
            ),
        ).toEqual([]);
    });
});

describe('a typed question that names a component', () => {
    it('is read by its label, the longest name first', () => {
        expect(readForegroundComponentAsk('start a 5 minute countdown')).toBe(
            'countdown',
        );
        expect(readForegroundComponentAsk('make the top marquee red')).toBe(
            'marquee-top',
        );
        expect(
            readForegroundComponentAsk('make a quick text for John 3:16'),
        ).toBe('quick-text');
    });

    it('reads the time asked for ON the screen as the clock (EC-521)', () => {
        for (const line of [
            'Put the time on the screen',
            'show the time on screen please',
            'can you put the current time up',
        ]) {
            expect(readForegroundComponentAsk(line), line).toBe('time');
        }
        expect(
            readForegroundComponentAsk('what time does the service start?'),
        ).toBeNull();
    });

    // EC-654: "time the worship set" was answered with the panel's steps.
    it('reads a line asking to time something as the stopwatch', () => {
        for (const line of [
            'time the worship set',
            'Please time the sermon',
            'can you time how long the prayer takes',
            'could you please time it',
        ]) {
            expect(readForegroundComponentAsk(line), line).toBe('stopwatch');
        }
        for (const line of [
            'what time the service starts',
            'time for the offering',
            'time to start',
            'the time the sermon took',
        ]) {
            expect(readForegroundComponentAsk(line), line).toBeNull();
        }
        // A component named is the one asked for.
        expect(
            readForegroundComponentAsk('time the sermon with a countdown'),
        ).toBe('countdown');
    });

    // EC-655: the general tool takes no place, and the clock came up in
    // the middle.
    it('reads the time put in a place as the clock', () => {
        for (const line of [
            'put the time in the corner',
            'show the time in the top right',
            'put the time at the bottom of the screen',
            'move the time to the top',
            'I want the time showing in the bottom right',
            'can you put the time in the corner?',
        ]) {
            expect(readForegroundComponentAsk(line), line).toBe('time');
        }
        for (const line of [
            'what time do we start?',
            'what is the time in the top league',
            'is the time on the left right?',
            'the time',
        ]) {
            expect(readForegroundComponentAsk(line), line).toBeNull();
        }
    });

    it('reads past the words in quotes, which name nothing (EC-645)', () => {
        // Quoted words had stood between "message" and "on the screen".
        for (const line of [
            'Put the message "Welcome" on the screen',
            'put the message “Welcome, visitors” on the screen',
            "put the message 'Welcome' on the screen",
            'put the message «Welcome» on the screen',
            // ... and a component named in them is not the one asked for.
            "Put the message 'the countdown starts soon' on the screen",
        ]) {
            expect(readForegroundComponentAsk(line), line).toBe('message');
        }
        // A component named only in quotes is still read.
        expect(readForegroundComponentAsk("put the 'countdown' up")).toBe(
            'countdown',
        );
        // An apostrophe inside a word opens no quote.
        expect(toUnquotedAskLine("the car park's full, isn't it")).toBeNull();
        expect(toUnquotedAskLine('show (Welcome) and [this]')).toBeNull();
        expect(toUnquotedAskLine("show 'Welcome' now")).toBe('show now');
    });

    it('reads a notice at an edge of the screen as a Quick Text (EC-532)', () => {
        for (const line of [
            'Show a message at the bottom of the screen for 15 seconds: ' +
                'the owner of car ABC 123, your lights are on',
            'put a notice at the top saying Welcome',
            'An announcement at the bottom: coffee after the service',
        ]) {
            expect(readForegroundComponentAsk(line), line).toBe('quick-text');
        }
        // A marquee or the clock named with a place stays itself.
        expect(
            readForegroundComponentAsk(
                'move the clock to the bottom of the screen',
            ),
        ).toBe('time');
        expect(
            readForegroundComponentAsk(
                'put the marquee at the top of the screen',
            ),
        ).toBe('marquee-bottom');
        // The place rides the same start call.
        expect(FOREGROUND_SYSTEM_PROMPT).toContain(
            '"at the bottom" is look position "bottom"',
        );
        // And how long it stays is a Quick Text's: a Message has no time
        // (EC-538, it went up as one and the 15 seconds went nowhere).
        expect(FOREGROUND_SYSTEM_PROMPT).toContain(
            'are a quick-text with seconds -- a message stays until hidden',
        );
    });

    it('reads a component by the words a language says for it (EC-563)', () => {
        // A made-up language written in signs: what is read is its data.
        const words = [
            { key: 'time', entry: '⏰⏰⏰', isSpaced: false },
            { key: 'nothing-of-ours', entry: '✦✦✦', isSpaced: false },
        ];
        const same = (key: string) => {
            return key;
        };
        expect(readForegroundComponentAsk('⇡⏰⏰⏰⇣', same, words)).toBe(
            'time',
        );
        expect(readForegroundComponentAsk('⇡✦✦✦⇣', same, words)).toBeNull();
        expect(readForegroundComponentAsk('⇡⇣', same, words)).toBeNull();
    });

    it('reads a language word the way its create asks are read (EC-564)', () => {
        // Made-up words: where a clock is also an hour, the clock is named
        // only near the screen; a stem takes its endings; spacing counts.
        const words = [
            { key: 'time', entry: 'zork … blip*', isSpaced: true },
            { key: 'time', entry: 'tikka*', isSpaced: true },
            { key: 'time', entry: '⌚ … ▣', isSpaced: false },
        ];
        const same = (key: string) => {
            return key;
        };
        const read = (line: string) => {
            return readForegroundComponentAsk(line, same, words);
        };
        expect(read('put zork on the blipper')).toBe('time');
        expect(read('Zork at ten, fine')).toBeNull();
        expect(
            read('the zork starts, then more words and the blip'),
        ).toBeNull();
        expect(read('Tikkas up please')).toBe('time');
        expect(read('a stikka')).toBeNull();
        expect(read('⇡⌚⇣⇣▣')).toBe('time');
        expect(read('⌚')).toBeNull();
        // The longest name wins over a language word inside it.
        expect(read('a tikka countdown')).toBe('countdown');
    });

    it('gives the way back from a hide as an ask, never as a button (EC-562)', () => {
        // "press the button 'show'" had reached a Khmer reader: the tool's
        // action word, which no panel draws.
        expect(FOREGROUND_SYSTEM_PROMPT).toContain(
            'they can ask you to reverse it (put it up again, resume it, take it off)',
        );
        expect(FOREGROUND_SYSTEM_PROMPT).toContain(
            "this tool's action names are not buttons",
        );
        expect(FOREGROUND_SYSTEM_PROMPT).not.toContain('(show it again,');
    });

    it('offers to turn the screen on, naming no button, and no undo id (EC-617)', () => {
        // "tombol show" and "punya id undo" had reached Indonesian answers.
        expect(FOREGROUND_SYSTEM_PROMPT).toContain(
            'offer to turn that screen on for them',
        );
        expect(FOREGROUND_SYSTEM_PROMPT).not.toContain('show button');
        expect(FOREGROUND_SYSTEM_PROMPT).toContain('(never the words undo id)');
    });

    it('never by an everyday word, nor from a command', () => {
        expect(readForegroundComponentAsk('what time is it?')).toBeNull();
        expect(
            readForegroundComponentAsk('the error messages will not go'),
        ).toBeNull();
        expect(readForegroundComponentAsk('/countdown 5')).toBeNull();
    });

    it('never in a line about the running order (EC-467)', () => {
        expect(
            readForegroundComponentAsk(
                'Make a new running order for Sunday: a welcome countdown ' +
                    '5 minutes, Doxology, Psalm 23',
            ),
        ).toBeNull();
        expect(
            readForegroundComponentAsk(
                'Add a countdown to the start of my presenting flow',
            ),
        ).toBeNull();
        // The app's own name for one, in the window's language.
        expect(
            readForegroundComponentAsk('a Zflowz with a countdown', (key) => {
                return key === 'Presenting Flow' ? 'Zflowz' : key;
            }),
        ).toBeNull();
    });

    it("reads the window's own language through its dictionary", () => {
        // A made-up translation: no other language may live in a test.
        expect(
            readForegroundComponentAsk('make the Zcountz bigger', (key) => {
                return key === 'Countdown' ? 'Zcountz' : key;
            }),
        ).toBe('countdown');
    });
});

describe('the question as the model is asked it', () => {
    it("carries each attached session as it reads now, and a button's job", () => {
        const asked = toForegroundAsk('Make the words larger', [
            { ask: SESSION_2, text: 'holds: {"text":"Welcome"}' },
        ]);
        expect(asked).toContain(FOREGROUND_EDIT_TOOL_NAME);
        expect(asked).toContain('widget "quick-text", session "s5k1"');
        expect(asked).toContain('holds: {"text":"Welcome"}');
        expect(asked).toContain('look {"size": "larger"}');
        expect(readForegroundButtonHint('nothing pressed')).toBeNull();
    });

    it('names the Default session by its name, and a clock as a clock', () => {
        const asked = toForegroundAsk('pause it', [
            { ask: DEFAULT_COUNTDOWN, text: null },
            {
                ask: { widget: 'time', sessionId: 's9', sessionName: 'Clocks' },
                text: null,
            },
        ]);
        expect(asked).toContain('widget "countdown", session "Default"');
        expect(asked).toContain('widget "clock", session "s9"');
        expect(asked).toContain('could not be read just now');
    });

    it('reads a read answer as plain lines, never JSON whole', () => {
        const text = toForegroundReadText({
            component: 'Countdown',
            session: { name: '5:00' },
            content: { minutes: '5' },
            look: { size: '100px' },
            onScreens: [0],
        });
        expect(text).toContain('component: Countdown');
        expect(text).toContain('session: 5:00');
        expect(text).toContain('on screen: screen 0');
        expect(toForegroundReadText(null)).toBeNull();
    });

    it('names every screen, ticked and on, so none is guessed (EC-522)', () => {
        const text = toForegroundReadText({
            component: 'Stopwatch',
            session: { name: 'Default' },
            onScreens: [],
            screens: [
                {
                    screenId: 0,
                    isTicked: true,
                    isShowing: false,
                    isLocked: false,
                },
                {
                    screenId: 1,
                    isTicked: false,
                    isShowing: true,
                    isLocked: true,
                },
            ],
        });
        expect(text).toContain(
            'screens: 0 (ticked, OFF), 1 (not ticked, on, locked)',
        );
        // No screen at all is said too.
        expect(
            toForegroundReadText({ component: 'Clock', screens: [] }),
        ).toContain('screens: none set up');
    });
});

describe('what comes back from the model and the tool', () => {
    it("turns a session name the model writes into the attached one's id", () => {
        const askList = [SESSION_2, DEFAULT_COUNTDOWN];
        expect(
            resolveForegroundSession('quick-text', 'session 2', askList),
        ).toBe('s5k1');
        expect(resolveForegroundSession('countdown', 'Default', askList)).toBe(
            'Default',
        );
        // A new session asked for by name is the worker's to make.
        expect(
            resolveForegroundSession('quick-text', 'Psalm 23', askList),
        ).toBe('Psalm 23');
    });

    it('reads a change off its result, the panel as its list', () => {
        expect(
            readEditedForeground(
                JSON.stringify({
                    did: 'changed',
                    component: 'Quick Text',
                    session: { name: 'Session 2' },
                    isChanged: true,
                    undoId: '20261109-151623456-k3x9',
                }),
            ),
        ).toEqual({
            name: 'Session 2',
            undoId: '20261109-151623456-k3x9',
            listName: 'Quick Text',
            undoParts: [{ name: 'Session 2', isMade: false }],
            shownName: 'Quick Text › Session 2',
        });
        expect(readEditedForeground('{"did":"read"}')).toBeNull();
        expect(readEditedForeground('not json')).toBeNull();
    });

    it('names a change by its strip, never the bare session (EC-601)', () => {
        const toResult = (component: string, session?: object) => {
            return JSON.stringify({
                did: 'started',
                component,
                ...(session === undefined ? {} : { session }),
                isChanged: true,
                undoId: 'u-1',
            });
        };
        // Seen live: a clock put up was "“Default” was changed".
        const clock = readEditedForeground(
            toResult('Time', { id: '', name: 'Default', isNew: false }),
        )!;
        expect(clock.shownName).toBe('Time › Default');
        // The key the undo and the list read stays the session's own.
        expect(clock.name).toBe('Default');
        expect(
            readEditedForeground(toResult('Countdown', { name: 'Welcome' }))!
                .shownName,
        ).toBe('Countdown › Welcome');
        // No session: the panel alone; a name the app has no label for is
        // said as it came, never looked up.
        expect(readEditedForeground(toResult('Countdown'))!.shownName).toBe(
            'Countdown',
        );
        expect(
            readEditedForeground(toResult('Not A Panel', { name: 'One' }))!
                .shownName,
        ).toBe('Not A Panel › One');
    });

    it('keeps whether a change went up on screens that are all off (EC-599)', () => {
        const toResult = (did: string, isAnyShowing?: boolean) => {
            return JSON.stringify({
                did,
                component: 'Quick Text',
                session: { name: 'Welcome', isNew: true },
                isChanged: true,
                undoId: `u-${did}`,
                ...(isAnyShowing === undefined ? {} : { isAnyShowing }),
            });
        };
        expect(readEditedForeground(toResult('started', false))).toMatchObject({
            isScreenOff: true,
        });
        expect(readEditedForeground(toResult('shown', false))).toMatchObject({
            isScreenOff: true,
        });
        expect(readEditedForeground(toResult('started', true))).toMatchObject({
            isScreenOff: false,
        });
        // A look changed on a session that is not up says nothing of it.
        const changed = readEditedForeground(toResult('changed', false));
        expect(changed).not.toHaveProperty('isScreenOff');
        // A later change in the same answer keeps what was known, and a
        // screen turned on since is believed.
        const started = readEditedForeground(toResult('started', false))!;
        expect(mergeEditedForeground(started, changed!).isScreenOff).toBe(true);
        const shownOn = readEditedForeground(toResult('changed', true))!;
        expect(mergeEditedForeground(started, shownOn).isScreenOff).toBe(false);
    });

    it('puts back every session one answer changed, under its one Undo (EC-539)', () => {
        const countdown = {
            name: '3:00',
            undoId: '20261113-034803869-schh',
            listName: 'Countdown',
            undoParts: [{ name: '3:00', isMade: false }],
        };
        const marquee = {
            name: 'Welcome!',
            undoId: '20261113-034804356-p69w',
            listName: 'Marquee Top',
            undoParts: [{ name: 'Welcome!', isMade: false }],
        };
        const merged = mergeEditedForeground(
            mergeEditedForeground(null, countdown),
            marquee,
        );
        // The newest is what Show it in the list rings; both go back.
        expect(merged).toEqual({
            ...marquee,
            undoIdList: [countdown.undoId, marquee.undoId],
            undoParts: [...countdown.undoParts, ...marquee.undoParts],
        });
        expect(genLyricUndoAction(merged)?.args).toMatchObject({
            id: marquee.undoId,
            ids: [countdown.undoId, marquee.undoId],
        });
        // A song changed earlier in the answer keeps its own button.
        const song = {
            name: 'Amazing Grace',
            undoId: 'x',
            listName: undefined,
        };
        expect(mergeEditedForeground(song, marquee)).toEqual(marquee);
    });

    it('says a session the answer made is taken away by its undo (EC-545)', () => {
        // The live pass: one answer started a countdown and a marquee, each
        // a new session, and the press had said the marquee "is back".
        const toStarted = (component: string, name: string, undoId: string) => {
            return JSON.stringify({
                did: 'started',
                component,
                session: { id: undoId, name, isNew: true },
                isChanged: true,
                undoId,
            });
        };
        const countdown = readEditedForeground(
            toStarted('Countdown', 'Countdown 3:00', 'u1'),
        );
        const marquee = readEditedForeground(
            toStarted('Marquee Bottom', 'Welcome, friends', 'u2'),
        );
        expect(countdown?.undoParts).toEqual([
            { name: 'Countdown 3:00', isMade: true },
        ]);
        const merged = mergeEditedForeground(
            mergeEditedForeground(null, countdown!),
            marquee!,
        );
        const args = genLyricUndoAction(merged)?.args;
        expect(args?.parts).toEqual([
            { name: 'Countdown 3:00', isMade: true },
            { name: 'Welcome, friends', isMade: true },
        ]);
        // Both named, neither "back as it was".
        const parts = readForegroundUndoParts(args?.parts);
        expect(genForegroundUndoneText(parts!)).toBe(
            '“Countdown 3:00” is taken away again: the change that made ' +
                'it is undone.\n\n' +
                '“Welcome, friends” is taken away again: the change that ' +
                'made it is undone.',
        );
    });

    it('keeps a session made once made, whatever the answer did to it next', () => {
        const started = {
            name: 'Notice',
            undoId: 'u1',
            listName: 'Quick Text',
            undoParts: [{ name: 'Notice', isMade: true }],
        };
        const set = {
            name: 'Notice',
            undoId: 'u2',
            listName: 'Quick Text',
            undoParts: [{ name: 'Notice', isMade: false }],
        };
        const merged = mergeEditedForeground(started, set);
        expect(merged.undoParts).toEqual([{ name: 'Notice', isMade: true }]);
        expect(merged.undoIdList).toEqual(['u1', 'u2']);
        // A session only changed is back as it was, as before.
        expect(
            genForegroundUndoneText([{ name: 'Default', isMade: false }]),
        ).toBe('“Default” is back as it was before that change.');
    });

    it('reads only whole parts off a saved press', () => {
        // A song's Undo, and an answer saved before EC-545, carry none.
        expect(readForegroundUndoParts(undefined)).toBeNull();
        expect(readForegroundUndoParts([])).toBeNull();
        expect(
            readForegroundUndoParts([
                { name: '', isMade: true },
                { name: 'A', isMade: 'yes' },
                null,
                { name: 'B', isMade: false },
            ]),
        ).toEqual([{ name: 'B', isMade: false }]);
    });

    it('reads the session an answer put up or changed, to hold it (EC-520)', () => {
        const result = (did: string, extra: object = {}) => {
            return JSON.stringify({
                did,
                widget: 'countdown',
                session: { id: 's5k1', name: '5:00', isNew: true },
                ...extra,
            });
        };
        for (const did of ['started', 'shown', 'changed', 'created', 'timer']) {
            expect(readHeldForeground(result(did)), did).toEqual({
                widget: 'countdown',
                sessionId: 's5k1',
                sessionName: '5:00',
            });
        }
        // A clock is the Time component, as its panel keys it.
        expect(
            readHeldForeground(
                JSON.stringify({
                    did: 'started',
                    widget: 'time',
                    session: { id: '', name: 'Default' },
                }),
            ),
        ).toEqual({ widget: 'time', sessionId: '', sessionName: 'Default' });
        // A read, a check, a stop and a refusal hold nothing new; a component
        // with no sessions has nothing to hold by.
        for (const text of [
            result('read'),
            result('checked'),
            result('stopped'),
            JSON.stringify({ isError: true, reason: 'No.' }),
            JSON.stringify({ did: 'started', widget: 'camera', session: null }),
            'not json',
        ]) {
            expect(readHeldForeground(text), text).toBeNull();
        }
    });

    it('puts NEW words up in a new session, never over one nobody attached (EC-523)', () => {
        const askList = [SESSION_2];
        // The model read the panel's Default and named it: a start goes into
        // a new session named after its words instead.
        expect(
            toForegroundEditArgs(
                {
                    action: 'start',
                    widget: 'countdown',
                    minutes: 3,
                    session: 'Default',
                },
                askList,
            ),
        ).toEqual({ action: 'start', widget: 'countdown', minutes: 3 });
        // The attached one is started where it is, by its id.
        expect(
            toForegroundEditArgs(
                { action: 'start', widget: 'quick-text', session: 'Session 2' },
                askList,
            ),
        ).toEqual({ action: 'start', widget: 'quick-text', session: 's5k1' });
        // A change keeps the session it names: that is the one asked about.
        expect(
            toForegroundEditArgs(
                { action: 'set', widget: 'countdown', session: 'Default' },
                [],
            ),
        ).toEqual({ action: 'set', widget: 'countdown', session: 'Default' });
        expect(toForegroundEditArgs(undefined, askList)).toEqual({});
        // Nothing attached -- the panel's current session read for a typed
        // line: a start names none of it, so a typed Default is safe.
        expect(
            toForegroundEditArgs(
                {
                    action: 'start',
                    widget: 'countdown',
                    minutes: 3,
                    session: 'Default',
                },
                [DEFAULT_COUNTDOWN],
                false,
            ),
        ).toEqual({ action: 'start', widget: 'countdown', minutes: 3 });
        // Attached, the Default countdown is started where it is.
        expect(
            toForegroundEditArgs(
                { action: 'start', widget: 'countdown', session: 'Default' },
                [DEFAULT_COUNTDOWN],
            ),
        ).toEqual({ action: 'start', widget: 'countdown', session: 'Default' });
        // Another component's Default is not this one's.
        expect(
            toForegroundEditArgs(
                { action: 'start', widget: 'quick-text', session: 'Default' },
                [DEFAULT_COUNTDOWN],
            ),
        ).toEqual({ action: 'start', widget: 'quick-text' });
    });

    it('drops a 0 written beside a time it gave (EC-616)', () => {
        // Free's Russian countdown: refused by the schema, a round spent.
        expect(
            toForegroundEditArgs(
                {
                    action: 'start',
                    widget: 'countdown',
                    minutes: 5,
                    seconds: 0,
                },
                [],
            ),
        ).toEqual({ action: 'start', widget: 'countdown', minutes: 5 });
        expect(
            toForegroundEditArgs(
                {
                    action: 'start',
                    widget: 'quick-text',
                    seconds: 15,
                    minutes: 0,
                },
                [],
            ),
        ).toEqual({ action: 'start', widget: 'quick-text', seconds: 15 });
        expect(
            toForegroundEditArgs(
                { action: 'set', widget: 'countdown', at: '10:30', seconds: 0 },
                [],
            ),
        ).toEqual({ action: 'set', widget: 'countdown', at: '10:30' });
        // With the session named, the same, and the session still resolved.
        expect(
            toForegroundEditArgs(
                {
                    action: 'start',
                    widget: 'countdown',
                    minutes: 3,
                    seconds: 0,
                    session: 'Default',
                },
                [DEFAULT_COUNTDOWN],
            ),
        ).toEqual({
            action: 'start',
            widget: 'countdown',
            minutes: 3,
            session: 'Default',
        });
        // A 0 alone is no time to keep or to drop: the schema says so, and
        // the worker never starts a default nobody asked for.
        expect(
            toForegroundEditArgs(
                { action: 'start', widget: 'countdown', minutes: 0 },
                [],
            ),
        ).toEqual({ action: 'start', widget: 'countdown', minutes: 0 });
        // A `delay` of 0 is a time the schema takes.
        expect(
            toForegroundEditArgs(
                {
                    action: 'start',
                    widget: 'quick-text',
                    seconds: 10,
                    delay: 0,
                },
                [],
            ),
        ).toEqual({
            action: 'start',
            widget: 'quick-text',
            seconds: 10,
            delay: 0,
        });
    });

    it('promises Undo only where there is one, and names what an off screen holds', () => {
        // EC-530: a show, hide or timer press keeps no backup.
        expect(FOREGROUND_SYSTEM_PROMPT).toContain(
            'ONLY when its answer carries an undoId',
        );
        expect(FOREGROUND_SYSTEM_PROMPT).toContain(
            'hide or timer press keeps none',
        );
        // EC-531: an off screen still holds what was put up.
        expect(FOREGROUND_SYSTEM_PROMPT).toContain('never "nothing"');
        // EC-526, EC-529: more time, and everything off.
        expect(FOREGROUND_SYSTEM_PROMPT).toContain('timer "add"');
        expect(FOREGROUND_SYSTEM_PROMPT).toContain('widget "all"');
    });

    it('reads a timer press written with no action as that press', () => {
        expect(
            toForegroundEditArgs(
                { timer: 'add', widget: 'countdown', minutes: 2 },
                [],
            ),
        ).toEqual({
            action: 'timer',
            timer: 'add',
            widget: 'countdown',
            minutes: 2,
        });
        // Its session is still put into an id.
        expect(
            toForegroundEditArgs(
                { timer: 'pause', widget: 'quick-text', session: 'Session 2' },
                [SESSION_2],
            ),
        ).toEqual({
            action: 'timer',
            timer: 'pause',
            widget: 'quick-text',
            session: 's5k1',
        });
        // Nothing else is guessed: no action and no timer stays as sent.
        expect(
            toForegroundEditArgs({ widget: 'countdown', minutes: 2 }, []),
        ).toEqual({ widget: 'countdown', minutes: 2 });
        expect(
            toForegroundEditArgs(
                { action: 'set', timer: 'add', widget: 'countdown' },
                [],
            ),
        ).toEqual({ action: 'set', timer: 'add', widget: 'countdown' });
    });

    it('opens under a card of the jobs asked for most', () => {
        const opening = genForegroundOpeningAnswer(SESSION_2);
        expect(opening.text).toContain('Quick Text › Session 2');
        expect(opening.replies).toEqual([
            'Show it on the screen',
            'Make the words larger',
            'Move it to the top',
            'Take it off the screen',
        ]);
    });
});

// 2026-11-14, EC-652: "show the church wifi password on the screen" put
// up "Church WiFi Password: [Insert Password Here]" three times of three,
// each answered "I have put the WiFi password on the screen".
describe('a blank to fill in, about to go up', () => {
    it('is found in the words a call puts up', () => {
        expect(
            findForegroundBlank(
                {
                    widget: 'message',
                    text: 'Church WiFi Password: [Insert Password Here]',
                },
                'show the church wifi password on the screen',
            ),
        ).toBe('[Insert Password Here]');
        expect(
            findForegroundBlank(
                { texts: ['Welcome', 'Our speaker today: {name}'] },
                'put the name of our speaker up',
            ),
        ).toBe('{name}');
        expect(
            findForegroundBlank(
                { text: 'The service starts at <time>' },
                'show when the service starts',
            ),
        ).toBe('<time>');
    });

    it('is not a blank when the person typed it, or holds no letter', () => {
        expect(
            findForegroundBlank(
                { text: '[Youth group] meets tonight' },
                'put up "[youth group] meets tonight"',
            ),
        ).toBeNull();
        for (const text of ['Grace2024', 'Psalm 23 [1]', '5 < 10 > 3']) {
            expect(findForegroundBlank({ text }, 'show it'), text).toBeNull();
        }
        expect(findForegroundBlank({ minutes: 5 }, 'start')).toBeNull();
        expect(findForegroundBlank(undefined, 'start')).toBeNull();
    });

    it('is refused with what to do instead', () => {
        const refusal = genForegroundBlankRefusal('[Insert Password Here]');
        expect(refusal).toContain('"[Insert Password Here]"');
        expect(refusal).toContain('Nothing changed on the screens.');
        expect(refusal).toContain('never say it is up');
    });

    // EC-653: "put up how long until the service starts" started a 5
    // minute countdown nobody named, three times of three; and a thing
    // asked for by what it is went up as its own name.
    it('is in the prompt with the time a countdown counts down to', () => {
        expect(FOREGROUND_SYSTEM_PROMPT.replace(/\s+/g, ' ')).toContain(
            'What they did not give is asked for, never made up. Asked to ' +
                'show a thing by what it is and not the thing itself ("show ' +
                'the door code", "put up who is preaching"), ask them for ' +
                'it: its name alone on the screen shows nothing. A countdown ' +
                'TO something they gave no time for ("count down to the ' +
                'wedding") asks what time it is.',
        );
    });
});

// EC-652: with the blank refused, "show the church wifi password on the
// screen" put up "Church WiFi Password" -- the name of what to show, not it
// -- three times of three.
describe('words about to go up that are only the line typed', () => {
    it('are found when the line marks no words of its own', () => {
        expect(
            findForegroundEchoedWords(
                { widget: 'message', text: 'Church WiFi Password' },
                'show the church wifi password on the screen',
            ),
        ).toBe('Church WiFi Password');
        expect(
            findForegroundEchoedWords(
                { widget: 'marquee', texts: ['x', 'Welcome to our church'] },
                'show welcome to our church on the screen',
            ),
        ).toBe('Welcome to our church');
        // An apostrophe inside a word marks nothing.
        expect(
            findForegroundEchoedWords(
                { text: 'Pastor\u2019s phone number' },
                'put the pastor\u2019s phone number up',
            ),
        ).toBe('Pastor\u2019s phone number');
    });

    it('are not when the line marks them, or they are not its run', () => {
        // After a colon, or in quotes of any kind: the words they gave.
        expect(
            findForegroundEchoedWords(
                { text: 'Grace2024' },
                'show the wifi password on the screen: Grace2024',
            ),
        ).toBe(null);
        for (const typed of [
            'show "welcome home" on the screen',
            'show \u201Cwelcome home\u201D on the screen',
            'show \u00ABwelcome home\u00BB on the screen',
        ]) {
            expect(
                findForegroundEchoedWords({ text: 'Welcome home' }, typed),
                typed,
            ).toBe(null);
        }
        // A time's colon marks nothing; words of their own are not a run.
        expect(
            findForegroundEchoedWords(
                { text: 'Doors open' },
                'put up doors open at 10:30',
            ),
        ).toBe('Doors open');
        expect(
            findForegroundEchoedWords(
                { text: 'The password is in the bulletin' },
                'show the wifi password',
            ),
        ).toBe(null);
        // The whole line typed is the words, and nothing else asked.
        expect(
            findForegroundEchoedWords({ text: 'Welcome home' }, 'welcome home'),
        ).toBe(null);
        expect(findForegroundEchoedWords({ minutes: 5 }, 'start 5')).toBe(null);
        expect(findForegroundEchoedWords(undefined, 'show it')).toBe(null);
    });

    it('go back with the question, and go up when sent again', () => {
        const question = genForegroundEchoQuestion('Church WiFi Password');
        expect(question).toContain('"Church WiFi Password"');
        expect(question).toContain('ask them for it');
        expect(question).toContain('send the same call again');
    });
});
