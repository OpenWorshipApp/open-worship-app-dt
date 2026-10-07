// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    setting: {
        openAIAPIKey: 'openai-key',
        anthropicAPIKey: '',
        kimiAPIKey: '',
        anthropicWorkspaceId: '',
        isAutoPlay: false,
    },
    setAISettingMock: vi.fn(),
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
    takeAIKeyFocusRequest: vi.fn(() => null),
}));

vi.mock('../helper/ai/aiHelpers', () => ({
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

import SettingOthersAIComp from './SettingOthersAIComp';

let container: HTMLDivElement;
let root: Root | null = null;

describe('SettingOthersAIComp', () => {
    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        h.setting.openAIAPIKey = 'openai-key';
        h.setting.isAutoPlay = false;
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
});
