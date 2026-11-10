// @vitest-environment jsdom

// The help window's conversation about a person, a place or a passage --
// the card a Lookup Detail panel's 🤖 opens, every button under it, the
// word study, and the lines typed under it that the window answers itself
// -- plus the routing the start of `handleAsking` does before any provider:
// a command stopped, a verse asked for by what it says, a Reader question.
// The tool host and the assistant are file-local mocks; the lookup, step
// and word-study helpers behind the buttons are the real ones.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { settings, routes, mocks } = vi.hoisted(() => ({
    settings: new Map<string, string>(),
    // What each tool answers in this test, by name. A tool with no route
    // fails, the way a tool host that does not have it would.
    routes: {} as Record<
        string,
        (args: any, signal?: AbortSignal | null) => any
    >,
    mocks: {
        callTool: vi.fn(),
        getAiEndpoints: vi.fn(),
        askLlmBot: vi.fn(),
        electronSendAsync: vi.fn(),
        openExternalURL: vi.fn(),
    },
}));

vi.mock('../server/appProvider', () => ({
    default: {
        isPagePresenter: false,
        isPageReader: false,
        isPageAppDocumentEditor: false,
        isPageExperiment: false,
        currentHomePage: '/chatbot.html',
        appInfo: { author: 'Open Worship <help@example.org>' },
        systemUtils: { isDev: false, isGlassCapable: false },
        envUtils: {},
        messageUtils: {
            sendDataSync: () => null,
            sendData: () => {},
            listenOnceForData: () => {},
            listenForData: () => {},
            removeListener: () => {},
        },
        pathUtils: {
            sep: '/',
            join: (...parts: string[]) => parts.join('/'),
            basename: (filePath: string) => {
                return filePath.split(/[\\/]/).pop() ?? filePath;
            },
            dirname: (filePath: string) => {
                return filePath.split(/[\\/]/).slice(0, -1).join('/');
            },
        },
        browserUtils: {
            openExternalURL: (url: string) => mocks.openExternalURL(url),
        },
    },
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => settings.get(key) ?? null,
    getSettingForce: (key: string) => settings.get(key) ?? null,
    setSetting: (key: string, value: string | null) => {
        settings.set(key, value ?? '');
    },
    removeSetting: (key: string) => {
        settings.delete(key);
    },
}));
vi.mock('../server/electronSendHelpers', () => ({
    electronSendAsync: (...args: any[]) => mocks.electronSendAsync(...args),
    genReturningEventName: (name: string) => `${name}-return`,
}));
vi.mock('./mcpClient', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./mcpClient')>()),
    callTool: (...args: any[]) => mocks.callTool(...args),
    getAiEndpoints: () => mocks.getAiEndpoints(),
}));
vi.mock('./llmBotHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./llmBotHelpers')>()),
    askLlmBot: (...args: any[]) => mocks.askLlmBot(...args),
}));

import ChatbotAppComp from './ChatbotAppComp';
import type { LookupAskType } from '../helper/ai/lookupAskHelpers';
import { genLookupActions, LOOKUP_STEP_TOOL_NAME } from './lookupStepHelpers';

// Captured before any test fakes the clock: a real turn of the event loop
// and the real time, for the lazy chunks (the question corpus) from disk.
const realSetTimeout = globalThis.setTimeout;
const realNow = performance.now.bind(performance);
const originalScrollIntoView = Element.prototype.scrollIntoView;

const SESSIONS_KEY = 'chatbot-sessions';
const STOPPED_TEXT =
    'Stopped. I did not finish looking that up — press the question above ' +
    'to ask it again.';
const ASK_PASSAGE_TEXT =
    'Type the passage you want, like John 3:16 or Psalm 23.';

function json(value: unknown) {
    return JSON.stringify(value);
}

function defer<T = string>() {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((onResolve, onReject) => {
        resolve = onResolve;
        reject = onReject;
    });
    return { promise, resolve, reject };
}

function genSession(id: string, messages: any[], extra: any = {}) {
    return {
        id,
        title: '',
        messages,
        draft: '',
        focus: 'presenter',
        isFocusChosen: true,
        provider: 'free',
        model: '',
        isLocked: false,
        ...extra,
    };
}

function seedSessions(sessions: any[], activeId = sessions[0]?.id ?? '') {
    settings.set(SESSIONS_KEY, JSON.stringify({ activeId, sessions }));
}

// A passage of three verses, as `owa_lookup_record` reads one.
const PASSAGE_ASK: LookupAskType = {
    kind: 'verse',
    target: 'GEN 8:1-3',
    title: 'Genesis 8:1-3',
    bibleKey: 'KJV',
    page: 'reader.html',
};
const PASSAGE_TEXT =
    '(1): And God remembered Noah, and every living thing. ' +
    '(2): The fountains also of the deep were stopped. ' +
    '(3): And the waters returned from off the earth continually.';
const PASSAGE_FACTS = {
    kind: 'verse',
    bible: 'KJV',
    passages: [
        {
            key: 'GEN 8:1-3',
            ref: 'Genesis 8:1-3',
            title: 'Genesis 8:1-3',
            text: PASSAGE_TEXT,
        },
    ],
    crossRefs: {
        referenceCount: 2,
        otherTestamentName: 'New Testament',
        mostCited: [{ key: '2PE 2:5', title: '2 Peter 2:5' }],
        otherTestament: [{ key: 'MAT 24:37', title: 'Matthew 24:37' }],
        byVerse: [{ verse: '1', themes: [{ theme: 'God remembers' }] }],
    },
    studyFiles: ['pdf/GEN.8.pdf'],
};
const PERSON_ASK: LookupAskType = {
    kind: 'name',
    target: 'noah',
    title: 'Noah',
    bibleKey: 'KJV',
    page: 'reader.html',
};
const PERSON_FACTS = {
    kind: 'name',
    name: 'Noah',
    bible: 'KJV',
    verseCount: 47,
    quoted: [
        { key: 'GEN 6:8', ref: 'Genesis 6:8', title: 'Genesis 6:8' },
        { key: 'GEN 6:9', ref: 'Genesis 6:9', title: 'Genesis 6:9' },
    ],
    parents: [{ id: 'lamech', name: 'Lamech' }],
    children: [
        { id: 'shem', name: 'Shem' },
        { id: 'ham', name: 'Ham' },
        { id: 'japheth', name: 'Japheth' },
    ],
    otherForms: [{ name: 'Noe' }],
};
const PLACE_ASK: LookupAskType = {
    kind: 'location',
    target: 'ararat',
    title: 'Ararat',
    page: 'reader.html',
};
const PLACE_FACTS = {
    kind: 'location',
    name: 'Ararat',
    bible: 'KJV',
    verseCount: 2,
    quoted: [{ key: 'GEN 8:4', ref: 'Genesis 8:4', title: 'Genesis 8:4' }],
    coordinates: { latitude: 39.7, longitude: 44.3 },
};
const BIBLE_LIST = {
    bible: 'KJV',
    bibles: [
        { key: 'KJV', title: 'King James Version' },
        { key: 'SMSV', title: 'Sample Standard Version' },
    ],
};

