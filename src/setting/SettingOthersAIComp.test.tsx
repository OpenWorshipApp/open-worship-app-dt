// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    setting: {
        openAIAPIKey: 'openai-key',
        anthropicAPIKey: '',
        kimiAPIKey: '',
        bedrockAPIKey: '',
        anthropicWorkspaceId: '',
        bedrockRegion: 'us-east-1',
        isAutoPlay: false,
    },
    setAISettingMock: vi.fn(),
    takeAIKeyFocusRequestMock: vi.fn(
        (): { keyName: string | null } | null => null,
    ),
    collapsedMap: new Map<string, boolean>(),
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
    takeAIKeyFocusRequest: h.takeAIKeyFocusRequestMock,
}));

vi.mock('./settingSectionFoldHelpers', () => ({
    getIsSettingSectionCollapsed: (foldName: string) => {
        return h.collapsedMap.get(foldName) ?? false;
    },
    saveIsSettingSectionCollapsed: (foldName: string, isCollapsed: boolean) => {
        h.collapsedMap.set(foldName, isCollapsed);
    },
}));

vi.mock('../helper/ai/aiHelpers', () => ({
    BEDROCK_REGION_LIST: ['us-east-1', 'us-west-2'],
    getAISetting: () => ({ ...h.setting }),
    getIsAIEnabled: () => true,
    setAISetting: h.setAISettingMock,
    setIsAIEnabled: vi.fn(),
    useAISetting: () => ({ ...h.setting }),
}));

vi.mock('../helper/ai/freeHelpers', () => ({
    FREE_SERVICE_MAP: {},
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
    default: { browserUtils: { openExternalURL: vi.fn() } },
}));

vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: vi.fn(async () => false),
}));

vi.mock('./SettingApplyComp', () => ({
    applyStore: { pendingApply: vi.fn() },
}));

vi.mock('./settingHelpers', () => ({
    relaunchApp: vi.fn(),
}));

vi.mock('./SettingOthersSecureStorageWarningComp', () => ({
    default: () => null,
}));

// The custom-server group has its own test; here it only has to load.
vi.mock('./SettingOthersCustomServersComp', () => ({
    default: () => null,
}));
vi.mock('../helper/ai/customServerHelpers', () => ({
    useCustomServers: () => [],
}));

import SettingOthersAIComp from './SettingOthersAIComp';

let container: HTMLDivElement;
let root: Root | null = null;

