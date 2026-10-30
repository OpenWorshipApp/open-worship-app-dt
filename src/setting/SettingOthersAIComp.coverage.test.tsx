// @vitest-environment jsdom

// The AI Providers panel paths SettingOthersAIComp.test.tsx does not take:
// saving each field, the master switch and its restart, the provider pages,
// and the free-assistant note shown while no key is set.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    setting: {
        openAIAPIKey: '',
        anthropicAPIKey: '',
        kimiAPIKey: '',
        bedrockAPIKey: '',
        anthropicWorkspaceId: '',
        bedrockRegion: 'us-east-1',
        isAutoPlay: false,
    } as Record<string, any>,
    isEnabled: true,
    customServers: [] as { isUsable: boolean }[],
    setAISettingMock: vi.fn(),
    setIsAIEnabledMock: vi.fn(),
    openExternalURLMock: vi.fn(),
    showAppConfirmMock: vi.fn(),
    pendingApplyMock: vi.fn(),
    relaunchAppMock: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

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
    saveIsSettingSectionCollapsed: vi.fn(),
}));

vi.mock('../helper/ai/aiHelpers', () => ({
    BEDROCK_REGION_LIST: ['us-east-1', 'us-west-2'],
    getAISetting: () => ({ ...h.setting }),
    getIsAIEnabled: () => h.isEnabled,
    setAISetting: h.setAISettingMock,
    setIsAIEnabled: h.setIsAIEnabledMock,
    useAISetting: () => ({ ...h.setting }),
}));

vi.mock('../helper/ai/freeHelpers', () => ({
    FREE_SERVICE_MAP: {
        first: { label: 'Free One', homeUrl: 'https://free-one.example' },
        second: { label: 'Free Two', homeUrl: 'https://free-two.example' },
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
    default: { browserUtils: { openExternalURL: h.openExternalURLMock } },
}));

vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: h.showAppConfirmMock,
}));

vi.mock('./SettingApplyComp', () => ({
    applyStore: { pendingApply: h.pendingApplyMock },
}));

vi.mock('./settingHelpers', () => ({
    relaunchApp: h.relaunchAppMock,
}));

vi.mock('./SettingOthersSecureStorageWarningComp', () => ({
    default: () => null,
}));
vi.mock('./SettingOthersCustomServersComp', () => ({
    default: () => null,
}));
vi.mock('./SettingOthersSharedServersComp', () => ({
    default: () => null,
}));
vi.mock('../helper/ai/customServerHelpers', () => ({
    useCustomServers: () => h.customServers,
}));
vi.mock('../../electron/customLlmProtocol', () => ({
    checkIsUsableCustomServer: (server: { isUsable: boolean }) => {
        return server.isUsable;
    },
}));

import SettingOthersAIComp from './SettingOthersAIComp';

let container: HTMLDivElement;
let root: Root;

function findButton(text: string) {
    return (
        Array.from(container.querySelectorAll('button')).find((button) => {
            return button.textContent?.trim() === text;
        }) ?? null
    );
}

function findFieldInput(labelText: string) {
    const label = Array.from(container.querySelectorAll('label')).find(
        (one) => {
            return one.textContent === labelText;
        },
    );
    return document.getElementById(label!.htmlFor) as HTMLInputElement;
}

function getStateLabel() {
    return container.querySelector('.app-setting-others-state')!.textContent;
}

