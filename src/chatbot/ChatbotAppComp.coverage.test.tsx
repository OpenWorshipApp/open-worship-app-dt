// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { settings } = vi.hoisted(() => ({
    settings: new Map<string, string>(),
}));

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false, isGlassCapable: false },
        messageUtils: {
            sendDataSync: () => null,
            listenForData: () => {},
            removeListener: () => {},
        },
        pathUtils: { sep: '/', join: (...parts: string[]) => parts.join('/') },
    },
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => settings.get(key) ?? null,
    setSetting: (key: string, value: string) => settings.set(key, value),
}));
vi.mock('../helper/appHooks', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../helper/appHooks')>()),
    // These tests drive synchronous controls; startup subscriptions do not run.
    useAppEffect: () => {},
}));

import ChatbotAppComp from './ChatbotAppComp';

describe('help window', () => {
    let container: HTMLDivElement;
    let root: Root;
    beforeEach(() => {
        settings.clear();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });
    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        settings.clear();
    });

    function render() {
        act(() => root.render(<ChatbotAppComp />));
    }

    function click(selector: string) {
        const button = container.querySelector<HTMLButtonElement>(selector);
        expect(button).not.toBeNull();
        act(() => button!.click());
    }

    function typeQuestion(value: string) {
        const box =
            container.querySelector<HTMLTextAreaElement>('.chat-input')!;
        const setter = Object.getOwnPropertyDescriptor(
            HTMLTextAreaElement.prototype,
            'value',
        )!.set!;
        act(() => {
            setter.call(box, value);
            box.dispatchEvent(new Event('input', { bubbles: true }));
        });
        expect(box.value).toBe(value);
    }

    test('offers questions, the guide, and an explicit report action', () => {
        const html = renderToStaticMarkup(<ChatbotAppComp />);
        expect(html).toContain('Asking about');
        expect(html).toContain('Try asking');
        expect(html).toContain('Report a problem with the app');
    });

    test('folds the choices and restores them when pressed again', () => {
        render();
        const fold = () =>
            container.querySelector<HTMLButtonElement>('.chat-head-fold')!;
        expect(container.textContent).toContain('Asking about');
        click('.chat-head-fold');
        expect(fold().getAttribute('aria-expanded')).toBe('false');
        expect(container.querySelector('.chat-head-body')).toBeNull();
        click('.chat-head-fold');
        expect(fold().getAttribute('aria-expanded')).toBe('true');
        expect(
            container.querySelector('.chat-head-body')?.textContent,
        ).toContain('Asking about');
    });

    test('reveals the full question list and hides it again', () => {
        render();
        const more = () =>
            container.querySelector<HTMLButtonElement>('.chat-more')!;
        expect(more().getAttribute('aria-expanded')).toBe('false');
        click('.chat-more');
        expect(more().getAttribute('aria-expanded')).toBe('true');
        expect(container.textContent).toContain('Fetching the list');
        click('.chat-more');
        expect(more().getAttribute('aria-expanded')).toBe('false');
        expect(container.textContent).not.toContain('Fetching the list');
    });

    test('hides the caution for 30 days when explicitly pressed', () => {
        render();
        expect(container.querySelector('.chat-caution')).not.toBeNull();
        click('.chat-caution-hide');
        expect(container.querySelector('.chat-caution')).toBeNull();
    });

    test('tip arrows change the tip and keep focus in the question box', () => {
        render();
        const tip = () => container.querySelector('.chat-tip')!.textContent;
        const original = tip();
        click('[aria-label="Next tip"]');
        expect(tip()).not.toBe(original);
        expect(document.activeElement).toBe(
            container.querySelector('.chat-input'),
        );
        click('[aria-label="Previous tip"]');
        expect(tip()).toBe(original);
    });

    test('report asks for confirmation with the typed complaint and typing clears it', () => {
        render();
        typeQuestion('The projector is blank');
        click('.chat-report');
        const confirmation = container.querySelector('[role="alertdialog"]');
        expect(confirmation?.textContent).toContain('The projector is blank');
        expect(confirmation?.textContent).toContain('nothing is sent');
        typeQuestion('The projector is still blank');
        expect(container.querySelector('[role="alertdialog"]')).toBeNull();
        click('.chat-report');
        click('.chat-report-no');
        expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    });

    test('a slash command appears as a suggestion and Tab completes without asking', () => {
        render();
        typeQuestion('/bt');
        expect(container.textContent).toContain('/btw');
        const box =
            container.querySelector<HTMLTextAreaElement>('.chat-input')!;
        act(() =>
            box.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Tab',
                    bubbles: true,
                    cancelable: true,
                }),
            ),
        );
        expect(box.value).toBe('/btw ');
        expect(container.querySelector('.chat-cues')).toBeNull();
    });

    test('lists commands offline and clears the current unlocked chat', async () => {
        render();
        typeQuestion('/commands');
        await act(async () => {
            container.querySelector<HTMLButtonElement>('.chat-send')!.click();
        });
        expect(container.querySelector('.chat-cues')?.textContent).toContain(
            '/commands',
        );
        expect(container.querySelector('.chat-cues')?.textContent).toContain(
            '/screen',
        );
        typeQuestion('/clear');
        await act(async () => {
            container.querySelector<HTMLButtonElement>('.chat-send')!.click();
        });
        expect(container.querySelector('.chat-cues')).toBeNull();
        expect(
            container.querySelector<HTMLTextAreaElement>('.chat-input')?.value,
        ).toBe('');
    });

    test('refuses to clear a locked chat and keeps its earlier message', async () => {
        settings.set(
            'chatbot-sessions',
            JSON.stringify({
                activeId: 'locked',
                sessions: [
                    {
                        id: 'locked',
                        title: 'Service notes',
                        messages: [
                            {
                                id: 1,
                                author: 'you',
                                text: 'Keep this question',
                            },
                        ],
                        draft: '',
                        focus: 'presenter',
                        isFocusChosen: true,
                        provider: null,
                        model: '',
                        isLocked: true,
                    },
                ],
            }),
        );
        render();
        expect(container.querySelector('.chat-cues')?.textContent).toContain(
            'Keep this question',
        );
        typeQuestion('/clear');
        await act(async () => {
            container.querySelector<HTMLButtonElement>('.chat-send')!.click();
        });
        expect(container.querySelector('.chat-cues')?.textContent).toContain(
            'Keep this question',
        );
        expect(container.querySelector('.chat-cues')?.textContent).toContain(
            'This chat is locked',
        );
    });

    test('a bad rating marks the answer and adds one follow-up', () => {
        settings.set(
            'chatbot-sessions',
            JSON.stringify({
                activeId: 'rated',
                sessions: [
                    {
                        id: 'rated',
                        title: '',
                        messages: [
                            {
                                id: 1,
                                author: 'you',
                                text: 'Where is Clear All?',
                            },
                            { id: 2, author: 'bot', text: 'Look at the top.' },
                        ],
                        draft: '',
                        focus: 'presenter',
                        isFocusChosen: true,
                        provider: null,
                        model: '',
                        isLocked: false,
                    },
                ],
            }),
        );
        render();
        click('[aria-label="Bad answer"]');
        const answer = container.querySelector('.cue-bot')!;
        expect(
            answer
                .querySelector('[aria-label="Bad answer"]')
                ?.getAttribute('aria-pressed'),
        ).toBe('true');
        expect(container.querySelectorAll('.cue-bot')).toHaveLength(2);
        click('[aria-label="Bad answer"]');
        expect(container.querySelectorAll('.cue-bot')).toHaveLength(2);
    });
});
