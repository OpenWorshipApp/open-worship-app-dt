// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    homeStore: new Map<string, string>(),
    secureStore: new Map<string, string>(),
}));

vi.mock('../appHooks', async () => {
    const { useEffect } = await import('react');
    return { useAppEffect: useEffect };
});
vi.mock('../../server/appHomeStorage', () => ({
    appHomeStorage: {
        getItem: (key: string) => h.homeStore.get(key) ?? null,
        setItem: (key: string, value: string) => {
            h.homeStore.set(key, value);
        },
    },
}));
vi.mock('../../server/appSecureStorage', () => ({
    appSecureStorage: {
        getItem: (key: string) => h.secureStore.get(key) ?? null,
        setItem: (key: string, value: string) => {
            h.secureStore.set(key, value);
        },
        removeItem: (key: string) => {
            h.secureStore.delete(key);
        },
    },
}));

import type { AISettingType } from './aiHelpers';
import { setAISetting, setIsAIEnabled, useAISetting } from './aiHelpers';

const EMPTY_SETTING: AISettingType = {
    openAIAPIKey: '',
    anthropicAPIKey: '',
    kimiAPIKey: '',
    bedrockAPIKey: '',
    anthropicWorkspaceId: '',
    bedrockRegion: '',
    isAutoPlay: false,
};

let container: HTMLDivElement;
let root: Root;

function SettingProbeComp() {
    const setting = useAISetting();
    return (
        <output>
            {JSON.stringify({
                openAIAPIKey: setting.openAIAPIKey,
                isAutoPlay: setting.isAutoPlay,
                bedrockRegion: setting.bedrockRegion,
            })}
        </output>
    );
}

function readProbe() {
    return JSON.parse(container.querySelector('output')!.textContent!);
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    h.homeStore.clear();
    h.secureStore.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
});

describe('useAISetting', () => {
    test('a mounted panel hears a key saved in another one', async () => {
        await act(async () => {
            root.render(<SettingProbeComp />);
        });
        expect(readProbe()).toEqual({
            openAIAPIKey: '',
            isAutoPlay: false,
            bedrockRegion: 'us-west-2',
        });

        act(() => {
            setAISetting({
                ...EMPTY_SETTING,
                openAIAPIKey: ' sk-1 ',
                isAutoPlay: true,
                bedrockRegion: 'us-east-1',
            });
        });
        expect(readProbe()).toEqual({
            openAIAPIKey: 'sk-1',
            isAutoPlay: true,
            bedrockRegion: 'us-east-1',
        });
    });

    test('turning AI off is heard too: auto play goes with it', async () => {
        setAISetting({
            ...EMPTY_SETTING,
            openAIAPIKey: 'sk-1',
            isAutoPlay: true,
        });
        await act(async () => {
            root.render(<SettingProbeComp />);
        });
        expect(readProbe().isAutoPlay).toBe(true);

        act(() => {
            setIsAIEnabled(false);
        });
        expect(h.homeStore.get('ai-enabled')).toBe('false');
        expect(readProbe().isAutoPlay).toBe(false);

        act(() => {
            setIsAIEnabled(true);
        });
        expect(h.homeStore.get('ai-enabled')).toBe('true');
        expect(readProbe().isAutoPlay).toBe(true);
    });

    test('a panel that is gone stops listening, and the next one reads the store', async () => {
        await act(async () => {
            root.render(<SettingProbeComp />);
        });
        act(() => {
            root.unmount();
        });
        expect(() => {
            setAISetting({ ...EMPTY_SETTING, openAIAPIKey: 'sk-2' });
        }).not.toThrow();
        root = createRoot(container);
        await act(async () => {
            root.render(<SettingProbeComp />);
        });
        expect(readProbe().openAIAPIKey).toBe('sk-2');
    });
});
