// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { readLangPackageDictionaries } from '../test-setup/langPackageDirs';

// The robot in a foreground panel's title bar: drawn only while AI is on,
// and pressed it hands the help window the session the panel is on AT THE
// PRESS -- read then from the real session store, never kept -- or, for
// Camera Show and Screen Show, which have no sessions, the component alone.
const h = vi.hoisted(() => ({
    isAIEnabled: true,
    settings: new Map<string, string>(),
    dictionaries: [] as Record<string, string>[],
    openForegroundInChatbot: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => {
        for (const dictionary of h.dictionaries) {
            if (dictionary[key.trim().toLowerCase()] === undefined) {
                throw new Error(`Missing translation: ${key}`);
            }
        }
        return key;
    },
}));
vi.mock('../helper/ai/aiHelpers', () => ({
    getIsAIEnabled: () => h.isAIEnabled,
}));
vi.mock('../helper/ai/foregroundChatbotMenuHelpers', () => ({
    openForegroundInChatbot: h.openForegroundInChatbot,
}));
// The session strip's store reads through these two alone.
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => h.settings.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        h.settings.set(key, value);
    },
}));

import ForegroundChatbotButtonComp from './ForegroundChatbotButtonComp';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    h.isAIEnabled = true;
    h.settings.clear();
    h.dictionaries = readLangPackageDictionaries();
    h.openForegroundInChatbot.mockResolvedValue(true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
});

async function render(
    widgetKey: Parameters<typeof ForegroundChatbotButtonComp>[0]['widgetKey'],
) {
    await act(async () => {
        root.render(<ForegroundChatbotButtonComp widgetKey={widgetKey} />);
    });
    return container.querySelector<HTMLButtonElement>('button');
}

async function press(button: HTMLButtonElement) {
    await act(async () => {
        button.click();
    });
}

describe('ForegroundChatbotButtonComp', () => {
    test('is not drawn while AI is off', async () => {
        h.isAIEnabled = false;
        expect(await render('countdown')).toBeNull();
        expect(container.innerHTML).toBe('');
    });

    test('is the title bar robot, named for what it does', async () => {
        const button = await render('countdown');
        expect(button).not.toBeNull();
        expect(button!.title).toBe('Open in Chatbot');
        expect(button!.getAttribute('aria-label')).toBe('Open in Chatbot');
        expect(button!.className).toBe('floating-widget__button');
        expect(button!.querySelector('i.bi-robot')).not.toBeNull();
        expect(h.openForegroundInChatbot).not.toHaveBeenCalled();
    });

    test('hands over the session the panel is on, by its id and name', async () => {
        h.settings.set(
            'foreground-quick-text-sessions',
            JSON.stringify([
                { id: '', name: 'Default' },
                { id: 's1ab', name: 'John 3:16' },
            ]),
        );
        h.settings.set('foreground-quick-text-active-session', 's1ab');
        await press((await render('quick-text'))!);
        expect(h.openForegroundInChatbot).toHaveBeenCalledWith({
            widget: 'quick-text',
            sessionId: 's1ab',
            sessionName: 'John 3:16',
        });
    });

    test('reads the session afresh at each press, never the one it mounted on', async () => {
        const button = (await render('marquee-top'))!;
        await press(button);
        // Nothing stored yet: the strip's own Default.
        expect(h.openForegroundInChatbot).toHaveBeenLastCalledWith({
            widget: 'marquee-top',
            sessionId: '',
            sessionName: 'Default',
        });
        h.settings.set(
            'foreground-marquee-top-sessions',
            JSON.stringify([
                { id: '', name: 'Default' },
                { id: 's2', name: 'Welcome' },
            ]),
        );
        h.settings.set('foreground-marquee-top-active-session', 's2');
        await press(button);
        expect(h.openForegroundInChatbot).toHaveBeenLastCalledWith({
            widget: 'marquee-top',
            sessionId: 's2',
            sessionName: 'Welcome',
        });
    });

    test('a stale active id falls back to the first session, as the strip does', async () => {
        h.settings.set(
            'foreground-countdown-sessions',
            JSON.stringify([{ id: 's9', name: 'Sermon' }]),
        );
        h.settings.set('foreground-countdown-active-session', 'gone');
        await press((await render('countdown'))!);
        expect(h.openForegroundInChatbot).toHaveBeenCalledWith({
            widget: 'countdown',
            sessionId: 's9',
            sessionName: 'Sermon',
        });
    });

    test.each([['camera' as const], ['screen' as const]])(
        '%s has no sessions: the component goes over alone',
        async (widgetKey) => {
            // A sessions list under its name must not be read for it.
            h.settings.set(
                `foreground-${widgetKey}-sessions`,
                JSON.stringify([{ id: 's3', name: 'Stray' }]),
            );
            await press((await render(widgetKey))!);
            expect(h.openForegroundInChatbot).toHaveBeenCalledWith({
                widget: widgetKey,
                sessionId: '',
                sessionName: '',
            });
        },
    );
});
