// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    checkIsPdfFullWidthMock,
    getAllScreenManagersMock,
    screenSettingState,
    setIsPdfFullWidthMock,
} = vi.hoisted(() => {
    const screenSettingState = {
        isFullWidth: false,
        managers: [] as any[],
    };

    return {
        checkIsPdfFullWidthMock: vi.fn(() => screenSettingState.isFullWidth),
        getAllScreenManagersMock: vi.fn(() => screenSettingState.managers),
        screenSettingState,
        setIsPdfFullWidthMock: vi.fn(),
    };
});

vi.mock('../lang/langHelpers', () => ({
    tran: (value: string) => value,
}));

vi.mock('../_screen/managers/screenManagerHelpers', () => ({
    getAllScreenManagers: getAllScreenManagersMock,
}));

vi.mock('../_screen/managers/ScreenVaryAppDocumentManager', () => ({
    checkIsPdfFullWidth: checkIsPdfFullWidthMock,
    setIsPdfFullWidth: setIsPdfFullWidthMock,
}));

import PageBaseAppearanceSettingComp from './PageBaseAppearanceSettingComp';
import VirtualBGColorSettingComp from './VirtualBGColorSettingComp';

function setInputValue(input: HTMLInputElement, value: string) {
    const descriptor = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    );
    descriptor?.set?.call(input, value);
}

describe('screen setting coverage', () => {
    let container: HTMLDivElement;
    let root: Root;
    let managerWithSlideData: { varySlideData: Record<string, unknown> | null };

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        document.body.innerHTML = '';
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);

        managerWithSlideData = {
            varySlideData: {
                id: 7,
                isRenderFullWidth: false,
                title: 'Preview',
            },
        };
        screenSettingState.isFullWidth = false;
        screenSettingState.managers = [
            { screenVaryAppDocumentManager: { varySlideData: null } },
            { screenVaryAppDocumentManager: managerWithSlideData },
        ];
    });

    afterEach(async () => {
        await act(async () => {
            root.unmount();
        });
        container.remove();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
    });

    test('updates page-base width settings and forwards preview background changes', async () => {
        const onDocxPreviewBackgroundColorChange = vi.fn();

        await act(async () => {
            root.render(
                <PageBaseAppearanceSettingComp
                    docxPreviewBackgroundColor="#123456"
                    onDocxPreviewBackgroundColorChange={
                        onDocxPreviewBackgroundColorChange
                    }
                />,
            );
        });

        const notFullWidthInput = container.querySelector(
            '#setting-not-full-width',
        ) as HTMLInputElement | null;
        const fullWidthInput = container.querySelector(
            '#setting-full-width',
        ) as HTMLInputElement | null;
        const colorInput = container.querySelector(
            'input[type="color"]',
        ) as HTMLInputElement | null;

        expect(container.textContent).toContain('On Screen Width:');
        expect(container.textContent).toContain('Not Full Width');
        expect(container.textContent).toContain('Full Width');
        expect(notFullWidthInput?.checked).toBe(true);
        expect(fullWidthInput?.checked).toBe(false);
        expect(colorInput?.value).toBe('#123456');

        await act(async () => {
            fullWidthInput?.dispatchEvent(
                new MouseEvent('click', { bubbles: true }),
            );
        });

        expect(setIsPdfFullWidthMock).toHaveBeenCalledWith(true);
        expect(managerWithSlideData.varySlideData).toEqual({
            id: 7,
            isRenderFullWidth: true,
            title: 'Preview',
        });
        expect(fullWidthInput?.checked).toBe(true);

        if (!(colorInput instanceof HTMLInputElement)) {
            throw new TypeError('Missing preview color input');
        }
        setInputValue(colorInput, '#abcdef');

        await act(async () => {
            colorInput.dispatchEvent(new Event('input', { bubbles: true }));
            colorInput.dispatchEvent(new Event('change', { bubbles: true }));
        });

        expect(onDocxPreviewBackgroundColorChange).toHaveBeenCalledWith(
            '#ABCDEF',
        );

        await act(async () => {
            notFullWidthInput?.dispatchEvent(
                new MouseEvent('click', { bubbles: true }),
            );
        });

        expect(setIsPdfFullWidthMock).toHaveBeenCalledWith(false);
        expect(managerWithSlideData.varySlideData).toEqual({
            id: 7,
            isRenderFullWidth: false,
            title: 'Preview',
        });
        expect(notFullWidthInput?.checked).toBe(true);
    });

    test('opens, changes, and clears the virtual preview background color', async () => {
        const onDocxPreviewBackgroundColorChange = vi.fn();

        await act(async () => {
            root.render(
                <VirtualBGColorSettingComp
                    onDocxPreviewBackgroundColorChange={
                        onDocxPreviewBackgroundColorChange
                    }
                />,
            );
        });

        const colorInput = container.querySelector(
            'input[type="color"]',
        ) as HTMLInputElement | null;
        const colorButton = container.querySelector(
            'button[title="Choose DOCX Preview Background (right click to clear)"]',
        ) as HTMLButtonElement | null;

        if (!(colorInput instanceof HTMLInputElement)) {
            throw new TypeError('Missing color input');
        }
        const clickSpy = vi.spyOn(colorInput, 'click');

        expect(colorInput.value).toBe('#ffffff');
        expect(container.querySelector('.bi-x-lg')).toBeNull();

        await act(async () => {
            colorButton?.dispatchEvent(
                new MouseEvent('click', { bubbles: true, cancelable: true }),
            );
        });

        expect(clickSpy).toHaveBeenCalledTimes(1);

        setInputValue(colorInput, '#00ff99');
        await act(async () => {
            colorInput.dispatchEvent(new Event('input', { bubbles: true }));
            colorInput.dispatchEvent(new Event('change', { bubbles: true }));
        });

        expect(onDocxPreviewBackgroundColorChange).toHaveBeenCalledWith(
            '#00FF99',
        );

        await act(async () => {
            colorButton?.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });

        expect(onDocxPreviewBackgroundColorChange).toHaveBeenCalledWith('');

        await act(async () => {
            root.render(
                <VirtualBGColorSettingComp
                    docxPreviewBackgroundColor="#00FF00"
                    onDocxPreviewBackgroundColorChange={
                        onDocxPreviewBackgroundColorChange
                    }
                />,
            );
        });

        const clearButton = container.querySelector('.bi-x-lg');

        expect(clearButton).not.toBeNull();

        await act(async () => {
            clearButton?.dispatchEvent(
                new MouseEvent('click', { bubbles: true, cancelable: true }),
            );
        });

        expect(onDocxPreviewBackgroundColorChange).toHaveBeenLastCalledWith('');
    });
});
