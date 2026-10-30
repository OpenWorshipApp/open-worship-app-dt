// @vitest-environment jsdom

// What SettingComp.test.tsx does not reach: each tab loading its own panel,
// the App Assistant button, and the routing of a request for an AI key box
// (and of a tab request) around unsaved Bible changes.

import { act, Suspense } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

type TabKeyType = 'g' | 'p' | 'b' | 'o' | 'a';

const h = vi.hoisted(() => ({
    initialTab: 'g' as TabKeyType,
    requestedTab: null as TabKeyType | null,
    aiKeyRequest: null as { keyName: string | null } | null,
    tabRequestListeners: new Set<(tabKey: TabKeyType) => void>(),
    setSettingMock: vi.fn(),
    takeAIKeyFocusRequestMock: vi.fn(),
    warnIfAnyBibleEditorDirtyMock: vi.fn(),
    openChatbotOnPressMock: vi.fn(),
}));

vi.mock('./directory-setting/appLocalStorage', () => ({
    appLocalStorage: { isOnOwnFolder: false },
}));

vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
        useAppEffect: react.useEffect,
    };
});

vi.mock('../helper/settingHelpers', async () => {
    const react = await import('react');
    return {
        setSetting: h.setSettingMock,
        useStateSettingString: () => react.useState(h.initialTab),
    };
});

vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));

vi.mock('../helper/ai/aiKeyFocusHelpers', () => ({
    getAIKeyFocusRequest: () => h.aiKeyRequest,
    takeAIKeyFocusRequest: () => {
        h.takeAIKeyFocusRequestMock();
        const request = h.aiKeyRequest;
        h.aiKeyRequest = null;
        return request;
    },
}));

vi.mock('./settingHelpers', () => ({
    SETTING_SETTING_NAME: 'setting-tabs',
    takeSettingTabRequest: () => {
        const tabKey = h.requestedTab;
        h.requestedTab = null;
        return tabKey;
    },
    listenForSettingTabRequest: (callback: (tabKey: TabKeyType) => void) => {
        h.tabRequestListeners.add(callback);
        return () => {
            h.tabRequestListeners.delete(callback);
        };
    },
}));

// The real tab bar drags the screen manager along; the body keeps the real
// shape: the chosen tab's lazy panel inside a Suspense boundary.
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
    genTabBody: (activeTab: string, [tab, Element]: [string, any]) => (
        <Suspense key={tab} fallback={null}>
            {activeTab === tab ? <Element /> : null}
        </Suspense>
    ),
}));

vi.mock('../others/labelIconHelpers', () => ({
    toIconedLabel: (label: string) => label,
}));
vi.mock('./SettingApplyComp', () => ({ default: () => null }));
vi.mock('./setting-archive/SettingArchiveButtonsComp', () => ({
    default: () => null,
}));
vi.mock('./bible-setting/bibleEditorDirtyHelpers', () => ({
    warnIfAnyBibleEditorDirty: h.warnIfAnyBibleEditorDirtyMock,
}));
vi.mock('../others/commonButtons', () => ({
    openChatbotOnPress: h.openChatbotOnPressMock,
}));

vi.mock('./SettingGeneralComp', () => ({
    default: () => <div data-testid="panel">General panel</div>,
}));
vi.mock('./SettingPathComp', () => ({
    default: () => <div data-testid="panel">Path panel</div>,
}));
vi.mock('./bible-setting/SettingBibleComp', () => ({
    default: () => <div data-testid="panel">Bible panel</div>,
}));
vi.mock('./SettingOthersComp', () => ({
    default: () => <div data-testid="panel">Others panel</div>,
}));
vi.mock('./SettingAIComp', () => ({
    default: () => <div data-testid="panel">AI panel</div>,
}));

import SettingComp from './SettingComp';

let container: HTMLDivElement;
let root: Root;

function getActiveTab() {
    return container.querySelector('[data-testid="active-tab"]')!.textContent;
}

function findButton(text: string) {
    return Array.from(container.querySelectorAll('button')).find((button) => {
        return button.textContent === text;
    }) as HTMLButtonElement;
}

async function readPanel() {
    for (let tick = 0; tick < 20; tick++) {
        const panel = container.querySelector('[data-testid="panel"]');
        if (panel !== null) {
            return panel.textContent;
        }
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 5));
        });
    }
    return null;
}

async function renderSetting() {
    await act(async () => root.render(<SettingComp />));
}

async function focusWindow() {
    await act(async () => window.dispatchEvent(new Event('focus')));
}

