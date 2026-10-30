// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The Webs tab: web files from a folder AND saved URLs, which belong to no
// folder and are kept in their own setting.

const { state, mocks } = vi.hoisted(() => ({
    state: {
        urlItems: [] as { id: string; src: string; isUrl: true }[],
        dirSource: null as any,
        layerMarker: '',
        thumbnailWidth: 120,
        viewMode: 'thumbnail',
        fileListProps: null as any,
        footerProps: null as any,
        autoPlayProps: null as any,
        bodyArgs: null as any[] | null,
        sessionOptions: null as any,
        activeId: 'session-a',
    },
    mocks: {
        setUrlItems: vi.fn(),
        promptUrl: vi.fn(),
        confirm: vi.fn(),
        zooming: vi.fn(),
        setThumbnailWidth: vi.fn(),
        setViewMode: vi.fn(),
        screenEvents: vi.fn(),
    },
}));

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon:${name}`,
}));
vi.mock('../helper/constants', () => ({
    defaultDataDirNames: { BACKGROUND_WEB: 'webs' },
    dirSourceSettingNames: { BACKGROUND_WEB: 'background-web' },
}));
vi.mock('../helper/dirSourceHelpers', () => ({
    useGenDirSourceReload: () => state.dirSource,
}));
vi.mock('./BackgroundFooterComp', () => ({
    defaultRangeSize: { size: 100, min: 50, max: 500, step: 10 },
    default: (props: any) => {
        state.footerProps = props;
        return <footer />;
    },
}));
vi.mock('../others/AppRangeComp', () => ({
    useZoomingRegistering: mocks.zooming,
}));
vi.mock('./BackgroundMediaComp', () => ({
    useThumbnailWidthSetting: () => [
        state.thumbnailWidth,
        mocks.setThumbnailWidth,
    ],
}));
vi.mock('./BackgroundAutoPlayComp', () => ({
    default: (props: any) => {
        state.autoPlayProps = props;
        return <div data-testid="auto-play" />;
    },
}));
vi.mock('./backgroundHelpers', () => ({
    genBackgroundLayerMarker: (type: string) =>
        type === 'web' ? state.layerMarker : 'wrong-type',
}));
vi.mock('./backgroundWebUrlHelpers', () => ({
    createBackgroundWebUrlSourceList: (items: any[]) =>
        items.map((item) => ({ ...item, fullName: item.src })),
    getBackgroundWebUrlItemList: () => state.urlItems,
    promptBackgroundWebUrlSource: mocks.promptUrl,
    setBackgroundWebUrlItemList: mocks.setUrlItems,
}));
vi.mock('./backgroundWebHelpers', () => ({
    genBackgroundWebContextMenuItems: (dirSource: any, extraItems: any[]) => [
        { menuElement: 'New File', dirSource },
        ...extraItems,
    ],
}));
vi.mock('../_screen/managers/screenEventHelpers', () => ({
    useScreenBackgroundManagerEvents: mocks.screenEvents,
}));
vi.mock('../others/FileListHandlerComp', () => ({
    default: (props: any) => {
        state.fileListProps = props;
        return (
            <div data-testid="file-list">{props.bodyHandler(['a.html'])}</div>
        );
    },
}));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: mocks.confirm,
}));
vi.mock('../server/fileHelpers', () => ({
    getMimetypeExtensions: (name: string) => [`.${name}-ext`],
}));
vi.mock('./BackgroundWebChildComp', () => ({
    basicRenderBody: (...args: any[]) => {
        state.bodyArgs = args;
        return <div data-testid="web-body" />;
    },
}));
vi.mock('./BackgroundViewModeComp', () => ({
    useBackgroundViewModeSetting: (name: string) => [
        name === 'background-web-session-a' ? state.viewMode : 'wrong-name',
        mocks.setViewMode,
    ],
}));
vi.mock('./backgroundSessionHelpers', () => ({
    useBackgroundSessions: (options: any) => {
        state.sessionOptions = options;
        return {
            activeId: state.activeId,
            element: <div data-testid="session-chips" />,
            dirSourceSettingName: `${options.dirSourceSettingName}-${state.activeId}`,
            autoPlayPrefix: `${options.autoPlayPrefix}-${state.activeId}`,
        };
    },
}));

import BackgroundWebComp from './BackgroundWebComp';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.urlItems = [
        { id: 'u1', src: 'https://one.example/', isUrl: true },
        { id: 'u2', src: 'https://two.example/', isUrl: true },
    ];
    state.dirSource = { dirPath: 'C:/data/webs' };
    state.layerMarker = '';
    state.thumbnailWidth = 120;
    state.viewMode = 'thumbnail';
    state.fileListProps = null;
    state.footerProps = null;
    state.autoPlayProps = null;
    state.bodyArgs = null;
    state.sessionOptions = null;
    state.activeId = 'session-a';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

async function render() {
    await act(async () => {
        root.render(<BackgroundWebComp />);
    });
}
function getUrlSources() {
    return state.bodyArgs![0] as { id: string; src: string }[];
}
async function genMenuItems() {
    return (await state.fileListProps.genContextMenuItems(
        state.dirSource,
    )) as any[];
}

describe('the Webs tab', () => {
    test('is one session of the web tab, and reads that session’s folder', async () => {
        await render();
        expect(state.sessionOptions).toEqual({
            target: 'background-web',
            dirSourceSettingName: 'background-web',
            autoPlayPrefix: 'background-web',
        });
        expect(
            container.querySelector('[data-testid="session-chips"]'),
        ).not.toBeNull();
        expect(state.fileListProps).toMatchObject({
            className: 'app-background-web',
            mimetypeName: 'web',
            defaultFolderName: 'webs',
            dirSource: state.dirSource,
            disableColorNoteGrouping: true,
            fileSelectionOption: {
                windowTitle: 'Select web files',
                dirPath: 'C:/data/webs',
                extensions: ['.web-ext'],
            },
        });
        expect(mocks.screenEvents).toHaveBeenCalledWith(['update']);
    });

    test('hands the grid its saved URLs, size, view and what the layer shows', async () => {
        state.layerMarker = '0:https://one.example/';
        state.viewMode = 'list';
        await render();
        const [urlSources, thumbnailWidth, , , viewMode, layerMarker, files] =
            state.bodyArgs!;
        expect(urlSources.map((item: any) => item.id)).toEqual(['u1', 'u2']);
        expect(thumbnailWidth).toBe(120);
        expect(viewMode).toBe('list');
        expect(layerMarker).toBe('0:https://one.example/');
        expect(files).toEqual(['a.html']);
        expect(state.footerProps).toMatchObject({
            thumbnailWidth: 120,
            setThumbnailWidth: mocks.setThumbnailWidth,
            viewMode: 'list',
            setViewMode: mocks.setViewMode,
        });
        // Ctrl+wheel over the tab resizes its tiles.
        const [containerRef, zoom] = mocks.zooming.mock.calls.at(-1)!;
        expect(containerRef.current).toBe(container.firstElementChild);
        expect(zoom).toMatchObject({
            value: 120,
            setValue: mocks.setThumbnailWidth,
            defaultSize: { size: 100 },
        });
    });

    test('shows its slide-show strip only while the layer is showing something', async () => {
        await render();
        expect(container.querySelector('[data-testid="auto-play"]')).toBeNull();
        state.layerMarker = '0:file:///a.html';
        await render();
        expect(state.autoPlayProps).toEqual({
            prefix: 'background-web-session-a',
            backgroundType: 'web',
            dirSourceSettingName: 'background-web-session-a',
        });
    });

    test('draws no file list before its folder is known', async () => {
        state.dirSource = null;
        await render();
        expect(container.querySelector('[data-testid="file-list"]')).toBeNull();
        expect(state.footerProps).not.toBeNull();
    });
});

describe('saved URLs', () => {
    test('Add URL asks for a new one, refusing the ones already saved, and keeps it', async () => {
        await render();
        const menuItems = await genMenuItems();
        expect(menuItems[0]).toMatchObject({ menuElement: 'New File' });
        const addItem = menuItems[1];
        expect(addItem).toMatchObject({
            menuElement: 'Add URL',
            childBefore: 'icon:link-45deg',
        });

        mocks.promptUrl.mockResolvedValueOnce(null);
        await act(async () => addItem.onSelect());
        expect(mocks.promptUrl).toHaveBeenLastCalledWith([
            'https://one.example/',
            'https://two.example/',
        ]);
        expect(getUrlSources()).toHaveLength(2);

        mocks.setUrlItems.mockClear();
        mocks.promptUrl.mockResolvedValueOnce({
            toData: () => ({
                id: 'u3',
                src: 'https://three.example/',
                isUrl: true,
            }),
        });
        await act(async () => addItem.onSelect());
        expect(getUrlSources().map((item) => item.id)).toEqual([
            'u1',
            'u2',
            'u3',
        ]);
        expect(mocks.setUrlItems).toHaveBeenLastCalledWith([
            ...state.urlItems,
            { id: 'u3', src: 'https://three.example/', isUrl: true },
        ]);
    });

    test('a URL is removed only once the removal is confirmed', async () => {
        await render();
        const handleUrlRemoving = state.bodyArgs![2];
        const target = getUrlSources()[0];
        mocks.confirm.mockResolvedValueOnce(false);
        await act(async () => handleUrlRemoving(target));
        expect(mocks.confirm).toHaveBeenLastCalledWith(
            'Remove URL',
            'Remove "https://one.example/"?',
            { cancelButtonLabel: 'No', confirmButtonLabel: 'Yes' },
        );
        expect(getUrlSources()).toHaveLength(2);

        mocks.setUrlItems.mockClear();
        mocks.confirm.mockResolvedValueOnce(true);
        await act(async () => handleUrlRemoving(target));
        expect(getUrlSources().map((item) => item.id)).toEqual(['u2']);
        expect(mocks.setUrlItems).toHaveBeenLastCalledWith([state.urlItems[1]]);
    });

    test('a colour note change redraws the URL tiles', async () => {
        await render();
        const firstSources = getUrlSources();
        const onColorNoteChange = state.bodyArgs![3];
        await act(async () => onColorNoteChange());
        expect(getUrlSources()).not.toBe(firstSources);
        expect(getUrlSources().map((item) => item.id)).toEqual(['u1', 'u2']);
    });
});
