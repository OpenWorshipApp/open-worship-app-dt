// @vitest-environment jsdom

import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        isInScreen: false,
        listProps: null as any,
    },
    mocks: {
        select: vi.fn(),
        drag: vi.fn(),
        showAppContextMenu: vi.fn(),
        pressElementLikeButton: vi.fn(),
    },
}));

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            src: `file:///${filePath}`,
            fullName: filePath.split(/[\\/]/).at(-1),
            name: filePath.split(/[\\/]/).at(-1),
        }),
    },
}));
vi.mock('../helper/appHooks', async () => {
    const React = (await vi.importActual('react')) as any;
    return {
        useAppCurrentRef: (target: unknown) => {
            const ref = React.useRef(target);
            ref.current = target;
            return ref;
        },
    };
});
vi.mock('../helper/helpers', () => ({
    pressElementLikeButton: mocks.pressElementLikeButton,
}));
vi.mock('../others/FileItemHandlerComp', () => ({
    genCommonMenu: () => [{ menuElement: 'Common' }],
    genShowOnScreensContextMenu: (onSelect: (event: any) => void) => [
        { menuElement: 'Show on screens', onSelect },
    ],
    genTrashContextMenu: () => [{ menuElement: 'Move to trash' }],
}));
vi.mock('../context-menu/ContextMenuDotsButtonComp', () => ({
    default: ({ onOpening }: any) => (
        <button
            data-testid="more"
            onContextMenu={onOpening}
            onClick={onOpening}
        >
            More
        </button>
    ),
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: mocks.showAppContextMenu,
}));
vi.mock('../others/ItemColorNoteComp', () => ({
    default: () => <span data-testid="color-note" />,
}));
vi.mock('./BackgroundListItemComp', () => ({
    default: (props: any) => {
        state.listProps = props;
        return (
            <div
                data-testid="list-row"
                aria-label={props.name}
                draggable={props.isDraggable}
            >
                {props.name}
            </div>
        );
    },
    handleBackgroundTileKeyDown: mocks.pressElementLikeButton,
}));
vi.mock('./backgroundHelpers', () => ({
    genBackgroundMediaItemDataByFilePath: () => ({
        selectedCN: 'app-selected',
        title: 'Clip currently shown on one screen',
        handleSelecting: mocks.select,
        handleDragStart: mocks.drag,
        backgroundType: 'video',
        isInScreen: state.isInScreen,
        selectedBackgroundSrcList: [['8', {}]],
    }),
}));

import BackgroundMediaItemComp from './BackgroundMediaItemComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

function renderTile(
    props: Partial<ComponentProps<typeof BackgroundMediaItemComp>> = {},
) {
    return act(() =>
        root.render(
            <BackgroundMediaItemComp
                rendChild={(
                    filePath,
                    _screens,
                    _width,
                    _height,
                    extraChild,
                ) => (
                    <div data-testid="rendered-child" data-path={filePath}>
                        <audio data-testid="audio" />
                        {extraChild}
                    </div>
                )}
                genExtraItemContextMenuItems={() => [
                    { menuElement: 'Video transition' },
                ]}
                dragType={'background-video' as any}
                onClick={undefined}
                noDraggable={false}
                isNameOnTop={false}
                thumbnailWidth={180}
                thumbnailHeight={100}
                filePath="media/clip.mp4"
                {...props}
            />,
        ),
    );
}

beforeEach(() => {
    state.isInScreen = false;
    state.listProps = null;
    mocks.select.mockClear();
    mocks.drag.mockClear();
    mocks.showAppContextMenu.mockClear();
    mocks.pressElementLikeButton.mockClear();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
});

test('thumbnail tiles expose an accessible name and route click, keyboard and drag actions', async () => {
    await renderTile({ isNameOnTop: true });
    const tile = host.querySelector('[role="button"]') as HTMLDivElement;
    expect(tile.getAttribute('aria-label')).toBe('clip.mp4');
    expect(tile.title).toBe('Clip currently shown on one screen');
    expect(tile.draggable).toBe(true);
    expect(tile.style.width).toBe('180px');
    expect(tile.querySelector('bdi')?.textContent).toBe('clip.mp4');
    expect(
        host
            .querySelector('[data-testid="rendered-child"]')
            ?.getAttribute('data-path'),
    ).toBe('media/clip.mp4');
    expect(host.querySelector('[data-testid="color-note"]')).not.toBeNull();

    await act(async () => tile.click());
    expect(mocks.select).toHaveBeenCalledOnce();

    const key = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    await act(async () => tile.dispatchEvent(key));
    expect(mocks.pressElementLikeButton).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'Enter' }),
    );

    const dragEvent = new Event('dragstart', {
        bubbles: true,
        cancelable: true,
    });
    await act(async () => tile.dispatchEvent(dragEvent));
    expect(mocks.drag).toHaveBeenCalledOnce();

    const audio = host.querySelector('audio') as HTMLAudioElement;
    const audioDragEvent = new Event('dragstart', {
        bubbles: true,
        cancelable: true,
    });
    await act(async () => audio.dispatchEvent(audioDragEvent));
    expect(audioDragEvent.defaultPrevented).toBe(true);
    expect(mocks.drag).toHaveBeenCalledOnce();
});

test('context menu includes common, screen, item-specific and available trash actions', async () => {
    await renderTile();
    const tile = host.querySelector('[role="button"]') as HTMLDivElement;
    const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
    });

    await act(async () => tile.dispatchEvent(event));

    expect(event.defaultPrevented).toBe(false);
    const items = mocks.showAppContextMenu.mock.calls[0][1];
    expect(items.map((item: any) => item.menuElement)).toEqual([
        'Common',
        'Show on screens',
        'Video transition',
        'Move to trash',
    ]);
    const showItem = items[1];
    showItem.onSelect(event);
    expect(mocks.select).toHaveBeenCalledWith(event, true);

    state.isInScreen = true;
    await renderTile();
    const updatedTile = host.querySelector('[role="button"]') as HTMLDivElement;
    await act(async () => updatedTile.dispatchEvent(event));
    expect(
        mocks.showAppContextMenu.mock.calls
            .at(-1)?.[1]
            .map((item: any) => item.menuElement),
    ).toEqual(['Common', 'Show on screens', 'Video transition']);
});

test('list view sends a full-width name row and respects noDraggable', async () => {
    await renderTile({ viewMode: 'list', noDraggable: true });
    const row = host.querySelector(
        '[data-testid="list-row"]',
    ) as HTMLDivElement;
    expect(row.textContent).toBe('clip.mp4');
    expect(row.getAttribute('aria-label')).toBe('clip.mp4');
    expect(row.draggable).toBe(false);
    expect(state.listProps.backgroundType).toBe('video');
    expect(state.listProps.selectedBackgroundSrcList).toEqual([['8', {}]]);
});
