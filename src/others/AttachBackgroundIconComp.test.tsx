// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
    type Mock,
} from 'vitest';

const state = vi.hoisted(() => ({
    data: null as null | undefined | { type: string; item: any },
    useAttachedBackgroundData: vi.fn(),
    showAppContextMenu: vi.fn(),
    showFileOrDirExplorer: vi.fn(),
}));

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
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../helper/dragHelpers', () => ({
    useAttachedBackgroundData: state.useAttachedBackgroundData,
}));
vi.mock('../helper/helpers', () => ({
    getMenuTitleRevealFile: () => 'Reveal in File Explorer',
}));
vi.mock('../server/appHelpers', () => ({
    showFileOrDirExplorer: state.showFileOrDirExplorer,
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: state.showAppContextMenu,
}));

import AttachBackgroundIconComp from './AttachBackgroundIconComp';
import { DragTypeEnum } from '../helper/DragInf';

let host: HTMLDivElement;
let root: Root;
let parentClick: Mock<() => void>;
let parentContextMenu: Mock<() => void>;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.data = null;
    state.useAttachedBackgroundData.mockImplementation(() => state.data);
    parentClick = vi.fn();
    parentContextMenu = vi.fn();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

async function renderIcon(id?: number) {
    await act(async () =>
        root.render(
            <div onClick={parentClick} onContextMenu={parentContextMenu}>
                <AttachBackgroundIconComp filePath="/docs/a.slides" id={id} />
            </div>,
        ),
    );
    return host.querySelector('button');
}

function genFileSource(name: string) {
    return {
        src: `file:///C:/Users/me/media/${name}`,
        fullName: name,
        filePath: `C:/Users/me/media/${name}`,
    };
}

describe('AttachBackgroundIconComp', () => {
    test('nothing attached, nothing drawn', async () => {
        expect(await renderIcon(2)).toBeNull();
        expect(state.useAttachedBackgroundData).toHaveBeenCalledWith(
            '/docs/a.slides',
            2,
        );
        state.data = undefined;
        expect(await renderIcon()).toBeNull();
    });

    test('a colour shows its swatch, and a press goes nowhere', async () => {
        state.data = { type: DragTypeEnum.BACKGROUND_COLOR, item: '#ff0000' };
        const button = (await renderIcon())!;
        expect(button.title).toBe('Color: #ff0000');
        expect(button.getAttribute('aria-label')).toBe('Color: #ff0000');
        const icon = button.querySelector('i')!;
        expect(icon.className).toBe('bi bi-filter-circle-fill');
        expect(icon.style.color).toBe('rgb(255, 0, 0)');
        await act(async () => button.click());
        // No menu for a colour, but the press stays on the icon.
        expect(state.showAppContextMenu).not.toHaveBeenCalled();
        expect(parentClick).not.toHaveBeenCalled();
    });

    test('a camera names its source', async () => {
        state.data = {
            type: DragTypeEnum.BACKGROUND_CAMERA,
            item: { src: 'camera-42' },
        };
        const button = (await renderIcon())!;
        expect(button.title).toBe('Camera: camera-42');
        expect(button.querySelector('i')!.className).toBe(
            'bi bi-camera-video-fill',
        );
        const event = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
        });
        await act(async () => button.dispatchEvent(event));
        expect(parentContextMenu).not.toHaveBeenCalled();
        expect(state.showAppContextMenu).not.toHaveBeenCalled();
    });

    test.each([
        [DragTypeEnum.BACKGROUND_WEB, 'Web', 'bi bi-globe', 'page.html'],
        [DragTypeEnum.BACKGROUND_IMAGE, 'Image', 'bi bi-image', 'sky.png'],
        [
            DragTypeEnum.BACKGROUND_VIDEO,
            'Video',
            'bi bi-file-earmark-play-fill',
            'loop.mp4',
        ],
    ])(
        'a %s file keeps its path for the tooltip only and reveals it',
        async (type, kind, iconClass, name) => {
            state.data = { type, item: genFileSource(name) };
            const button = (await renderIcon())!;
            expect(button.title).toBe(`file:///C:/Users/me/media/${name}`);
            // The accessible name never reads the account path aloud.
            expect(button.getAttribute('aria-label')).toBe(`${kind}: ${name}`);
            expect(button.querySelector('i')!.className).toBe(iconClass);

            await act(async () => button.click());
            expect(parentClick).not.toHaveBeenCalled();
            expect(state.showAppContextMenu).toHaveBeenCalledOnce();
            const [event, items] = state.showAppContextMenu.mock.calls[0];
            expect(event.defaultPrevented).toBe(true);
            expect(items).toHaveLength(1);
            expect(items[0].menuElement).toBe('Reveal in File Explorer');
            items[0].onSelect();
            expect(state.showFileOrDirExplorer).toHaveBeenCalledExactlyOnceWith(
                `C:/Users/me/media/${name}`,
            );

            // A right-click opens the very same menu.
            await act(async () =>
                button.dispatchEvent(
                    new MouseEvent('contextmenu', {
                        bubbles: true,
                        cancelable: true,
                    }),
                ),
            );
            expect(state.showAppContextMenu).toHaveBeenCalledTimes(2);
            expect(parentContextMenu).not.toHaveBeenCalled();
        },
    );

    test('a kind it has no icon for draws nothing', async () => {
        state.data = { type: DragTypeEnum.BACKGROUND_AUDIO, item: {} };
        expect(await renderIcon()).toBeNull();
    });
});