// The opening card of a conversation, with every button it carries.
function genCard(id: number, ask: any, facts: any) {
    return {
        id,
        author: 'bot',
        text: `I have read ${ask.title}.`,
        actions: genLookupActions(ask, facts),
        lookup: { ...ask, facts: json(facts) },
    };
}

function seedCard(ask: any, facts: any, after: any[] = []) {
    seedSessions([genSession('one', [genCard(1, ask, facts), ...after])]);
}

describe('ChatbotAppComp lookup steps', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.useFakeTimers();
        settings.clear();
        for (const key of Object.keys(routes)) {
            delete routes[key];
        }
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        // jsdom lays nothing out: the tab strip and the suggestion list
        // scroll their row into view, which it does not implement.
        Element.prototype.scrollIntoView = () => {};
        mocks.callTool.mockImplementation(
            async (name: string, args: any, signal?: AbortSignal | null) => {
                const route = routes[name];
                if (route === undefined) {
                    throw new Error(`The tool host has no ${name}`);
                }
                return await route(args ?? {}, signal);
            },
        );
        mocks.getAiEndpoints.mockReturnValue({
            mcpUrl: 'http://127.0.0.1:39223/mcp',
            mcpToken: 'token',
            cdpPort: null,
        });
        mocks.electronSendAsync.mockImplementation(async (channel: string) => {
            return channel === 'main:app:list-app-windows' ? [] : null;
        });
        mocks.askLlmBot.mockRejectedValue(new Error('No assistant here'));
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        vi.clearAllTimers();
        vi.useRealTimers();
        settings.clear();
        if (originalScrollIntoView === undefined) {
            delete (Element.prototype as any).scrollIntoView;
        } else {
            Element.prototype.scrollIntoView = originalScrollIntoView;
        }
        delete (navigator as any).clipboard;
    });

    // Every promise the mocked tools and assistant answer with, and the
    // re-renders they cause. No fake time passes.
    async function settle(rounds = 2) {
        for (let index = 0; index < rounds; index++) {
            await act(async () => {
                await vi.advanceTimersByTimeAsync(0);
            });
        }
    }

    // The same, until `check` holds -- with a real turn of the event loop
    // each time, for a lazy chunk (the question corpus) loading from disk.
    // Bounded by the real clock, not by turns: a loaded machine is slower.
    async function waitFor(check: () => boolean, what: string) {
        const deadline = realNow() + 5000;
        while (!check()) {
            if (realNow() > deadline) {
                throw new Error(`Timed out waiting for ${what}`);
            }
            await settle(1);
            await act(async () => {
                await new Promise((resolve) => realSetTimeout(resolve, 1));
            });
        }
    }

    async function renderWindow() {
        act(() => root.render(<ChatbotAppComp />));
        await settle();
    }

    function cues() {
        return Array.from(container.querySelectorAll<HTMLElement>('.cue'));
    }

    function bodyOf(cue: Element | undefined) {
        return cue?.querySelector('.cue-body')?.textContent ?? '';
    }

    function lastCue() {
        const list = cues();
        return list[list.length - 1];
    }

    function noteOf(cue: Element | undefined) {
        return cue?.querySelector('.cue-note')?.textContent ?? null;
    }

    function actionLabels(cue: Element | undefined) {
        return Array.from(cue?.querySelectorAll('.cue-act') ?? []).map(
            (button) => button.textContent?.trim() ?? '',
        );
    }

    function replyLabels(cue: Element | undefined) {
        return Array.from(cue?.querySelectorAll('.cue-reply') ?? []).map(
            (button) => button.textContent?.trim() ?? '',
        );
    }

    async function click(element: HTMLElement | null | undefined) {
        expect(element).toBeTruthy();
        await act(async () => {
            element!.click();
        });
        await settle();
    }

    async function press(label: string, cue: Element | undefined = lastCue()) {
        const button = Array.from(
            cue?.querySelectorAll<HTMLButtonElement>('.cue-act') ?? [],
        ).find((one) => one.textContent?.trim() === label);
        expect(button, `a button "${label}"`).toBeDefined();
        await click(button);
    }

    // Pressed on the card, and answered: the echo and one line more.
    async function pressOnCard(label: string) {
        const count = cues().length;
        await press(label, cues()[0]);
        await waitFor(() => cues().length >= count + 2, `"${label}"`);
        return lastCue();
    }

    function inputBox() {
        return container.querySelector<HTMLTextAreaElement>('.chat-input')!;
    }

    function typeQuestion(value: string) {
        const box = inputBox();
        const setter = Object.getOwnPropertyDescriptor(
            HTMLTextAreaElement.prototype,
            'value',
        )!.set!;
        act(() => {
            setter.call(box, value);
            box.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }

    async function send(value: string) {
        typeQuestion(value);
        await click(container.querySelector<HTMLButtonElement>('.chat-send'));
    }

    function stopButton() {
        return container.querySelector<HTMLButtonElement>('.chat-stop');
    }

    function toolCalls(name: string) {
        return mocks.callTool.mock.calls.filter((call) => call[0] === name);
    }

    function useClipboard(writeText: (text: string) => Promise<void>) {
        const clipboard = { writeText: vi.fn(writeText) };
        Object.defineProperty(navigator, 'clipboard', {
            value: clipboard,
            configurable: true,
        });
        return clipboard;
    }

    function handOverLookup(ask: Record<string, unknown>) {
        settings.set(
            'chatbot-handoff-lookup',
            json({ ...ask, at: Date.now() }),
        );
    }

    describe('a card opened from a Lookup Detail panel', () => {
        test('a person is read in the panel’s window, searched in its Bible, and offered', async () => {
            routes.owa_lookup_record = (args) => {
                expect(args).toEqual({
                    kind: 'name',
                    id: 'noah',
                    bible: 'KJV',
                    page: 'reader.html',
                });
                return json(PERSON_FACTS);
            };
            routes.owa_find_verse = (args) => {
                expect(args).toEqual({
                    bible: 'KJV',
                    words: 'Noah Noe',
                    page: 'reader.html',
                });
                return json({
                    bible: 'KJV',
                    words: ['noah', 'noe'],
                    total: 2,
                    verses: [
                        { key: 'GEN 6:8', text: 'But Noah found grace.' },
                        { key: 'LUK 3:36', text: 'which was the son of Noe' },
                    ],
                });
            };
            seedSessions([genSession('one', [])]);
            handOverLookup(PERSON_ASK);
            await renderWindow();
            await waitFor(() => cues().length === 1, 'the card');
            const card = lastCue();
            expect(bodyOf(card)).toContain(
                'I have read what the names lookup holds on Noah (drawn from ' +
                    'the King James Version).',
            );
            expect(replyLabels(card)).toEqual([
                'Who was Noah?',
                'What does the Bible say about Noah?',
                'Tell me about the family of Noah',
            ]);
            expect(actionLabels(card)).toEqual([
                'Its verses',
                'Family and places',
                'Family line to Jesus',
                'Read it in another Bible',
            ]);
            expect(document.activeElement).toBe(inputBox());
            // The search is kept on the card with the record.
            await act(async () => {
                await vi.advanceTimersByTimeAsync(400);
            });
            const saved = JSON.parse(settings.get(SESSIONS_KEY)!);
            const lookup = saved.sessions.at(-1).messages[0].lookup;
            expect(JSON.parse(lookup.facts).bibleSearch).toMatchObject({
                bible: 'KJV',
                total: 2,
            });
        });

        test('a passage keeps its chapter’s study files', async () => {
            routes.owa_lookup_record = (args) => {
                expect(args.related).toBe(true);
                const { studyFiles: _files, ...facts } = PASSAGE_FACTS;
                return json(facts);
            };
            routes.owa_resource_file = (args) => {
                expect(args).toEqual({
                    action: 'list',
                    book: 'GEN',
                    chapter: 8,
                });
                return json({ files: [{ file: 'pdf/GEN.8.pdf' }] });
            };
            handOverLookup(PASSAGE_ASK);
            await renderWindow();
            await waitFor(() => cues().length === 1, 'the card');
            expect(bodyOf(lastCue())).toContain(
                'I have read Genesis 8:1-3 in the Bible KJV.',
            );
            expect(bodyOf(lastCue())).toContain(
                'Resources has 1 study files for its chapter.',
            );
            expect(actionLabels(lastCue()).slice(0, 3)).toEqual([
                'Related verses',
                'Study files for this chapter',
                'Study the words',
            ]);
        });

        test('a panel window that has gone is read in any window', async () => {
            routes.owa_lookup_record = (args) => {
                if (args.page !== undefined) {
                    throw new Error('No such window');
                }
                return json(PLACE_FACTS);
            };
            routes.owa_find_verse = () => json({ total: 0 });
            handOverLookup(PLACE_ASK);
            await renderWindow();
            await waitFor(() => cues().length === 1, 'the card');
            expect(
                toolCalls('owa_lookup_record').map((call) => call[1]),
            ).toEqual([
                { kind: 'location', id: 'ararat', page: 'reader.html' },
                { kind: 'location', id: 'ararat' },
            ]);
            expect(actionLabels(lastCue())).toContain('Show it on a map');
        });

        test('a record nothing could read still opens a card that says so', async () => {
            handOverLookup(PERSON_ASK);
            await renderWindow();
            await waitFor(() => cues().length === 1, 'the card');
            expect(bodyOf(lastCue())).toContain(
                'I could not read Noah from the app just now. Ask me about it ' +
                    'anyway and I will try again.',
            );
            expect(actionLabels(lastCue())).toEqual([]);
        });

        test.each([
            ['the read fails after Stop', 'record', 'reject'],
            ['the read answers after Stop', 'record', 'resolve'],
            ['the name search answers after Stop', 'search', 'resolve'],
        ])('no card when %s', async (_name, where, how) => {
            const waiting = defer();
            routes.owa_lookup_record = () => {
                return where === 'record'
                    ? waiting.promise
                    : json(PERSON_FACTS);
            };
            routes.owa_find_verse = () => waiting.promise;
            handOverLookup(PERSON_ASK);
            await renderWindow();
            expect(
                container.querySelector('.chat-progress')?.textContent,
            ).toContain('Reading Noah from the app');
            await click(stopButton());
            expect(bodyOf(lastCue())).toContain(STOPPED_TEXT);
            await act(async () => {
                if (how === 'reject') {
                    waiting.reject(new Error('gone'));
                } else {
                    waiting.resolve(json(PERSON_FACTS));
                }
            });
            await settle();
            expect(cues()).toHaveLength(1);
            expect(toolCalls('owa_lookup_record')).toHaveLength(1);
        });
    });

    describe('the buttons under a passage', () => {
        test('Open in bible lookup opens it, or says it could not', async () => {
            routes.owa_find_verse = (args) => {
                expect(args).toEqual({ open: 'GEN 8:1-3', bible: 'KJV' });
                return '';
            };
            seedCard(PASSAGE_ASK, PASSAGE_FACTS);
            await renderWindow();
            const answer = await pressOnCard('Open in bible lookup');
            expect(bodyOf(cues()[1])).toContain('Open in bible lookup');
            expect(bodyOf(answer)).toContain(
                'I opened Genesis 8:1-3 in the Bible Lookup.',
            );
            routes.owa_find_verse = () => {
                throw new Error('No Bible Lookup');
            };
            expect(bodyOf(await pressOnCard('Open in bible lookup'))).toContain(
                'I could not open Genesis 8:1-3 in the Bible Lookup just now.',
            );
        });

        test('Next chapter opens the next passage as a card of its own', async () => {
            routes.owa_lookup_record = (args) => {
                expect(args).toEqual({
                    kind: 'verse',
                    ref: 'GEN 8:1-3',
                    bible: 'KJV',
                    page: 'reader.html',
                    related: true,
                    near: 'next',
                });
                return json({
                    kind: 'verse',
                    bible: 'KJV',
                    passages: [
                        {
                            key: 'GEN 9:1-2',
                            ref: 'Genesis 9:1-2',
                            title: 'Genesis 9:1-2',
                            text: '(1): And God blessed Noah. (2): And the fear of you.',
                        },
                    ],
                });
            };
            routes.owa_resource_file = (args) => {
                expect(args).toEqual({
                    action: 'list',
                    book: 'GEN',
                    chapter: 9,
                });
                return json({ files: [{ file: 'pdf/GEN.9.pdf' }] });
            };
            seedCard(PASSAGE_ASK, PASSAGE_FACTS);
            await renderWindow();
            const card = await pressOnCard('Next chapter');
            expect(bodyOf(card)).toContain(
                'I have read Genesis 9:1-2 in the Bible KJV.',
            );
            expect(bodyOf(card)).toContain(
                'Resources has 1 study files for its chapter.',
            );
            expect(replyLabels(card)).toContain(
                'Explain this passage in simple words',
            );
            expect(actionLabels(card)).toContain(
                'Study files for this chapter',
            );
        });

        test('there is no passage before the first, nor after the last', async () => {
            routes.owa_lookup_record = () =>
                json({ kind: 'verse', passages: [] });
            seedCard(PASSAGE_ASK, PASSAGE_FACTS);
            await renderWindow();
            expect(bodyOf(await pressOnCard('Previous chapter'))).toContain(
                'There is no passage before Genesis 8:1-3 in this Bible.',
            );
            expect(bodyOf(await pressOnCard('Next chapter'))).toContain(
                'There is no passage after Genesis 8:1-3 in this Bible.',
            );
        });

        test('with no other Bible to list, it says this is the only one', async () => {
            seedCard(PASSAGE_ASK, PASSAGE_FACTS);
            await renderWindow();
            expect(
                bodyOf(await pressOnCard('Read it in another Bible')),
            ).toContain('This is the only Bible on this computer.');
        });

        test('Who and where is in it lists them, and a name opens its card', async () => {
            routes.owa_lookup_record = (args) => {
                if (args.names === true) {
                    expect(args).toEqual({
                        kind: 'verse',
                        ref: 'GEN 8:1-3',
                        bible: 'KJV',
                        page: 'reader.html',
                        names: true,
                    });
                    return json({
                        lang: 'en',
                        people: [{ id: 'noah', name: 'Noah' }],
                        places: [{ id: 'ararat', name: 'Ararat' }],
                    });
                }
                expect(args).toEqual({
                    kind: 'name',
                    id: 'noah',
                    lang: 'en',
                    page: 'reader.html',
                });
                return json({ ...PERSON_FACTS, name: 'Noah son of Lamech' });
            };
            routes.owa_find_verse = () => json({ total: 0 });
            seedCard(PASSAGE_ASK, PASSAGE_FACTS);
            await renderWindow();
            const list = await pressOnCard('Who and where is in it');
            expect(bodyOf(list)).toContain(
                'People and places in Genesis 8:1-3. Press one to ask about it.',
            );
            expect(actionLabels(list)).toEqual(['Noah', 'Ararat']);
            await press('Noah', list);
            await waitFor(() => cues().length === 5, 'the person’s card');
            // Named the way the record names him.
            expect(bodyOf(lastCue())).toContain(
                'holds on Noah son of Lamech (drawn from the King James',
            );
        });

        test('Related verses and Study files tell what the card gathered', async () => {
            seedCard(PASSAGE_ASK, PASSAGE_FACTS);
            await renderWindow();
            const related = await pressOnCard('Related verses');
            expect(bodyOf(related)).toContain(
                "The app's cross references lead from Genesis 8:1-3 to 2 " +
                    'other verses. Press one to read it with me.',
            );
            expect(bodyOf(related)).toContain('Verse 1: God remembers');
            expect(actionLabels(related)).toEqual([
                '2 Peter 2:5',
                'Matthew 24:37',
                'Previous chapter',
                'Next chapter',
                'More things to do',
            ]);
            // A reference pressed opens its own card -- here, one that says
            // it could not be read.
            await press('2 Peter 2:5', related);
            await waitFor(() => cues().length === 5, 'the reference card');
            expect(bodyOf(lastCue())).toContain(
                'I could not read 2 Peter 2:5 from the app just now.',
            );
            expect(toolCalls('owa_lookup_record')[0][1]).toEqual({
                kind: 'verse',
                ref: '2PE 2:5',
                bible: 'KJV',
                page: 'reader.html',
                related: true,
            });
            const files = await pressOnCard('Study files for this chapter');
            expect(bodyOf(files)).toContain(
                'The study files in Resources for the chapter of Genesis 8:1-3.',
            );
            expect(actionLabels(files)).toEqual([
                'Ask about GEN.8.pdf',
                'Previous chapter',
                'Next chapter',
                'More things to do',
            ]);
        });

        test('Study the words lists the verses, then a verse’s words', async () => {
            seedCard(PASSAGE_ASK, PASSAGE_FACTS);
            await renderWindow();
            const verses = await pressOnCard('Study the words');
            expect(bodyOf(verses)).toContain(
                'Which verse of Genesis 8:1-3 do you want to study? Press ' +
                    'one, and I will list its words.',
            );
            const labels = actionLabels(verses);
            expect(labels).toHaveLength(4);
            expect(labels[0]).toBe('1 · And God remembered Noah,…');
            expect(labels[3]).toBe('More things to do');
            await press(labels[1], verses);
            await waitFor(() => cues().length === 5, 'the words');
            const words = lastCue();
            expect(bodyOf(words)).toContain(
                'The fountains also of the deep were stopped.',
            );
            expect(actionLabels(words)).toEqual([
                'All words',
                'The',
                'fountains',
                'also',
                'of',
                'deep',
                'were',
                'stopped',
                'Another verse',
                'More things to do',
            ]);
            expect(mocks.callTool).not.toHaveBeenCalled();
        });

        test('a verse the card holds no words of is read by its key', async () => {
            const cutFacts = {
                ...PASSAGE_FACTS,
                passages: [
                    {
                        ...PASSAGE_FACTS.passages[0],
                        text: '(1): And God remembered Noah.',
                    },
                ],
            };
            routes.owa_lookup_record = (args) => {
                expect(args).toEqual({
                    kind: 'verse',
                    ref: 'GEN 8:3',
                    bible: 'KJV',
                    page: 'reader.html',
                });
                return json({
                    passages: [
                        {
                            key: 'GEN 8:3',
                            ref: 'Genesis 8:3',
                            title: 'Genesis 8:3',
                            text: '(3): And the waters returned.',
                        },
                    ],
                });
            };
            seedCard(PASSAGE_ASK, cutFacts);
            await renderWindow();
            const verses = await pressOnCard('Study the words');
            expect(actionLabels(verses).slice(0, 3)).toEqual([
                '1 · And God remembered Noah.',
                '2',
                '3',
            ]);
            await press('3', verses);
            await waitFor(() => cues().length === 5, 'the words');
            expect(bodyOf(lastCue())).toContain('And the waters returned.');
            expect(actionLabels(lastCue()).slice(0, 3)).toEqual([
                'All words',
                'And',
                'the',
            ]);
            // Read and failing, the verse has no words to offer.
            routes.owa_lookup_record = () => {
                throw new Error('No Bible');
            };
            await press('2', verses);
            await waitFor(() => cues().length === 7, 'the failure');
            expect(bodyOf(lastCue())).toContain(
                'I could not read the words of Genesis 8:2 just now.',
            );
            expect(actionLabels(lastCue())).toEqual([
                'Another verse',
                'More things to do',
            ]);
        });

        test('Search Google for a word opens the browser and keeps the lesson', async () => {
            seedCard(PASSAGE_ASK, PASSAGE_FACTS, [
                {
                    id: 2,
                    author: 'bot',
                    text: '“remembered” means called to mind.',
                    isLookupAnswer: true,
                    actions: [
                        {
                            label: 'Search Google for remembered',
                            toolName: LOOKUP_STEP_TOOL_NAME,
                            isData: true,
                            args: {
                                step: 'wordWeb',
                                ask: PASSAGE_ASK,
                                verse: 'GEN 8:1',
                                ref: 'Genesis 8:1',
                                word: 'remembered',
                            },
                        },
                    ],
                },
            ]);
            await renderWindow();
            await press('Search Google for remembered');
            await waitFor(() => cues().length === 4, 'the answer');
            expect(mocks.openExternalURL).toHaveBeenCalledWith(
                'https://www.google.com/search?q=%22remembered%22%20meaning',
            );
            expect(bodyOf(lastCue())).toContain(
                'Opened a Google search for remembered in your browser.',
            );
            expect(actionLabels(lastCue())).toEqual([
                'Next word: Noah',
                'Choose a word',
                'More things to do',
            ]);
        });

        test('Save to my Bibles list saves it, or says it could not', async () => {
            routes.owa_bible_item = (args) => {
                expect(args).toEqual({
                    action: 'add',
                    reference: 'Genesis 8:1-3',
                    version: 'KJV',
                });
                return '';
            };
            seedCard(PASSAGE_ASK, PASSAGE_FACTS);
            await renderWindow();
            expect(
                bodyOf(await pressOnCard('Save to my Bibles list')),
            ).toContain('Saved Genesis 8:1-3 to your Bibles list.');
            routes.owa_bible_item = () => {
                throw new Error('No list');
            };
            expect(
                bodyOf(await pressOnCard('Save to my Bibles list')),
            ).toContain('I could not save Genesis 8:1-3 just now.');
        });

        test('a card with no passage words has nothing to save or copy', async () => {
            const emptyFacts = { kind: 'verse', bible: 'KJV' };
            const clipboard = useClipboard(async () => {});
            seedSessions([
                genSession('one', [
                    {
                        ...genCard(1, PASSAGE_ASK, emptyFacts),
                        actions: genLookupActions(PASSAGE_ASK, PASSAGE_FACTS),
                    },
                ]),
            ]);
            await renderWindow();
            expect(
                bodyOf(await pressOnCard('Save to my Bibles list')),
            ).toContain('I could not save Genesis 8:1-3 just now.');
            expect(bodyOf(await pressOnCard('Copy the passage'))).toContain(
                'I could not copy it just now.',
            );
            expect(toolCalls('owa_bible_item')).toHaveLength(0);
            expect(clipboard.writeText).not.toHaveBeenCalled();
        });

        test('Copy the passage copies its words with its Bible', async () => {
            const clipboard = useClipboard(async () => {});
            seedCard(PASSAGE_ASK, PASSAGE_FACTS);
            await renderWindow();
            expect(bodyOf(await pressOnCard('Copy the passage'))).toContain(
                'Copied Genesis 8:1-3.',
            );
            expect(clipboard.writeText).toHaveBeenCalledWith(
                `(KJV) Genesis 8:1-3\n${PASSAGE_TEXT}`,
            );
            clipboard.writeText.mockRejectedValueOnce(new Error('busy'));
            expect(bodyOf(await pressOnCard('Copy the passage'))).toContain(
                'I could not copy it just now.',
            );
        });

        test('More things to do lists the card’s buttons again', async () => {
            seedCard(PASSAGE_ASK, PASSAGE_FACTS);
            await renderWindow();
            const more = await pressOnCard('Study the words');
            await press('More things to do', more);
            await waitFor(() => cues().length === 5, 'the list');
            expect(bodyOf(lastCue())).toContain(
                'What would you like to do with Genesis 8:1-3?',
            );
            expect(actionLabels(lastCue())).toEqual(actionLabels(cues()[0]));
        });

        test('an old button with no card in the tab reads its record afresh', async () => {
            routes.owa_lookup_record = (args) => {
                expect(args).toEqual({
                    kind: 'verse',
                    ref: 'GEN 8:1-3',
                    bible: 'KJV',
                    page: 'reader.html',
                    related: true,
                });
                return json(PASSAGE_FACTS);
            };
            seedSessions([
                genSession('one', [
                    {
                        id: 1,
                        author: 'bot',
                        text: 'Earlier, about Genesis 8.',
                        actions: [
                            {
                                label: 'More things to do',
                                toolName: LOOKUP_STEP_TOOL_NAME,
                                args: { step: 'more', ask: PASSAGE_ASK },
                            },
                        ],
                    },
                ]),
            ]);
            await renderWindow();
            await press('More things to do');
            await waitFor(() => cues().length === 3, 'the list');
            expect(actionLabels(lastCue())[0]).toBe('Related verses');
        });

        test('Stop while a step reads drops what it read', async () => {
            const read = defer();
            routes.owa_lookup_record = () => read.promise;
            seedCard(PASSAGE_ASK, PASSAGE_FACTS);
            await renderWindow();
            await press('Next chapter', cues()[0]);
            await click(stopButton());
            expect(bodyOf(lastCue())).toContain(STOPPED_TEXT);
            const count = cues().length;
            await act(async () => {
                read.resolve(json(PASSAGE_FACTS));
            });
            await settle();
            expect(cues()).toHaveLength(count);
        });
    });

    describe('Open another passage', () => {
        async function openAnother() {
            seedCard(PASSAGE_ASK, PASSAGE_FACTS);
            await renderWindow();
            const asked = await pressOnCard('Open another passage');
            expect(bodyOf(asked)).toContain(ASK_PASSAGE_TEXT);
        }

        const JOHN_PASSAGE = {
            kind: 'verse',
            bible: 'KJV',
            passages: [
                {
                    key: 'JHN 3:16',
                    ref: 'John 3:16',
                    title: 'John 3:16',
                    text: '(16): For God so loved the world.',
                },
            ],
        };

        function routeJohnOnly() {
            routes.owa_lookup_record = (args) => {
                return args.ref === 'John 3:16'
                    ? json(JOHN_PASSAGE)
                    : json({ kind: 'verse', passages: [] });
            };
        }

        test('a typed passage is read and opened as a card', async () => {
            routeJohnOnly();
            await openAnother();
            await send('John 3:16');
            await waitFor(() => cues().length === 5, 'the card');
            expect(toolCalls('owa_lookup_record')[0][1]).toEqual({
                kind: 'verse',
                ref: 'John 3:16',
                bible: 'KJV',
                page: 'reader.html',
                related: true,
            });
            expect(bodyOf(lastCue())).toContain(
                'I have read John 3:16 in the Bible KJV.',
            );
            expect(inputBox().value).toBe('');
            expect(mocks.askLlmBot).not.toHaveBeenCalled();
        });

        test('words that are not a passage are put into one by the assistant', async () => {
            routeJohnOnly();
            mocks.askLlmBot.mockResolvedValueOnce({
                text: json({ kind: 'value', value: 'John 3:16' }),
            });
            await openAnother();
            await send('the one about God loving the world');
            await waitFor(() => cues().length === 5, 'the card');
            const prompt = String(mocks.askLlmBot.mock.calls[0][0]);
            expect(JSON.parse(prompt.split('\n').at(-1)!)).toMatchObject({
                question: 'Which passage would you like to read next?',
                valueKind: 'passage',
                previous: 'Genesis 8:1-3',
                typed: 'the one about God loving the world',
            });
            expect(bodyOf(lastCue())).toContain(
                'I have read John 3:16 in the Bible KJV.',
            );
        });

        test('a help reply, a failed read and a failed assistant ask again', async () => {
            routeJohnOnly();
            mocks.askLlmBot
                .mockResolvedValueOnce({
                    text: json({ kind: 'help', reply: 'Which book is it in?' }),
                })
                .mockResolvedValueOnce({
                    text: json({ kind: 'value', value: 'Psalm 23' }),
                })
                .mockRejectedValueOnce(new Error('The free service is busy'));
            await openAnother();
            await send('the famous one');
            await waitFor(() => cues().length === 5, 'the help reply');
            expect(bodyOf(lastCue())).toContain('Which book is it in?');
            // Still waiting for a passage: the next line is read as one.
            await send('the shepherd psalm');
            await waitFor(() => cues().length === 7, 'the failed read');
            expect(bodyOf(lastCue())).toContain(
                'I could not read “the shepherd psalm”. Type it like John ' +
                    '3:16 or Psalm 23.',
            );
            await send('something else');
            await waitFor(() => cues().length === 9, 'the failed assistant');
            expect(bodyOf(lastCue())).toContain(
                'I could not answer that: The free service is busy',
            );
            await send('John 3:16');
            await waitFor(() => cues().length === 11, 'the card');
            expect(bodyOf(lastCue())).toContain('I have read John 3:16');
        });

        test('words the assistant calls another task go on to the assistant', async () => {
            routeJohnOnly();
            mocks.askLlmBot
                .mockResolvedValueOnce({ text: json({ kind: 'unrelated' }) })
                .mockResolvedValueOnce({ text: 'The Mini Screen shows it.' });
            await openAnother();
            await send('what is on the projector now');
            await waitFor(() => cues().length === 5, 'the ordinary answer');
            expect(
                cues().filter((cue) => cue.classList.contains('cue-you')),
            ).toHaveLength(2);
            expect(mocks.askLlmBot.mock.calls[1][6]?.lookup).toBeUndefined();
            expect(bodyOf(lastCue())).toContain('The Mini Screen shows it.');
        });

        test('Stop while the passage is read keeps waiting for one', async () => {
            const read = defer();
            routes.owa_lookup_record = () => read.promise;
            await openAnother();
            await send('John 3:16');
            await click(stopButton());
            expect(bodyOf(lastCue())).toContain(ASK_PASSAGE_TEXT);
            expect(noteOf(lastCue())).toBe(STOPPED_TEXT);
            await act(async () => {
                read.resolve(json(JOHN_PASSAGE));
            });
            await settle();
            expect(cues()).toHaveLength(5);
            routeJohnOnly();
            await send('John 3:16');
            await waitFor(() => cues().length === 7, 'the card');
            expect(bodyOf(lastCue())).toContain('I have read John 3:16');
        });
    });

    describe('a person and a place', () => {
        test('Its verses and Family and places are buttons to press', async () => {
            seedCard(PERSON_ASK, PERSON_FACTS);
            await renderWindow();
            const verses = await pressOnCard('Its verses');
            expect(bodyOf(verses)).toContain(
                'Verses about Noah. Press one to read it with me. The names ' +
                    'lookup lists 47 verses; these are the first 2.',
            );
            expect(actionLabels(verses)).toEqual([
                'Genesis 6:8',
                'Genesis 6:9',
            ]);
            const family = await pressOnCard('Family and places');
            expect(bodyOf(family)).toContain(
                'The family and places of Noah. Press one to ask about it.',
            );
            expect(actionLabels(family)).toEqual([
                'Lamech',
                'Shem',
                'Ham',
                'Japheth',
            ]);
        });

        test('Family line to Jesus reads the genealogy that names him', async () => {
            const lukeText =
                'which was the son of Sem, which was the son of Noe, which ' +
                'was the son of Lamech';
            routes.owa_lookup_record = (args) => {
                expect(args).toMatchObject({
                    kind: 'verse',
                    bible: 'KJV',
                    page: 'reader.html',
                });
                return json({
                    bible: 'KJV',
                    passages: [
                        args.ref === 'MAT 1:1-17'
                            ? {
                                  key: 'MAT 1:1-17',
                                  ref: 'Matthew 1:1-17',
                                  text: 'Abraham begat Isaac',
                              }
                            : {
                                  key: 'LUK 3:23-38',
                                  ref: 'Luke 3:23-38',
                                  text: lukeText,
                              },
                    ],
                });
            };
            seedCard(PERSON_ASK, PERSON_FACTS);
            await renderWindow();
            const line = await pressOnCard('Family line to Jesus');
            expect(
                toolCalls('owa_lookup_record').map((call) => call[1].ref),
            ).toEqual(['MAT 1:1-17', 'LUK 3:23-38']);
            expect(bodyOf(line)).toContain(
                'Here is the family line in Luke 3:23-38, from the Bible KJV, ' +
                    'in the order it gives it:',
            );
            expect(bodyOf(line)).toContain(lukeText);
            expect(actionLabels(line)).toEqual([
                'Open in bible lookup',
                'Open another passage',
            ]);
        });

        test('a genealogy that does not name him, and none read at all', async () => {
            routes.owa_lookup_record = () => {
                return json({
                    passages: [
                        { key: 'MAT 1:1-17', text: 'Abraham begat Isaac' },
                    ],
                });
            };
            seedCard(PERSON_ASK, PERSON_FACTS);
            await renderWindow();
            expect(bodyOf(await pressOnCard('Family line to Jesus'))).toContain(
                'Neither family line the Bible gives — Matthew 1 and Luke 3 — ' +
                    'names Noah.',
            );
            routes.owa_lookup_record = () => {
                throw new Error('No Bible');
            };
            expect(bodyOf(await pressOnCard('Family line to Jesus'))).toContain(
                'I could not do that just now.',
            );
        });

        test('Show it on a map opens the place in the browser', async () => {
            seedCard(PLACE_ASK, PLACE_FACTS);
            await renderWindow();
            expect(bodyOf(await pressOnCard('Show it on a map'))).toContain(
                'Opened Ararat on a map in your browser.',
            );
            expect(mocks.openExternalURL).toHaveBeenCalledWith(
                'https://www.google.com/maps/search/?api=1&query=39.7%2C44.3',
            );
            mocks.openExternalURL.mockImplementationOnce(() => {
                throw new Error('No browser');
            });
            expect(bodyOf(await pressOnCard('Show it on a map'))).toContain(
                'I could not do that just now.',
            );
        });

        test('an old map button on a place with no point says so', async () => {
            const { coordinates: _point, ...region } = PLACE_FACTS;
            seedSessions([
                genSession('one', [
                    {
                        ...genCard(1, PLACE_ASK, region),
                        actions: genLookupActions(PLACE_ASK, PLACE_FACTS),
                    },
                ]),
            ]);
            await renderWindow();
            expect(bodyOf(await pressOnCard('Show it on a map'))).toContain(
                'The names lookup has no point on a map for Ararat.',
            );
            expect(mocks.openExternalURL).not.toHaveBeenCalled();
        });
    });

    describe('a word study asked of the assistant', () => {
        test('a pressed word is taught in the passage’s conversation', async () => {
            mocks.askLlmBot.mockResolvedValue({
                text: '“fountains” are springs of water.',
            });
            seedCard(PASSAGE_ASK, PASSAGE_FACTS, [
                {
                    id: 2,
                    author: 'bot',
                    text: 'Press a word to learn it.',
                    isLookupAnswer: true,
                    actions: [
                        {
                            label: 'fountains',
                            toolName: LOOKUP_STEP_TOOL_NAME,
                            isData: true,
                            args: {
                                step: 'word',
                                ask: PASSAGE_ASK,
                                verse: 'GEN 8:2',
                                ref: 'Genesis 8:2',
                                word: 'fountains',
                            },
                        },
                    ],
                },
            ]);
            await renderWindow();
            await press('fountains');
            await waitFor(() => cues().length === 4, 'the lesson');
            expect(bodyOf(cues()[2])).toContain('Teach me the word fountains');
            const [question, , , , , , extra] = mocks.askLlmBot.mock.calls[0];
            expect(question).toContain(
                'Teach me the word “fountains” in Genesis 8:2.',
            );
            expect(extra?.lookup).toMatchObject({ isStudy: true });
            expect(bodyOf(lastCue())).toContain(
                '“fountains” are springs of water.',
            );
            // The lesson's buttons, then the conversation's own way on.
            expect(actionLabels(lastCue())).toEqual([
                'Next word: also',
                'Choose a word',
                'Search Google for fountains',
                'More things to do',
            ]);
        });

        test('a typed ask for a verse’s every word is taught at once', async () => {
            mocks.askLlmBot.mockResolvedValue({
                text: 'Each word of verse 2, one by one.',
            });
            seedCard(PASSAGE_ASK, PASSAGE_FACTS);
            await renderWindow();
            await send('explain each word of verse 2');
            await waitFor(() => cues().length === 3, 'the lesson');
            expect(bodyOf(cues()[1])).toContain('explain each word of verse 2');
            expect(String(mocks.askLlmBot.mock.calls[0][0])).toContain(
                'Teach me every word of Genesis 8:2, one by one.',
            );
            expect(actionLabels(lastCue())).toEqual([
                'Choose a word',
                'Next verse',
                'Another verse',
                'More things to do',
            ]);
            expect(inputBox().value).toBe('');
        });

        test('a word with no passage to read says so, with no model', async () => {
            seedSessions([
                genSession('one', [
                    {
                        id: 1,
                        author: 'bot',
                        text: 'Press a word to learn it.',
                        actions: [
                            {
                                label: 'fountains',
                                toolName: LOOKUP_STEP_TOOL_NAME,
                                isData: true,
                                args: {
                                    step: 'word',
                                    ask: PASSAGE_ASK,
                                    verse: 'GEN 8:2',
                                    word: 'fountains',
                                },
                            },
                        ],
                    },
                ]),
            ]);
            await renderWindow();
            await press('fountains');
            await waitFor(() => cues().length === 3, 'the failure');
            expect(bodyOf(cues()[1])).toContain('fountains');
            expect(bodyOf(lastCue())).toContain(
                'I could not read the words of Genesis 8:1-3 just now.',
            );
            expect(mocks.askLlmBot).not.toHaveBeenCalled();
        });
    });

    describe('a line typed under a card', () => {
        test('“study the words” is the card’s own button', async () => {
            seedCard(PASSAGE_ASK, PASSAGE_FACTS);
            await renderWindow();
            await send('study the words');
            await waitFor(() => cues().length === 3, 'the verse list');
            expect(bodyOf(lastCue())).toContain(
                'Which verse of Genesis 8:1-3 do you want to study?',
            );
            expect(mocks.askLlmBot).not.toHaveBeenCalled();
        });

        test('the passage in its own language is quoted from the record', async () => {
            seedCard(PASSAGE_ASK, PASSAGE_FACTS);
            await renderWindow();
            await send('show this passage in English');
            expect(bodyOf(lastCue())).toContain(
                'Here is Genesis 8:1-3 from the Bible it was opened in.',
            );
            expect(bodyOf(lastCue())).toContain('(KJV) Genesis 8:1-3');
            expect(actionLabels(lastCue())).toEqual([
                'Read it in another Bible',
            ]);
            expect(mocks.askLlmBot).not.toHaveBeenCalled();
        });

        test('“how do I save this” names the card’s button', async () => {
            seedCard(PASSAGE_ASK, PASSAGE_FACTS);
            await renderWindow();
            await send('how do I save this?');
            expect(bodyOf(lastCue())).toContain(
                'Press Save to my Bibles list under the passage above.',
            );
            expect(actionLabels(lastCue())).toEqual(['Save to my Bibles list']);
            expect(toolCalls('owa_bible_item')).toHaveLength(0);
        });

        test('“in another version” lists the other Bibles', async () => {
            routes.owa_find_verse = () => json(BIBLE_LIST);
            seedCard(PASSAGE_ASK, PASSAGE_FACTS);
            await renderWindow();
            await send('read it in another version');
            await waitFor(() => cues().length === 3, 'the Bible list');
            expect(actionLabels(lastCue())).toEqual([
                'SMSV — Sample Standard Version',
            ]);
        });

        test('a map ask under a place offers its button', async () => {
            seedCard(PLACE_ASK, PLACE_FACTS);
            await renderWindow();
            await send('where is it on a map');
            expect(bodyOf(lastCue())).toContain(
                'Press Show it on a map to open Ararat on a map in your browser.',
            );
            expect(actionLabels(lastCue())).toEqual(['Show it on a map']);
            expect(mocks.openExternalURL).not.toHaveBeenCalled();
        });

        test('a family-line ask under a person runs the genealogy', async () => {
            routes.owa_lookup_record = () => json({ passages: [] });
            seedCard(PERSON_ASK, PERSON_FACTS);
            await renderWindow();
            await send('show me the genealogy of Noah');
            await waitFor(() => cues().length === 3, 'the answer');
            expect(toolCalls('owa_lookup_record')).toHaveLength(2);
            expect(bodyOf(lastCue())).toContain(
                'I could not do that just now.',
            );
        });

        test('a how-many ask under a person is counted by the window', async () => {
            seedCard(PERSON_ASK, PERSON_FACTS);
            await renderWindow();
            await send('how many children did he have?');
            expect(bodyOf(lastCue())).toContain(
                'The record names 3 children of Noah: Shem, Ham, Japheth.',
            );
            expect(mocks.askLlmBot).not.toHaveBeenCalled();
        });
    });

    describe('before any provider is asked', () => {
        test('a command stopped while it reads leaves nothing behind', async () => {
            const screens = defer();
            routes.owa_list_screens = () => screens.promise;
            seedSessions([genSession('one', [])]);
            await renderWindow();
            await send('/screen');
            await click(stopButton());
            expect(bodyOf(lastCue())).toContain(STOPPED_TEXT);
            await act(async () => {
                screens.resolve(json({ screens: [] }));
            });
            await settle();
            expect(cues()).toHaveLength(2);
        });

        test('a verse asked for by what it says is searched in the lookup’s Bible', async () => {
            routes.owa_find_verse = (args) => {
                return args.words === undefined
                    ? json(BIBLE_LIST)
                    : json({ total: 0, verses: [] });
            };
            mocks.askLlmBot.mockResolvedValue({
                text: 'Matthew 5:44 says it.',
            });
            seedSessions([genSession('one', [])]);
            await renderWindow();
            await send('which verse says love your enemies');
            await waitFor(() => cues().length === 2, 'the answer');
            expect(mocks.askLlmBot.mock.calls[0][6]?.verseFind).toMatchObject({
                bible: 'KJV',
                words: 'love your enemies',
            });
        });

        test('the finder’s own sentence with words and no Bible is searched too', async () => {
            routes.owa_find_verse = (args) => {
                return args.words === undefined
                    ? json(BIBLE_LIST)
                    : json({ total: 0, verses: [] });
            };
            mocks.askLlmBot.mockResolvedValue({ text: 'Matthew 5:44.' });
            seedSessions([genSession('one', [])]);
            await renderWindow();
            await send('Help me find a Bible verse: love your enemies');
            await waitFor(() => cues().length === 2, 'the answer');
            expect(mocks.askLlmBot.mock.calls[0][6]?.verseFind).toMatchObject({
                bible: 'KJV',
                words: 'love your enemies',
            });
        });

        test('with no Bible to search, the question is asked as it stands', async () => {
            mocks.askLlmBot.mockResolvedValue({
                text: 'Install a Bible first.',
            });
            seedSessions([genSession('one', [])]);
            await renderWindow();
            await send('which verse says love your enemies');
            await waitFor(() => cues().length === 2, 'the answer');
            expect(toolCalls('owa_find_verse')).toHaveLength(1);
            expect(mocks.askLlmBot.mock.calls[0][6]?.verseFind).toBeUndefined();
        });

        test('a Reader question about a verse goes with the Reader’s tools', async () => {
            routes.owa_find_verse = () => json(BIBLE_LIST);
            mocks.askLlmBot.mockResolvedValue({
                text: 'For God so loved the world.',
            });
            seedSessions([genSession('one', [], { focus: 'reader' })]);
            await renderWindow();
            await send('what does John 3:16 mean');
            await waitFor(() => cues().length === 2, 'the answer');
            expect(mocks.askLlmBot.mock.calls[0][6]?.bibleReader).toBeDefined();
        });
    });
});
