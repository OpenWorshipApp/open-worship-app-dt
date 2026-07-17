// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const { useKeyboardRegisteringMock, bringDomToBottomViewMock, captured } =
    vi.hoisted(() => ({
        useKeyboardRegisteringMock: vi.fn(),
        bringDomToBottomViewMock: vi.fn(),
        captured: { cb: undefined as any },
    }));

vi.mock('../event/KeyboardEventListener', () => ({
    useKeyboardRegistering: useKeyboardRegisteringMock,
}));
vi.mock('../helper/helpers', () => ({
    bringDomToBottomView: bringDomToBottomViewMock,
}));

import {
    BIBLE_LOOKUP_INPUT_ID,
    INPUT_TEXT_CLASS,
    RENDER_FOUND_CLASS,
    checkIsBibleLookupInputFocused,
    focusRenderFound,
    getBibleLookupInputElement,
    getBibleLookupInputText,
    getSelectedElement,
    processSelection,
    setBibleLookupInputFocus,
    userEnteringSelected,
} from './selectionHelpers';

const OPTION_CLASS = 'opt';
const SELECTED_CLASS = 'sel';

function makeOptions(
    coords: { x: number; y: number; disabled?: boolean; selected?: boolean }[],
) {
    const buttons: HTMLButtonElement[] = [];
    for (const c of coords) {
        const btn = document.createElement('button');
        btn.className = OPTION_CLASS;
        if (c.disabled) {
            btn.setAttribute('disabled', '');
        }
        if (c.selected) {
            btn.classList.add(SELECTED_CLASS);
        }
        btn.getBoundingClientRect = () => ({ x: c.x, y: c.y }) as DOMRect;
        document.body.appendChild(btn);
        buttons.push(btn);
    }
    return buttons;
}

function makeRenderFound(focus = true) {
    const div = document.createElement('div');
    div.className = RENDER_FOUND_CLASS;
    div.tabIndex = 0;
    document.body.appendChild(div);
    if (focus) {
        div.focus();
    }
    return div;
}

function genEvent() {
    return {
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
    } as any;
}

