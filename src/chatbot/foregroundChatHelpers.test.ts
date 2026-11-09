import { describe, expect, it } from 'vitest';

import {
    FOREGROUND_EDIT_TOOL_NAME,
    findOpenForegroundAttachments,
    genForegroundAttachment,
    genForegroundOpeningAnswer,
    readEditedForeground,
    readForegroundButtonHint,
    readForegroundComponentAsk,
    resolveForegroundSession,
    toForegroundAsk,
    toForegroundAskList,
    toForegroundChipName,
    toForegroundReadText,
} from './foregroundChatHelpers';

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

    it('never by an everyday word, nor from a command', () => {
        expect(readForegroundComponentAsk('what time is it?')).toBeNull();
        expect(
            readForegroundComponentAsk('the error messages will not go'),
        ).toBeNull();
        expect(readForegroundComponentAsk('/countdown 5')).toBeNull();
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
        });
        expect(readEditedForeground('{"did":"read"}')).toBeNull();
        expect(readEditedForeground('not json')).toBeNull();
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
