// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppEffect: react.useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../../server/appHelpers', () => ({
    removeOpacityFromHexColor: (color: string) => color.slice(0, 7),
}));
vi.mock('../../context-menu/appContextMenuHelpers', () => ({
    createMouseEvent: (x: number, y: number) =>
        new MouseEvent('click', { clientX: x, clientY: y }),
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));

import SelectCustomColorComp from './SelectCustomColorComp';

let host: HTMLDivElement;
let root: Root;
const onColorSelected = vi.fn();

function getInput() {
    return host.querySelector('input') as HTMLInputElement;
}

async function pick(value: string) {
    const input = getInput();
    await act(async () => {
        const setValue = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
        )!.set!;
        setValue.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

async function blur() {
    await act(async () => {
        getInput().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
}

beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    onColorSelected.mockReset();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    // A screen's background holds teal; this is that screen's picker.
    await act(async () =>
        root.render(
            createElement(SelectCustomColorComp, {
                color: '#008080FF',
                onColorSelected,
                isNoImmediate: true,
            }),
        ),
    );
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('Mix Color box', () => {
    it('sends nothing when it is only clicked into and away from', async () => {
        // Sent, the colour already up read as a press on the lit swatch and
        // switched the projector's background off.
        await blur();
        await act(async () => {
            getInput().dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
            );
        });
        expect(onColorSelected).not.toHaveBeenCalled();
    });

    it('applies a colour that was changed, once', async () => {
        await pick('#ff0000');
        expect(onColorSelected).not.toHaveBeenCalled();
        await blur();
        expect(onColorSelected).toHaveBeenCalledOnce();
        expect(onColorSelected.mock.calls[0][0]).toBe('#ff0000');
        await blur();
        expect(onColorSelected).toHaveBeenCalledOnce();
    });

    it('sends nothing for a colour changed back to the one it was given', async () => {
        await pick('#ff0000');
        await pick('#008080');
        await blur();
        expect(onColorSelected).not.toHaveBeenCalled();
    });
});
