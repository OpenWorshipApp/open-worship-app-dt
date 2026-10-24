// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    provider: {
        systemUtils: {
            isWindows: true,
            isMac: false,
            isLinux: false,
            isDev: false,
        },
    },
}));

vi.mock('../server/appProvider', () => ({ default: state.provider }));
vi.mock('../helper/helpers', () => ({
    cloneJson: <T>(value: T) => structuredClone(value),
}));
vi.mock('../helper/appHooks', () => ({
    useAppEffect: vi.fn(),
    useAppCurrentRef: vi.fn(),
}));

import KeyboardEventListener from '../event/KeyboardEventListener';
import {
    KEYING_AREA_PRIORITY,
    findKeyingAreaElementToFocus,
    forgetKeyingAreaPresses,
    handleKeyingAreaKeyDown,
    registerKeyingArea,
} from './keyingAreaHelpers';

const unregisterList: (() => void)[] = [];

function addFocusable(tagName = 'div', parent: HTMLElement = document.body) {
    const element = document.createElement(tagName);
    element.tabIndex = 0;
    parent.appendChild(element);
    return element;
}

function addArea(
    priority: number,
    isSelected: boolean,
    parent: HTMLElement = document.body,
) {
    const element = addFocusable('div', parent);
    const area = { isSelected };
    unregisterList.push(
        registerKeyingArea({
            priority,
            getElement: () => element,
            checkHasSelected: () => area.isSelected,
        }),
    );
    return { element, area };
}

function addFloatingWidget(zOffset: number) {
    const widget = document.createElement('div');
    widget.className = 'floating-widget';
    widget.style.setProperty('--floating-widget-z-offset', `${zOffset}`);
    document.body.appendChild(widget);
    return widget;
}

function press(timeStamp: number, extra: Record<string, unknown> = {}) {
    const event = {
        key: 'PageDown',
        target: document.activeElement,
        timeStamp,
        repeat: false,
        defaultPrevented: false,
        isComposing: false,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        ...extra,
    };
    const isSpent = handleKeyingAreaKeyDown(event as unknown as KeyboardEvent);
    return { event, isSpent };
}