describe('SettingOthersAIComp', () => {
    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        h.setting.openAIAPIKey = 'openai-key';
        h.setting.isAutoPlay = false;
        h.collapsedMap.clear();
        // jsdom has no layout, so it has no `scrollIntoView` either.
        Element.prototype.scrollIntoView = vi.fn();
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(async () => {
        if (root) {
            await act(async () => root?.unmount());
            root = null;
        }
        container.remove();
    });

    async function renderComponent() {
        await act(async () => {
            root = createRoot(container);
            root.render(<SettingOthersAIComp />);
        });
    }

    function getFoldButton() {
        return container.querySelector(
            'h2 button[aria-expanded]',
        ) as HTMLButtonElement;
    }

    // A provider's box inside the panel, by the name on it.
    function getBoxFoldButton(title: string) {
        return Array.from(
            container.querySelectorAll<HTMLButtonElement>(
                '.app-setting-others-group-title button[aria-expanded]',
            ),
        ).find((button) => {
            return button.textContent === title;
        }) as HTMLButtonElement;
    }

    function findTitleTick(title: string) {
        return (
            getBoxFoldButton(title).parentElement?.querySelector(
                '.app-setting-others-field-set',
            ) ?? null
        );
    }

    function findKeyInput(labelText: string) {
        const label = Array.from(container.querySelectorAll('label')).find(
            (one) => {
                return one.textContent?.includes(labelText);
            },
        );
        return label ? document.getElementById(label.htmlFor) : null;
    }

    test('keeps the Bible Audio auto-play switch beside its OpenAI key', async () => {
        await renderComponent();

        const input = container.querySelector(
            '#app-ai-audio-auto-play',
        ) as HTMLInputElement;
        expect(input.checked).toBe(false);
        expect(container.textContent).toContain(
            'Auto Play Audio AI when available',
        );

        await act(async () => input.click());

        expect(h.setAISettingMock).toHaveBeenCalledWith({
            ...h.setting,
            isAutoPlay: true,
        });
    });

    test('does not offer auto-play until the required OpenAI key is set', async () => {
        h.setting.openAIAPIKey = '';

        await renderComponent();

        expect(container.querySelector('#app-ai-audio-auto-play')).toBeNull();
    });

    // One Bedrock key reaches every region of its account, so the region is
    // picked beside it -- off a closed list, never typed.
    test('saves the Bedrock region picked beside its key', async () => {
        await renderComponent();

        expect(container.textContent).toContain('Amazon Bedrock');
        const select = Array.from(container.querySelectorAll('select')).find(
            (one) => {
                return one.value === 'us-east-1';
            },
        ) as HTMLSelectElement;
        expect(
            Array.from(select.options).map((option) => {
                return option.value;
            }),
        ).toEqual(['us-east-1', 'us-west-2']);

        await act(async () => {
            select.value = 'us-west-2';
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });

        expect(h.setAISettingMock).toHaveBeenCalledWith({
            ...h.setting,
            bedrockRegion: 'us-west-2',
        });
    });

    // The help window sends the user here to type a key. A folded panel has
    // no box to put the cursor in, so it opens first.
    test('a key asked for while the panel is folded opens it at that box', async () => {
        h.collapsedMap.set('ai', true);
        h.takeAIKeyFocusRequestMock.mockReturnValueOnce({
            keyName: 'anthropicAPIKey',
        });

        await renderComponent();

        expect(getFoldButton().getAttribute('aria-expanded')).toBe('true');
        expect(h.collapsedMap.get('ai')).toBe(false);
        const input = findKeyInput('Anthropic API Key');
        expect(input).not.toBeNull();
        expect(document.activeElement).toBe(input);
    });

    test('a request for the panel itself opens a folded panel', async () => {
        h.collapsedMap.set('ai', true);
        h.takeAIKeyFocusRequestMock.mockReturnValueOnce({ keyName: null });

        await renderComponent();

        expect(container.querySelector('#app-ai-enabled')).not.toBeNull();
    });

    test('stays folded when nothing asked for it', async () => {
        h.collapsedMap.set('ai', true);

        await renderComponent();

        expect(container.querySelector('#app-ai-enabled')).toBeNull();
        // The state the row is in is still on its header.
        expect(container.textContent).toContain('Key set');
    });

    // The boxes are mounted afresh on every opening. A request still held
    // would take the cursor back into its box each time.
    test('folded and opened again by hand, the cursor is left alone', async () => {
        h.takeAIKeyFocusRequestMock.mockReturnValueOnce({
            keyName: 'anthropicAPIKey',
        });
        await renderComponent();
        expect(document.activeElement).toBe(findKeyInput('Anthropic API Key'));

        await act(async () => getFoldButton().click());
        expect(findKeyInput('Anthropic API Key')).toBeNull();
        await act(async () => getFoldButton().click());

        const input = findKeyInput('Anthropic API Key');
        expect(input).not.toBeNull();
        expect(document.activeElement).not.toBe(input);
    });

    // The boxes inside the panel fold too, each on its own.
    test('a provider box folds to its name, with a tick when its key is saved', async () => {
        await renderComponent();
        // Open, the field says the key is saved; the title says nothing.
        expect(findKeyInput('OpenAI API Key')).not.toBeNull();
        expect(findTitleTick('OpenAI')).toBeNull();

        await act(async () => getBoxFoldButton('OpenAI').click());

        expect(getBoxFoldButton('OpenAI').getAttribute('aria-expanded')).toBe(
            'false',
        );
        expect(findKeyInput('OpenAI API Key')).toBeNull();
        expect(container.querySelector('#app-ai-audio-auto-play')).toBeNull();
        expect(findTitleTick('OpenAI')).not.toBeNull();
        expect(h.collapsedMap.get('ai-openai')).toBe(true);
        // The box beside it is left as it was.
        expect(findKeyInput('Anthropic API Key')).not.toBeNull();

        // No key, no tick: a folded box must not claim a key it has not got.
        await act(async () => getBoxFoldButton('Anthropic').click());
        expect(findKeyInput('Anthropic API Key')).toBeNull();
        expect(findTitleTick('Anthropic')).toBeNull();
    });

    test('a key asked for in a folded box of a folded panel opens both', async () => {
        h.collapsedMap.set('ai', true);
        h.collapsedMap.set('ai-openai', true);
        h.collapsedMap.set('ai-anthropic', true);
        h.takeAIKeyFocusRequestMock.mockReturnValueOnce({
            keyName: 'anthropicAPIKey',
        });

        await renderComponent();

        expect(document.activeElement).toBe(findKeyInput('Anthropic API Key'));
        expect(h.collapsedMap.get('ai-anthropic')).toBe(false);
        // The box nobody asked for stays folded.
        expect(findKeyInput('OpenAI API Key')).toBeNull();
        expect(h.collapsedMap.get('ai-openai')).toBe(true);
    });

    test('a box folded and opened again by hand leaves the cursor alone', async () => {
        h.takeAIKeyFocusRequestMock.mockReturnValueOnce({
            keyName: 'anthropicAPIKey',
        });
        await renderComponent();
        expect(document.activeElement).toBe(findKeyInput('Anthropic API Key'));

        await act(async () => getBoxFoldButton('Anthropic').click());
        await act(async () => getBoxFoldButton('Anthropic').click());

        const input = findKeyInput('Anthropic API Key');
        expect(input).not.toBeNull();
        expect(document.activeElement).not.toBe(input);
    });
});
