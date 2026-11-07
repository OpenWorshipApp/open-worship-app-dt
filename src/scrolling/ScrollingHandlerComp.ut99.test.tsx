// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    applyToTheTop: vi.fn(),
    applyPlayToBottom: vi.fn(),
    showMenu: vi.fn(),
    press: vi.fn(),
    dotsProps: [] as any[],
}));

vi.mock('./scrollingHandlerHelpers', () => ({
    TO_THE_TOP_STYLE_STRING: '.test-to-top { opacity: 1; }',
    TO_THE_TOP_CLASSNAME: 'test-to-top',
    PLAY_TO_BOTTOM_CLASSNAME: 'test-play-to-bottom',
    PLAY_TO_BOTTOM_MENU_CLASSNAME: 'test-play-menu',
    applyToTheTop: h.applyToTheTop,
    applyPlayToBottom: h.applyPlayToBottom,
}));
vi.mock('./playToBottomMenuHelpers', () => ({
    showPlayToBottomContextMenu: h.showMenu,
}));
vi.mock('../context-menu/ContextMenuDotsButtonComp', () => ({
    default: (props: any) => {
        h.dotsProps.push(props);
        return (
            <button
                type="button"
                className={props.className}
                aria-label={props.label}
                onClick={(event) => props.onOpening(event)}
            />
        );
    },
}));
vi.mock('../helper/domHelpers', () => ({
    HoverMotionHandler: { lowVisibleClassname: 'test-low-visible' },
}));
vi.mock('../helper/helpers', () => ({
    pressElementLikeButton: h.press,
}));
vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

import ScrollingHandlerComp from './ScrollingHandlerComp';

let container: HTMLDivElement;
let root: Root;

function toTopButton() {
    return container.querySelector<HTMLElement>('i.test-to-top')!;
}

function playButton() {
    return container.querySelector<HTMLElement>('i.test-play-to-bottom');
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    h.dotsProps.length = 0;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

describe('ScrollingHandlerComp', () => {
    test('alone, it is the to-the-top button over its own scroller', () => {
        act(() =>
            root.render(
                <ScrollingHandlerComp
                    style={{ bottom: '60px' }}
                    scrollingContainerSelector=".test-scroller"
                />,
            ),
        );
        expect(container.querySelector('style')?.textContent).toBe(
            '.test-to-top { opacity: 1; }',
        );
        const toTop = toTopButton();
        expect(toTop.getAttribute('role')).toBe('button');
        expect(toTop.tabIndex).toBe(0);
        expect(toTop.getAttribute('aria-label')).toBe('Scroll to the top');
        expect(toTop.title).toBe('Scroll to the top');
        expect(toTop.className).toContain('test-low-visible-1');
        expect(toTop.style.width).toBe('45px');
        expect(toTop.style.height).toBe('45px');
        // The host's placement rides on top of the button's own box.
        expect(toTop.style.bottom).toBe('60px');
        expect(h.applyToTheTop).toHaveBeenCalledWith(toTop, '.test-scroller');
        expect(playButton()).toBeNull();
        expect(container.querySelector('.test-play-menu')).toBeNull();
        expect(h.applyPlayToBottom).not.toHaveBeenCalled();
    });

    test('a key press goes the mouse path', () => {
        act(() => root.render(<ScrollingHandlerComp />));
        const toTop = toTopButton();
        act(() => {
            toTop.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
            );
        });
        expect(h.press).toHaveBeenCalledTimes(1);
        expect(h.press.mock.calls[0][0].key).toBe('Enter');
        expect(h.applyToTheTop).toHaveBeenCalledWith(toTop, undefined);
    });

    test('with auto-scroll: the chevron, then its menu, then to-the-top', () => {
        const movedCheck = { isMoved: false } as any;
        const onAutoScrollFrame = vi.fn();
        act(() =>
            root.render(
                <ScrollingHandlerComp
                    shouldShowPlayToBottom
                    playToBottomStyle={{ bottom: '100px' }}
                    movedCheck={movedCheck}
                    onAutoScrollFrame={onAutoScrollFrame}
                />,
            ),
        );
        const play = playButton()!;
        expect(play).not.toBeNull();
        expect(play.getAttribute('aria-label')).toBe('Play to bottom');
        expect(play.className).toContain('bi-chevron-double-down');
        expect(play.className).toContain('test-low-visible-1');
        expect(play.style.bottom).toBe('100px');
        expect(play.style.width).toBe('45px');
        expect(h.applyPlayToBottom).toHaveBeenCalledWith(
            play,
            movedCheck,
            onAutoScrollFrame,
        );
        // The stylesheet reveals the menu with a sibling selector on the
        // chevron: the order in the markup is load-bearing.
        const order = Array.from(container.children).map((element) => {
            return element.tagName + '.' + element.className.split(' ')[0];
        });
        expect(order).toEqual([
            'STYLE.',
            'I.test-play-to-bottom',
            'BUTTON.test-play-menu',
            'I.test-to-top',
        ]);
        const dots = h.dotsProps.at(-1);
        expect(dots).toMatchObject({
            isHorizontal: true,
            className: 'test-play-menu',
            label: 'Auto Scroll Options',
            style: { bottom: '100px', right: '46px', marginBottom: '11px' },
        });
    });

    test('the menu opens for the chevron it sits beside', () => {
        act(() => root.render(<ScrollingHandlerComp shouldShowPlayToBottom />));
        const menuButton =
            container.querySelector<HTMLButtonElement>('.test-play-menu')!;
        act(() => menuButton.click());
        expect(h.showMenu).toHaveBeenCalledTimes(1);
        const [event, playElement] = h.showMenu.mock.calls[0];
        expect(event.type).toBe('click');
        expect(playElement).toBe(playButton());
        // The chevron's own keys go the mouse path too.
        act(() => {
            playElement.dispatchEvent(
                new KeyboardEvent('keydown', { key: ' ', bubbles: true }),
            );
        });
        expect(h.press).toHaveBeenCalledTimes(1);
    });
});
