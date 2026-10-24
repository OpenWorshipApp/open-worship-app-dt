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
    tabRequestListenerSet,
    dataDirState,
} = vi.hoisted(() => ({
    initialTab: { value: 'g' as 'g' | 'p' | 'b' | 'o' | 'a' | null },
    requestedTab: { value: null as 'g' | 'p' | 'b' | 'o' | 'a' | null },
    setSettingMock: vi.fn(),
    getAIKeyFocusRequestMock: vi.fn(() => null),
    takeAIKeyFocusRequestMock: vi.fn(),
    warnIfAnyBibleEditorDirtyMock: vi.fn(() => false),
    tabRequestListenerSet: new Set<
        (tabKey: 'g' | 'p' | 'b' | 'o' | 'a') => void
    >(),
    dataDirState: { isOnOwnFolder: false },
}));

vi.mock('./directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        get isOnOwnFolder() {
            return dataDirState.isOnOwnFolder;
        },
    },
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
        useStateSettingString: (_key: string, defaultValue: string) =>
            React.useState(initialTab.value ?? defaultValue),
    };
});

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));

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
    listenForSettingTabRequest: (
        callback: (tabKey: 'g' | 'p' | 'b' | 'o' | 'a') => void,
    ) => {
        tabRequestListenerSet.add(callback);
        return () => {
            tabRequestListenerSet.delete(callback);
        };
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

vi.mock('./setting-archive/SettingArchiveButtonsComp', () => ({
    default: () => <div data-testid="setting-archive-buttons" />,
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
        dataDirState.isOnOwnFolder = false;
        tabRequestListenerSet.clear();
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

    test('switches at once when Settings itself asks for a tab', async () => {
        await renderSetting();
        expect(
            container.querySelector('[data-testid="active-tab"]')?.textContent,
        ).toBe('g');

        // The assistant's "Enable AI features" prompt, answered from a window
        // that is already in front: no focus event, so the stored request
        // alone left the tab where it was.
        await act(async () => {
            for (const callback of tabRequestListenerSet) {
                callback('o');
            }
        });

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

    test('puts Export / Import Settings under Apply Settings', async () => {
        await renderSetting();

        const applyBox = container.querySelector('.app-setting-apply');
        expect(
            Array.from(applyBox?.children ?? []).map((child) => {
                return child.getAttribute('data-testid') ?? child.textContent;
            }),
        ).toEqual(['App Assistant', 'apply', 'setting-archive-buttons']);
    });

    test('opens on Path Settings when no tab was chosen before', async () => {
        initialTab.value = null;
        await renderSetting();
        expect(
            container.querySelector('[data-testid="active-tab"]')?.textContent,
        ).toBe('p');
    });

    test('with no data folder, offers the computer’s own settings only', async () => {
        dataDirState.isOnOwnFolder = true;
        // Last left on a tab of the data folder's own settings.
        initialTab.value = 'b';
        await renderSetting();

        expect(
            Array.from(container.querySelectorAll('button')).map((button) => {
                return button.textContent;
            }),
        ).toEqual([
            'General',
            'Path Settings',
            'AI Providers',
            'App Assistant',
        ]);
        expect(
            container.querySelector('[data-testid="active-tab"]')?.textContent,
        ).toBe('p');
        expect(container.querySelector('[data-testid="tab-p"]')).not.toBeNull();
        expect(container.querySelector('[data-testid="tab-b"]')).toBeNull();
        expect(
            container.querySelector('[data-testid="setting-archive-buttons"]'),
        ).toBeNull();
    });
});