describe('bible-lookup selectionHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
        captured.cb = undefined;
        useKeyboardRegisteringMock.mockImplementation((_m: any, cb: any) => {
            captured.cb = cb;
        });
    });

    test('getSelectedElement finds the selected option', () => {
        const [, second] = makeOptions([
            { x: 0, y: 0 },
            { x: 10, y: 0, selected: true },
        ]);
        expect(getSelectedElement(OPTION_CLASS, SELECTED_CLASS)).toBe(second);
    });

    test('processSelection does nothing when render-found is not focused', () => {
        makeOptions([{ x: 0, y: 0 }]);
        const event = genEvent();
        processSelection(OPTION_CLASS, SELECTED_CLASS, 'ArrowRight', event);
        expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('processSelection moves the selection horizontally', () => {
        makeRenderFound();
        const buttons = makeOptions([
            { x: 0, y: 0, selected: true },
            { x: 10, y: 0 },
            { x: 20, y: 0 },
        ]);
        const event = genEvent();
        processSelection(OPTION_CLASS, SELECTED_CLASS, 'ArrowRight', event);
        expect(event.preventDefault).toHaveBeenCalled();
        expect(buttons[1].classList.contains(SELECTED_CLASS)).toBe(true);
        expect(buttons[0].classList.contains(SELECTED_CLASS)).toBe(false);
        expect(bringDomToBottomViewMock).toHaveBeenCalledWith(buttons[1]);
    });

    test('processSelection picks the first option when none selected', () => {
        makeRenderFound();
        const buttons = makeOptions([
            { x: 0, y: 0 },
            { x: 10, y: 0 },
        ]);
        const event = genEvent();
        processSelection(OPTION_CLASS, SELECTED_CLASS, 'ArrowDown', event);
        expect(buttons[0].classList.contains(SELECTED_CLASS)).toBe(true);
    });

    test('processSelection skips disabled options', () => {
        makeRenderFound();
        const buttons = makeOptions([
            { x: 0, y: 0, selected: true },
            { x: 10, y: 0, disabled: true },
            { x: 20, y: 0 },
        ]);
        const event = genEvent();
        processSelection(OPTION_CLASS, SELECTED_CLASS, 'ArrowRight', event);
        expect(buttons[2].classList.contains(SELECTED_CLASS)).toBe(true);
    });

    test('processSelection navigates a 2D grid vertically', () => {
        makeRenderFound();
        const buttons = makeOptions([
            { x: 0, y: 0, selected: true },
            { x: 10, y: 0 },
            { x: 0, y: 10 },
            { x: 10, y: 10 },
        ]);
        const event = genEvent();
        processSelection(OPTION_CLASS, SELECTED_CLASS, 'ArrowDown', event);
        expect(buttons[2].classList.contains(SELECTED_CLASS)).toBe(true);
        processSelection(OPTION_CLASS, SELECTED_CLASS, 'ArrowUp', event);
        expect(buttons[0].classList.contains(SELECTED_CLASS)).toBe(true);
        processSelection(OPTION_CLASS, SELECTED_CLASS, 'ArrowLeft', event);
        expect(buttons[1].classList.contains(SELECTED_CLASS)).toBe(true);
    });

    test('processSelection returns when there are no options', () => {
        makeRenderFound();
        const event = genEvent();
        processSelection(OPTION_CLASS, SELECTED_CLASS, 'ArrowRight', event);
        // no options => index -1 => nothing selected, but preventDefault ran
        expect(event.preventDefault).toHaveBeenCalled();
    });

    test('processSelection ignores when all options are disabled', () => {
        makeRenderFound();
        makeOptions([
            { x: 0, y: 0, disabled: true },
            { x: 10, y: 0, disabled: true },
        ]);
        const event = genEvent();
        processSelection(OPTION_CLASS, SELECTED_CLASS, 'ArrowRight', event);
        // all disabled => empty indexer => early index -1 return
        expect(bringDomToBottomViewMock).not.toHaveBeenCalled();
    });

    test('processSelection blurs the input text on selection', () => {
        makeRenderFound();
        const input = document.createElement('input');
        input.className = INPUT_TEXT_CLASS;
        document.body.appendChild(input);
        const buttons = makeOptions([
            { x: 0, y: 0, selected: true },
            { x: 10, y: 0 },
        ]);
        const blurSpy = vi.spyOn(input, 'blur');
        const event = genEvent();
        processSelection(OPTION_CLASS, SELECTED_CLASS, 'ArrowRight', event);
        expect(blurSpy).toHaveBeenCalled();
        expect(buttons[1].classList.contains(SELECTED_CLASS)).toBe(true);
    });

    test('userEnteringSelected clicks the selected element on Enter', () => {
        makeRenderFound();
        const [, second] = makeOptions([
            { x: 0, y: 0 },
            { x: 10, y: 0, selected: true },
        ]);
        const clickSpy = vi.spyOn(second, 'click');
        userEnteringSelected(OPTION_CLASS, SELECTED_CLASS);
        captured.cb();
        expect(clickSpy).toHaveBeenCalled();
    });

    test('userEnteringSelected clicks when the input text is focused', () => {
        const input = document.createElement('input');
        input.className = INPUT_TEXT_CLASS;
        input.tabIndex = 0;
        document.body.appendChild(input);
        input.focus();
        const [selected] = makeOptions([{ x: 0, y: 0, selected: true }]);
        const clickSpy = vi.spyOn(selected, 'click');
        userEnteringSelected(OPTION_CLASS, SELECTED_CLASS);
        captured.cb();
        expect(clickSpy).toHaveBeenCalled();
    });

    test('userEnteringSelected no-ops when nothing is focused', () => {
        makeOptions([{ x: 0, y: 0, selected: true }]);
        userEnteringSelected(OPTION_CLASS, SELECTED_CLASS);
        // neither render-found nor input focused => early return
        expect(() => captured.cb()).not.toThrow();
    });

    test('focusRenderFound focuses the render-found element', () => {
        const div = makeRenderFound(false);
        focusRenderFound();
        expect(document.activeElement).toBe(div);
    });

    test('bible lookup input helpers read value and focus state', () => {
        expect(getBibleLookupInputElement()).toBeNull();
        expect(getBibleLookupInputText()).toBe('');
        expect(checkIsBibleLookupInputFocused()).toBe(false);
        // setBibleLookupInputFocus is a no-op without the element
        expect(() => setBibleLookupInputFocus()).not.toThrow();

        const input = document.createElement('input');
        input.id = BIBLE_LOOKUP_INPUT_ID;
        input.value = 'John 3:16';
        document.body.appendChild(input);

        expect(getBibleLookupInputText()).toBe('John 3:16');
        setBibleLookupInputFocus();
        expect(document.activeElement).toBe(input);
        expect(checkIsBibleLookupInputFocused()).toBe(true);
    });
});
