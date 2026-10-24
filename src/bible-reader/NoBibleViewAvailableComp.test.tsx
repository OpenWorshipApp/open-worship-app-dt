// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    addBibleItem: vi.fn(),
    handleError: vi.fn(),
}));

vi.mock('../server/appProvider', () => ({
    default: {
        isPageReader: true,
        isPagePresenter: false,
        isPageScreen: false,
        systemUtils: { isDev: false },
        pathUtils: {
            sep: '/',
            join: (...paths: string[]) => paths.join('/'),
            basename: (path: string) => path.split('/').pop() ?? '',
            dirname: (path: string) => path.split('/').slice(0, -1).join('/'),
        },
        envUtils: { isFEUseEffectWarning: false },
        appUtils: { handleError: h.handleError },
        reload: () => {},
        fileUtils: { watch: () => {} },
        messageUtils: { listenForData: () => {}, sendData: () => {} },
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('./BibleItemsViewController', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    useBibleItemsViewControllerContext: () => ({
        addBibleItem: h.addBibleItem,
    }),
}));

const { default: NoBibleViewAvailableComp } =
    await import('./NoBibleViewAvailableComp');
const { DragTypeEnum } = await import('../helper/DragInf');
const { ReadIdOnlyBibleItem } = await import('./ReadIdOnlyBibleItem');

let root: Root;
let container: HTMLDivElement;

function drop(text: string) {
    const event = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', {
        value: { getData: () => text },
    });
    act(() => {
        container.querySelector('.bible-view')!.dispatchEvent(event);
    });
}

beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.addBibleItem.mockClear();
    h.handleError.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(createElement(NoBibleViewAvailableComp)));
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('NoBibleViewAvailableComp', () => {
    it('opens a dropped passage, or a dragged view title, as the first view', () => {
        const data = {
            id: 7,
            bibleKey: 'KJV',
            target: {
                bookKey: 'JHN',
                chapter: 3,
                verseStart: 16,
                verseEnd: 16,
            },
        };
        drop(JSON.stringify({ type: DragTypeEnum.BIBLE_ITEM, data }));
        drop(
            JSON.stringify({
                type: DragTypeEnum.BIBLE_ITEM_TARGET_ONLY,
                data,
            }),
        );
        expect(h.addBibleItem).toHaveBeenCalledTimes(2);
        const [source, opened, ...flags] = h.addBibleItem.mock.calls[0];
        expect(source).toBeNull();
        expect(opened).toBeInstanceOf(ReadIdOnlyBibleItem);
        expect(opened.bibleKey).toBe('KJV');
        expect(opened.target.chapter).toBe(3);
        expect(flags).toEqual([false, false, false]);
    });

    // An OS file drags no text, a link or a run-sheet row drags plain text:
    // none of them is a passage, and none of them is an error.
    it('quietly ignores a drop that is not a passage', () => {
        for (const text of [
            '',
            'Sunday service',
            'null',
            JSON.stringify({ type: DragTypeEnum.NOTE_ITEM, data: {} }),
        ]) {
            drop(text);
        }
        expect(h.addBibleItem).not.toHaveBeenCalled();
        expect(h.handleError).not.toHaveBeenCalled();
    });
});
