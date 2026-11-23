// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readLangPackageDictionaries } from '../test-setup/langPackageDirs';

// The robot in Customize and in Shader Code: drawn while AI is on, and the
// press that opens the help window on THIS editor (loaded at the press).
const h = vi.hoisted(() => ({
    isAIEnabled: true,
    dictionaries: [] as Record<string, string>[],
    openChatbotWithAnimation: vi.fn(),
    handleError: vi.fn(),
}));

// English labels, while every installed package's dictionary is held to
// having the key: a label missing in any of them throws as in a dev window.
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
vi.mock('../helper/errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../helper/ai/chatbotHandoffHelpers', () => ({
    openChatbotWithAnimation: h.openChatbotWithAnimation,
}));

import AnimationChatbotButtonComp from './AnimationChatbotButtonComp';
import {
    listAnimationAgentEditors,
    registerAnimationAgentEditor,
} from './animationAgentEditorRegistry';

const GLSL_SRC = 'glsl?name=plasma&colors=0F172A-7C3AED&speed=fast&quality=low';

let root: Root;
let container: HTMLDivElement;
const cleanupList: (() => void)[] = [];

function render(isInTitleBar = false) {
    act(() => {
        root.render(
            createElement(AnimationChatbotButtonComp, {
                editorId: 'background:0',
                isInTitleBar,
            }),
        );
    });
}

beforeEach(() => {
    h.isAIEnabled = true;
    h.dictionaries = readLangPackageDictionaries();
    h.openChatbotWithAnimation.mockReset().mockResolvedValue(true);
    h.handleError.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    while (cleanupList.length > 0) {
        cleanupList.pop()?.();
    }
});

function openEditor(id: string, src: string) {
    cleanupList.push(
        registerAnimationAgentEditor({
            id,
            place: 'background',
            screenId: 0,
            getDraftSrc: () => src,
            setDraftSrc: () => true,
            openCode: () => false,
        }),
    );
}

describe('AnimationChatbotButtonComp', () => {
    it('draws nothing while AI is off', () => {
        h.isAIEnabled = false;
        render();
        expect(container.innerHTML).toBe('');
    });

    it('draws the robot, its title in every language', () => {
        render();
        const button = container.querySelector('button');
        expect(button?.title).toBe('Open in Chatbot');
        expect(button?.className).toContain('btn');
        expect(button?.querySelector('.bi-robot')).not.toBeNull();
        render(true);
        expect(container.querySelector('button')?.className).toBe(
            'floating-widget__button',
        );
    });

    it('opens the help window on its editor, put first', async () => {
        openEditor('background:0', GLSL_SRC);
        openEditor('foreground:0', GLSL_SRC);
        render();
        await act(async () => {
            container.querySelector('button')?.click();
        });
        expect(h.openChatbotWithAnimation).toHaveBeenCalledWith({
            editorId: 'background:0',
            name: 'Plasma',
            engine: 'glsl',
        });
        // The one asked about is the one the robot was pressed in.
        expect(listAnimationAgentEditors()[0].id).toBe('background:0');
    });

    it('does nothing with no animation to name, and reports a failure', async () => {
        render();
        await act(async () => {
            container.querySelector('button')?.click();
        });
        expect(h.openChatbotWithAnimation).not.toHaveBeenCalled();
        openEditor('background:0', GLSL_SRC);
        const error = new Error('the window would not open');
        h.openChatbotWithAnimation.mockRejectedValue(error);
        await act(async () => {
            container.querySelector('button')?.click();
        });
        expect(h.handleError).toHaveBeenCalledWith(error);
    });
});
