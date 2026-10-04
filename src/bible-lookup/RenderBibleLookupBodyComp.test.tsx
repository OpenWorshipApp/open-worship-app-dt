// @vitest-environment jsdom

import { act, createContext, use, useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    const typedTexts: string[] = [];
    const resultMap = new Map<string, any>();
    return {
        typedTexts,
        resultMap,
        keyListeners: new Set<{
            key: string;
            listener: (event: any) => void;
        }>(),
        // What the controller is asked: the text the box holds.
        getEditingResultMock: vi.fn(async (inputText: string) => {
            return resultMap.get(inputText);
        }),
        // Luke's chapter list, as `genChapterMatches` and the hook build it.
        lukeChapterList: [
            { chapter: 0, chapterLocaleString: 'Introduction', isIntro: false },
            ...Array.from({ length: 24 }, (_, i) => {
                return { chapter: i + 1, chapterLocaleString: `${i + 1}` };
            }),
        ],
    };
});

vi.mock('../event/KeyboardEventListener', () => ({
    allArrows: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'],
    // Every registered key, the way the app's listener holds them: the latest
    // render's listener, for as long as its component is mounted.
    useKeyboardRegistering: (
        eventMappers: { key: string }[],
        listener: (event: any) => void,
    ) => {
        const listenerRef = useRef(listener);
        listenerRef.current = listener;
        useEffect(() => {
            const entries = eventMappers.map((eventMapper) => {
                return {
                    key: eventMapper.key,
                    listener: (event: any) => {
                        listenerRef.current(event);
                    },
                };
            });
            for (const entry of entries) {
                h.keyListeners.add(entry);
            }
            return () => {
                for (const entry of entries) {
                    h.keyListeners.delete(entry);
                }
            };
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);
    },
}));
vi.mock('../helper/appHooks', () => ({
    useAppCurrentRef: (value: unknown) => {
        const ref = useRef(value);
        ref.current = value;
        return ref;
    },
    useAppStateAsync: (genValue: () => unknown, deps: unknown[] = []) => {
        const [value, setValue] = useState<unknown>(undefined);
        useEffect(() => {
            let isAlive = true;
            Promise.resolve(genValue()).then((newValue) => {
                if (isAlive) {
                    setValue(newValue);
                }
            });
            return () => {
                isAlive = false;
            };
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, deps);
        return [value, setValue];
    },
}));
vi.mock('../bible-reader/LookupBibleItemController', () => {
    const EditingResultContext = createContext(null);
    return {
        EditingResultContext,
        useEditingResult: () => use(EditingResultContext),
        useLookupBibleItemControllerContext: () => ({
            getEditingResult: h.getEditingResultMock,
            set inputText(inputText: string) {
                h.typedTexts.push(inputText);
            },
        }),
    };
});
vi.mock('../bible-list/bibleHelpers', () => ({
    useBibleKeyContext: () => 'KJV',
}));
vi.mock('../helper/bible-helpers/bibleLogicHelpers1', () => ({
    // The list on screen is whatever the hook last built; Luke's whole book.
    useChapterMatch: () => h.lukeChapterList,
    genChapterMatches: vi.fn(
        async (
            _bibleKey: string,
            _bookKey: string,
            guessing: string | null,
        ) => {
            const list = h.lukeChapterList.slice(1);
            return guessing === null
                ? list
                : list.filter(({ chapterLocaleString }) => {
                      return chapterLocaleString === guessing;
                  });
        },
    ),
    genBookMatches: vi.fn(async () => [
        {
            bibleKey: 'KJV',
            bookKey: 'GEN',
            book: 'Genesis',
            modelBook: 'Genesis',
            isAvailable: true,
        },
    ]),
}));
vi.mock('../helper/bible-helpers/bibleLogicHelpers2', () => ({
    toInputText: async (
        _bibleKey: string,
        book?: string | null,
        chapter?: number | null,
    ) => {
        return chapter ? `${book} ${chapter}` : `${book} `;
    },
    toTrailingReference: () => null,
}));
vi.mock('../helper/bible-helpers/bibleInfoHelpers', () => ({
    keyToBook: async (_bibleKey: string, bookKey: string) => {
        return ({ GEN: 'Genesis', LUK: 'Luke' } as any)[bookKey] ?? null;
    },
    checkIsBookAvailable: async () => true,
    checkIsOldTestament: () => false,
    checkIsApocrypha: () => false,
    getChapterData: async () => null,
}));
vi.mock('../helper/bible-helpers/bibleModelHelpers', () => ({
    kjvBibleModelInfo: { bookKeysSubtype: [] },
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: () => undefined,
}));
vi.mock('../helper/sanitizeHelpers', () => ({
    sanitizeHtml: (html: string) => html,
}));
vi.mock('../helper/helpers', () => ({ bringDomToBottomView: vi.fn() }));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../setting/settingHelpers', () => ({ openBibleSetting: vi.fn() }));
vi.mock('./BibleKeySelectionComp', () => ({
    BibleKeySelectionMiniComp: () => null,
}));
vi.mock('./RenderVerseOptionsComp', () => ({ default: () => null }));

import RenderBibleLookupBodyComp from './RenderBibleLookupBodyComp';
import { EditingResultContext } from '../bible-reader/LookupBibleItemController';
import {
    BIBLE_LOOKUP_INPUT_ID,
    INPUT_TEXT_CLASS,
    RENDER_FOUND_CLASS,
} from './selectionHelpers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function genEditingResult(
    inputText: string,
    result: {
        bookKey?: string | null;
        guessingBook?: string | null;
        chapter?: number | null;
        guessingChapter?: string | null;
        bibleItem?: unknown;
    },
) {
    return {
        result: {
            bookKey: null,
            guessingBook: null,
            chapter: null,
            guessingChapter: null,
            bibleItem: null,
            ...result,
        },
        bibleKey: 'KJV',
        inputText,
        oldInputText: inputText,
        time: 0,
    };
}

// The list up before a fast burst of typing: Luke, picking a chapter.
const LUKE_PICKING_CHAPTER = genEditingResult('Luke', { bookKey: 'LUK' });
const GENESIS_PASSAGE = genEditingResult('Genesis 1:1-31', {
    bookKey: 'GEN',
    chapter: 1,
    bibleItem: { title: 'Genesis 1:1-31' },
});

let host: HTMLDivElement;
let root: Root;
let input: HTMLInputElement;

beforeEach(() => {
    h.typedTexts.length = 0;
    h.resultMap.clear();
    h.keyListeners.clear();
    h.getEditingResultMock.mockImplementation(async (inputText: string) => {
        return h.resultMap.get(inputText);
    });
    // The reference box, as `InputHandlerComp` draws it.
    input = document.createElement('input');
    input.id = BIBLE_LOOKUP_INPUT_ID;
    input.className = INPUT_TEXT_CLASS;
    document.body.appendChild(input);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
    input.remove();
});

async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

// The lookup body over the result ON SCREEN, with the box already holding
// `boxText` -- typed faster than it was looked up.
async function renderBody(onScreenResult: unknown, boxText: string) {
    await act(async () => {
        root.render(
            <EditingResultContext value={onScreenResult as any}>
                <RenderBibleLookupBodyComp />
            </EditingResultContext>,
        );
    });
    await flush();
    input.value = boxText;
    input.focus();
}

async function pressEnter() {
    await act(async () => {
        for (const { key, listener } of [...h.keyListeners]) {
            if (key === 'Enter') {
                listener({ key: 'Enter' });
            }
        }
    });
    await flush();
    await flush();
}

describe('RenderBibleLookupBodyComp Enter in the reference box', () => {
    // Reported: from Luke's chapter list, a fast `Genesis 1:1-31` + Enter
    // landed on `Luke 1:` -- Enter pressed the chapter list still up.
    test('a passage typed faster than it was looked up is left as typed', async () => {
        h.resultMap.set('Genesis 1:1-31', GENESIS_PASSAGE);
        await renderBody(LUKE_PICKING_CHAPTER, 'Genesis 1:1-31');

        await pressEnter();

        expect(h.typedTexts).toEqual([]);
        expect(h.getEditingResultMock).toHaveBeenCalledWith('Genesis 1:1-31');
    });

    // Reported: `Luke 13:1-35` + Enter from the `Luke 13` list left the box
    // at `Luke 13:`. The same race, one list along: Enter picks the chapter
    // the BOX names, not the first of the list still drawn.
    test('a chapter typed faster than it was looked up is the one picked', async () => {
        h.resultMap.set(
            'Luke 13',
            genEditingResult('Luke 13', {
                bookKey: 'LUK',
                guessingChapter: '13',
            }),
        );
        await renderBody(LUKE_PICKING_CHAPTER, 'Luke 13');

        await pressEnter();

        expect(h.typedTexts).toEqual(['Luke 13:']);
    });

    // No list is up at all while the last passage is still shown, so Enter
    // used to do nothing; the book the box names is picked now.
    test('a book typed while a passage is still shown is picked', async () => {
        h.resultMap.set(
            'Gen',
            genEditingResult('Gen', { guessingBook: 'Gen' }),
        );
        await renderBody(GENESIS_PASSAGE, 'Gen');

        await pressEnter();

        expect(h.typedTexts).toEqual(['Genesis ']);
    });

    test('a press whose text was typed over while it resolved does nothing', async () => {
        h.resultMap.set(
            'Gen',
            genEditingResult('Gen', { guessingBook: 'Gen' }),
        );
        h.getEditingResultMock.mockImplementation(async (inputText: string) => {
            input.value = 'Gene';
            return h.resultMap.get(inputText);
        });
        await renderBody(LUKE_PICKING_CHAPTER, 'Gen');

        await pressEnter();

        expect(h.typedTexts).toEqual([]);
    });

    // A press made in the list is on what the user is looking at, and it
    // still takes the highlighted option -- once.
    test('Enter in the list takes its highlighted option', async () => {
        await renderBody(LUKE_PICKING_CHAPTER, 'Luke');
        host.querySelector<HTMLElement>(`.${RENDER_FOUND_CLASS}`)!.focus();

        await pressEnter();

        expect(h.typedTexts).toEqual(['Luke 1:']);
    });
});
