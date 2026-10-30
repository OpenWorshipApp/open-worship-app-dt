// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import StickyAutoHideComp from './StickyAutoHideComp';
import {
    STICKY_AUTO_HIDE_CLASSNAME,
    STICKY_HIDDEN_CLASSNAME,
} from './stickyAutoHideHelpers';

let host: HTMLDivElement;
let root: Root;
let now: number;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

async function renderInScroller(overflowY: string) {
    await act(async () =>
        root.render(
            <div className="scroller" style={{ overflowY } as any}>
                <div className="inner">
                    <StickyAutoHideComp className="toolbar">
                        <button type="button">Add</button>
                    </StickyAutoHideComp>
                </div>
            </div>,
        ),
    );
    const scroller = host.querySelector<HTMLDivElement>('.scroller')!;
    let scrollTop = 0;
    Object.defineProperty(scroller, 'scrollTop', {
        configurable: true,
        get: () => scrollTop,
    });
    const bar = host.querySelector<HTMLDivElement>(
        `.${STICKY_AUTO_HIDE_CLASSNAME}`,
    )!;
    const scrollTo = (top: number, afterMilliseconds = 16) => {
        scrollTop = top;
        now += afterMilliseconds;
        scroller.dispatchEvent(new Event('scroll'));
    };
    return { bar, scrollTo };
}

function isHidden(bar: HTMLElement) {
    return bar.classList.contains(STICKY_HIDDEN_CLASSNAME);
}

describe('StickyAutoHideComp', () => {
    test('wraps its children in the sticky bar', async () => {
        const { bar } = await renderInScroller('auto');
        expect(bar.className).toBe(`${STICKY_AUTO_HIDE_CLASSNAME} toolbar`);
        expect(bar.querySelector('button')!.textContent).toBe('Add');
    });

    test('hides on a scroll down and comes back on a quick flick up', async () => {
        const { bar, scrollTo } = await renderInScroller('auto');
        scrollTo(10);
        expect(isHidden(bar)).toBe(false);
        scrollTo(80);
        expect(isHidden(bar)).toBe(true);
        // A tiny movement keeps whatever the bar is doing.
        scrollTo(78);
        expect(isHidden(bar)).toBe(true);
        scrollTo(20);
        expect(isHidden(bar)).toBe(false);
    });

    test('always shows again back at the top', async () => {
        const { bar, scrollTo } = await renderInScroller('scroll');
        scrollTo(200);
        expect(isHidden(bar)).toBe(true);
        scrollTo(0, 5000);
        expect(isHidden(bar)).toBe(false);
    });

    test('unmounting stops listening and leaves the bar shown', async () => {
        const { bar, scrollTo } = await renderInScroller('auto');
        scrollTo(200);
        expect(isHidden(bar)).toBe(true);
        await act(async () => root.render(<div className="scroller" />));
        expect(isHidden(bar)).toBe(false);
        scrollTo(600);
        expect(isHidden(bar)).toBe(false);
    });

    test('with no scrolling ancestor it never hides', async () => {
        const { bar, scrollTo } = await renderInScroller('visible');
        scrollTo(300);
        expect(isHidden(bar)).toBe(false);
    });
});
