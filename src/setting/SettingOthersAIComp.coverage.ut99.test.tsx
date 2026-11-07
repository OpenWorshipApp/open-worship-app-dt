// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The AI Providers row beyond its folding: a key or workspace saved only when
// it changed, the console pages, the master switch with its restart, and the
// free fallback shown only while it is the thing answering.
const { state, mocks } = vi.hoisted(() => ({
    state: {
        setting: {} as Record<string, unknown>,
        isEnabled: true,
        servers: [] as { name: string }[],
    },
    mocks: {
        setAISetting: vi.fn(),
        setIsAIEnabled: vi.fn(),
        openURL: vi.fn(),
        confirm: vi.fn(),
        pendingApply: vi.fn(),
        relaunch: vi.fn(),
    },
}));

vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppEffect: react.useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../helper/ai/aiKeyFocusHelpers', () => ({
    takeAIKeyFocusRequest: () => null,
}));
vi.mock('./settingSectionFoldHelpers', () => ({
    getIsSettingSectionCollapsed: () => false,
    saveIsSettingSectionCollapsed: () => {},
}));
vi.mock('../helper/ai/aiHelpers', () => ({
    BEDROCK_REGION_LIST: ['us-east-1', 'us-west-2'],
    getAISetting: () => ({ ...state.setting }),
    getIsAIEnabled: () => state.isEnabled,
    setAISetting: mocks.setAISetting,
    setIsAIEnabled: mocks.setIsAIEnabled,
    useAISetting: () => ({ ...state.setting }),
}));
vi.mock('../helper/ai/freeHelpers', () => ({
    FREE_SERVICE_MAP: {
        kilo: { label: 'Kilo Code', homeUrl: 'https://kilo.example' },
        other: { label: 'Other Free', homeUrl: 'https://free.example' },
    },
}));
vi.mock('../chatbot/providerIssueHelpers', () => ({
    PAID_PROVIDER_PAGE_MAP: {
        openai: { keys: 'https://example.test/openai' },
        anthropic: {
            keys: 'https://example.test/anthropic',
            workspaces: 'https://example.test/workspaces',
        },
        kimi: { keys: 'https://example.test/kimi' },
        bedrock: { keys: 'https://example.test/bedrock' },
    },
}));
vi.mock('../server/appProvider', () => ({
    default: { browserUtils: { openExternalURL: mocks.openURL } },
}));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: mocks.confirm,
}));
vi.mock('./SettingApplyComp', () => ({
    applyStore: { pendingApply: mocks.pendingApply },
}));
vi.mock('./settingHelpers', () => ({ relaunchApp: mocks.relaunch }));
vi.mock('./SettingOthersSecureStorageWarningComp', () => ({
    default: () => null,
}));
vi.mock('./SettingOthersCustomServersComp', () => ({ default: () => null }));
vi.mock('./SettingOthersSharedServersComp', () => ({ default: () => null }));
vi.mock('../helper/ai/customServerHelpers', () => ({
    useCustomServers: () => state.servers,
}));
vi.mock('../../electron/customLlmProtocol', () => ({
    checkIsUsableCustomServer: (server: { name: string }) => server.name !== '',
}));

import SettingOthersAIComp from './SettingOthersAIComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

async function render() {
    await act(async () => {
        root.render(<SettingOthersAIComp />);
    });
}

function findInput(labelText: string) {
    const label = Array.from(container.querySelectorAll('label')).find(
        (one) => {
            return one.textContent?.includes(labelText);
        },
    );
    return document.getElementById(label!.htmlFor) as HTMLInputElement;
}

function findButton(text: string) {
    return Array.from(container.querySelectorAll('button')).find((button) => {
        return button.textContent === text;
    }) as HTMLButtonElement | undefined;
}

