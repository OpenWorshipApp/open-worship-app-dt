// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    applyToTheTop: vi.fn(),
    applyPlayToBottom: vi.fn(),
    showPlayToBottomContextMenu: vi.fn(),
    pressElementLikeButton: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('./scrollingHandlerHelpers', () => ({
    TO_THE_TOP_STYLE_STRING: '.to-the-top { position: absolute; }',
    TO_THE_TOP_CLASSNAME: 'app-to-the-top',
    PLAY_TO_BOTTOM_CLASSNAME: 'app-play-to-bottom',
    PLAY_TO_BOTTOM_MENU_CLASSNAME: 'app-play-to-bottom-menu',
    applyToTheTop: state.applyToTheTop,
    applyPlayToBottom: state.applyPlayToBottom,
}));
vi.mock('./playToBottomMenuHelpers', () => ({
    showPlayToBottomContextMenu: state.showPlayToBottomContextMenu,
}));
vi.mock('../helper/domHelpers', () => ({
    HoverMotionHandler: { lowVisibleClassname: 'app-low-hover-visible' },
}));
vi.mock('../helper/helpers', () => ({
    pressElementLikeButton: state.pressElementLikeButton,
}));

import ScrollingHandlerComp from './ScrollingHandlerComp';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

function pressEnter(element: Element) {
    element.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
}

describe('ScrollingHandlerComp', () => {
    test('by default only the to-the-top button is drawn and wired', async () => {
        await act(async () =>
            root.render(
                <ScrollingHandlerComp
                    style={{ bottom: '60px' }}
                    scrollingContainerSelector=".bible-view"
                />,
            ),
        );
        expect(host.querySelector('style')!.textContent).toBe(
            '.to-the-top { position: absolute; }',
        );
        const toTop = host.querySelector<HTMLElement>('.app-to-the-top')!;
        expect(toTop.className).toBe(
            'app-to-the-top bi bi-arrow-up-circle app-low-hover-visible-1',
        );
        expect(toTop.getAttribute('role')).toBe('button');
        expect(toTop.getAttribute('aria-label')).toBe('Scroll to the top');
        expect(toTop.title).toBe('Scroll to the top');
        expect(toTop.style.bottom).toBe('60px');
        expect(toTop.style.width).toBe('45px');
        expect(state.applyToTheTop).toHaveBeenCalledWith(toTop, '.bible-view');
        expect(host.querySelector('.app-play-to-bottom')).toBeNull();
        expect(host.querySelector('button')).toBeNull();
        expect(state.applyPlayToBottom).not.toHaveBeenCalled();

        await act(async () => pressEnter(toTop));
        expect(state.pressElementLikeButton).toHaveBeenCalledOnce();
    });

    test('auto scroll adds the play button and its options menu beside it', async () => {
        const movedCheck = vi.fn();
        const onAutoScrollFrame = vi.fn();
        await act(async () =>
            root.render(
                <ScrollingHandlerComp
                    shouldShowPlayToBottom
                    playToBottomStyle={{ bottom: '10px' }}
                    movedCheck={movedCheck as any}
                    onAutoScrollFrame={onAutoScrollFrame as any}
                />,
            ),
        );
        const play = host.querySelector<HTMLElement>('.app-play-to-bottom')!;
        expect(play.getAttribute('aria-label')).toBe('Play to bottom');
        expect(play.style.bottom).toBe('10px');
        expect(state.applyPlayToBottom).toHaveBeenCalledWith(
            play,
            movedCheck,
            onAutoScrollFrame,
        );
        // The menu button comes AFTER the play button: the stylesheet
        // reveals it with a sibling selector.
        const menuButton = host.querySelector<HTMLButtonElement>(
            'button.app-play-to-bottom-menu',
        )!;
        expect(play.nextElementSibling).toBe(menuButton);
        expect(menuButton.getAttribute('aria-label')).toBe(
            'Auto Scroll Options',
        );
        expect(menuButton.style.bottom).toBe('10px');
        expect(menuButton.style.right).toBe('46px');
        expect(menuButton.style.marginBottom).toBe('11px');

        await act(async () => menuButton.click());
        expect(state.showPlayToBottomContextMenu).toHaveBeenCalledOnce();
        const [event, playElement] =
            state.showPlayToBottomContextMenu.mock.calls[0];
        expect(playElement).toBe(play);
        expect(event.type).toBe('click');

        await act(async () => pressEnter(play));
        expect(state.pressElementLikeButton).toHaveBeenCalledOnce();
    });
});
