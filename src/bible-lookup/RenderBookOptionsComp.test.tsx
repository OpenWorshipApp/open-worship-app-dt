// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    matches: vi.fn(),
    processSelection: vi.fn(),
    enteringSelected: vi.fn(),
    register: vi.fn(),
}));

vi.mock('../helper/bible-helpers/bibleLogicHelpers1', () => ({
    genBookMatches: h.matches,
}));
vi.mock('../event/KeyboardEventListener', () => ({
    useKeyboardRegistering: h.register,
}));
vi.mock('./selectionHelpers', () => ({
    BOOK_OPTION_WIDTH: 120,
    processSelection: h.processSelection,
    userEnteringSelected: h.enteringSelected,
}));
vi.mock('../bible-list/bibleHelpers', () => ({
    useBibleKeyContext: () => 'nt-only',
}));
vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppStateAsync: <T,>(load: () => T | Promise<T>, deps: unknown[]) => {
            const [value, setValue] = react.useState<T | undefined>();
            react.useEffect(() => {
                let active = true;
                void Promise.resolve(load()).then((result) => {
                    if (active) setValue(result);
                });
                return () => {
                    active = false;
                };
            }, deps);
            return [value, setValue] as const;
        },
    };
});
vi.mock('../helper/bible-helpers/bibleInfoHelpers', () => ({
    checkIsOldTestament: (key: string) => key === 'GEN',
    checkIsApocrypha: (key: string) => key === 'TOB',
}));
vi.mock('../helper/bible-helpers/bibleModelHelpers', () => ({
    kjvBibleModelInfo: {
        bookKeysSubtype: [{ type: 'gospel', bookKeys: ['MAT'] }],
    },
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: () => 'Test Serif',
}));
vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => key,
}));

import RenderBookOptionsComp from './RenderBookOptionsComp';

let container: HTMLDivElement;
let root: Root;
let onSelect: (newBookKey: string, newBook: string) => void;

async function render(guessingBook = 'mat') {
    await act(async () => {
        root.render(
            createElement(RenderBookOptionsComp, { onSelect, guessingBook }),
        );
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.matches.mockReset();
    h.processSelection.mockReset();
    h.enteringSelected.mockReset();
    h.register.mockReset();
    onSelect = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('Bible lookup book options', () => {
    it.each([[], null])(
        'explains when no books match (%s)',
        async (matches) => {
            h.matches.mockResolvedValue(matches);
            await render('absent');
            expect(h.matches).toHaveBeenCalledWith('nt-only', {
                guessingBook: 'absent',
            });
            expect(container.textContent).toBe('No book options available');
            expect(container.querySelectorAll('button')).toHaveLength(0);
        },
    );

    it('disables unavailable books and highlights the first available one', async () => {
        h.matches.mockResolvedValue([
            {
                bookKey: 'GEN',
                book: 'Genesis',
                modelBook: 'Genesis',
                isAvailable: false,
            },
            {
                bookKey: 'MAT',
                book: 'Matthieu',
                modelBook: 'Matthew',
                isAvailable: true,
            },
            {
                bookKey: 'TOB',
                book: 'Tobit',
                modelBook: 'Tobit',
                isAvailable: true,
            },
        ]);
        await render();
        const buttons = Array.from(
            container.querySelectorAll<HTMLButtonElement>('button'),
        );
        expect(buttons).toHaveLength(3);
        expect(buttons[0].disabled).toBe(true);
        expect(buttons[0].parentElement?.title).toBe('Not available');
        expect(buttons[0].classList.contains('active')).toBe(false);
        expect(buttons[1].classList.contains('active')).toBe(true);
        expect(buttons[1].dataset.bookSubtype).toBe('gospel');
        expect(buttons[1].textContent).toContain('Matthieu');
        expect(buttons[1].textContent).toContain('(Matthew)');
        expect(
            buttons[1].querySelector<HTMLElement>('.book-option-name')?.style
                .fontFamily,
        ).toBe('Test Serif');
        await act(async () => buttons[1].click());
        expect(onSelect).toHaveBeenCalledWith('MAT', 'Matthieu');
    });

    it('registers arrow navigation for the option selection', async () => {
        h.matches.mockResolvedValue([
            {
                bookKey: 'MAT',
                book: 'Matthew',
                modelBook: 'Matthew',
                isAvailable: true,
            },
        ]);
        await render();
        expect(h.enteringSelected).toHaveBeenCalledWith(
            'bible-lookup-book-option',
            'active',
        );
        const registrations = h.register.mock.calls.map(
            ([keys]) => keys[0].key,
        );
        expect(registrations).toEqual([
            'ArrowLeft',
            'ArrowRight',
            'ArrowUp',
            'ArrowDown',
            'ArrowLeft',
            'ArrowRight',
            'ArrowUp',
            'ArrowDown',
        ]);
        const handler = h.register.mock.calls.at(-1)![1];
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
        handler(event);
        expect(h.processSelection).toHaveBeenCalledWith(
            'bible-lookup-book-option',
            'active',
            'ArrowDown',
            event,
        );
    });
});
