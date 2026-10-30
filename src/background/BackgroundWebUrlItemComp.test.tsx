// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// A saved URL's tile in the Webs tab: shown, dragged, copied, styled per
// transition and removed -- the last only while it is on no screen.

const { state, mocks } = vi.hoisted(() => ({
    state: {
        isInScreen: false,
        listItemProps: null as any,
        webChildProps: null as any,
        colorNoteProps: [] as any[],
    },
    mocks: {
        handleSelecting: vi.fn(),
        menu: vi.fn(),
        drag: vi.fn(),
        copy: vi.fn(),
        remove: vi.fn(),
        colorNoteChange: vi.fn(),
    },
}));

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: mocks.menu,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon:${name}`,
}));
vi.mock('../helper/dragHelpers', () => ({ handleDragStart: mocks.drag }));
vi.mock('./backgroundHelpers', () => ({
    genBackgroundMediaItemData: (
        titlePrefix: string,
        src: string,
        dragType: string,
    ) => ({
        selectedCN: state.isInScreen ? 'highlight-selected animation' : '',
        title: `${titlePrefix}|${src}|${dragType}`,
        handleSelecting: mocks.handleSelecting,
        backgroundType: 'web',
        isInScreen: state.isInScreen,
        selectedBackgroundSrcList: state.isInScreen ? [['1', {}]] : [],
    }),
}));
vi.mock('../others/FileItemHandlerComp', () => ({
    genShowOnScreensContextMenu: (onClick: (event: any) => void) => [
        { menuElement: 'Show on Screens', onSelect: onClick },
    ],
}));
vi.mock('../context-menu/ContextMenuDotsButtonComp', () => ({
    default: ({ onOpening }: any) => (
        <button type="button" aria-label="more" onClick={onOpening} />
    ),
}));
vi.mock('../others/ItemColorNoteComp', () => ({
    default: (props: any) => {
        state.colorNoteProps.push(props);
        return <span data-color-note={props.item.id} />;
    },
}));
vi.mock('../server/appHelpers', () => ({ copyToClipboard: mocks.copy }));
vi.mock('./BackgroundWebChildComp', () => ({
    RenderWebChildComp: (props: any) => {
        state.webChildProps = props;
        return <div data-web-child>{props.extraChild}</div>;
    },
}));
vi.mock('./BackgroundListItemComp', () => ({
    default: (props: any) => {
        state.listItemProps = props;
        return (
            <div
                data-list-item
                onClick={props.onClick}
                onContextMenu={props.onContextMenu}
            >
                {props.colorNoteChild}
            </div>
        );
    },
}));
vi.mock('./backgroundTransitionMenuHelpers', () => ({
    genBackgroundItemTransitionMenuItems: (type: string, src: string) => [
        { menuElement: `Transition ${type}`, src },
    ],
}));

import BackgroundWebUrlItemComp from './BackgroundWebUrlItemComp';

let container: HTMLDivElement;
let root: Root;
const urlSource = {
    id: 'u1',
    src: 'https://one.example/',
    fullName: 'https://one.example/page',
    name: 'one.example page',
} as any;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.isInScreen = false;
    state.listItemProps = null;
    state.webChildProps = null;
    state.colorNoteProps = [];
    mocks.remove.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

async function render(viewMode?: 'thumbnail' | 'list') {
    await act(async () => {
        root.render(
            <BackgroundWebUrlItemComp
                urlSource={urlSource}
                thumbnailWidth={160}
                thumbnailHeight={90}
                onRemove={mocks.remove}
                onColorNoteChange={mocks.colorNoteChange}
                viewMode={viewMode}
            />,
        );
    });
}
async function openMenu(element: Element) {
    await act(async () => {
        element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    });
    return mocks.menu.mock.calls.at(-1)![1] as any[];
}

describe('a saved URL tile', () => {
    test('is a thumbnail card by default, named by its URL and shown with a click', async () => {
        await render();
        const card = container.firstElementChild as HTMLElement;
        expect(card.className).toBe('web-thumbnail card ');
        expect(card.title).toBe(
            'https://one.example/page|https://one.example/|bg-web',
        );
        expect(card.style.width).toBe('160px');
        expect(card.dataset.fileItemFileSrc).toBe('https://one.example/');
        expect(card.querySelector('bdi')!.textContent).toBe('one.example page');
        expect(state.webChildProps).toMatchObject({
            fileOrUrlSource: urlSource,
            width: 160,
            height: 90,
            isUrl: true,
            selectedBackgroundSrcList: [],
        });
        expect(state.colorNoteProps[0]).toMatchObject({
            item: urlSource,
            onChange: mocks.colorNoteChange,
        });
        await act(async () => card.click());
        expect(mocks.handleSelecting).toHaveBeenCalledTimes(1);
        expect(mocks.handleSelecting.mock.calls[0]).toHaveLength(1);
    });

    test('drags the URL source itself as a web background', async () => {
        await render();
        const card = container.firstElementChild as HTMLElement;
        await act(async () => {
            card.dispatchEvent(new Event('dragstart', { bubbles: true }));
        });
        expect(mocks.drag).toHaveBeenCalledWith(
            expect.anything(),
            urlSource,
            'bg-web',
        );
    });

    test('its menu copies the URL, shows it on chosen screens, sets its transition and removes it', async () => {
        await render();
        const items = await openMenu(container.firstElementChild!);
        expect(items.map((item) => item.menuElement)).toEqual([
            'Copy URL to Clipboard',
            'Show on Screens',
            'Transition web',
            'Remove URL',
        ]);
        expect(items[0].childBefore).toBe('icon:clipboard');
        expect(items[2].src).toBe('https://one.example/');
        items[0].onSelect();
        expect(mocks.copy).toHaveBeenCalledWith('https://one.example/');
        items[1].onSelect({ type: 'menu' });
        expect(mocks.handleSelecting).toHaveBeenLastCalledWith(
            { type: 'menu' },
            true,
        );
        items[3].onSelect();
        expect(mocks.remove).toHaveBeenCalledWith(urlSource);
        // The dots open the same menu.
        await act(async () => {
            (
                container.querySelector(
                    'button[aria-label="more"]',
                ) as HTMLButtonElement
            ).click();
        });
        expect(mocks.menu).toHaveBeenCalledTimes(2);
    });

    test('a URL on a screen cannot be removed from under it', async () => {
        state.isInScreen = true;
        await render();
        const card = container.firstElementChild as HTMLElement;
        expect(card.className).toContain('highlight-selected');
        const items = await openMenu(card);
        expect(items.map((item) => item.menuElement)).not.toContain(
            'Remove URL',
        );
    });

    test('as a list row it hands the same actions to the row', async () => {
        state.isInScreen = true;
        await render('list');
        expect(state.webChildProps).toBeNull();
        expect(state.listItemProps).toMatchObject({
            backgroundType: 'web',
            name: 'https://one.example/page',
            selectedCN: 'highlight-selected animation',
            src: 'https://one.example/',
            isDraggable: true,
            selectedBackgroundSrcList: [['1', {}]],
        });
        expect(
            container.querySelector('[data-color-note="u1"]'),
        ).not.toBeNull();
        const row = container.querySelector('[data-list-item]')!;
        await act(async () => (row as HTMLElement).click());
        expect(mocks.handleSelecting).toHaveBeenCalledTimes(1);
        const items = await openMenu(row);
        expect(items[0].menuElement).toBe('Copy URL to Clipboard');
        state.listItemProps.onDragStart({ type: 'dragstart' });
        expect(mocks.drag).toHaveBeenCalledWith(
            { type: 'dragstart' },
            urlSource,
            'bg-web',
        );
    });
});
