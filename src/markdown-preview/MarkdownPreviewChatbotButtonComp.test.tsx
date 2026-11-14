// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    isAIEnabled: true,
    openMarkdownInChatbot: vi.fn(),
}));

vi.mock('../helper/ai/aiHelpers', () => ({
    getIsAIEnabled: () => h.isAIEnabled,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('./markdownPreviewChatbotHelpers', () => ({
    openMarkdownInChatbot: h.openMarkdownInChatbot,
}));

import MarkdownPreviewChatbotButtonComp from './MarkdownPreviewChatbotButtonComp';

let root: Root;
let container: HTMLDivElement;

async function render(filePath: string | null) {
    await act(async () =>
        root.render(
            createElement(MarkdownPreviewChatbotButtonComp, { filePath }),
        ),
    );
    return container.querySelector('button');
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.isAIEnabled = true;
    h.openMarkdownInChatbot.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

// 2026-11-11, the user: _on the markdown file preview should have chatbot
// icon to attach and forcus on chatbot_.
describe("the Markdown Preview toolbar's robot", () => {
    it('hands the file shown to the assistant, under the Resources row words', async () => {
        const button = await render('C:\\r\\notes.md');
        expect(button?.title).toBe('Ask the Assistant About This File');
        expect(button?.getAttribute('aria-label')).toBe(
            'Ask the Assistant About This File',
        );
        expect(button?.querySelector('.bi-robot')).not.toBeNull();
        await act(async () => button?.click());
        expect(h.openMarkdownInChatbot).toHaveBeenCalledWith('C:\\r\\notes.md');
        // After a link took the window to another file, that one.
        const movedButton = await render('C:\\r\\other.md');
        await act(async () => movedButton?.click());
        expect(h.openMarkdownInChatbot).toHaveBeenLastCalledWith(
            'C:\\r\\other.md',
        );
    });

    it('cannot be pressed with no file shown', async () => {
        const button = await render(null);
        expect(button?.disabled).toBe(true);
        await act(async () => button?.click());
        expect(h.openMarkdownInChatbot).not.toHaveBeenCalled();
    });

    it('is not drawn while AI is off, like every way into the assistant', async () => {
        h.isAIEnabled = false;
        expect(await render('C:\\r\\notes.md')).toBeNull();
    });
});
