// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    initialTab,
    requestedTab,
    setSettingMock,
    getAIKeyFocusRequestMock,
    takeAIKeyFocusRequestMock,
    warnIfAnyBibleEditorDirtyMock,
} = vi.hoisted(() => ({
    initialTab: { value: 'g' },
    requestedTab: { value: null as 'g' | 'b' | 'o' | null },
    setSettingMock: vi.fn(),
    getAIKeyFocusRequestMock: vi.fn(() => null),
    takeAIKeyFocusRequestMock: vi.fn(),
    warnIfAnyBibleEditorDirtyMock: vi.fn(() => false),
}));

vi.mock('../helper/appHooks', async () => {
    const React = await import('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = React.useRef(value);
            ref.current = value;
            return ref;
        },
        useAppEffect: React.useEffect,
    };
});

vi.mock('../helper/settingHelpers', async () => {
    const React = await import('react');
    return {
        setSetting: setSettingMock,
        useStateSettingString: () => React.useState(initialTab.value),
    };
});

vi.mock('../helper/ai/aiKeyFocusHelpers', () => ({
    getAIKeyFocusRequest: getAIKeyFocusRequestMock,
    takeAIKeyFocusRequest: takeAIKeyFocusRequestMock,
}));

vi.mock('./settingHelpers', () => ({
    SETTING_SETTING_NAME: 'setting-tabs',
    takeSettingTabRequest: () => {
        const value = requestedTab.value;
        requestedTab.value = null;
        return value;
    },
}));

vi.mock('../others/TabRenderComp', () => ({
    default: ({ tabs, activeTabs, setActiveTab }: any) => (
        <div>
            <span data-testid="active-tab">{activeTabs[0]}</span>
            {tabs.map(({ key, title }: any) => (
                <button key={key} onClick={() => setActiveTab(key)}>
                    {title}
                </button>
            ))}
        </div>
    ),
    genTabBody: (activeTab: string, [tab]: [string]) =>
        activeTab === tab ? <div data-testid={`tab-${tab}`} /> : null,
}));

vi.mock('../others/labelIconHelpers', () => ({
    toIconedLabel: (label: string) => label,
}));

vi.mock('./SettingApplyComp', () => ({
    default: () => <div data-testid="apply" />,
}));

vi.mock('./bible-setting/bibleEditorDirtyHelpers', () => ({
    warnIfAnyBibleEditorDirty: warnIfAnyBibleEditorDirtyMock,
}));

describe('SettingComp cross-window tab requests', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        initialTab.value = 'g';
        requestedTab.value = null;
        getAIKeyFocusRequestMock.mockReturnValue(null);
        warnIfAnyBibleEditorDirtyMock.mockReturnValue(false);
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
    });

    async function renderSetting() {
        const { default: SettingComp } = await import('./SettingComp');
        await act(async () => root.render(<SettingComp />));
    }

    test('switches an already-open Settings window to the requested tab', async () => {
        await renderSetting();
        expect(
            container.querySelector('[data-testid="active-tab"]')?.textContent,
        ).toBe('g');

        requestedTab.value = 'o';
        await act(async () => window.dispatchEvent(new Event('focus')));

        expect(
            container.querySelector('[data-testid="active-tab"]')?.textContent,
        ).toBe('o');
        expect(container.querySelector('[data-testid="tab-o"]')).not.toBeNull();
    });

    test('keeps the Bible tab and restores its setting when dirty', async () => {
        initialTab.value = 'b';
        warnIfAnyBibleEditorDirtyMock.mockReturnValue(true);
        await renderSetting();

        requestedTab.value = 'o';
        await act(async () => window.dispatchEvent(new Event('focus')));

        expect(
            container.querySelector('[data-testid="active-tab"]')?.textContent,
        ).toBe('b');
        expect(setSettingMock).toHaveBeenCalledWith('setting-tabs', 'b');
    });
});
