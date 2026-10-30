// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    // The listener each shortcut id registered, and the layer it asked for.
    shortcuts: new Map<string, (event?: any) => void>(),
    layers: new Map<string, unknown>(),
}));

vi.mock('../../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: (current: unknown) => {
            const ref = useRef(current);
            ref.current = current;
            return ref;
        },
    };
});
vi.mock('../../event/KeyboardEventListener', () => ({
    useKeyboardRegistering: (
        eventMappers: { key: string }[],
        listener: (event?: any) => void,
        _deps: unknown[],
        layer?: unknown,
    ) => {
        h.shortcuts.set(eventMappers[0].key, listener);
        h.layers.set(eventMappers[0].key, layer);
    },
}));
// Each shortcut id maps to one mapper keyed by the id itself, so the fake
// registry above can tell the bindings apart.
vi.mock('../managers/screenDrawShortcutHelpers', () => ({
    drawShortcutMap: new Proxy(
        {},
        {
            get: (_target, shortcutId: string) => [{ key: shortcutId }],
        },
    ),
    toShortcutTitle: (title: string, ...shortcutIds: string[]) => {
        return `${title} [${shortcutIds.join(', ')}]`;
    },
}));

import {
    OverlayColorSwatchComp,
    OverlayRangeComp,
    handleKeepOverlayFocus,
    useOverlayShortcut,
} from './miniScreenOverlayControlComps';

let container: HTMLDivElement;
let root: Root;

function RangeHostComp({
    initialValue,
    onSet,
    isTarget,
    layer,
}: {
    initialValue: number;
    onSet: (value: number) => void;
    isTarget: () => boolean;
    layer?: any;
}) {
    return (
        <OverlayRangeComp
            icon="bi-circle"
            label="Size"
            value={initialValue}
            setValue={onSet}
            min={0}
            max={100}
            step={5}
            stepBig={20}
            suffix="px"
            shortcutBase="size"
            checkIsShortcutTarget={isTarget}
            layer={layer}
        />
    );
}

function ShortcutHostComp({
    handle,
    isTarget,
    isRepeatable,
}: {
    handle: () => void;
    isTarget: () => boolean;
    isRepeatable?: boolean;
}) {
    useOverlayShortcut('toggleContrast', handle, isTarget, isRepeatable);
    return null;
}

function getButton(label: string) {
    const button = [...container.querySelectorAll('button')].find((item) => {
        return item.getAttribute('aria-label')?.startsWith(label);
    });
    if (button === undefined) {
        throw new Error(`Missing button: ${label}`);
    }
    return button;
}

function changeInput(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    )!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.shortcuts.clear();
    h.layers.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

describe('handleKeepOverlayFocus', () => {
    test('stops the focus transfer by preventing the default', () => {
        const event = { preventDefault: vi.fn() };
        handleKeepOverlayFocus(event);
        expect(event.preventDefault).toHaveBeenCalledOnce();
    });
});

describe('useOverlayShortcut', () => {
    test('fires only while this panel owns the keyboard', async () => {
        const handle = vi.fn();
        let isTarget = false;
        await act(async () => {
            root.render(
                <ShortcutHostComp
                    handle={handle}
                    isTarget={() => {
                        return isTarget;
                    }}
                />,
            );
        });
        const listener = h.shortcuts.get('toggleContrast')!;

        listener({ repeat: false });
        expect(handle).not.toHaveBeenCalled();

        // Read at key time, not at bind time.
        isTarget = true;
        listener({ repeat: false });
        expect(handle).toHaveBeenCalledTimes(1);
    });

    test('drops an auto-repeat unless the binding opts in', async () => {
        const handle = vi.fn();
        await act(async () => {
            root.render(
                <ShortcutHostComp
                    handle={handle}
                    isTarget={() => {
                        return true;
                    }}
                />,
            );
        });
        h.shortcuts.get('toggleContrast')!({ repeat: true });
        expect(handle).not.toHaveBeenCalled();

        await act(async () => {
            root.render(
                <ShortcutHostComp
                    handle={handle}
                    isTarget={() => {
                        return true;
                    }}
                    isRepeatable
                />,
            );
        });
        h.shortcuts.get('toggleContrast')!({ repeat: true });
        expect(handle).toHaveBeenCalledTimes(1);
    });
});

