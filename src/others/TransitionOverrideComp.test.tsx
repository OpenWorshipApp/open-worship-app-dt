// @vitest-environment jsdom

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    showAppInput: vi.fn(),
}));

vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppInput: state.showAppInput,
}));

import TransitionOverrideComp, {
    genTransitionMenuItem,
    getTransitionIconName,
    showTransitionOverrideDialog,
    toTransitionLabel,
    type TransitionInheritedType,
} from './TransitionOverrideComp';

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

function getCheckbox() {
    return host.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
}

function getEffectButton(label: string) {
    return host.querySelector<HTMLButtonElement>(
        `button[aria-label="${label}"]`,
    )!;
}

function getPressedLabels() {
    return Array.from(
        host.querySelectorAll<HTMLButtonElement>('button[aria-pressed="true"]'),
    ).map((button) => button.getAttribute('aria-label'));
}

const SCREEN_ZOOM: TransitionInheritedType = {
    effect: 'zoom',
    sourceLabel: 'Screen setting',
};

describe('transition labels and icons', () => {
    test('an effect names its bootstrap icon, and null falls back to fade', () => {
        expect(getTransitionIconName('zoom')).toBe('arrows-fullscreen');
        expect(getTransitionIconName('none')).toBe('ban');
        expect(getTransitionIconName(null)).toBe('shadows');
    });

    test('each effect says what it does, and null says the screens disagree', () => {
        expect(toTransitionLabel('move')).toBe('Slide In');
        expect(toTransitionLabel('none')).toBe('No Transition');
        expect(toTransitionLabel(null)).toBe('Varies by screen');
    });
});

describe('TransitionOverrideComp', () => {
    test('unticked, it shows what it follows and its buttons stay disabled', async () => {
        const onChange = vi.fn();
        await act(async () =>
            root.render(
                <TransitionOverrideComp
                    value={undefined}
                    inherited={SCREEN_ZOOM}
                    onChange={onChange}
                    choicesClassName="extra-choices"
                />,
            ),
        );
        expect(getCheckbox().checked).toBe(false);
        const group = host.querySelector('[role="group"]')!;
        expect(group.className).toContain('extra-choices');
        expect(group.getAttribute('title')).toBe(
            'Follows: Screen setting (Zoom)',
        );
        const buttons = Array.from(group.querySelectorAll('button'));
        expect(buttons).toHaveLength(4);
        expect(buttons.every((button) => button.disabled)).toBe(true);
        // The inherited effect is the one shown pressed.
        expect(getPressedLabels()).toEqual(['Zoom']);
        expect(host.querySelector('small')!.textContent).toBe(
            'Follows: Screen setting',
        );
        // Not "varies": the screens agree on one effect.
        expect(host.querySelector('.bi-question-circle')).toBeNull();
        expect(onChange).not.toHaveBeenCalled();
    });

    test('ticking starts from the inherited effect', async () => {
        const onChange = vi.fn();
        await act(async () =>
            root.render(
                <TransitionOverrideComp
                    value={undefined}
                    inherited={SCREEN_ZOOM}
                    onChange={onChange}
                />,
            ),
        );
        await act(async () => getCheckbox().click());
        expect(onChange).toHaveBeenCalledExactlyOnceWith('zoom');
    });

    test('ticking while the screens disagree starts from fade, and says it varies', async () => {
        const onChange = vi.fn();
        await act(async () =>
            root.render(
                <TransitionOverrideComp
                    value={undefined}
                    inherited={{ effect: null, sourceLabel: 'Screen setting' }}
                    onChange={onChange}
                />,
            ),
        );
        const varies = host.querySelector(
            '[aria-label="Varies by screen"]',
        ) as HTMLElement;
        expect(varies).not.toBeNull();
        expect(varies.querySelector('.bi-question-circle')).not.toBeNull();
        expect(getPressedLabels()).toEqual([]);
        expect(
            host.querySelector('[role="group"]')!.getAttribute('title'),
        ).toBe('Follows: Screen setting (Varies by screen)');
        await act(async () => getCheckbox().click());
        expect(onChange).toHaveBeenCalledExactlyOnceWith('fade');
    });

    test('ticked, a button picks its effect and unticking clears it', async () => {
        const onChange = vi.fn();
        await act(async () =>
            root.render(
                <TransitionOverrideComp
                    value="move"
                    inherited={SCREEN_ZOOM}
                    onChange={onChange}
                />,
            ),
        );
        expect(getCheckbox().checked).toBe(true);
        const group = host.querySelector('[role="group"]')!;
        expect(group.getAttribute('title')).toBe('Transition');
        // Its own value is pressed, not the inherited one.
        expect(getPressedLabels()).toEqual(['Slide In']);
        expect(getEffectButton('Slide In').className).toContain('btn-info');
        expect(getEffectButton('Zoom').className).toContain('btn-outline-info');
        // No "Follows" line while it has its own.
        expect(host.querySelector('small')).toBeNull();

        await act(async () => getEffectButton('Fade').click());
        expect(onChange).toHaveBeenLastCalledWith('fade');
        await act(async () => getCheckbox().click());
        expect(onChange).toHaveBeenLastCalledWith(undefined);
        expect(onChange).toHaveBeenCalledTimes(2);
    });

    test('compact rows leave the "Follows" line to their own tooltip', async () => {
        await act(async () =>
            root.render(
                <TransitionOverrideComp
                    value={undefined}
                    inherited={SCREEN_ZOOM}
                    onChange={vi.fn()}
                    isCompact
                />,
            ),
        );
        expect(host.querySelector('small')).toBeNull();
        expect(
            host.querySelector('[role="group"]')!.getAttribute('title'),
        ).toBe('Follows: Screen setting (Zoom)');
    });
});

