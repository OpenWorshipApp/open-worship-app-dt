// @vitest-environment jsdom

import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));

import FindPanelBodyComp from './FindPanelBodyComp';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

function genHandlers() {
    return {
        onQueryChanging: vi.fn(),
        onKeyDowning: vi.fn(),
        onPreviousClicking: vi.fn(),
        onNextClicking: vi.fn(),
        onMatchCaseToggling: vi.fn(),
        onClosing: vi.fn(),
        onGripPointerDowning: vi.fn(),
        onGripPointerUping: vi.fn(),
    };
}

function getByLabel(label: string) {
    return host.querySelector<HTMLElement>(`[aria-label="${label}"]`)!;
}

async function renderPanel(
    props: Partial<{
        queryText: string;
        isMatchCase: boolean;
        matchCount: number;
        activeMatchOrdinal: number;
    }>,
    handlers = genHandlers(),
) {
    const inputRef = createRef<HTMLInputElement>();
    await act(async () =>
        root.render(
            <FindPanelBodyComp
                inputRef={inputRef}
                queryText={props.queryText ?? ''}
                isMatchCase={props.isMatchCase ?? false}
                matchCount={props.matchCount ?? 0}
                activeMatchOrdinal={props.activeMatchOrdinal ?? 0}
                {...handlers}
            />,
        ),
    );
    return { handlers, inputRef };
}

describe('FindPanelBodyComp', () => {
    test('with no query the count is blank and the arrows are off', async () => {
        const { inputRef } = await renderPanel({});
        expect(inputRef.current).toBe(getByLabel('Find'));
        expect((getByLabel('Match count') as HTMLInputElement).value).toBe('');
        expect(
            (getByLabel('Previous match') as HTMLButtonElement).disabled,
        ).toBe(true);
        expect((getByLabel('Next match') as HTMLButtonElement).disabled).toBe(
            true,
        );
        expect(getByLabel('Match case').getAttribute('aria-pressed')).toBe(
            'false',
        );
        // Every glyph is an inline svg, not the icon font.
        expect(host.querySelectorAll('svg path')).toHaveLength(5);
    });

    test('a query shows which match of how many, and the arrows step', async () => {
        const { handlers } = await renderPanel({
            queryText: 'grace',
            matchCount: 7,
            activeMatchOrdinal: 3,
        });
        expect((getByLabel('Match count') as HTMLInputElement).value).toBe(
            '3/7',
        );
        await act(async () => getByLabel('Previous match').click());
        await act(async () => getByLabel('Next match').click());
        expect(handlers.onPreviousClicking).toHaveBeenCalledOnce();
        expect(handlers.onNextClicking).toHaveBeenCalledOnce();
    });

    test('match case shows its state and toggles', async () => {
        const { handlers } = await renderPanel({ isMatchCase: true });
        const button = getByLabel('Match case');
        expect(button.getAttribute('aria-pressed')).toBe('true');
        expect(button.className).toContain('is-active');
        await act(async () => button.click());
        expect(handlers.onMatchCaseToggling).toHaveBeenCalledOnce();
    });

    test('typing, keys, closing and dragging reach their handlers', async () => {
        const { handlers } = await renderPanel({ queryText: 'a' });
        const input = getByLabel('Find') as HTMLInputElement;
        await act(async () => {
            Object.getOwnPropertyDescriptor(
                HTMLInputElement.prototype,
                'value',
            )!.set!.call(input, 'ab');
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        expect(handlers.onQueryChanging).toHaveBeenCalledOnce();
        await act(async () =>
            input.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
            ),
        );
        expect(handlers.onKeyDowning).toHaveBeenCalledOnce();
        await act(async () => getByLabel('Close find').click());
        expect(handlers.onClosing).toHaveBeenCalledOnce();

        const grip = getByLabel('Drag to move the find panel');
        await act(async () =>
            grip.dispatchEvent(new Event('pointerdown', { bubbles: true })),
        );
        await act(async () =>
            grip.dispatchEvent(new Event('pointerup', { bubbles: true })),
        );
        await act(async () =>
            grip.dispatchEvent(new Event('pointercancel', { bubbles: true })),
        );
        expect(handlers.onGripPointerDowning).toHaveBeenCalledOnce();
        // A cancelled drag ends the same way a released one does.
        expect(handlers.onGripPointerUping).toHaveBeenCalledTimes(2);
    });
});