describe('OverlayRangeComp', () => {
    test('steps by one small step either way and shows the value', async () => {
        const onSet = vi.fn();
        await act(async () => {
            root.render(
                <RangeHostComp
                    initialValue={50}
                    onSet={onSet}
                    isTarget={() => {
                        return true;
                    }}
                />,
            );
        });
        expect(container.textContent).toContain('50px');
        expect(getButton('Size -5 / -20').title).toBe(
            'Size -5 / -20 [sizeDown, sizeDownBig]',
        );

        await act(async () => {
            getButton('Size -5').click();
        });
        expect(onSet).toHaveBeenLastCalledWith(45);
        await act(async () => {
            getButton('Size +5').click();
        });
        expect(onSet).toHaveBeenLastCalledWith(55);
    });

    test('clamps every step to the range and disables a spent button', async () => {
        const onSet = vi.fn();
        await act(async () => {
            root.render(
                <RangeHostComp
                    initialValue={0}
                    onSet={onSet}
                    isTarget={() => {
                        return true;
                    }}
                />,
            );
        });
        expect(getButton('Size -5').disabled).toBe(true);
        expect(getButton('Size +5').disabled).toBe(false);
        // The big step down from the minimum stays at the minimum.
        h.shortcuts.get('sizeDownBig')!({ repeat: false });
        expect(onSet).toHaveBeenLastCalledWith(0);

        await act(async () => {
            root.render(
                <RangeHostComp
                    initialValue={95}
                    onSet={onSet}
                    isTarget={() => {
                        return true;
                    }}
                />,
            );
        });
        h.shortcuts.get('sizeUpBig')!({ repeat: false });
        expect(onSet).toHaveBeenLastCalledWith(100);

        await act(async () => {
            root.render(
                <RangeHostComp
                    initialValue={100}
                    onSet={onSet}
                    isTarget={() => {
                        return true;
                    }}
                />,
            );
        });
        expect(getButton('Size +5').disabled).toBe(true);
    });

    test('the four step keys repeat when held and respect the target', async () => {
        const onSet = vi.fn();
        let isTarget = true;
        await act(async () => {
            root.render(
                <RangeHostComp
                    initialValue={50}
                    onSet={onSet}
                    isTarget={() => {
                        return isTarget;
                    }}
                />,
            );
        });
        expect([...h.shortcuts.keys()].sort()).toEqual([
            'sizeDown',
            'sizeDownBig',
            'sizeUp',
            'sizeUpBig',
        ]);

        h.shortcuts.get('sizeDown')!({ repeat: true });
        expect(onSet).toHaveBeenLastCalledWith(45);
        h.shortcuts.get('sizeUp')!({ repeat: true });
        expect(onSet).toHaveBeenLastCalledWith(55);
        h.shortcuts.get('sizeDownBig')!({ repeat: false });
        expect(onSet).toHaveBeenLastCalledWith(30);
        h.shortcuts.get('sizeUpBig')!({ repeat: false });
        expect(onSet).toHaveBeenLastCalledWith(70);

        isTarget = false;
        onSet.mockClear();
        h.shortcuts.get('sizeUp')!({ repeat: false });
        expect(onSet).not.toHaveBeenCalled();
    });

    test('dragging the slider sets the parsed number', async () => {
        const onSet = vi.fn();
        await act(async () => {
            root.render(
                <RangeHostComp
                    initialValue={50}
                    onSet={onSet}
                    isTarget={() => {
                        return true;
                    }}
                />,
            );
        });
        const input = container.querySelector<HTMLInputElement>(
            'input[type="range"]',
        )!;
        expect(input.getAttribute('aria-label')).toBe('Size');
        expect(input.min).toBe('0');
        expect(input.max).toBe('100');
        expect(input.step).toBe('5');
        await act(async () => {
            changeInput(input, '65');
        });
        expect(onSet).toHaveBeenLastCalledWith(65);
    });

    test('a step button keeps the overlay focused on mousedown', async () => {
        await act(async () => {
            root.render(
                <RangeHostComp
                    initialValue={50}
                    onSet={vi.fn()}
                    isTarget={() => {
                        return true;
                    }}
                />,
            );
        });
        const event = new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
        });
        getButton('Size +5').dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
    });

    test('passes an explicit keyboard layer to all four step keys', async () => {
        await act(async () => {
            root.render(
                <RangeHostComp
                    initialValue={50}
                    onSet={vi.fn()}
                    isTarget={() => {
                        return true;
                    }}
                    layer="presenting-control"
                />,
            );
        });
        for (const shortcutId of [
            'sizeDown',
            'sizeUp',
            'sizeDownBig',
            'sizeUpBig',
        ]) {
            expect(h.layers.get(shortcutId)).toBe('presenting-control');
        }
    });
});

describe('OverlayColorSwatchComp', () => {
    test('previews the opacity and reports the picked color', async () => {
        const setColor = vi.fn();
        await act(async () => {
            root.render(
                <OverlayColorSwatchComp
                    icon="bi-palette"
                    label="Dim color"
                    color="#000000"
                    setColor={setColor}
                    opacity={40}
                />,
            );
        });
        const input = container.querySelector<HTMLInputElement>(
            'input[type="color"]',
        )!;
        expect(input.getAttribute('aria-label')).toBe('Dim color');
        expect(input.value).toBe('#000000');
        expect(input.style.opacity).toBe('0.4');
        expect(container.querySelector('label')!.title).toBe('Dim color');

        await act(async () => {
            changeInput(input, '#ff0000');
        });
        expect(setColor).toHaveBeenCalledWith('#ff0000');
    });
});
