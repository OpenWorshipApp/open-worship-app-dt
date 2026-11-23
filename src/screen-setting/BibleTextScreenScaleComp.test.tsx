// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    // One fake long-text manager per screen: its scale, and who listens.
    type ManagerType = {
        screenId: number;
        screenManagerBase: {
            screenId: number;
            display: { bounds: { width: number; height: number } };
        };
        textScale: number;
    };
    return {
        settingStore: new Map<string, string>(),
        managers: new Map<number, ManagerType>(),
        screenIds: [] as number[],
        textScaleListeners: new Set<() => void>(),
        instanceListeners: new Set<() => void>(),
        scaleWrites: [] as { screenId: number; scale: number }[],
    };
});

vi.mock('./BibleTextScreenScaleComp.scss', () => ({}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/settingHelpers', async () => {
    const { useState } = await import('react');
    return {
        useStateSettingBoolean: (name: string, defaultValue?: boolean) => {
            const stored = h.settingStore.get(name);
            const [value, setValue] = useState(
                stored === undefined ? !!defaultValue : stored === 'true',
            );
            return [
                value,
                (newValue: boolean) => {
                    h.settingStore.set(name, `${newValue}`);
                    setValue(newValue);
                },
            ];
        },
    };
});
// At once: the window itself is `genThrottleAttempt`'s own test.
vi.mock('../helper/timeoutHelpers', () => ({
    genThrottleAttempt: () => (func: () => void) => func(),
}));
vi.mock('../others/AppRangeComp', () => ({
    default: ({
        title,
        value,
        setValue,
        defaultSize,
    }: {
        title: string;
        value: number;
        setValue: (value: number) => void;
        defaultSize: { min: number; max: number };
    }) => (
        <button
            type="button"
            data-range={title}
            data-min={defaultSize.min}
            data-max={defaultSize.max}
            onClick={() => setValue(value * 2)}
        >
            {title}: {value}
        </button>
    ),
}));
vi.mock('../presenter-foreground/ForegroundPropRowComp', () => ({
    default: ({
        label,
        title,
        isEngaged,
        children,
    }: {
        label: string;
        title?: string;
        isEngaged?: boolean;
        children: React.ReactNode;
    }) => (
        <div
            data-row={label}
            data-title={title}
            data-engaged={isEngaged ? 'true' : 'false'}
        >
            {children}
        </div>
    ),
}));
vi.mock('../_screen/managers/ScreenLongTextManager', () => ({
    default: {
        getInstance: (screenId: number) => h.managers.get(screenId) ?? null,
    },
}));
vi.mock('../_screen/managers/screenManagerBaseHelpers', () => ({
    getAllScreenManagerBases: () => {
        return h.screenIds.map((screenId) => ({ screenId }));
    },
}));
vi.mock('../_screen/managers/screenManagerHooks', async () => {
    const { useEffect, useState } = await import('react');
    return {
        useScreenManagerEvents: (
            _events: string[],
            _base?: unknown,
            callback?: () => void,
        ) => {
            const [, setN] = useState(0);
            useEffect(() => {
                const listener = () => {
                    setN((n) => n + 1);
                    callback?.();
                };
                h.instanceListeners.add(listener);
                return () => {
                    h.instanceListeners.delete(listener);
                };
            }, []);
        },
    };
});
vi.mock('../_screen/managers/screenEventHelpers', async () => {
    const { useEffect } = await import('react');
    return {
        useScreenLongTextManagerEvents: (
            _events: string[],
            _manager?: unknown,
            callback?: () => void,
        ) => {
            useEffect(() => {
                const listener = () => {
                    callback?.();
                };
                h.textScaleListeners.add(listener);
                return () => {
                    h.textScaleListeners.delete(listener);
                };
            }, []);
        },
    };
});

import BibleTextScreenScaleComp, {
    BIBLE_TEXT_SCREEN_SCALE_OPENED_SETTING_NAME,
} from './BibleTextScreenScaleComp';

function addScreen(screenId: number, textScale = 1) {
    const screenManagerBase = {
        screenId,
        display: { bounds: { width: 1920, height: 1080 } },
    };
    let scale = textScale;
    h.managers.set(screenId, {
        screenId,
        screenManagerBase,
        get textScale() {
            return scale;
        },
        set textScale(newScale: number) {
            scale = newScale;
            h.scaleWrites.push({ screenId, scale: newScale });
            for (const listener of h.textScaleListeners) {
                listener();
            }
        },
    });
    h.screenIds.push(screenId);
}