describe('showTransitionOverrideDialog', () => {
    function captureDialog() {
        let resolveInput: (isOk: boolean) => void = () => {};
        let body: ReactElement | null = null;
        state.showAppInput.mockImplementation(
            (_title: string, element: ReactElement) => {
                body = element;
                return new Promise<boolean>((resolve) => {
                    resolveInput = resolve;
                });
            },
        );
        return {
            getBody: () => body!,
            answer: (isOk: boolean) => resolveInput(isOk),
        };
    }

    test('OK returns the effect chosen in the dialog', async () => {
        const dialog = captureDialog();
        const promise = showTransitionOverrideDialog({
            title: 'Slide transition',
            value: undefined,
            inherited: SCREEN_ZOOM,
            description: 'Every slide comes in with it.',
        });
        expect(state.showAppInput).toHaveBeenCalledWith(
            'Slide transition',
            expect.anything(),
            { escToCancel: true, enterToOk: true },
        );
        await act(async () => root.render(dialog.getBody()));
        expect(host.querySelector('small')!.textContent).toBe(
            'Every slide comes in with it.',
        );
        // Ticking starts from the inherited effect, then a button changes it;
        // the body keeps its own state so the buttons follow.
        await act(async () => getCheckbox().click());
        expect(getPressedLabels()).toEqual(['Zoom']);
        await act(async () => getEffectButton('No Transition').click());
        expect(getPressedLabels()).toEqual(['No Transition']);
        dialog.answer(true);
        await expect(promise).resolves.toEqual({ value: 'none' });
    });

    test('OK with the box left unticked removes the override', async () => {
        const dialog = captureDialog();
        const promise = showTransitionOverrideDialog({
            title: 'Slides preview transition',
            value: 'fade',
            inherited: SCREEN_ZOOM,
        });
        await act(async () => root.render(dialog.getBody()));
        // No description given: none drawn.
        expect(host.querySelector('small.text-muted')).toBeNull();
        expect(getCheckbox().checked).toBe(true);
        await act(async () => getCheckbox().click());
        expect(getCheckbox().checked).toBe(false);
        dialog.answer(true);
        await expect(promise).resolves.toEqual({});
    });

    test('OK without touching anything keeps the value it opened with', async () => {
        const dialog = captureDialog();
        const promise = showTransitionOverrideDialog({
            title: 'Slide transition',
            value: 'move',
            inherited: SCREEN_ZOOM,
        });
        dialog.answer(true);
        await expect(promise).resolves.toEqual({ value: 'move' });
    });

    test('Cancel changes nothing', async () => {
        const dialog = captureDialog();
        const promise = showTransitionOverrideDialog({
            title: 'Slide transition',
            value: 'move',
            inherited: SCREEN_ZOOM,
        });
        dialog.answer(false);
        await expect(promise).resolves.toBeNull();
    });
});

describe('genTransitionMenuItem', () => {
    test('with no own effect the row says what it follows, uncoloured', async () => {
        const onSelect = vi.fn();
        const item = genTransitionMenuItem({
            value: undefined,
            inherited: SCREEN_ZOOM,
            onSelect,
        });
        expect(item.menuElement).toBe('Transition: Zoom (Screen setting)');
        expect(item.title).toBe('Transition');
        expect(item.onSelect).toBe(onSelect);
        await act(async () => root.render(item.childBefore as ReactElement));
        const icon = host.querySelector('i')!;
        expect(icon.className).toBe('bi bi-arrows-fullscreen');
        expect(icon.style.color).toBe('var(--bs-info-text-emphasis)');
    });

    test('an own effect is named alone and its icon is highlighted', async () => {
        const item = genTransitionMenuItem({
            value: 'none',
            inherited: SCREEN_ZOOM,
            onSelect: vi.fn(),
        });
        expect(item.menuElement).toBe('Transition: No Transition');
        await act(async () => root.render(item.childBefore as ReactElement));
        const icon = host.querySelector('i')!;
        expect(icon.className).toBe('bi bi-ban');
        expect(icon.style.color).toBe('var(--bs-warning-text-emphasis)');
    });

    test('screens that disagree read as "varies" with the fade icon', () => {
        const item = genTransitionMenuItem({
            value: undefined,
            inherited: { effect: null, sourceLabel: 'Slides preview' },
            onSelect: vi.fn(),
        });
        expect(item.menuElement).toBe(
            'Transition: Varies by screen (Slides preview)',
        );
    });
});
