// @vitest-environment jsdom

import { act, Suspense, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        bible: null as any,
        attached: null as any,
        onUpdate: null as null | (() => Promise<void>),
    },
    mocks: {
        fromFilePath: vi.fn(),
        showConfirm: vi.fn(),
        exportWord: vi.fn(),
        moveItemTo: vi.fn(),
        copy: vi.fn(),
        extractDrop: vi.fn(),
        stopDragging: vi.fn(),
        attachDrop: vi.fn(),
        exportBible: vi.fn(),
    },
}));

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../others/FileItemHandlerComp', () => ({
    default: ({
        fileData,
        renderChild,
        contextMenuItems,
        onDrop,
        reload,
    }: {
        fileData: any;
        renderChild: (data: any) => ReactNode;
        contextMenuItems: Array<{
            menuElement: string;
            onSelect: (event?: unknown) => void;
        }>;
        onDrop: (event: unknown) => void;
        reload: () => void;
    }) => (
        <article onDrop={onDrop}>
            <button type="button" onClick={reload}>
                Reload list
            </button>
            {contextMenuItems.map((item) => (
                <button
                    type="button"
                    key={item.menuElement}
                    onClick={(event) => item.onSelect(event)}
                >
                    {item.menuElement}
                </button>
            ))}
            {fileData ? renderChild(fileData) : null}
        </article>
    ),
}));
vi.mock('../helper/FileSource', () => ({
    default: { getInstance: () => ({ name: 'Default' }) },
}));
vi.mock('./Bible', () => ({
    default: { fromFilePath: mocks.fromFilePath },
}));
vi.mock('../others/AppSuspenseComp', () => ({
    default: ({ children }: { children: ReactNode }) => (
        <Suspense fallback={<span>Loading passages</span>}>{children}</Suspense>
    ),
}));
vi.mock('./RenderBibleItemsComp', () => ({
    default: () => <span>Saved passages</span>,
}));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: mocks.showConfirm,
}));
vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffectAsync: (
            callback: (context: {
                setData: (data: unknown) => void;
            }) => Promise<void>,
            deps: unknown[],
            context: { setData: (data: unknown) => void },
        ) =>
            useEffect(() => {
                void callback(context);
            }, deps),
        useAppCurrentRef: (value: unknown) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('./bibleHelpers', () => ({
    exportToWordDocument: mocks.exportWord,
    moveBibleItemTo: mocks.moveItemTo,
    useIsOnScreen: () => false,
}));
vi.mock('../server/appHelpers', () => ({
    copyToClipboard: mocks.copy,
}));
vi.mock('../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: (_events: unknown, callback: () => Promise<void>) => {
        state.onUpdate = callback;
    },
}));
vi.mock('../helper/dragHelpers', () => ({
    extractDropData: mocks.extractDrop,
    genRemovingAttachedBackgroundMenu: () => [
        { menuElement: 'Remove background', onSelect: () => undefined },
    ],
    handleAttachBackgroundDrop: mocks.attachDrop,
    useAttachedBackgroundData: () => state.attached,
}));
vi.mock('../helper/DragInf', () => ({
    DragTypeEnum: { BIBLE_ITEM: 'bible-item' },
}));
vi.mock('../helper/helpers', () => ({
    stopDraggingState: mocks.stopDragging,
}));
// A real control, as the attached-background button is: the header must
// leave the keys pressed on it alone.
vi.mock('../others/AttachBackgroundIconComp', () => ({
    default: () => <button type="button">Background icon</button>,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));
vi.mock('./bibleArchiveHelpers', () => ({
    exportBible: mocks.exportBible,
}));

import BibleFileComp from './BibleFileComp';

let host: HTMLDivElement;
let root: Root;

function makeBible(items: any[] = []) {
    return {
        filePath: '/bibles/Default.owb',
        items,
        isOpened: false,
        setIsOpened: vi.fn(),
        empty: vi.fn(),
        save: vi.fn(),
        saveBibleItem: vi.fn(),
        moveItemFrom: vi.fn(),
    };
}

async function renderFile() {
    await act(async () =>
        root.render(<BibleFileComp index={0} filePath="/bibles/Default.owb" />),
    );
    await act(async () => Promise.resolve());
}

function click(label: string) {
    const found = [...host.querySelectorAll('button')].find(
        (button) => button.textContent === label,
    );
    expect(found).toBeDefined();
    found!.click();
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.clearAllMocks();
    state.attached = null;
    state.onUpdate = null;
    state.bible = makeBible();
    mocks.fromFilePath.mockImplementation(async () => state.bible);
    mocks.showConfirm.mockResolvedValue(true);
    mocks.extractDrop.mockReturnValue(null);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('saved Bible file row', () => {
    test('loads fresh data, toggles preview and reloads after a file event', async () => {
        await renderFile();
        expect(mocks.fromFilePath).toHaveBeenCalledWith('/bibles/Default.owb');
        expect(host.textContent).toContain('Default');
        await act(async () =>
            host.querySelector<HTMLElement>('.accordion-header')!.click(),
        );
        expect(state.bible.setIsOpened).toHaveBeenCalledWith(true);
        const newBible = makeBible();
        newBible.isOpened = true;
        state.bible = newBible;
        await act(async () => state.onUpdate!());
        expect(host.textContent).toContain('Saved passages');
        await act(async () => click('Reload list'));
        expect(mocks.fromFilePath).toHaveBeenCalledTimes(3);
    });

    test('header is a keyboard control that folds the file open and shut', async () => {
        // Toggles the way the real one does, so a second press closes.
        state.bible.setIsOpened.mockImplementation((isOpened: boolean) => {
            state.bible.isOpened = isOpened;
        });
        await renderFile();
        const header = host.querySelector<HTMLElement>(
            '[aria-label="Default"]',
        )!;
        expect(header.getAttribute('role')).toBe('button');
        expect(header.tabIndex).toBe(0);
        expect(header.getAttribute('aria-expanded')).toBe('false');

        const enter = new KeyboardEvent('keydown', {
            key: 'Enter',
            bubbles: true,
            cancelable: true,
        });
        await act(async () => header.dispatchEvent(enter));
        expect(state.bible.setIsOpened).toHaveBeenLastCalledWith(true);
        expect(enter.defaultPrevented).toBe(true);
        const space = new KeyboardEvent('keydown', {
            key: ' ',
            bubbles: true,
            cancelable: true,
        });
        await act(async () => header.dispatchEvent(space));
        expect(state.bible.setIsOpened).toHaveBeenLastCalledWith(false);
        // Space would otherwise scroll the panel out from under it.
        expect(space.defaultPrevented).toBe(true);
        await act(async () =>
            header.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
            ),
        );
        expect(state.bible.setIsOpened).toHaveBeenCalledTimes(2);

        // A key on the control INSIDE the header is that control's own.
        const inner = [...header.querySelectorAll('button')].find(
            (button) => button.textContent === 'Background icon',
        )!;
        const innerEnter = new KeyboardEvent('keydown', {
            key: 'Enter',
            bubbles: true,
            cancelable: true,
        });
        await act(async () => inner.dispatchEvent(innerEnter));
        expect(state.bible.setIsOpened).toHaveBeenCalledTimes(2);
        expect(innerEnter.defaultPrevented).toBe(false);

        // An opened file reloads with its header saying so.
        const openedBible = makeBible();
        openedBible.isOpened = true;
        state.bible = openedBible;
        await act(async () => state.onUpdate!());
        expect(
            host
                .querySelector('[aria-label="Default"]')!
                .getAttribute('aria-expanded'),
        ).toBe('true');
    });

    test('menu exports, copies and empties a list only after confirmation', async () => {
        const item = {
            toTitleText: vi.fn(async () => ({
                title: 'John 3:16',
                text: 'For God',
            })),
        };
        state.bible = makeBible([item]);
        state.attached = { type: 'image' };
        await renderFile();
        expect(host.textContent).toContain('Remove background');
        await act(async () => click('Export to MS Word'));
        expect(mocks.exportWord).toHaveBeenCalledWith([item]);
        await act(async () => click('Copy All Items'));
        expect(mocks.copy).toHaveBeenCalledWith('John 3:16\nFor God');
        await act(async () => click('Export'));
        expect(mocks.exportBible).toHaveBeenCalledWith('/bibles/Default.owb');
        await act(async () => click('Move All Items To'));
        expect(mocks.moveItemTo).toHaveBeenCalledWith(
            expect.anything(),
            state.bible,
        );
        mocks.showConfirm.mockResolvedValueOnce(false);
        await act(async () => click('Empty'));
        expect(state.bible.empty).not.toHaveBeenCalled();
        await act(async () => click('Empty'));
        expect(state.bible.empty).toHaveBeenCalledOnce();
        expect(state.bible.save).toHaveBeenCalledOnce();
    });

    test('typed passage drops add or move an item and other drops attach a background', async () => {
        await renderFile();
        const freshItem = { id: 1 };
        mocks.extractDrop.mockReturnValueOnce({
            type: 'bible-item',
            item: freshItem,
        });
        await act(async () =>
            host
                .querySelector('article')!
                .dispatchEvent(new Event('drop', { bubbles: true })),
        );
        expect(state.bible.saveBibleItem).toHaveBeenCalledWith(freshItem);
        const existingItem = { id: 2, filePath: '/bibles/Other.owb' };
        mocks.extractDrop.mockReturnValueOnce({
            type: 'bible-item',
            item: existingItem,
        });
        await act(async () =>
            host
                .querySelector('article')!
                .dispatchEvent(new Event('drop', { bubbles: true })),
        );
        expect(state.bible.moveItemFrom).toHaveBeenCalledWith(
            '/bibles/Other.owb',
            existingItem,
        );
        expect(mocks.stopDragging).toHaveBeenCalledTimes(2);
        await act(async () =>
            host
                .querySelector('article')!
                .dispatchEvent(new Event('drop', { bubbles: true })),
        );
        expect(mocks.attachDrop).toHaveBeenCalledWith(expect.anything(), {
            filePath: '/bibles/Default.owb',
        });
    });
});
