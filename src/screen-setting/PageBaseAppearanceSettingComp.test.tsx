// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

type VarySlideDataType = null | Record<string, unknown>;

const state = vi.hoisted(() => ({
    isPdfFullWidth: false,
    setIsPdfFullWidth: vi.fn(),
    managers: [] as {
        screenVaryAppDocumentManager: { varySlideData: VarySlideDataType };
    }[],
}));

vi.mock('./PageBaseAppearanceSettingComp.scss', () => ({}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: (current: unknown) => {
            const ref = useRef(current);
            ref.current = current;
            return ref;
        },
    };
});
vi.mock('../_screen/managers/screenManagerHelpers', () => ({
    getAllScreenManagers: () => state.managers,
}));
vi.mock('../_screen/managers/ScreenVaryAppDocumentManager', () => ({
    checkIsPdfFullWidth: () => state.isPdfFullWidth,
    setIsPdfFullWidth: (isFullWidth: boolean) => {
        state.isPdfFullWidth = isFullWidth;
        state.setIsPdfFullWidth(isFullWidth);
    },
}));

import PageBaseAppearanceSettingComp from './PageBaseAppearanceSettingComp';

let host: HTMLDivElement;
let root: Root;

function render(color: string | null, onChange = vi.fn()) {
    act(() => {
        root.render(
            <PageBaseAppearanceSettingComp
                docxPreviewBackgroundColor={color}
                onDocxPreviewBackgroundColorChange={onChange}
            />,
        );
    });
    return onChange;
}

function radio(id: string) {
    return host.querySelector<HTMLInputElement>(`#${id}`)!;
}

function pickerButton() {
    return host.querySelector<HTMLButtonElement>('.docx-bg-color button')!;
}

function changeColor(value: string) {
    const input = host.querySelector<HTMLInputElement>('input[type="color"]')!;
    const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    )!.set!;
    act(() => {
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.isPdfFullWidth = false;
    state.managers = [
        { screenVaryAppDocumentManager: { varySlideData: { id: 1 } } },
        { screenVaryAppDocumentManager: { varySlideData: null } },
    ];
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('page appearance on screen', () => {
    test('switches PDF pages to full width, saving it and redrawing every screen showing a page', () => {
        render(null);
        expect(radio('setting-not-full-width').checked).toBe(true);

        act(() => {
            radio('setting-full-width').click();
        });

        expect(state.setIsPdfFullWidth).toHaveBeenCalledWith(true);
        expect(radio('setting-full-width').checked).toBe(true);
        expect(
            state.managers[0].screenVaryAppDocumentManager.varySlideData,
        ).toEqual({ id: 1, isRenderFullWidth: true });
        // A screen showing nothing is left alone.
        expect(
            state.managers[1].screenVaryAppDocumentManager.varySlideData,
        ).toBeNull();

        act(() => {
            radio('setting-not-full-width').click();
        });
        expect(state.setIsPdfFullWidth).toHaveBeenLastCalledWith(false);
        expect(
            state.managers[0].screenVaryAppDocumentManager.varySlideData,
        ).toEqual({ id: 1, isRenderFullWidth: false });
    });

    test('starts on full width when that was saved', () => {
        state.isPdfFullWidth = true;

        render(null);

        expect(radio('setting-full-width').checked).toBe(true);
    });

    test('a picked preview colour is reported in capitals and painted behind every shown page', () => {
        const onChange = render(null);

        changeColor('#a1b2c3');

        expect(onChange).toHaveBeenCalledWith('#A1B2C3');
        expect(
            state.managers[0].screenVaryAppDocumentManager.varySlideData,
        ).toEqual({ id: 1, virtualBackgroundColor: '#A1B2C3' });
    });

    test('the swatch opens the colour picker, and a right click clears the colour', () => {
        const onChange = render(null);
        const input = host.querySelector<HTMLInputElement>(
            'input[type="color"]',
        )!;
        const openPicker = vi.spyOn(input, 'click');

        act(() => {
            pickerButton().click();
        });
        expect(openPicker).toHaveBeenCalledOnce();
        // No colour yet: the swatch is drawn faint and offers no clear mark.
        expect(input.value).toBe('#ffffff');
        expect(host.querySelector('.bi-x-lg')).toBeNull();

        act(() => {
            pickerButton().dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            );
        });
        expect(onChange).toHaveBeenCalledWith('');
        expect(
            state.managers[0].screenVaryAppDocumentManager.varySlideData,
        ).toEqual({ id: 1, virtualBackgroundColor: null });
    });

    test('with a colour set, the clear mark clears it without opening the picker', () => {
        const onChange = render('#112233');
        const input = host.querySelector<HTMLInputElement>(
            'input[type="color"]',
        )!;
        const openPicker = vi.spyOn(input, 'click');
        expect(
            host.querySelector<HTMLElement>('.bi-record-circle')!.style.color,
        ).toBe('rgb(17, 34, 51)');

        act(() => {
            host.querySelector<HTMLElement>('.bi-x-lg')!.click();
        });

        expect(onChange).toHaveBeenCalledWith('');
        expect(openPicker).not.toHaveBeenCalled();
    });
});