describe('keyingAreaHelpers', () => {
    afterEach(() => {
        for (const unregister of unregisterList.splice(0)) {
            unregister();
        }
        forgetKeyingAreaPresses();
        KeyboardEventListener.removeLayer('popup');
        document.body.replaceChildren();
    });

    test('the run sheet outranks the slides, and a slides popup comes last', () => {
        const popup = addArea(KEYING_AREA_PRIORITY.slidesPopup, true);
        const slides = addArea(KEYING_AREA_PRIORITY.slides, true);
        const flow = addArea(KEYING_AREA_PRIORITY.presentingFlow, true);
        expect(findKeyingAreaElementToFocus()).toBe(flow.element);

        // Only an area a press would MOVE something in is a candidate.
        flow.area.isSelected = false;
        expect(findKeyingAreaElementToFocus()).toBe(slides.element);
        slides.area.isSelected = false;
        expect(findKeyingAreaElementToFocus()).toBe(popup.element);
        popup.area.isSelected = false;
        expect(findKeyingAreaElementToFocus()).toBeNull();
    });

    test('two of one kind: the widget on top, else the first in the document', () => {
        const first = addArea(KEYING_AREA_PRIORITY.slides, true);
        addArea(KEYING_AREA_PRIORITY.slides, true);
        expect(findKeyingAreaElementToFocus()).toBe(first.element);

        const below = addArea(
            KEYING_AREA_PRIORITY.presentingFlow,
            true,
            addFloatingWidget(1),
        );
        const onTop = addArea(
            KEYING_AREA_PRIORITY.presentingFlow,
            true,
            addFloatingWidget(4),
        );
        expect(findKeyingAreaElementToFocus()).toBe(onTop.element);
        onTop.area.isSelected = false;
        expect(findKeyingAreaElementToFocus()).toBe(below.element);
    });

    test('an area that is gone is not a candidate', () => {
        const flow = addArea(KEYING_AREA_PRIORITY.presentingFlow, true);
        const slides = addArea(KEYING_AREA_PRIORITY.slides, true);
        flow.element.remove();
        expect(findKeyingAreaElementToFocus()).toBe(slides.element);
        unregisterList.splice(0).forEach((unregister) => unregister());
        expect(findKeyingAreaElementToFocus()).toBeNull();
    });

    test('an unowned keyboard goes to the area at once, and the press carries on', () => {
        const flow = addArea(KEYING_AREA_PRIORITY.presentingFlow, true);
        addArea(KEYING_AREA_PRIORITY.slides, true);
        expect(document.activeElement).toBe(document.body);

        const { event, isSpent } = press(0);
        // Not spent: the run sheet now holds focus and steps on this press.
        expect(isSpent).toBe(false);
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(event.stopPropagation).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(flow.element);
    });

    test('an unowned keyboard is left alone when no area has a selected element', () => {
        addArea(KEYING_AREA_PRIORITY.presentingFlow, false);
        addArea(KEYING_AREA_PRIORITY.slides, false);
        expect(press(0).isSpent).toBe(false);
        expect(document.activeElement).toBe(document.body);
    });

    test('three quick presses hand the keys over, and the third is spent on it', () => {
        const flow = addArea(KEYING_AREA_PRIORITY.presentingFlow, true);
        const outside = addFocusable('button');
        outside.focus();

        expect(press(0).isSpent).toBe(false);
        expect(press(400).isSpent).toBe(false);
        expect(document.activeElement).toBe(outside);

        const { event, isSpent } = press(900);
        expect(isSpent).toBe(true);
        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(event.stopPropagation).toHaveBeenCalledTimes(1);
        expect(document.activeElement).toBe(flow.element);
    });

    test('presses spread wider than the window do not add up', () => {
        const flow = addArea(KEYING_AREA_PRIORITY.presentingFlow, true);
        const outside = addFocusable('button');
        outside.focus();

        expect(press(0).isSpent).toBe(false);
        expect(press(1000).isSpent).toBe(false);
        // The first has aged out: this is the second of a new run of presses.
        expect(press(2000).isSpent).toBe(false);
        expect(document.activeElement).toBe(outside);
        expect(press(2400).isSpent).toBe(true);
        expect(document.activeElement).toBe(flow.element);
    });

    test('three quick presses change nothing when no area has a selected element', () => {
        addArea(KEYING_AREA_PRIORITY.presentingFlow, false);
        const outside = addFocusable('button');
        outside.focus();

        press(0);
        press(100);
        const { event, isSpent } = press(200);
        expect(isSpent).toBe(false);
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(outside);
    });

    test('a focused area with nothing selected gives way to one that has', () => {
        const flow = addArea(KEYING_AREA_PRIORITY.presentingFlow, true);
        // The slides preview claims focus whenever a document is picked, live
        // or not -- the commonest way a remote ends up driving nothing.
        const slides = addArea(KEYING_AREA_PRIORITY.slides, false);
        slides.element.focus();

        press(0);
        press(100);
        expect(press(200).isSpent).toBe(true);
        expect(document.activeElement).toBe(flow.element);
    });

    test('a focused area that answers the key is never pulled away from', () => {
        addArea(KEYING_AREA_PRIORITY.presentingFlow, true);
        const slides = addArea(KEYING_AREA_PRIORITY.slides, true);
        const outside = addFocusable('button');

        // Stepping quickly through a song, with a run sheet open behind it.
        slides.element.focus();
        for (const timeStamp of [0, 100, 200, 300]) {
            expect(press(timeStamp).isSpent).toBe(false);
        }
        expect(document.activeElement).toBe(slides.element);

        // And it CLEARS the count: two unanswered presses before it and one
        // after are not three in a row.
        outside.focus();
        press(1000);
        press(1100);
        slides.element.focus();
        press(1200);
        outside.focus();
        expect(press(1300).isSpent).toBe(false);
        expect(document.activeElement).toBe(outside);
    });

    test('focus inside an area counts as the area', () => {
        const slides = addArea(KEYING_AREA_PRIORITY.slides, true);
        addArea(KEYING_AREA_PRIORITY.presentingFlow, true);
        const insideButton = addFocusable('button', slides.element);
        insideButton.focus();

        press(0);
        press(100);
        expect(press(200).isSpent).toBe(false);
        expect(document.activeElement).toBe(insideButton);
    });

    test('a press that is not a bare, single next key is not counted', () => {
        addArea(KEYING_AREA_PRIORITY.presentingFlow, true);
        const outside = addFocusable('button');
        outside.focus();

        const ignoredList: Record<string, unknown>[] = [
            { key: 'a' },
            { key: 'ArrowLeft' },
            { repeat: true },
            { defaultPrevented: true },
            { isComposing: true },
            { shiftKey: true },
            { ctrlKey: true },
            { altKey: true },
            { metaKey: true },
        ];
        for (const ignored of ignoredList) {
            for (const timeStamp of [0, 100, 200]) {
                expect(press(timeStamp, ignored).isSpent).toBe(false);
            }
            expect(document.activeElement).toBe(outside);
        }

        // Every next key the slides bind is one a remote can hand over with.
        for (const key of ['ArrowRight', 'ArrowDown', 'PageDown', ' ']) {
            outside.focus();
            press(0, { key });
            press(100, { key });
            expect(press(200, { key }).isSpent).toBe(true);
        }
    });

    test('a control that uses the key itself keeps it', () => {
        addArea(KEYING_AREA_PRIORITY.presentingFlow, true);
        const typingBox = addFocusable('input') as HTMLInputElement;
        const range = addFocusable('input') as HTMLInputElement;
        range.type = 'range';
        const radio = addFocusable('input') as HTMLInputElement;
        radio.type = 'radio';
        const textArea = addFocusable('textarea');
        const player = addFocusable('video');

        for (const element of [typingBox, range, radio, textArea, player]) {
            element.focus();
            for (const timeStamp of [0, 100, 200]) {
                expect(press(timeStamp).isSpent).toBe(false);
            }
            expect(document.activeElement).toBe(element);
        }

        // A checkbox does not: Space ticks it, but it is no place to be stuck.
        const checkbox = addFocusable('input') as HTMLInputElement;
        checkbox.type = 'checkbox';
        checkbox.focus();
        press(0);
        press(100);
        expect(press(200).isSpent).toBe(true);
    });

    test('a modal or a menu on top keeps the keyboard', () => {
        const flow = addArea(KEYING_AREA_PRIORITY.presentingFlow, true);
        const outside = addFocusable('button');
        outside.focus();

        KeyboardEventListener.addLayer('popup');
        for (const timeStamp of [0, 100, 200]) {
            expect(press(timeStamp).isSpent).toBe(false);
        }
        expect(document.activeElement).toBe(outside);

        // Nor is an unowned keyboard handed anywhere from behind it.
        outside.blur();
        expect(document.activeElement).toBe(document.body);
        press(300);
        expect(document.activeElement).toBe(document.body);

        KeyboardEventListener.removeLayer('popup');
        press(400);
        expect(document.activeElement).toBe(flow.element);
    });
});
