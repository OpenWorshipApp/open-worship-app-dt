// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The sibling `ItemColorNoteComp.test.tsx` stubs the async load away to test
// the naming and the menu's disabled rows; this one runs the load and the
// picks, through an `useAppEffectAsync` that behaves like the real one.
const h = vi.hoisted(() => ({ showAppContextMenu: vi.fn() }));

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return {
        useAppEffectAsync: (
            effectMethod: (context: any) => Promise<void>,
            deps: unknown[],
            methods: Record<string, unknown>,
        ) => {
            useEffect(() => {
                const context = { ...methods };
                effectMethod(context);
                return () => {
                    for (const key of Object.keys(context)) {
                        context[key] = () => {};
                    }
                };
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
        },
    };
});
vi.mock('../helper/helpers', () => ({
    freezeObject: () => {},
    pressElementLikeButton: (event: KeyboardEvent) => {
        if (event.key === 'Enter') {
            (event.currentTarget as HTMLElement).click();
        }
    },
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: (...args: unknown[]) => h.showAppContextMenu(...args),
}));

import ItemColorNoteComp from './ItemColorNoteComp';

let host: HTMLDivElement;
let root: Root;

function genItem(storedColorNote: string | null, colorNote?: string | null) {
    return {
        colorNote,
        getColorNote: vi.fn(async () => storedColorNote),
        setColorNote: vi.fn(async () => {}),
    };
}

function getSwatch() {
    return host.querySelector('[role="button"]') as HTMLElement;
}

async function flush() {
    for (let i = 0; i < 3; i++) {
        await act(async () => {
            await Promise.resolve();
        });
    }
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    host.remove();
});

describe('ItemColorNoteComp loading and picking', () => {
    test('reads the colour of an item the list had not resolved', async () => {
        const item = genItem('#ff0000');
        await act(async () => {
            root.render(<ItemColorNoteComp item={item as any} />);
        });
        await flush();
        expect(item.getColorNote).toHaveBeenCalledTimes(1);
        expect(getSwatch().getAttribute('aria-label')).toBe('Color Note: red');
        expect(getSwatch().style.color).toBe('rgb(255, 0, 0)');
        expect(getSwatch().style.opacity).toBe('1');
        expect(host.querySelector('.color-note')!.className).toBe(
            'color-note active',
        );
    });

    test('reads a missing colour as none, and skips the read when it is known', async () => {
        const unknownItem = genItem(null);
        await act(async () => {
            root.render(<ItemColorNoteComp item={unknownItem as any} />);
        });
        await flush();
        expect(getSwatch().getAttribute('aria-label')).toBe(
            'Color Note: No Color',
        );
        expect(getSwatch().style.opacity).toBe('0.2');
        expect(host.querySelector('.color-note')!.className).toBe(
            'color-note ',
        );
        const knownItem = genItem('#ff0000', '#0000ff');
        await act(async () => {
            root.render(<ItemColorNoteComp item={knownItem as any} />);
        });
        await flush();
        expect(knownItem.getColorNote).not.toHaveBeenCalled();
    });

    test('a pick from the menu is shown, stored and reported; No Color clears it', async () => {
        const item = genItem(null, null);
        const onChange = vi.fn();
        const hostClick = vi.fn();
        await act(async () => {
            root.render(
                <div onClick={hostClick}>
                    <ItemColorNoteComp item={item as any} onChange={onChange} />
                </div>,
            );
        });
        // Enter presses it like a button; the row behind gets no click.
        await act(async () => {
            getSwatch().dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
            );
        });
        expect(h.showAppContextMenu).toHaveBeenCalledTimes(1);
        expect(hostClick).not.toHaveBeenCalled();
        const items = h.showAppContextMenu.mock.calls[0][1] as any[];
        const red = items.find((menuItem) => menuItem.menuElement === 'red');
        await act(async () => {
            red.onSelect();
        });
        expect(item.setColorNote).toHaveBeenCalledWith('#ff0000');
        expect(onChange).toHaveBeenCalledWith('#ff0000');
        expect(getSwatch().getAttribute('aria-label')).toBe('Color Note: red');

        await act(async () => {
            getSwatch().click();
        });
        const noColor = (h.showAppContextMenu.mock.calls[1][1] as any[])[0];
        expect(noColor.menuElement).toBe('No Color');
        expect(noColor.disabled).toBe(false);
        await act(async () => {
            noColor.onSelect();
        });
        expect(item.setColorNote).toHaveBeenLastCalledWith(null);
        expect(onChange).toHaveBeenLastCalledWith(null);
        expect(getSwatch().getAttribute('aria-label')).toBe(
            'Color Note: No Color',
        );
    });
});
