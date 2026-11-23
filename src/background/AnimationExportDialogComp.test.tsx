// @vitest-environment jsdom

import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    displays: [] as { id: number; bounds: { width: number; height: number } }[],
    inputBody: null as ReactElement<any> | null,
    // Settles the popup as a press of OK (true) or Cancel (false) would.
    settle: null as ((isOk: boolean) => void) | null,
}));

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: vi.fn(),
    pathBasename: vi.fn(),
    pathJoin: vi.fn(),
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: () => null,
    setSetting: vi.fn(),
}));
vi.mock('../_screen/managers/screenHelpers', () => ({
    getAllDisplays: () => ({
        primaryDisplay: h.displays[0],
        displays: h.displays,
    }),
}));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppInput: (_title: string, body: ReactElement) => {
        h.inputBody = body;
        return new Promise<boolean>((resolve) => {
            h.settle = resolve;
        });
    },
}));

import {
    AnimationExportDialogBodyComp,
    askAnimationExportOptions,
} from './AnimationExportDialogComp';
import {
    DEFAULT_ANIMATION_EXPORT_OPTIONS,
    listAnimationExportSizes,
    type AnimationExportOptionsType,
} from './animationExportOptionHelpers';

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    h.displays = [];
    h.inputBody = null;
    h.settle = null;
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
});

async function render(element: ReactElement) {
    await act(async () => {
        root.render(element);
    });
}

function changeValue(
    element: HTMLInputElement | HTMLSelectElement,
    value: string,
) {
    const prototype =
        element instanceof HTMLSelectElement
            ? HTMLSelectElement.prototype
            : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(
        element,
        value,
    );
    element.dispatchEvent(new Event('change', { bubbles: true }));
}

function renderBody(
    kind: 'image' | 'video',
    initialOptions: AnimationExportOptionsType,
    onChange = vi.fn(),
) {
    return render(
        createElement(AnimationExportDialogBodyComp, {
            kind,
            initialOptions,
            sizes: listAnimationExportSizes([{ width: 1440, height: 900 }]),
            onChange,
        }),
    );
}

describe('AnimationExportDialogComp', () => {
    it('asks a picture its size only, a video its length and rate too', async () => {
        await renderBody('image', DEFAULT_ANIMATION_EXPORT_OPTIONS);
        expect(container.querySelector('[aria-label="Resolution"]')).not.toBe(
            null,
        );
        expect(container.querySelector('[aria-label="Frame Rate"]')).toBe(null);
        expect(container.textContent).not.toContain('Duration');
        await renderBody('video', DEFAULT_ANIMATION_EXPORT_OPTIONS);
        expect(container.querySelector('[aria-label="Frame Rate"]')).not.toBe(
            null,
        );
        expect(
            container.querySelector('[aria-label="Duration (Seconds)"]'),
        ).not.toBe(null);
    });

    it('offers the presets and the monitor sizes, then Custom', async () => {
        await renderBody('image', DEFAULT_ANIMATION_EXPORT_OPTIONS);
        const select = container.querySelector(
            '[aria-label="Resolution"]',
        ) as HTMLSelectElement;
        expect(
            [...select.options].map((option) => {
                return option.value;
            }),
        ).toEqual([
            '1280x720',
            '1920x1080',
            '2560x1440',
            '3840x2160',
            '1440x900',
            'custom',
        ]);
        expect(select.value).toBe('1920x1080');
        expect(container.querySelector('[aria-label="Width"]')).toBe(null);
    });

    it('says each change, and a size of its own opens Custom', async () => {
        const onChange = vi.fn();
        await renderBody('video', DEFAULT_ANIMATION_EXPORT_OPTIONS, onChange);
        const select = container.querySelector(
            '[aria-label="Resolution"]',
        ) as HTMLSelectElement;
        await act(async () => {
            changeValue(select, '1280x720');
        });
        expect(onChange).toHaveBeenLastCalledWith({
            ...DEFAULT_ANIMATION_EXPORT_OPTIONS,
            width: 1280,
            height: 720,
        });
        await act(async () => {
            changeValue(
                container.querySelector(
                    '[aria-label="Frame Rate"]',
                ) as HTMLSelectElement,
                '60',
            );
        });
        expect(onChange).toHaveBeenLastCalledWith(
            expect.objectContaining({ frameRate: 60 }),
        );
        await act(async () => {
            changeValue(select, 'custom');
        });
        const width = container.querySelector(
            '[aria-label="Width"]',
        ) as HTMLInputElement;
        expect(width).not.toBe(null);
        await act(async () => {
            changeValue(width, '1001');
        });
        expect(onChange).toHaveBeenLastCalledWith(
            expect.objectContaining({ width: 1001, height: 720 }),
        );
    });

    it('opens on Custom when the last size is not offered', async () => {
        await renderBody('image', {
            ...DEFAULT_ANIMATION_EXPORT_OPTIONS,
            width: 1000,
            height: 500,
        });
        expect(
            (
                container.querySelector(
                    '[aria-label="Resolution"]',
                ) as HTMLSelectElement
            ).value,
        ).toBe('custom');
        expect(
            (
                container.querySelector(
                    '[aria-label="Width"]',
                ) as HTMLInputElement
            ).value,
        ).toBe('1000');
    });

    it('answers what was chosen made valid, or null when cancelled', async () => {
        h.displays = [{ id: 1, bounds: { width: 1366, height: 768 } }];
        const asking = askAnimationExportOptions(
            'video',
            DEFAULT_ANIMATION_EXPORT_OPTIONS,
        );
        await vi.waitFor(() => {
            expect(h.inputBody).not.toBe(null);
        });
        expect(h.inputBody!.props.sizes).toContainEqual({
            width: 1366,
            height: 768,
        });
        h.inputBody!.props.onChange({
            width: 1001,
            height: 501,
            seconds: 9999,
            frameRate: 60,
        });
        h.settle!(true);
        expect(await asking).toEqual({
            width: 1000,
            height: 500,
            seconds: 300,
            frameRate: 60,
        });
        h.inputBody = null;
        const cancelled = askAnimationExportOptions(
            'image',
            DEFAULT_ANIMATION_EXPORT_OPTIONS,
        );
        await vi.waitFor(() => {
            expect(h.inputBody).not.toBe(null);
        });
        h.settle!(false);
        expect(await cancelled).toBe(null);
    });
});