async function leaveWith(input: HTMLInputElement, value: string) {
    await act(async () => {
        input.value = value;
        input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
}

function getStateLabel() {
    return container.querySelector('.app-setting-others-state')!.textContent;
}

beforeEach(() => {
    state.setting = {
        openAIAPIKey: '',
        anthropicAPIKey: '',
        kimiAPIKey: '',
        bedrockAPIKey: '',
        anthropicWorkspaceId: 'ws-1',
        bedrockRegion: 'us-east-1',
        isAutoPlay: false,
    };
    state.isEnabled = true;
    state.servers = [];
    mocks.confirm.mockResolvedValue(false);
    Element.prototype.scrollIntoView = vi.fn() as any;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
    delete (Element.prototype as any).scrollIntoView;
});

describe('saving what was typed', () => {
    test('a new key is saved and asks for Apply; the same key is not saved again', async () => {
        await render();
        await leaveWith(findInput('Kimi API Key'), ' sk-kimi ');
        expect(mocks.setAISetting).toHaveBeenCalledWith({
            ...state.setting,
            kimiAPIKey: 'sk-kimi',
        });
        expect(mocks.pendingApply).toHaveBeenCalledOnce();

        mocks.setAISetting.mockClear();
        mocks.pendingApply.mockClear();
        state.setting.kimiAPIKey = 'sk-kimi';
        await leaveWith(findInput('Kimi API Key'), 'sk-kimi');
        expect(mocks.setAISetting).not.toHaveBeenCalled();
        expect(mocks.pendingApply).not.toHaveBeenCalled();
    });

    test('the workspace id is saved only when it changed', async () => {
        await render();
        await leaveWith(findInput('Anthropic Workspace ID'), 'ws-1');
        expect(mocks.setAISetting).not.toHaveBeenCalled();
        await leaveWith(findInput('Anthropic Workspace ID'), 'ws-2');
        expect(mocks.setAISetting).toHaveBeenCalledWith({
            ...state.setting,
            anthropicWorkspaceId: 'ws-2',
        });
        expect(mocks.pendingApply).toHaveBeenCalledOnce();
    });

    test('picking the region already set saves nothing', async () => {
        await render();
        const select = container.querySelector('select') as HTMLSelectElement;
        await act(async () => {
            select.value = 'us-east-1';
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });
        expect(mocks.setAISetting).not.toHaveBeenCalled();
        expect(mocks.pendingApply).not.toHaveBeenCalled();
    });
});

describe('the console pages', () => {
    test('Get key and Get ID open the provider pages in the browser', async () => {
        await render();
        const getKeyButtons = Array.from(
            container.querySelectorAll<HTMLButtonElement>('button'),
        ).filter((button) => button.textContent === 'Get key');
        expect(getKeyButtons.map((button) => button.title)).toEqual([
            'Create OpenAI api key',
            'Create Anthropic api key',
            'Create Kimi api key',
            'Create Amazon Bedrock api key',
        ]);
        for (const button of getKeyButtons) {
            await act(async () => {
                button.click();
            });
        }
        await act(async () => {
            findButton('Get ID')!.click();
        });
        expect(mocks.openURL.mock.calls).toEqual([
            ['https://example.test/openai'],
            ['https://example.test/anthropic'],
            ['https://example.test/kimi'],
            ['https://example.test/bedrock'],
            ['https://example.test/workspaces'],
        ]);
    });
});

describe('the master switch', () => {
    test('turning AI off is saved and asks for a restart', async () => {
        await render();
        const restartNote = Array.from(container.querySelectorAll('span')).find(
            (span) => span.textContent === 'Restart the app to apply',
        )!;
        expect(restartNote.className).not.toContain('text-warning');
        expect(findButton('Restart Now')!.className).toContain(
            'btn-outline-secondary',
        );
        const toggle = container.querySelector(
            '#app-ai-enabled',
        ) as HTMLInputElement;
        expect(toggle.checked).toBe(true);
        await act(async () => {
            toggle.click();
        });
        expect(mocks.setIsAIEnabled).toHaveBeenCalledWith(false);
        expect(toggle.checked).toBe(false);
        expect(restartNote.className).toContain('text-warning');
        expect(findButton('Restart Now')!.className).toContain('btn-warning');
    });

    test('Restart Now asks first and restarts only on Yes', async () => {
        await render();
        await act(async () => {
            findButton('Restart Now')!.click();
        });
        expect(mocks.confirm).toHaveBeenCalledWith(
            'Restart the app to apply',
            'The app will close and open again. Save your work first.',
            { cancelButtonLabel: 'No', confirmButtonLabel: 'Yes' },
        );
        expect(mocks.relaunch).not.toHaveBeenCalled();
        mocks.confirm.mockResolvedValue(true);
        await act(async () => {
            findButton('Restart Now')!.click();
        });
        expect(mocks.relaunch).toHaveBeenCalledOnce();
    });
});

describe('the free fallback', () => {
    test('with no key it names the free services and links to each', async () => {
        await render();
        expect(getStateLabel()).toBe('No key set');
        expect(container.textContent).toContain(
            'Free assistant (no key needed)',
        );
        const links = ['Kilo Code', 'Other Free'].map((label) => {
            return findButton(label)!;
        });
        expect(links.map((link) => link.title)).toEqual([
            'https://kilo.example',
            'https://free.example',
        ]);
        await act(async () => {
            links[1].click();
        });
        expect(mocks.openURL).toHaveBeenCalledWith('https://free.example');
    });

    test('a key of any provider, or a usable server, makes the row ready', async () => {
        state.setting.bedrockAPIKey = 'aws-key';
        await render();
        expect(getStateLabel()).toBe('Key set');
        expect(container.textContent).not.toContain(
            'Free assistant (no key needed)',
        );

        state.setting.bedrockAPIKey = '';
        state.servers = [{ name: '' }];
        await render();
        expect(getStateLabel()).toBe('No key set');
        state.servers = [{ name: '' }, { name: 'Home server' }];
        await render();
        expect(getStateLabel()).toBe('Key set');
        expect(findButton('Kilo Code')).toBeUndefined();
    });

    test('with AI turned off there is no fallback to describe', async () => {
        state.isEnabled = false;
        await render();
        expect(getStateLabel()).toBe('Turned off');
        expect(
            container
                .querySelector('.app-setting-others-section')!
                .className.includes('app-setting-others-idle'),
        ).toBe(true);
        expect(findButton('Kilo Code')).toBeUndefined();
    });
});
