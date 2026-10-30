// @vitest-environment jsdom

import type { ReactNode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    settings: new Map<string, string>(),
}));

vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => state.settings.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        state.settings.set(key, value);
    },
}));
vi.mock('../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: 'dark' }),
}));
vi.mock('../app-modal/FloatingWidgetComp', () => ({
    default: ({
        title,
        widgetName,
        onClose,
        children,
    }: {
        title: string;
        widgetName: string;
        onClose: () => void;
        children: ReactNode;
    }) => (
        <section data-widget-name={widgetName}>
            <h2>{title}</h2>
            <button type="button" className="widget-close" onClick={onClose}>
                close
            </button>
            {children}
        </section>
    ),
}));
vi.mock('./BibleCustomStyleComp', () => ({
    default: () => <p className="style-panel">panel</p>,
}));

import BibleCustomStyleFloatingComp from './BibleCustomStyleFloatingComp';
import BibleCustomStyleFloatingToggleComp from './BibleCustomStyleFloatingToggleComp';

let host: HTMLDivElement;
let root: Root;

function toggles() {
    return [
        ...host.querySelectorAll<HTMLButtonElement>(
            'button[aria-label="Bible Properties"]',
        ),
    ];
}

function widget() {
    return document.body.querySelector(
        '.app-floating-widget-portal section[data-widget-name="Bible Properties"]',
    );
}

beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.settings.clear();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    await act(async () => {
        root.render(
            <>
                <BibleCustomStyleFloatingToggleComp />
                <BibleCustomStyleFloatingToggleComp />
                <BibleCustomStyleFloatingComp />
            </>,
        );
    });
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('Bible Properties floating panel', () => {
    test('opens one panel from any toggle, keeps every toggle in step, and closes from the panel', async () => {
        expect(widget()).toBeNull();
        expect(toggles().map((button) => button.className)).toEqual([
            'btn btn-sm btn-secondary',
            'btn btn-sm btn-secondary',
        ]);

        await act(async () => {
            toggles()[1].click();
        });
        await vi.waitFor(() => {
            expect(document.body.querySelector('.style-panel')).not.toBeNull();
        });

        expect(state.settings.get('bible-custom-style-floating')).toBe('true');
        expect(
            document.body.querySelectorAll('.app-floating-widget-portal'),
        ).toHaveLength(1);
        expect(widget()?.querySelector('h2')?.textContent).toBe(
            'Bible Properties',
        );
        expect(
            widget()
                ?.closest('.app-floating-widget-portal')
                ?.getAttribute('data-bs-theme'),
        ).toBe('dark');
        expect(toggles().map((button) => button.className)).toEqual([
            'btn btn-sm btn-info',
            'btn btn-sm btn-info',
        ]);

        act(() => {
            widget()!
                .querySelector<HTMLButtonElement>('.widget-close')!
                .click();
        });
        expect(widget()).toBeNull();
        expect(state.settings.get('bible-custom-style-floating')).toBe('false');
        expect(toggles()[0].className).toBe('btn btn-sm btn-secondary');
    });

    test('a second press of a toggle closes the panel it opened', async () => {
        await act(async () => {
            toggles()[0].click();
        });
        expect(widget()).not.toBeNull();

        act(() => {
            toggles()[0].click();
        });

        expect(widget()).toBeNull();
    });
});