async function leaveWithValue(input: HTMLInputElement, value: string) {
    await act(async () => {
        input.value = value;
        input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
}

async function renderPanel() {
    await act(async () => root.render(<SettingOthersAIComp />));
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.setting = {
        openAIAPIKey: '',
        anthropicAPIKey: '',
        kimiAPIKey: '',
        bedrockAPIKey: '',
        anthropicWorkspaceId: '',
        bedrockRegion: 'us-east-1',
        isAutoPlay: false,
    };
    h.isEnabled = true;
    h.customServers = [];
    h.showAppConfirmMock.mockResolvedValue(false);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('SettingOthersAIComp state', () => {
    test('with no key and AI on, names the free services it falls back to', async () => {
        await renderPanel();

        expect(getStateLabel()).toBe('No key set');
        expect(container.querySelector('section')!.className).toContain(
            'app-setting-others-idle',
        );
        const note = container.querySelector('.alert-warning')!;
        expect(note.textContent).toContain('Free assistant (no key needed)');
        const serviceButtons = Array.from(note.querySelectorAll('button'));
        expect(
            serviceButtons.map((button) => {
                return [button.textContent, button.title];
            }),
        ).toEqual([
            ['Free One', 'https://free-one.example'],
            ['Free Two', 'https://free-two.example'],
        ]);

        await act(async () => serviceButtons[1].click());

        expect(h.openExternalURLMock).toHaveBeenCalledWith(
            'https://free-two.example',
        );
    });

    test.each([['anthropicAPIKey'], ['kimiAPIKey'], ['bedrockAPIKey']])(
        'a %s alone is a working row',
        async (keyName) => {
            h.setting[keyName] = 'secret';
            await renderPanel();
            expect(getStateLabel()).toBe('Key set');
            expect(container.querySelector('.alert-warning')).toBeNull();
        },
    );

    test('a usable server of your own counts as a key; an unusable one does not', async () => {
        h.customServers = [{ isUsable: false }];
        await renderPanel();
        expect(getStateLabel()).toBe('No key set');

        h.customServers = [{ isUsable: false }, { isUsable: true }];
        await act(async () => root.render(<SettingOthersAIComp key="2" />));
        expect(getStateLabel()).toBe('Key set');
        expect(container.querySelector('.alert-warning')).toBeNull();
    });

    test('turned off, it says so and describes no fallback', async () => {
        h.isEnabled = false;
        await renderPanel();
        expect(getStateLabel()).toBe('Turned off');
        expect(container.querySelector('.alert-warning')).toBeNull();
    });
});

describe('SettingOthersAIComp fields', () => {
    test("each provider's page opens from beside its field", async () => {
        await renderPanel();
        const keyButtons = Array.from(
            container.querySelectorAll('button'),
        ).filter((button) => {
            return button.textContent === 'Get key';
        });
        expect(keyButtons.map((button) => button.title)).toEqual([
            'Create OpenAI api key',
            'Create Anthropic api key',
            'Create Kimi api key',
            'Create Amazon Bedrock api key',
        ]);

        await act(async () => keyButtons[2].click());
        expect(h.openExternalURLMock).toHaveBeenLastCalledWith(
            'https://example.test/kimi',
        );

        await act(async () => findButton('Get ID')!.click());
        expect(h.openExternalURLMock).toHaveBeenLastCalledWith(
            'https://example.test/workspaces',
        );
    });

    test('a key is saved on leaving its box, and Apply marked pending', async () => {
        await renderPanel();

        await leaveWithValue(findFieldInput('Kimi API Key'), '  sk-kimi  ');

        expect(h.setAISettingMock).toHaveBeenCalledWith({
            ...h.setting,
            kimiAPIKey: 'sk-kimi',
        });
        expect(h.pendingApplyMock).toHaveBeenCalledOnce();
    });

    test('leaving a box unchanged saves nothing', async () => {
        h.setting.openAIAPIKey = 'sk-open';
        h.setting.anthropicWorkspaceId = 'wrk-1';
        await renderPanel();

        await leaveWithValue(findFieldInput('OpenAI API Key'), 'sk-open');
        await leaveWithValue(findFieldInput('Anthropic Workspace ID'), 'wrk-1');

        expect(h.setAISettingMock).not.toHaveBeenCalled();
        expect(h.pendingApplyMock).not.toHaveBeenCalled();
    });

    test('the Anthropic workspace id is saved beside its key', async () => {
        await renderPanel();

        await leaveWithValue(
            findFieldInput('Anthropic Workspace ID'),
            'wrkspc_42',
        );

        expect(h.setAISettingMock).toHaveBeenCalledWith({
            ...h.setting,
            anthropicWorkspaceId: 'wrkspc_42',
        });
        expect(h.pendingApplyMock).toHaveBeenCalledOnce();
    });

    test('choosing the Bedrock region already set saves nothing', async () => {
        await renderPanel();
        const select = container.querySelector('select') as HTMLSelectElement;

        await act(async () => {
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });

        expect(h.setAISettingMock).not.toHaveBeenCalled();
        expect(h.pendingApplyMock).not.toHaveBeenCalled();
    });
});

describe('SettingOthersAIComp master switch', () => {
    test('switching AI off is saved and asks for a restart', async () => {
        await renderPanel();
        const toggle = container.querySelector(
            '#app-ai-enabled',
        ) as HTMLInputElement;
        expect(toggle.checked).toBe(true);
        expect(findButton('Restart Now')!.className).toContain(
            'btn-outline-secondary',
        );

        await act(async () => toggle.click());

        expect(h.setIsAIEnabledMock).toHaveBeenCalledWith(false);
        expect(toggle.checked).toBe(false);
        expect(findButton('Restart Now')!.className).toContain('btn-warning');
        expect(
            Array.from(container.querySelectorAll('span.app-data')).find(
                (span) => {
                    return span.textContent === 'Restart the app to apply';
                },
            )!.className,
        ).toContain('text-warning');
    });

    test('Restart Now relaunches only once the operator agrees', async () => {
        await renderPanel();

        await act(async () => findButton('Restart Now')!.click());

        expect(h.showAppConfirmMock).toHaveBeenCalledWith(
            'Restart the app to apply',
            'The app will close and open again. Save your work first.',
            { cancelButtonLabel: 'No', confirmButtonLabel: 'Yes' },
        );
        expect(h.relaunchAppMock).not.toHaveBeenCalled();

        h.showAppConfirmMock.mockResolvedValue(true);
        await act(async () => findButton('Restart Now')!.click());

        expect(h.relaunchAppMock).toHaveBeenCalledOnce();
    });
});