describe('BibleTextScreenScaleComp', () => {
    let container: HTMLDivElement;
    let root: Root;

    async function render() {
        await act(async () => {
            root.render(<BibleTextScreenScaleComp />);
        });
    }

    function getFold() {
        return container.querySelector(
            'button[aria-expanded]',
        ) as HTMLButtonElement;
    }

    async function click(element: Element | null) {
        if (element === null) throw new Error('Missing element');
        await act(async () => {
            (element as HTMLElement).click();
        });
    }

    beforeEach(() => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        h.settingStore.clear();
        h.managers.clear();
        h.screenIds.length = 0;
        h.scaleWrites.length = 0;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        vi.unstubAllGlobals();
    });

    test('is folded until opened, with no row mounted', async () => {
        addScreen(0);
        await render();
        const fold = getFold();
        expect(fold.getAttribute('aria-expanded')).toBe('false');
        expect(fold.title).toBe('Expand: Screen Scale');
        expect(fold.textContent).toContain('Screen Scale');
        expect(container.querySelector('[data-row]')).toBeNull();
        expect(
            container.querySelector('section[aria-label="Screen Scale"]'),
        ).not.toBeNull();
    });

    test('opened, a row per screen at 1, 0.1..10, and the fold is remembered', async () => {
        addScreen(0);
        addScreen(2);
        await render();
        await click(getFold());
        expect(getFold().getAttribute('aria-expanded')).toBe('true');
        expect(getFold().title).toBe('Collapse: Screen Scale');
        expect(
            h.settingStore.get(BIBLE_TEXT_SCREEN_SCALE_OPENED_SETTING_NAME),
        ).toBe('true');
        const rows = [...container.querySelectorAll('[data-row]')];
        expect(
            rows.map((row) => {
                return row.getAttribute('data-row');
            }),
        ).toEqual(['Screen: 0', 'Screen: 2']);
        expect(rows[0].getAttribute('data-title')).toBe('1920×1080');
        const range = container.querySelector('[data-range="Screen: 0"]')!;
        expect(range.textContent).toBe('Screen: 0: 1');
        expect(range.getAttribute('data-min')).toBe('0.1');
        expect(range.getAttribute('data-max')).toBe('10');

        // Reopened as it was left.
        await act(async () => root.unmount());
        root = createRoot(container);
        await render();
        expect(getFold().getAttribute('aria-expanded')).toBe('true');
    });

    test('a change goes to that screen alone, and its reset puts it back to 1', async () => {
        addScreen(0);
        addScreen(1);
        h.settingStore.set(BIBLE_TEXT_SCREEN_SCALE_OPENED_SETTING_NAME, 'true');
        await render();
        const resetOf = (screenId: number) => {
            return container.querySelector(
                `button[aria-label="Default: Screen: ${screenId}"]`,
            ) as HTMLButtonElement;
        };
        expect(resetOf(1).disabled).toBe(true);
        expect(
            container
                .querySelector('[data-row="Screen: 1"]')!
                .getAttribute('data-engaged'),
        ).toBe('false');
        expect(container.querySelector('.fg-deco-dot')).toBeNull();

        await click(container.querySelector('[data-range="Screen: 1"]'));
        expect(h.scaleWrites).toEqual([{ screenId: 1, scale: 2 }]);
        expect(h.managers.get(0)!.textScale).toBe(1);
        expect(
            container.querySelector('[data-range="Screen: 1"]')!.textContent,
        ).toBe('Screen: 1: 2');
        expect(
            container
                .querySelector('[data-row="Screen: 1"]')!
                .getAttribute('data-engaged'),
        ).toBe('true');
        expect(resetOf(1).disabled).toBe(false);
        // Some screen is scaled: the fold says so even while folded.
        expect(container.querySelector('.fg-deco-dot')).not.toBeNull();

        await click(resetOf(1));
        expect(h.scaleWrites.at(-1)).toEqual({ screenId: 1, scale: 1 });
        expect(resetOf(1).disabled).toBe(true);
        expect(container.querySelector('.fg-deco-dot')).toBeNull();
    });

    test('a screen added while open gets its row', async () => {
        addScreen(0);
        h.settingStore.set(BIBLE_TEXT_SCREEN_SCALE_OPENED_SETTING_NAME, 'true');
        await render();
        expect(container.querySelectorAll('[data-row]')).toHaveLength(1);
        addScreen(3, 1.5);
        await act(async () => {
            for (const listener of h.instanceListeners) {
                listener();
            }
        });
        expect(container.querySelectorAll('[data-row]')).toHaveLength(2);
        expect(
            container.querySelector('[data-range="Screen: 3"]')!.textContent,
        ).toBe('Screen: 3: 1.5');
        expect(container.querySelector('.fg-deco-dot')).not.toBeNull();
    });
});
