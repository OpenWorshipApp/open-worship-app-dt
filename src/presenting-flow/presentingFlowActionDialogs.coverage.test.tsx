// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const fake = vi.hoisted(() => ({
    showInput: vi.fn(),
    showToast: vi.fn(),
    screens: [{ screenId: 3 }, { screenId: 1 }],
}));

vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppInput: fake.showInput,
}));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: fake.showToast,
}));
vi.mock('../_screen/managers/screenManagerBaseHelpers', () => ({
    getAllScreenManagerBases: () => fake.screens,
}));
vi.mock('../_screen/preview/screenIdColorHelpers', () => ({
    genColorFromScreenId: (id: number) => `color-${id}`,
}));
vi.mock('../helper/appHooks', async () => {
    const React = await vi.importActual<typeof import('react')>('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = React.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../server/appProvider', () => ({
    default: {
        pathUtils: { sep: '/', join: (...parts: string[]) => parts.join('/') },
        messageUtils: { listenForData: () => {}, sendDataSync: () => null },
        systemUtils: { isDev: false },
    },
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: () => null,
    setSetting: () => {},
}));
vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: { getItem: () => null, setItem: () => {} },
}));

import {
    ActionScreenIdsInputComp,
    askForPresentingFlowActionArming,
    askForPresentingFlowActionScreenIds,
} from './presentingFlowActionArmingHelpers';
import { askForPresentingFlowMediaControl } from './presentingFlowMediaControlDialogHelpers';
import type {
    PresentingFlowRunActionType,
    PresentingFlowScreenActionType,
} from './presentingFlowActionHelpers';

const INTERVAL = {
    label: 'Next: Interval',
    number: { label: 'Seconds', defaultValue: 10 },
    canBeTimeArmed: false,
    canBeKeyArmed: false,
} as PresentingFlowRunActionType;
const TIMEOUT = {
    ...INTERVAL,
    label: 'Next: Timeout',
    canBeTimeArmed: true,
} as PresentingFlowRunActionType;
const KEYBOARD = {
    ...INTERVAL,
    label: 'Next: Keyboard Event',
    number: null,
    canBeKeyArmed: true,
} as PresentingFlowRunActionType;
const SCREEN = { label: 'Screen: Show' } as PresentingFlowScreenActionType;

