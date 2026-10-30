// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { DragTypeEnum } from '../../helper/DragInf';

const h = vi.hoisted(() => ({
    handleDragStart: vi.fn(),
}));

vi.mock('../../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: (current: unknown) => {
            const ref = useRef(current);
            ref.current = current;
            return ref;
        },
    };
});
vi.mock('../../helper/bibleViewHelpers', () => ({
    useBibleViewFontSizeContext: () => 24,
}));
vi.mock('../../helper/dragHelpers', () => ({
    handleDragStart: h.handleDragStart,
}));
vi.mock('../../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: (bibleKey: string) => `${bibleKey} Font`,
}));

import BibleViewTitleWrapperComp from './BibleViewTitleWrapperComp';

const BIBLE_ITEM = { id: 2, bibleKey: 'KHM' } as any;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
    vi.unstubAllGlobals();
});

async function render(bibleItem?: any, wrap = true) {
    const title = (
        <BibleViewTitleWrapperComp bibleKey="KHM" bibleItem={bibleItem}>
            <b>John 3:16</b>
        </BibleViewTitleWrapperComp>
    );
    let element: ReactNode = title;
    if (wrap) {
        element = (
            <div className="bible-view" data-do-not-allow-drop="0">
                <div className="header">{title}</div>
            </div>
        );
    }
    await act(async () => {
        root.render(element);
    });
    return host.querySelector<HTMLSpanElement>('span.title')!;
}

async function fire(element: HTMLElement, type: string) {
    await act(async () => {
        element.dispatchEvent(new Event(type, { bubbles: true }));
    });
}

describe('BibleViewTitleWrapperComp', () => {
    test("draws the title in the bible's face at the view's size", async () => {
        const title = await render(BIBLE_ITEM);
        expect(title.textContent).toBe('John 3:16');
        expect(title.style.fontSize).toBe('24px');
        expect(title.style.fontFamily).toBe('KHM Font');
        expect(title.draggable).toBe(true);
    });

    test('dragging the title carries its passage, and its own view refuses it', async () => {
        const title = await render(BIBLE_ITEM);
        const view = host.querySelector<HTMLDivElement>('.bible-view')!;
        await fire(title, 'dragstart');
        expect(view.dataset.doNotAllowDrop).toBe('1');
        expect(h.handleDragStart).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'dragstart' }),
            BIBLE_ITEM,
            DragTypeEnum.BIBLE_ITEM_TARGET_ONLY,
        );
        await fire(title, 'dragend');
        expect(view.dataset.doNotAllowDrop).toBe('0');
    });

    test('a title with no passage behind it does not drag', async () => {
        const title = await render(undefined);
        expect(title.draggable).toBe(false);
        await fire(title, 'dragstart');
        expect(h.handleDragStart).not.toHaveBeenCalled();
        expect(
            host.querySelector<HTMLDivElement>('.bible-view')!.dataset
                .doNotAllowDrop,
        ).toBe('0');
    });

    test('a title outside any bible view still drags', async () => {
        const title = await render(BIBLE_ITEM, false);
        await fire(title, 'dragstart');
        expect(h.handleDragStart).toHaveBeenCalledOnce();
        await fire(title, 'dragend');
        expect(host.querySelector('[data-do-not-allow-drop]')).toBeNull();
    });
});
