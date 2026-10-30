// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

type MenuItemType = { menuElement: string; onSelect: () => void };

const h = vi.hoisted(() => ({
    // What the person picks in each menu, in order; `null` dismisses it.
    answers: [] as (string | null)[],
    // The header row of every menu opened, in order.
    menus: [] as string[],
    titleParts: null as null | Record<string, string | null>,
}));

vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppStateAsync: <T,>(load: () => Promise<T>, deps: unknown[]) => {
            const [value, setValue] = react.useState<T | undefined>();
            react.useEffect(() => {
                void load().then(setValue);
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
            return [value, setValue] as const;
        },
    };
});
vi.mock('../helper/bible-helpers/bibleInfoHelpers', () => ({
    getBibleInfo: async () => ({
        keyBookMap: { GEN: 'Genesis', EXO: 'Exodus' },
        booksAvailable: ['GEN', 'EXO'],
    }),
    getVerses: async () => ({}),
}));
vi.mock('../helper/bible-helpers/bibleLogicHelpers1', () => ({
    getModelChapterCount: () => 3,
    getModelKeyBookMap: () => ({ GEN: 'Genesis', EXO: 'Exodus' }),
}));
vi.mock('../helper/bible-helpers/bibleLogicHelpers2', () => ({
    getVersesCount: async () => 5,
    toLocaleNumBible: async (_bibleKey: string, n: number) => `${n}`,
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: (_event: unknown, items: MenuItemType[]) => {
        h.menus.push(items[0].menuElement);
        let resolveDone: () => void = () => {};
        const promiseDone = new Promise<void>((resolve) => {
            resolveDone = resolve;
        });
        const answer = h.answers.shift() ?? null;
        queueMicrotask(() => {
            if (answer === null) {
                resolveDone();
                return;
            }
            const item = items.slice(1).find((item1) => {
                return item1.menuElement === answer;
            });
            if (item === undefined) {
                throw new Error(
                    `no "${answer}" in the ${items[0].menuElement} menu`,
                );
            }
            item.onSelect();
        });
        return { promiseDone, closeMenu: () => {} };
    },
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    getBibleFontFamily: async () => 'KJV Font',
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../bible-list/bibleRenderHelpers', () => ({
    bibleRenderHelper: { toTitleParts: async () => h.titleParts },
}));

import BibleViewTitleEditorComp from './BibleViewTitleEditorComp';

const ONE_CHAPTER = { bookKey: 'GEN', chapter: 1, verseStart: 2, verseEnd: 4 };
const CROSS_CHAPTER = { ...ONE_CHAPTER, chapterEnd: 3 };

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.answers = [];
    h.menus = [];
    h.titleParts = null;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
    vi.unstubAllGlobals();
});

// Every step of a picker flow is a promise (the menu answers on a
// microtask), so draining microtasks runs a whole flow without a timer.
async function flush() {
    await act(async () => {
        for (let i = 0; i < 200; i++) {
            await Promise.resolve();
        }
    });
}

async function render({
    target = ONE_CHAPTER as object,
    isEditable = true,
    isOneVerse = false,
    waitUntilGotVerseStart = false,
    withCtrl = false,
} = {}) {
    const onTargetChange = vi.fn();
    const bibleItem = {
        bibleKey: 'KJV',
        target,
        toTitle: async () => 'Genesis 1:2-4',
    } as any;
    await act(async () => {
        root.render(
            <BibleViewTitleEditorComp
                bibleItem={bibleItem}
                onTargetChange={isEditable ? onTargetChange : undefined}
                isOneVerse={isOneVerse}
                waitUntilGotVerseStart={waitUntilGotVerseStart}
                withCtrl={withCtrl}
            />,
        );
    });
    await flush();
    return onTargetChange;
}

function getPart(text: string) {
    const part = Array.from(
        host.querySelectorAll<HTMLSpanElement>('span.app-caught-hover-pointer'),
    ).find((span) => span.textContent === text);
    if (part === undefined) {
        throw new Error(`no title part "${text}" in ${host.textContent}`);
    }
    return part;
}

async function openMenu(text: string, init: MouseEventInit = {}) {
    await act(async () => {
        getPart(text).dispatchEvent(
            new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                ...init,
            }),
        );
    });
    await flush();
}

describe('a title with nothing to change', () => {
    test('is only the title, once it is read', async () => {
        await render({ isEditable: false });
        expect(host.innerHTML).toBe('<span>Genesis 1:2-4</span>');
    });
});

describe('the parts read as the bible writes them', () => {
    test('once the bible has named them', async () => {
        h.titleParts = {
            book: 'លោកុប្បត្តិ',
            chapter: '១',
            verseStart: '២',
            verseEnd: '៤',
            chapterEnd: null,
        };
        await render();
        expect(host.textContent).toBe('លោកុប្បត្តិ ១:២-៤');
    });
});