describe('presenting-flow action dialogs', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        fake.showInput.mockReset();
        fake.showToast.mockReset();
        fake.screens = [{ screenId: 3 }, { screenId: 1 }];
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });
    afterEach(() => {
        act(() => root.unmount());
        container.remove();
    });

    function prepareDialog() {
        let resolveDialog: (ok: boolean) => void = () => {};
        fake.showInput.mockImplementation((_title, content) => {
            act(() => root.render(content));
            return new Promise<boolean>((resolve) => {
                resolveDialog = resolve;
            });
        });
        return async (ok: boolean) => {
            await act(async () => resolveDialog(ok));
        };
    }

    function changeValue(
        control: HTMLInputElement | HTMLSelectElement,
        value: string,
    ) {
        const prototype =
            control instanceof HTMLSelectElement
                ? HTMLSelectElement.prototype
                : HTMLInputElement.prototype;
        act(() => {
            Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(
                control,
                value,
            );
            control.dispatchEvent(
                new Event(
                    control instanceof HTMLSelectElement ? 'change' : 'input',
                    { bubbles: true },
                ),
            );
        });
    }

    function controlInGroup<T extends Element>(
        label: string,
        selector: string,
    ) {
        const group = [...container.querySelectorAll('.input-group')].find(
            (one) => one.textContent?.includes(label),
        );
        expect(group).toBeDefined();
        const control = group!.querySelector<T>(selector);
        expect(control).not.toBeNull();
        return control!;
    }

    test('an interval opens on its existing seconds and rejects zero', async () => {
        const confirm = prepareDialog();
        const pending = askForPresentingFlowActionArming(INTERVAL, {
            actionNumber: 25,
        });
        expect(container.querySelector<HTMLInputElement>('input')?.value).toBe(
            '25',
        );
        changeValue(container.querySelector('input')!, '0');
        await confirm(true);
        expect(await pending).toBeNull();
        expect(fake.showToast).toHaveBeenCalledWith(
            'Next: Interval',
            'Please enter a number greater than 0',
        );
    });

    test('an interval accepts edited seconds and cancellation writes nothing', async () => {
        const confirm = prepareDialog();
        const pending = askForPresentingFlowActionArming(INTERVAL);
        changeValue(container.querySelector('input')!, '12');
        await confirm(true);
        expect(await pending).toEqual({ actionNumber: 12 });
        const cancelled = askForPresentingFlowActionArming(INTERVAL);
        await confirm(false);
        expect(await cancelled).toBeNull();
    });

    test('timeout switches from seconds to a time of day', async () => {
        const confirm = prepareDialog();
        const pending = askForPresentingFlowActionArming(TIMEOUT, {
            actionNumber: 30,
        });
        changeValue(container.querySelector('select')!, 'time');
        expect(container.querySelector<HTMLInputElement>('input')?.type).toBe(
            'time',
        );
        changeValue(container.querySelector('input')!, '07:05');
        await confirm(true);
        expect(await pending).toEqual({ actionTime: '07:05' });
    });

    test('keyboard arming accepts a modified key and rejects a bare key', async () => {
        const confirm = prepareDialog();
        const pending = askForPresentingFlowActionArming(KEYBOARD);
        const input = container.querySelector<HTMLInputElement>('input')!;
        act(() => {
            input.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'a',
                    code: 'KeyA',
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
        expect(container.textContent).toContain('Hold Ctrl or Shift');
        act(() => {
            input.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'a',
                    code: 'KeyA',
                    ctrlKey: true,
                    shiftKey: true,
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
        expect(input.value).toBe('Ctrl+Shift+A');
        await confirm(true);
        expect(await pending).toEqual({ actionKey: 'Ctrl+Shift+A' });
    });

    test('screen selection requires at least one screen', async () => {
        fake.showInput.mockResolvedValue(true);
        expect(await askForPresentingFlowActionScreenIds(SCREEN)).toBeNull();
        expect(fake.showToast).toHaveBeenCalledWith(
            'Screen: Show',
            'Please choose at least one screen',
        );
    });

    test('screen action returns the checked screens in sorted order', async () => {
        const confirm = prepareDialog();
        const pending = askForPresentingFlowActionScreenIds(SCREEN, [3]);
        const checkboxes = container.querySelectorAll<HTMLInputElement>(
            'input[type="checkbox"]',
        );
        act(() => checkboxes[1].click());
        await confirm(true);
        expect(await pending).toEqual([1, 3]);
    });

    test('the checklist sorts selected screen ids and reports each toggle', () => {
        const onChange = vi.fn();
        act(() =>
            root.render(
                <ActionScreenIdsInputComp
                    defaultScreenIds={[3]}
                    onChange={onChange}
                />,
            ),
        );
        const checkboxes = container.querySelectorAll<HTMLInputElement>(
            'input[type="checkbox"]',
        );
        expect(checkboxes).toHaveLength(2);
        expect(checkboxes[0].checked).toBe(true);
        act(() => checkboxes[1].click());
        expect(onChange).toHaveBeenLastCalledWith([1, 3]);
        act(() => checkboxes[0].click());
        expect(onChange).toHaveBeenLastCalledWith([1]);
    });

    test('media control defaults to play with no optional settings', async () => {
        fake.showInput.mockResolvedValue(true);
        expect(await askForPresentingFlowMediaControl()).toEqual({
            mediaControl: { mode: 'play' },
            screenIds: [],
        });
        expect(fake.showInput.mock.calls[0][2]).toEqual({ enterToOk: false });
    });

    test('a media controller keeps only settings relevant to pause mode', async () => {
        const confirm = prepareDialog();
        const pending = askForPresentingFlowMediaControl({
            mode: 'play',
            startAtSecond: 10,
            pauseAtSecond: 70,
        });
        changeValue(
            controlInGroup<HTMLSelectElement>('Action', 'select'),
            'pause',
        );
        expect(container.textContent).not.toContain('Media Start At');
        expect(container.textContent).not.toContain('Then Pause');
        changeValue(
            controlInGroup<HTMLInputElement>('Delay Before', 'input'),
            '3',
        );
        await confirm(true);
        expect(await pending).toEqual({
            mediaControl: { mode: 'pause', delaySecond: 3 },
            screenIds: [],
        });
    });

    test('media playback captures stop point, volume, speed and screen pin', async () => {
        const confirm = prepareDialog();
        const pending = askForPresentingFlowMediaControl(null, [3]);
        changeValue(
            controlInGroup<HTMLInputElement>('Delay Before', 'input'),
            '2',
        );
        changeValue(
            controlInGroup<HTMLInputElement>('Media Start At', 'input'),
            '10',
        );
        changeValue(
            controlInGroup<HTMLSelectElement>('Then Pause', 'select'),
            'at',
        );
        changeValue(
            controlInGroup<HTMLInputElement>('Media Pause At', 'input'),
            '70',
        );
        act(() =>
            container
                .querySelector<HTMLInputElement>('input[title="Set Volume"]')!
                .click(),
        );
        changeValue(
            controlInGroup<HTMLInputElement>('Volume', 'input[type="number"]'),
            '45',
        );
        act(() =>
            container
                .querySelector<HTMLInputElement>('input[title="Set Speed"]')!
                .click(),
        );
        changeValue(
            controlInGroup<HTMLSelectElement>('Speed', 'select'),
            '1.5',
        );
        const screens = container.querySelectorAll<HTMLInputElement>(
            'input[type="checkbox"]:not([title])',
        );
        act(() => screens[1].click());
        await confirm(true);
        expect(await pending).toEqual({
            mediaControl: {
                mode: 'play',
                delaySecond: 2,
                startAtSecond: 10,
                pauseAtSecond: 70,
                volume: 45,
                speed: 1.5,
            },
            screenIds: [1, 3],
        });
    });

    test('media control rejects a stop point before its start point', async () => {
        const confirm = prepareDialog();
        const pending = askForPresentingFlowMediaControl();
        changeValue(
            controlInGroup<HTMLInputElement>('Media Start At', 'input'),
            '10',
        );
        changeValue(
            controlInGroup<HTMLSelectElement>('Then Pause', 'select'),
            'at',
        );
        changeValue(
            controlInGroup<HTMLInputElement>('Media Pause At', 'input'),
            '5',
        );
        await confirm(true);
        expect(await pending).toBeNull();
        expect(fake.showToast).toHaveBeenCalledWith(
            'Slide: Media Control',
            'The stop point must be after the start point',
        );
    });
});
