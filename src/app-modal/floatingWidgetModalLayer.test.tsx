// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { settingStore } = vi.hoisted(() => ({
    settingStore: new Map<string, string>(),
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => settingStore.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        settingStore.set(key, value);
    },
}));

vi.mock('../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: 'dark' }),
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

import FloatingWidgetComp from './FloatingWidgetComp';
import { ModalComp } from './ModalComp';

const ABOVE_MODAL_CLASS = 'floating-widget--above-modal';

describe('floating widget modal layer', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        settingStore.clear();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => {
            root?.unmount();
        });
        container?.remove();
        container = null;
        root = null;
    });

    function renderWidget(children: any) {
        act(() => {
            root?.render(children);
        });
        return document.querySelector('.floating-widget')!;
    }

    test('a widget on its own stays in the band below the modal layer', () => {
        const widget = renderWidget(
            <FloatingWidgetComp onClose={() => {}} options={{}}>
                {'body'}
            </FloatingWidgetComp>,
        );

        expect(widget.classList.contains(ABOVE_MODAL_CLASS)).toBe(false);
    });

    test('a widget rendered by a modal is raised above that modal', () => {
        const widget = renderWidget(
            <ModalComp>
                <FloatingWidgetComp onClose={() => {}} options={{}}>
                    {'body'}
                </FloatingWidgetComp>
            </ModalComp>,
        );

        expect(widget.classList.contains(ABOVE_MODAL_CLASS)).toBe(true);
    });

    // What the window-level record detail panels rely on: they are mounted
    // outside every modal, yet are opened from inside one.
    test('`isAboveModal` raises a widget with no modal in its tree', () => {
        const widget = renderWidget(
            <FloatingWidgetComp
                onClose={() => {}}
                options={{ isAboveModal: true }}
            >
                {'body'}
            </FloatingWidgetComp>,
        );

        expect(widget.classList.contains(ABOVE_MODAL_CLASS)).toBe(true);
    });
});