function requestTabFromThisWindow(tabKey: TabKeyType) {
    h.requestedTab = tabKey;
    for (const listener of h.tabRequestListeners) {
        listener(tabKey);
    }
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.initialTab = 'g';
    h.requestedTab = null;
    h.aiKeyRequest = null;
    h.tabRequestListeners.clear();
    h.warnIfAnyBibleEditorDirtyMock.mockReturnValue(false);
    h.openChatbotOnPressMock.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('SettingComp panels', () => {
    test('each tab loads its own panel when it is chosen', async () => {
        await renderSetting();
        expect(await readPanel()).toBe('General panel');

        const shown: (string | null)[] = [];
        for (const title of [
            'Path Settings',
            'Bible',
            'AI Providers',
            'Others',
        ]) {
            await act(async () => findButton(title).click());
            shown.push(await readPanel());
        }

        expect(shown).toEqual([
            'Path panel',
            'Bible panel',
            'AI panel',
            'Others panel',
        ]);
        expect(
            container.querySelectorAll('[data-testid="panel"]'),
        ).toHaveLength(1);
    });

    test('App Assistant opens the chatbot the way its own button does', async () => {
        await renderSetting();

        await act(async () => findButton('App Assistant').click());

        expect(h.openChatbotOnPressMock).toHaveBeenCalledOnce();
    });
});

describe('SettingComp tab requests from this window', () => {
    test('a request for the tab already shown is taken and changes nothing', async () => {
        await renderSetting();

        await act(async () => requestTabFromThisWindow('g'));

        expect(h.requestedTab).toBeNull();
        expect(getActiveTab()).toBe('g');
        expect(h.warnIfAnyBibleEditorDirtyMock).not.toHaveBeenCalled();
    });

    test('refused over unsaved Bible changes, it keeps the tab and drops an AI key request', async () => {
        h.initialTab = 'b';
        h.warnIfAnyBibleEditorDirtyMock.mockReturnValue(true);
        h.aiKeyRequest = { keyName: 'openAIAPIKey' };
        await renderSetting();

        await act(async () => requestTabFromThisWindow('a'));

        expect(getActiveTab()).toBe('b');
        expect(h.setSettingMock).toHaveBeenCalledWith('setting-tabs', 'b');
        expect(h.takeAIKeyFocusRequestMock).toHaveBeenCalledOnce();
        expect(h.aiKeyRequest).toBeNull();
    });

    test('refused with no AI key request pending, there is nothing to drop', async () => {
        h.initialTab = 'b';
        h.warnIfAnyBibleEditorDirtyMock.mockReturnValue(true);
        await renderSetting();

        await act(async () => requestTabFromThisWindow('o'));

        expect(h.setSettingMock).toHaveBeenCalledWith('setting-tabs', 'b');
        expect(h.takeAIKeyFocusRequestMock).not.toHaveBeenCalled();
    });
});

describe('SettingComp on focus', () => {
    test('an AI key request with no tab request opens the AI Providers tab', async () => {
        await renderSetting();
        h.aiKeyRequest = { keyName: 'anthropicAPIKey' };

        await focusWindow();

        expect(getActiveTab()).toBe('a');
        // Left for the AI panel itself to take.
        expect(h.takeAIKeyFocusRequestMock).not.toHaveBeenCalled();
        expect(h.aiKeyRequest).not.toBeNull();
    });

    test('an AI key request already on the AI tab is left for the panel', async () => {
        h.initialTab = 'a';
        h.aiKeyRequest = { keyName: null };
        await renderSetting();

        await focusWindow();

        expect(getActiveTab()).toBe('a');
        expect(h.warnIfAnyBibleEditorDirtyMock).not.toHaveBeenCalled();
        expect(h.takeAIKeyFocusRequestMock).not.toHaveBeenCalled();
    });

    test('an AI key request refused over unsaved Bible changes is dropped', async () => {
        h.initialTab = 'b';
        await renderSetting();
        h.warnIfAnyBibleEditorDirtyMock.mockReturnValue(true);
        h.aiKeyRequest = { keyName: 'kimiAPIKey' };

        await focusWindow();

        expect(getActiveTab()).toBe('b');
        expect(h.takeAIKeyFocusRequestMock).toHaveBeenCalledOnce();
    });

    test('a refused tab request also drops a pending AI key request', async () => {
        h.initialTab = 'b';
        await renderSetting();
        h.warnIfAnyBibleEditorDirtyMock.mockReturnValue(true);
        h.requestedTab = 'a';
        h.aiKeyRequest = { keyName: 'kimiAPIKey' };

        await focusWindow();

        expect(getActiveTab()).toBe('b');
        expect(h.setSettingMock).toHaveBeenCalledWith('setting-tabs', 'b');
        expect(h.takeAIKeyFocusRequestMock).toHaveBeenCalledOnce();
    });

    test('a granted tab request with an AI key request goes on to the AI tab', async () => {
        await renderSetting();
        h.requestedTab = 'o';
        h.aiKeyRequest = { keyName: 'openAIAPIKey' };

        await focusWindow();

        expect(getActiveTab()).toBe('a');
    });
});