describe('dismissing a picker changes nothing further', () => {
    test('the book picker', async () => {
        h.answers = [null];
        const onTargetChange = await render();
        await openMenu('GEN');
        expect(h.menus).toEqual(['Book']);
        expect(onTargetChange).not.toHaveBeenCalled();
    });

    test('the chapter picker, after a new book', async () => {
        h.answers = ['Exodus', null];
        const onTargetChange = await render();
        await openMenu('GEN');
        expect(h.menus).toEqual(['Book', 'Chapter']);
        // The book alone already moved the passage to its first chapter.
        expect(onTargetChange.mock.calls).toEqual([
            [{ bookKey: 'EXO', chapter: 1, verseStart: 1, verseEnd: 5 }],
        ]);
    });

    test('the start verse picker, after a new chapter', async () => {
        h.answers = ['Exodus', '2', null];
        const onTargetChange = await render();
        await openMenu('GEN');
        expect(h.menus).toEqual(['Book', 'Chapter', 'Verse Start']);
        expect(onTargetChange.mock.calls.at(-1)).toEqual([
            { bookKey: 'EXO', chapter: 2, verseStart: 1, verseEnd: 5 },
        ]);
        expect(onTargetChange).toHaveBeenCalledTimes(2);
    });

    test('the end verse picker leaves the start verse picked', async () => {
        h.answers = ['3', null];
        const onTargetChange = await render();
        await openMenu('2');
        expect(h.menus).toEqual(['Verse Start', 'Verse End']);
        expect(onTargetChange.mock.calls).toEqual([
            [{ bookKey: 'GEN', chapter: 1, verseStart: 3, verseEnd: 5 }],
        ]);
    });
});

describe('starting from a later part', () => {
    test('the chapter part keeps the book', async () => {
        h.answers = ['3', '1', '2'];
        const onTargetChange = await render();
        await openMenu('1');
        expect(h.menus).toEqual(['Chapter', 'Verse Start', 'Verse End']);
        expect(onTargetChange.mock.calls.at(-1)).toEqual([
            { bookKey: 'GEN', chapter: 3, verseStart: 1, verseEnd: 2 },
        ]);
    });

    test('a one-verse title stops at its verse', async () => {
        h.answers = ['5'];
        const onTargetChange = await render({
            target: { bookKey: 'GEN', chapter: 1, verseStart: 2, verseEnd: 2 },
            isOneVerse: true,
        });
        // Book, chapter and verse: no end verse part at all.
        expect(host.textContent).toBe('GEN 1:2');
        await openMenu('2');
        expect(h.menus).toEqual(['Verse Start']);
        expect(onTargetChange.mock.calls).toEqual([
            [{ bookKey: 'GEN', chapter: 1, verseStart: 5, verseEnd: 5 }],
        ]);
    });

    test('waiting for the start verse writes nothing before it', async () => {
        h.answers = ['Exodus', '2', '3', '4'];
        const onTargetChange = await render({ waitUntilGotVerseStart: true });
        await openMenu('GEN');
        expect(onTargetChange.mock.calls).toEqual([
            [{ bookKey: 'EXO', chapter: 2, verseStart: 3, verseEnd: 5 }],
            [{ bookKey: 'EXO', chapter: 2, verseStart: 3, verseEnd: 4 }],
        ]);
    });
});

describe('a passage crossing chapters', () => {
    test('its start verse picker, dismissed, keeps the passage', async () => {
        h.answers = [null];
        const onTargetChange = await render({ target: CROSS_CHAPTER });
        expect(host.textContent).toBe('GEN 1:2-3:4');
        await openMenu('2');
        expect(h.menus).toEqual(['Verse Start']);
        expect(onTargetChange).not.toHaveBeenCalled();
    });

    test('its end chapter picker, dismissed, keeps the passage', async () => {
        h.answers = [null];
        const onTargetChange = await render({ target: CROSS_CHAPTER });
        await openMenu('3');
        expect(h.menus).toEqual(['End Chapter']);
        expect(onTargetChange).not.toHaveBeenCalled();
    });

    test('its end verse part picks the end verse alone', async () => {
        h.answers = ['5'];
        const onTargetChange = await render({ target: CROSS_CHAPTER });
        await openMenu('4');
        expect(h.menus).toEqual(['Verse End']);
        expect(onTargetChange.mock.calls).toEqual([
            [{ ...CROSS_CHAPTER, verseEnd: 5 }],
        ]);
    });

    test('its end verse picker, dismissed, keeps the end verse', async () => {
        h.answers = [null];
        const onTargetChange = await render({ target: CROSS_CHAPTER });
        await openMenu('4');
        expect(onTargetChange).not.toHaveBeenCalled();
    });
});

describe('what does not open a picker', () => {
    test('a held key repeating', async () => {
        await render();
        await act(async () => {
            getPart('GEN').dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Enter',
                    repeat: true,
                    bubbles: true,
                }),
            );
        });
        await flush();
        expect(h.menus).toEqual([]);
    });

    test('a plain right-click on a list row title', async () => {
        await render({ withCtrl: true });
        await openMenu('GEN');
        expect(h.menus).toEqual([]);
        h.answers = [null];
        await openMenu('GEN', { ctrlKey: true });
        expect(h.menus).toEqual(['Book']);
    });
});
