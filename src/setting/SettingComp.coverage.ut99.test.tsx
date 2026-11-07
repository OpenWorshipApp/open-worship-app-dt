// @vitest-environment jsdom

import { act, Suspense } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The Settings window loading each tab only when it is chosen, the assistant
// button, and the tab requests it has to refuse or redirect.
type TabKeyType = 'g' | 'p' | 'b' | 'o' | 'a';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        initialTab: 'g' as TabKeyType,
        requestedTab: null as TabKeyType | null,
        aiKeyRequest: null as { keyName: string | null } | null,
        isDirty: false,
        listeners: new Set<(tabKey: TabKeyType) => void>(),
    },
    mocks: {
        setSetting: vi.fn(),
        takeAIKeyFocusRequest: vi.fn(),
        warnIfDirty: vi.fn(),
        openChatbot: vi.fn(),
    },
}));

vi.mock('./directory-setting/appLocalStorage', () => ({
    appLocalStorage: { isOnOwnFolder: false },
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
        setSetting: mocks.setSetting,
        useStateSettingString: () => React.useState(state.initialTab),
    };
});
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/ai/aiKeyFocusHelpers', () => ({
    getAIKeyFocusRequest: () => state.aiKeyRequest,
    takeAIKeyFocusRequest: mocks.takeAIKeyFocusRequest,
}));
vi.mock('./settingHelpers', () => ({
    SETTING_SETTING_NAME: 'setting-tabs',
    takeSettingTabRequest: () => {
        const value = state.requestedTab;
        state.requestedTab = null;
        return value;
    },
    listenForSettingTabRequest: (callback: (tabKey: TabKeyType) => void) => {
        state.listeners.add(callback);
        return () => {
            state.listeners.delete(callback);
        };
    },
}));
vi.mock('../others/TabRenderComp', () => ({
    default: ({ tabs, activeTabs, setActiveTab }: any) => (
        <div>
            <span className="active-tab">{activeTabs[0]}</span>
            {tabs.map(({ key, title }: any) => (
                <button
                    key={key}
                    className="tab"
                    onClick={() => setActiveTab(key)}
                >
                    {title}
                </button>
            ))}
        </div>
    ),
    // As the real one: the chosen tab's lazy body inside its own Suspense.
    genTabBody: (activeTab: string, [tab, Target]: [string, any]) => (
        <Suspense key={tab} fallback={<span className="tab-loading" />}>
            {activeTab === tab ? <Target /> : null}
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
    warnIfAnyBibleEditorDirty: mocks.warnIfDirty,
}));
vi.mock('../others/commonButtons', () => ({
    openChatbotOnPress: mocks.openChatbot,
}));
vi.mock('./SettingGeneralComp', () => ({
    default: () => <div className="body">General body</div>,
}));
vi.mock('./SettingPathComp', () => ({
    default: () => <div className="body">Path body</div>,
}));
vi.mock('./bible-setting/SettingBibleComp', () => ({
    default: () => <div className="body">Bible body</div>,
}));
vi.mock('./SettingOthersComp', () => ({
    default: () => <div className="body">Others body</div>,
}));
vi.mock('./SettingAIComp', () => ({
    default: () => <div className="body">AI body</div>,
}));
vi.mock('./SettingLanguagesComp', () => ({
    default: () => <div className="body">Languages body</div>,
}));

import SettingComp from './SettingComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

async function wait() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

async function render() {
    await act(async () => {
        root.render(<SettingComp />);
    });
    await wait();
}

function getActiveTab() {
    return container.querySelector('.active-tab')!.textContent;
}

function getBodies() {
    return Array.from(container.querySelectorAll('.body')).map((body) => {
        return body.textContent;
    });
}

async function focusWindow() {
    await act(async () => {
        window.dispatchEvent(new Event('focus'));
    });
    await wait();
}

async function askFromThisWindow(tabKey: TabKeyType) {
    await act(async () => {
        for (const listener of state.listeners) {
            listener(tabKey);
        }
    });
    await wait();
}

beforeEach(() => {
    state.initialTab = 'g';
    state.requestedTab = null;
    state.aiKeyRequest = null;
    state.isDirty = false;
    state.listeners.clear();
    mocks.warnIfDirty.mockImplementation(() => state.isDirty);
    mocks.openChatbot.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
});

describe('the tabs', () => {
    test('each tab loads its own body when chosen, one at a time', async () => {
        await render();
        expect(getBodies()).toEqual(['General body']);
        const tabs = Array.from(
            container.querySelectorAll<HTMLButtonElement>('button.tab'),
        );
        expect(tabs.map((tab) => tab.textContent)).toEqual([
            'General',
            'Languages',
            'Path Settings',
            'Bible',
            'AI Providers',
            'Others',
        ]);
        const seen: (string | null)[][] = [];
        for (const tab of tabs.slice(1)) {
            await act(async () => {
                tab.click();
            });
            await wait();
            seen.push(getBodies());
        }
        expect(seen).toEqual([
            ['Languages body'],
            ['Path body'],
            ['Bible body'],
            ['AI body'],
            ['Others body'],
        ]);
    });

    test('the assistant button opens the assistant as the robot button does', async () => {
        await render();
        const button = container.querySelector(
            'button[title="App Assistant"]',
        ) as HTMLButtonElement;
        expect(button.textContent).toBe('App Assistant');
        await act(async () => {
            button.click();
        });
        await wait();
        expect(mocks.openChatbot).toHaveBeenCalledOnce();
    });
});

describe('a tab asked for by this same window', () => {
    test('the tab already showing is taken and nothing else happens', async () => {
        await render();
        state.requestedTab = 'g';
        await askFromThisWindow('g');
        expect(state.requestedTab).toBeNull();
        expect(mocks.warnIfDirty).not.toHaveBeenCalled();
        expect(mocks.setSetting).not.toHaveBeenCalled();
        expect(getActiveTab()).toBe('g');
    });

    test('refused over unsaved Bible changes, the shown tab is kept and the key request dropped', async () => {
        state.initialTab = 'b';
        state.isDirty = true;
        state.aiKeyRequest = { keyName: 'openAIAPIKey' };
        await render();
        await askFromThisWindow('a');
        expect(mocks.warnIfDirty).toHaveBeenCalledWith(
            'Save or discard unsaved Bible changes before switching tabs.',
        );
        expect(getActiveTab()).toBe('b');
        expect(mocks.setSetting).toHaveBeenCalledWith('setting-tabs', 'b');
        expect(mocks.takeAIKeyFocusRequest).toHaveBeenCalledOnce();
    });

    test('refused with no key request pending, there is nothing to drop', async () => {
        state.initialTab = 'b';
        state.isDirty = true;
        await render();
        await askFromThisWindow('o');
        expect(mocks.setSetting).toHaveBeenCalledWith('setting-tabs', 'b');
        expect(mocks.takeAIKeyFocusRequest).not.toHaveBeenCalled();
    });
});

describe('a request found when the window comes to the front', () => {
    test('a refused tab request also drops the key request that came with it', async () => {
        state.initialTab = 'b';
        state.isDirty = true;
        state.aiKeyRequest = { keyName: null };
        await render();
        state.requestedTab = 'a';
        await focusWindow();
        expect(getActiveTab()).toBe('b');
        expect(mocks.setSetting).toHaveBeenCalledWith('setting-tabs', 'b');
        expect(mocks.takeAIKeyFocusRequest).toHaveBeenCalledOnce();
    });

    test('a key request alone brings the AI tab forward', async () => {
        await render();
        state.aiKeyRequest = { keyName: 'kimiAPIKey' };
        await focusWindow();
        expect(getActiveTab()).toBe('a');
        expect(getBodies()).toEqual(['AI body']);
        // Left stored for the AI panel to take itself.
        expect(mocks.takeAIKeyFocusRequest).not.toHaveBeenCalled();
    });

    test('a key request is dropped when the AI tab is refused', async () => {
        state.initialTab = 'b';
        state.isDirty = true;
        state.aiKeyRequest = { keyName: 'kimiAPIKey' };
        await render();
        await focusWindow();
        expect(getActiveTab()).toBe('b');
        expect(mocks.takeAIKeyFocusRequest).toHaveBeenCalledOnce();
        expect(mocks.setSetting).not.toHaveBeenCalled();
    });

    test('on the AI tab already, a key request is left alone', async () => {
        state.initialTab = 'a';
        state.aiKeyRequest = { keyName: 'kimiAPIKey' };
        await render();
        await focusWindow();
        expect(mocks.warnIfDirty).not.toHaveBeenCalled();
        expect(mocks.takeAIKeyFocusRequest).not.toHaveBeenCalled();
        expect(getActiveTab()).toBe('a');
    });

    test('closing the window stops both ways of asking', async () => {
        await render();
        expect(state.listeners.size).toBe(1);
        await act(async () => {
            root.unmount();
        });
        expect(state.listeners.size).toBe(0);
        state.aiKeyRequest = { keyName: 'kimiAPIKey' };
        window.dispatchEvent(new Event('focus'));
        expect(mocks.warnIfDirty).not.toHaveBeenCalled();
        root = createRoot(container);
    });
});
