// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    isAiEnabled: true,
    open: vi.fn(),
}));

vi.mock('../helper/ai/aiHelpers', () => ({
    getIsAIEnabled: () => h.isAiEnabled,
}));
vi.mock('../helper/ai/lyricChatbotMenuHelpers', () => ({
    openDocumentInChatbot: h.open,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));

import SlideEditorChatbotButtonComp from './SlideEditorChatbotButtonComp';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    h.isAiEnabled = true;
    h.open.mockReset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

describe('the Slide Editor footer’s Open in Chatbot', () => {
    it('opens the help window on the document being edited', async () => {
        await act(async () => {
            root.render(
                createElement(SlideEditorChatbotButtonComp, {
                    filePath: 'C:\\docs\\Preaching.ows',
                }),
            );
        });
        const button = container.querySelector('button');
        expect(button?.getAttribute('aria-label')).toBe('Open in Chatbot');
        await act(async () => button?.click());
        expect(h.open).toHaveBeenCalledWith('C:\\docs\\Preaching.ows');
    });

    it('is not there while AI is off', async () => {
        h.isAiEnabled = false;
        await act(async () => {
            root.render(
                createElement(SlideEditorChatbotButtonComp, {
                    filePath: 'C:\\docs\\Preaching.ows',
                }),
            );
        });
        expect(container.querySelector('button')).toBeNull();
    });
});
