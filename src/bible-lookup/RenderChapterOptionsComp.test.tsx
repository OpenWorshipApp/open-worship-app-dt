// @vitest-environment jsdom

import { act, useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    bibleKey: 'KJV',
    chapters: null as
        | null
        | { chapter: number; chapterLocaleString: string; isIntro?: boolean }[],
    getChapterData: vi.fn(),
}));

vi.mock('../event/KeyboardEventListener', () => ({
    allArrows: ['ArrowLeft', 'ArrowRight'],
    useKeyboardRegistering: vi.fn(),
}));
vi.mock('./selectionHelpers', () => ({
    CHAPTER_OPTION_WIDTH: 70,
    processSelection: vi.fn(),
    userEnteringSelected: vi.fn(),
}));
vi.mock('../helper/bible-helpers/bibleLogicHelpers1', () => ({
    useChapterMatch: () => h.chapters,
}));
vi.mock('../bible-list/bibleHelpers', () => ({
    useBibleKeyContext: () => h.bibleKey,
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
            void Promise.resolve(genValue()).then(setValue);
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, deps);
        return [value, setValue];
    },
}));
vi.mock('../helper/bible-helpers/bibleInfoHelpers', () => ({
    getChapterData: h.getChapterData,
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: () => undefined,
}));
vi.mock('../helper/sanitizeHelpers', () => ({
    sanitizeHtml: (html: string) => html,
}));
// Marked, so a label that skipped `tran` would not match.
vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => `[${key}]`,
}));

import RenderChapterOptionsComp from './RenderChapterOptionsComp';

let host: HTMLDivElement;
let root: Root;

async function render() {
    await act(async () =>
        root.render(
            <RenderChapterOptionsComp
                bookKey="GEN"
                guessingChapter={null}
                onSelect={vi.fn()}
            />,
        ),
    );
}

function introButton() {
    return host.querySelector<HTMLButtonElement>('button:has(.bi-info-circle)');
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.bibleKey = 'KJV';
    h.chapters = [
        { chapter: 0, chapterLocaleString: 'Introduction', isIntro: true },
        { chapter: 1, chapterLocaleString: '1' },
    ];
    h.getChapterData
        .mockReset()
        .mockImplementation(async (bibleKey: string) => ({
            verses: { 1: `${bibleKey} introduction` },
        }));
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('chapter options introduction toggle', () => {
    it('names the icon-only toggle and reports whether it is open', async () => {
        await render();
        const button = introButton()!;
        expect(button).not.toBeNull();
        expect(button.getAttribute('type')).toBe('button');
        expect(button.getAttribute('aria-label')).toBe('[Introduction]');
        expect(button.title).toBe('[Introduction]');
        expect(button.getAttribute('aria-expanded')).toBe('false');
        expect(
            button
                .querySelector('.bi-info-circle')!
                .getAttribute('aria-hidden'),
        ).toBe('true');
        expect(host.textContent).not.toContain('KJV introduction');

        await act(async () => button.click());
        expect(button.getAttribute('aria-expanded')).toBe('true');
        expect(host.textContent).toContain('KJV introduction');

        await act(async () => button.click());
        expect(button.getAttribute('aria-expanded')).toBe('false');
        expect(host.textContent).not.toContain('KJV introduction');
    });

    it('reloads an open introduction when the Bible changes', async () => {
        await render();
        await act(async () => introButton()!.click());
        expect(host.textContent).toContain('KJV introduction');

        h.bibleKey = 'NIV';
        await render();
        expect(h.getChapterData).toHaveBeenLastCalledWith('NIV', 'GEN', 0);
        expect(host.textContent).toContain('NIV introduction');
        expect(host.textContent).not.toContain('KJV introduction');
    });

    it('offers no toggle for a book without an introduction', async () => {
        h.chapters = [
            { chapter: 0, chapterLocaleString: 'Introduction', isIntro: false },
            { chapter: 1, chapterLocaleString: '1' },
        ];
        await render();
        expect(introButton()).toBeNull();
        expect(
            host.querySelectorAll('.bible-lookup-chapter-option'),
        ).toHaveLength(1);
    });
});
