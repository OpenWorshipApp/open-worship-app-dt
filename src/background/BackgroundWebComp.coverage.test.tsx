// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The Webs tab end to end through its own body: the real `BackgroundWebComp`
// hands the real `basicRenderBody` to the (mocked) file list, which draws the
// real URL tiles and, through the (mocked) media tile, the real web preview.
const h = vi.hoisted(() => {
    const state = {
        filePaths: [] as string[],
        savedUrlItems: [] as { id: string; src: string; isUrl: true }[],
        urlColorNotes: {} as Record<string, string | null>,
        fileColorNotes: {} as Record<string, string | null>,
        captures: {} as Record<string, string | null>,
        onScreen: {} as Record<string, string[]>,
        layerMarker: '',
        layerMarkerTypes: [] as string[],
        dirSource: { dirPath: '/data/webs' } as null | { dirPath: string },
        session: {
            activeId: 'default',
            dirSourceSettingName: 'select-dir-web-bg',
            autoPlayPrefix: 'background-web' as string | undefined,
        },
        sessionOptions: null as any,
        fileListProps: null as any,
        mediaItemProps: {} as Record<string, any>,
        settingNames: [] as string[],
        zoomRegistrations: [] as { ref: any; options: any }[],
        screenEventNames: [] as string[][],
        getUrlItemList: vi.fn(),
        setUrlItemList: vi.fn(),
        promptUrl: vi.fn(),
        showAppConfirm: vi.fn(),
        showAppContextMenu: vi.fn(),
        handleSelecting: vi.fn(),
        handleDragStart: vi.fn(),
        copyToClipboard: vi.fn(),
        pressElementLikeButton: vi.fn(),
        FakeUrlSource: null as any,
    };
    // What `BackgroundWebUrlSource` gives the tab: the colour note is read
    // when the source is built, the way the real one reads its setting.
    state.FakeUrlSource = class {
        readonly id: string;
        readonly src: string;
        readonly fullName: string;
        readonly name: string;
        readonly isUrl = true;
        colorNote: string | null;
        constructor(data: { id: string; src: string }) {
            this.id = data.id;
            this.src = data.src;
            this.fullName = data.src;
            this.name = data.src;
            this.colorNote = state.urlColorNotes[data.id] ?? null;
        }
        toData() {
            return { id: this.id, src: this.src, isUrl: true as const };
        }
    };
    return state;
});

vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppEffect: react.useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../helper/settingHelpers', async () => {
    const react = await import('react');
    return {
        useStateSettingString: (name: string, defaultValue: string) => {
            h.settingNames.push(name);
            return react.useState(defaultValue);
        },
    };
});
vi.mock('./BackgroundMediaComp', async () => {
    const react = await import('react');
    return { useThumbnailWidthSetting: () => react.useState(160) };
});
vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => {
            const fullName = filePath.split('/').at(-1)!;
            return {
                filePath,
                src: `file://${filePath}`,
                fullName,
                name: fullName.replace(/\.[^.]+$/, ''),
                colorNote: h.fileColorNotes[filePath] ?? null,
            };
        },
    },
}));
vi.mock('./backgroundWebUrlHelpers', () => ({
    getBackgroundWebUrlItemList: () => h.getUrlItemList(),
    setBackgroundWebUrlItemList: (list: unknown) => h.setUrlItemList(list),
    createBackgroundWebUrlSourceList: (list: { id: string; src: string }[]) =>
        list.map((item) => new h.FakeUrlSource(item)),
    promptBackgroundWebUrlSource: (existingSrcList: string[]) =>
        h.promptUrl(existingSrcList),
}));
vi.mock('./backgroundWebHelpers', () => ({
    genBackgroundWebContextMenuItems: (
        dirSource: { dirPath: string },
        extraItems: any[] = [],
    ) => [
        { menuElement: 'New File', dirPath: dirSource.dirPath },
        ...extraItems,
        { menuElement: 'Open Shared Link' },
    ],
    genBackgroundWebExtraItemContextMenuItems: (filePath: string) => [
        { menuElement: 'Edit', filePath },
    ],
}));
vi.mock('./backgroundSessionHelpers', () => ({
    useBackgroundSessions: (options: unknown) => {
        h.sessionOptions = options;
        return {
            activeId: h.session.activeId,
            element: <span data-session-chips>{h.session.activeId}</span>,
            dirSourceSettingName: h.session.dirSourceSettingName,
            autoPlayPrefix: h.session.autoPlayPrefix,
        };
    },
}));
vi.mock('./backgroundHelpers', () => ({
    genBackgroundLayerMarker: (backgroundType: string) => {
        h.layerMarkerTypes.push(backgroundType);
        return h.layerMarker;
    },
    genBackgroundMediaItemData: (
        titlePrefix: string,
        src: string,
        _dragType: string,
    ) => {
        const screenKeys = h.onScreen[src] ?? [];
        const isInScreen = screenKeys.length > 0;
        return {
            selectedCN: isInScreen ? 'app-highlight-selected' : '',
            title:
                titlePrefix +
                (isInScreen
                    ? ` \nShow in presents:${screenKeys.join(',')}`
                    : ''),
            handleSelecting: (_event: unknown, isForceChoosing = false) =>
                h.handleSelecting(src, isForceChoosing),
            backgroundType: 'web',
            isInScreen,
            selectedBackgroundSrcList: screenKeys.map((key) => [
                key,
                { type: 'web', src },
            ]),
        };
    },
}));
vi.mock('./BackgroundAutoPlayComp', () => ({
    default: ({ prefix, backgroundType, dirSourceSettingName }: any) => (
        <div
            data-auto-play={prefix}
            data-type={backgroundType}
            data-dir={dirSourceSettingName}
        />
    ),
}));
vi.mock('../helper/dirSourceHelpers', () => ({
    useGenDirSourceReload: () => h.dirSource,
}));
vi.mock('../_screen/managers/screenEventHelpers', () => ({
    useScreenBackgroundManagerEvents: (eventNames: string[]) => {
        h.screenEventNames.push(eventNames);
    },
}));
vi.mock('../others/FileListHandlerComp', () => ({
    default: (props: any) => {
        h.fileListProps = props;
        return (
            <section data-file-list={props.className}>
                {props.bodyHandler(h.filePaths)}
            </section>
        );
    },
}));
vi.mock('./BackgroundMediaItemComp', () => ({
    default: (props: any) => {
        h.mediaItemProps[props.filePath] = props;
        const src = `file://${props.filePath}`;
        return (
            <div
                data-media-item={props.filePath}
                data-view-mode={props.viewMode}
                data-layer-marker={props.layerMarker}
            >
                {props.rendChild(
                    props.filePath,
                    (h.onScreen[src] ?? []).map((key) => [key, {}]),
                    props.thumbnailWidth,
                    props.thumbnailHeight,
                    <span data-extra-child={props.filePath} />,
                )}
            </div>
        );
    },
}));
vi.mock('../helper/capturingHelpers', () => ({
    useWebCapturing: (src: string) => h.captures[src] ?? null,
}));
vi.mock('../_screen/managers/screenHelpers', () => ({
    getDefaultScreenDisplay: () => ({ bounds: { width: 1920, height: 1080 } }),
}));
vi.mock('../_screen/preview/ShowingScreenIcon', () => ({
    default: ({ screenId }: { screenId: number }) => (
        <span data-screen-id={screenId} />
    ),
}));
vi.mock('./backgroundTransitionMenuHelpers', () => ({
    genBackgroundItemTransitionMenuItems: (type: string, src: string) => [
        { menuElement: `Transition (${type} ${src})` },
    ],
}));
vi.mock('../others/FileItemHandlerComp', () => ({
    genShowOnScreensContextMenu: (onSelect: (event: any) => void) => [
        { menuElement: 'Show on Screens', onSelect },
    ],
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: (event: unknown, items: unknown) =>
        h.showAppContextMenu(event, items),
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon:${name}`,
}));
vi.mock('../context-menu/ContextMenuDotsButtonComp', () => ({
    default: ({ onOpening }: any) => (
        <button
            type="button"
            data-dots
            onClick={(event) => {
                event.stopPropagation();
                onOpening(event);
            }}
        >
            More Options
        </button>
    ),
}));
vi.mock('../others/ItemColorNoteComp', () => ({
    default: ({ item, onChange }: any) => (
        <button
            type="button"
            data-color-note={item.src}
            onClick={(event) => {
                event.stopPropagation();
                onChange?.();
            }}
        >
            Color
        </button>
    ),
}));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: (title: string, message: string, options: unknown) =>
        h.showAppConfirm(title, message, options),
}));
vi.mock('../server/appHelpers', () => ({
    copyToClipboard: (text: string) => h.copyToClipboard(text),
}));
vi.mock('../server/fileHelpers', () => ({
    getMimetypeExtensions: (mimetypeName: string) =>
        mimetypeName === 'web' ? ['html', 'htm'] : [],
}));
vi.mock('../helper/dragHelpers', () => ({
    handleDragStart: (event: unknown, target: unknown, type: unknown) =>
        h.handleDragStart(event, target, type),
}));
vi.mock('../helper/helpers', () => ({
    pressElementLikeButton: (event: unknown) => h.pressElementLikeButton(event),
}));
vi.mock('../others/AppRangeComp', () => ({
    default: ({ value, title }: any) => (
        <input type="range" aria-label={title} value={value} readOnly />
    ),
    useZoomingRegistering: (ref: any, options: any) => {
        h.zoomRegistrations.push({ ref, options });
    },
}));
vi.mock('../helper/domHelpers', () => ({ handleAutoHide: () => {} }));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));

import BackgroundWebComp from './BackgroundWebComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const NEWS = 'https://news.example/';
const SONGS = 'https://songs.example/';

let host: HTMLDivElement;
let root: Root;

async function flush() {
    await act(async () => {
        for (let i = 0; i < 10; i += 1) {
            await Promise.resolve();
        }
    });
}

async function renderTab() {
    await act(async () => root.render(<BackgroundWebComp />));
}

function urlTiles() {
    return [...host.querySelectorAll<HTMLElement>('.web-thumbnail.card')];
}

function urlTile(src: string) {
    return host.querySelector<HTMLElement>(
        `.web-thumbnail.card[data-file-item-file-src="${src}"]`,
    );
}

function lastMenuItems() {
    return h.showAppContextMenu.mock.calls.at(-1)![1] as any[];
}

async function openMenuOn(element: HTMLElement) {
    await act(async () => {
        element.dispatchEvent(
            new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
        );
    });
    return lastMenuItems();
}

async function genTabMenuItems() {
    return (await h.fileListProps.genContextMenuItems(h.dirSource)) as any[];
}

beforeEach(() => {
    h.filePaths = ['/webs/b.html', '/webs/a.html'];
    h.savedUrlItems = [{ id: 'u1', src: NEWS, isUrl: true }];
    h.urlColorNotes = {};
    h.fileColorNotes = {};
    h.captures = {};
    h.onScreen = {};
    h.layerMarker = '';
    h.layerMarkerTypes = [];
    h.dirSource = { dirPath: '/data/webs' };
    h.session = {
        activeId: 'default',
        dirSourceSettingName: 'select-dir-web-bg',
        autoPlayPrefix: 'background-web',
    };
    h.sessionOptions = null;
    h.fileListProps = null;
    h.mediaItemProps = {};
    h.settingNames = [];
    h.zoomRegistrations = [];
    h.screenEventNames = [];
    h.getUrlItemList.mockImplementation(() => h.savedUrlItems);
    h.promptUrl.mockResolvedValue(null);
    h.showAppConfirm.mockResolvedValue(false);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe('Webs tab', () => {
    test('draws the session strip, the sorted files and the saved URLs in one grid', async () => {
        await renderTab();
        expect(h.sessionOptions).toEqual({
            target: 'background-web',
            dirSourceSettingName: 'select-dir-web-bg',
            autoPlayPrefix: 'background-web',
        });
        expect(host.querySelector('[data-session-chips]')?.textContent).toBe(
            'default',
        );
        expect(h.fileListProps).toMatchObject({
            className: 'app-background-web',
            mimetypeName: 'web',
            defaultFolderName: 'webs',
            disableColorNoteGrouping: true,
            fileSelectionOption: {
                windowTitle: 'Select web files',
                dirPath: '/data/webs',
                extensions: ['html', 'htm'],
            },
        });
        expect(
            [...host.querySelectorAll('[data-media-item]')].map((element) =>
                element.getAttribute('data-media-item'),
            ),
        ).toEqual(['/webs/a.html', '/webs/b.html']);
        expect(h.mediaItemProps['/webs/a.html']).toMatchObject({
            dragType: 'bg-web',
            onClick: undefined,
            noDraggable: false,
            isNameOnTop: false,
            thumbnailWidth: 160,
            thumbnailHeight: 90,
            viewMode: 'thumbnail',
        });
        const tile = urlTile(NEWS)!;
        expect(tile.style.width).toBe('160px');
        expect(tile.draggable).toBe(true);
        expect(tile.querySelector('.card-footer bdi')?.textContent).toBe(NEWS);
        // The grid is padded so its last row keeps the tile width.
        expect(
            host.querySelectorAll('.web-thumbnail:not(.card)').length,
        ).toBeGreaterThan(0);
        // What was saved is what is written back -- nothing is lost on load.
        expect(h.getUrlItemList).toHaveBeenCalledTimes(1);
        expect(h.setUrlItemList).toHaveBeenLastCalledWith(h.savedUrlItems);
        expect(h.screenEventNames).toContainEqual(['update']);
        expect(h.settingNames).toContain('bg-view-mode-select-dir-web-bg');
        expect(h.zoomRegistrations.at(-1)!.options).toMatchObject({
            value: 160,
            defaultSize: { size: 100, min: 50, max: 500, step: 10 },
        });
        expect(h.zoomRegistrations.at(-1)!.ref.current).toBe(
            host.querySelector('.background-has-media-bar'),
        );
        expect(
            host.querySelector('input[aria-label="Thumbnail Size"]'),
        ).not.toBeNull();
        expect(host.querySelector('[title="List View"]')).not.toBeNull();
    });

    test('switching session re-reads that session’s own list', async () => {
        await renderTab();
        expect(urlTiles()).toHaveLength(1);

        h.session = {
            activeId: 'session-2',
            dirSourceSettingName: 'select-dir-web-bg-session-2',
            autoPlayPrefix: 'background-web-session-2',
        };
        h.savedUrlItems = [];
        await renderTab();
        expect(h.getUrlItemList).toHaveBeenCalledTimes(2);
        expect(urlTiles()).toHaveLength(0);
        expect(host.querySelector('[data-session-chips]')?.textContent).toBe(
            'session-2',
        );
        expect(h.settingNames).toContain(
            'bg-view-mode-select-dir-web-bg-session-2',
        );
    });

    test('offers the slide show only while this tab has something up', async () => {
        await renderTab();
        expect(h.layerMarkerTypes).toContain('web');
        expect(host.querySelector('[data-auto-play]')).toBeNull();

        h.layerMarker = `1:${NEWS}`;
        await renderTab();
        const autoPlay = host.querySelector('[data-auto-play]')!;
        expect(autoPlay.getAttribute('data-auto-play')).toBe('background-web');
        expect(autoPlay.getAttribute('data-type')).toBe('web');
        expect(autoPlay.getAttribute('data-dir')).toBe('select-dir-web-bg');
        // The memoised file tiles are told what is up.
        expect(
            host
                .querySelector('[data-media-item="/webs/a.html"]')
                ?.getAttribute('data-layer-marker'),
        ).toBe(`1:${NEWS}`);

        h.session = { ...h.session, autoPlayPrefix: undefined };
        await renderTab();
        expect(host.querySelector('[data-auto-play]')).toBeNull();
    });

    test('without a folder there is no file list, but the strip and footer stay', async () => {
        h.dirSource = null;
        await renderTab();
        expect(host.querySelector('[data-file-list]')).toBeNull();
        expect(host.querySelector('[data-session-chips]')).not.toBeNull();
        expect(
            host.querySelector('input[aria-label="Thumbnail Size"]'),
        ).not.toBeNull();
    });

    test('Add URL asks with the saved URLs, adds a new one and the next ask knows it', async () => {
        await renderTab();
        const items = await genTabMenuItems();
        expect(items.map((item) => item.menuElement)).toEqual([
            'New File',
            'Add URL',
            'Open Shared Link',
        ]);
        expect(items[0].dirPath).toBe('/data/webs');
        expect(items[1].childBefore).toBe('icon:link-45deg');

        // Cancelled: nothing is added.
        h.promptUrl.mockResolvedValueOnce(null);
        await act(async () => items[1].onSelect());
        await flush();
        expect(h.promptUrl).toHaveBeenLastCalledWith([NEWS]);
        expect(urlTiles()).toHaveLength(1);

        h.promptUrl.mockResolvedValueOnce(
            new h.FakeUrlSource({ id: 'u2', src: SONGS }),
        );
        await act(async () => items[1].onSelect());
        await flush();
        expect(urlTiles().map((tile) => tile.dataset.fileItemFileSrc)).toEqual([
            NEWS,
            SONGS,
        ]);
        expect(h.setUrlItemList).toHaveBeenLastCalledWith([
            { id: 'u1', src: NEWS, isUrl: true },
            { id: 'u2', src: SONGS, isUrl: true },
        ]);

        // The menu is built afresh from the CURRENT list, so the next
        // duplicate check sees the URL just added.
        const nextItems = await genTabMenuItems();
        await act(async () => nextItems[1].onSelect());
        await flush();
        expect(h.promptUrl).toHaveBeenLastCalledWith([NEWS, SONGS]);
    });

    test('a URL tile copies, shows, and is removed only after a Yes', async () => {
        await renderTab();
        const items = await openMenuOn(urlTile(NEWS)!);
        expect(items.map((item) => item.menuElement)).toEqual([
            'Copy URL to Clipboard',
            'Show on Screens',
            `Transition (web ${NEWS})`,
            'Remove URL',
        ]);
        expect(items[0].childBefore).toBe('icon:clipboard');
        items[0].onSelect();
        expect(h.copyToClipboard).toHaveBeenCalledWith(NEWS);
        items[1].onSelect({});
        expect(h.handleSelecting).toHaveBeenCalledWith(NEWS, true);

        h.showAppConfirm.mockResolvedValueOnce(false);
        await act(async () => items[3].onSelect());
        await flush();
        expect(h.showAppConfirm).toHaveBeenCalledWith(
            'Remove URL',
            `Remove "${NEWS}"?`,
            { cancelButtonLabel: 'No', confirmButtonLabel: 'Yes' },
        );
        expect(urlTile(NEWS)).not.toBeNull();

        h.showAppConfirm.mockResolvedValueOnce(true);
        await act(async () => items[3].onSelect());
        await flush();
        expect(urlTile(NEWS)).toBeNull();
        expect(h.setUrlItemList).toHaveBeenLastCalledWith([]);
    });

    test('a URL on a screen is marked and cannot be removed from under it', async () => {
        h.onScreen = { [NEWS]: ['1'] };
        await renderTab();
        const tile = urlTile(NEWS)!;
        expect(tile.className).toBe(
            'web-thumbnail card app-highlight-selected',
        );
        expect(tile.title).toBe(`${NEWS} \nShow in presents:1`);
        expect(
            tile
                .querySelector('[data-screen-id]')
                ?.getAttribute('data-screen-id'),
        ).toBe('1');
        const items = await openMenuOn(tile);
        expect(items.map((item) => item.menuElement)).not.toContain(
            'Remove URL',
        );
    });

    test('a URL tile selects on click, drags as a web background, and its dots open the menu', async () => {
        await renderTab();
        const tile = urlTile(NEWS)!;
        await act(async () => tile.click());
        expect(h.handleSelecting).toHaveBeenCalledWith(NEWS, false);

        await act(async () => {
            tile.dispatchEvent(new Event('dragstart', { bubbles: true }));
        });
        const [, dragged, dragType] = h.handleDragStart.mock.calls[0];
        expect(dragged).toBeInstanceOf(h.FakeUrlSource);
        expect((dragged as any).src).toBe(NEWS);
        expect(dragType).toBe('bg-web');

        h.handleSelecting.mockClear();
        await act(async () =>
            tile.querySelector<HTMLElement>('[data-dots]')!.click(),
        );
        expect(lastMenuItems()[0].menuElement).toBe('Copy URL to Clipboard');
        expect(h.handleSelecting).not.toHaveBeenCalled();
    });

    test('a colour note on a URL regroups the grid under colour bars', async () => {
        await renderTab();
        expect(host.querySelectorAll('hr')).toHaveLength(0);
        const callsBefore = h.setUrlItemList.mock.calls.length;

        h.urlColorNotes = { u1: 'red' };
        await act(async () =>
            host
                .querySelector<HTMLElement>(`[data-color-note="${NEWS}"]`)!
                .click(),
        );
        const bars = [...host.querySelectorAll<HTMLElement>('hr')];
        expect(bars).toHaveLength(2);
        expect(bars[0].style.backgroundColor).toBe('red');
        expect(bars[1].getAttribute('style')).toBeNull();
        // The red section holds the URL, the unmarked one the files.
        const [redSection, otherSection] = [
            ...host.querySelectorAll('hr + div'),
        ];
        expect(redSection.querySelector('.web-thumbnail.card')).not.toBeNull();
        expect(redSection.querySelector('[data-media-item]')).toBeNull();
        expect(otherSection.querySelectorAll('[data-media-item]')).toHaveLength(
            2,
        );
        expect(h.setUrlItemList.mock.calls.length).toBe(callsBefore + 1);
        expect(h.handleSelecting).not.toHaveBeenCalled();
    });

    test('list view draws name rows for files and URLs, with no filler and no size slider', async () => {
        h.onScreen = { [NEWS]: ['2'] };
        await renderTab();
        await act(async () =>
            host
                .querySelector<HTMLButtonElement>('[title="List View"]')!
                .click(),
        );
        expect(
            [...host.querySelectorAll('[data-media-item]')].map((element) =>
                element.getAttribute('data-view-mode'),
            ),
        ).toEqual(['list', 'list']);
        expect(host.querySelector('.web-thumbnail')).toBeNull();
        expect(host.querySelector('.d-flex.flex-column')).not.toBeNull();
        expect(
            host.querySelector('input[aria-label="Thumbnail Size"]'),
        ).toBeNull();

        const row = host.querySelector<HTMLElement>(
            '.app-background-list-item',
        )!;
        expect(row.getAttribute('aria-label')).toBe(NEWS);
        expect(row.getAttribute('data-file-item-file-src')).toBe(NEWS);
        expect(row.title).toBe(`${NEWS} \nShow in presents:2`);
        expect(row.className).toContain('app-highlight-selected');
        expect(row.querySelector('.bi-globe2')).not.toBeNull();
        expect(
            row
                .querySelector('[data-screen-id]')
                ?.getAttribute('data-screen-id'),
        ).toBe('2');

        await act(async () => row.click());
        expect(h.handleSelecting).toHaveBeenCalledWith(NEWS, false);
        await act(async () => {
            row.dispatchEvent(new Event('dragstart', { bubbles: true }));
        });
        expect(h.handleDragStart).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ src: NEWS }),
            'bg-web',
        );
        const items = await openMenuOn(row);
        // On a screen: no removal from the list either.
        expect(items.map((item) => item.menuElement)).toEqual([
            'Copy URL to Clipboard',
            'Show on Screens',
            `Transition (web ${NEWS})`,
        ]);
        await act(async () => {
            row.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
            );
        });
        expect(h.pressElementLikeButton).toHaveBeenCalledTimes(1);

        const callsBefore = h.setUrlItemList.mock.calls.length;
        await act(async () =>
            row.querySelector<HTMLElement>('[data-color-note]')!.click(),
        );
        expect(h.setUrlItemList.mock.calls.length).toBe(callsBefore + 1);
    });

    test('a web file tile shows its capture, plays the page while hovered and offers Edit', async () => {
        vi.useFakeTimers();
        h.captures = {
            'file:///webs/a.html': 'data:image/png;base64,AAAA',
            [NEWS]: 'data:image/png;base64,BBBB',
        };
        h.onScreen = { 'file:///webs/a.html': ['3'] };
        await renderTab();
        const fileTile = host.querySelector<HTMLElement>(
            '[data-media-item="/webs/a.html"] .card-body',
        )!;
        expect(fileTile.title).toBe('a.html');
        expect(fileTile.style.height).toBe('90px');
        expect(
            fileTile.querySelector<HTMLImageElement>('img[alt="web preview"]')!
                .src,
        ).toBe('data:image/png;base64,AAAA');
        expect(fileTile.textContent).not.toContain('URL');
        expect(
            fileTile
                .querySelector('[data-screen-id]')
                ?.getAttribute('data-screen-id'),
        ).toBe('3');
        expect(
            fileTile.querySelector('[data-extra-child="/webs/a.html"]'),
        ).not.toBeNull();
        // A file not captured yet shows the file-type icon; a URL, the globe.
        expect(
            host.querySelector(
                '[data-media-item="/webs/b.html"] .bi-filetype-html',
            ),
        ).not.toBeNull();
        // A captured URL is badged as one while it is not playing.
        const urlBody =
            urlTile(NEWS)!.querySelector<HTMLElement>('.card-body')!;
        expect(urlBody.querySelector('.badge')?.textContent).toBe('URL');

        expect(fileTile.querySelector('iframe')).toBeNull();
        await act(async () => {
            fileTile.dispatchEvent(
                new MouseEvent('mouseover', { bubbles: true }),
            );
        });
        const iframe = fileTile.querySelector('iframe')!;
        expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
        expect(iframe.getAttribute('src')).toBe('file:///webs/a.html');
        expect(iframe.title).toBe('a.html');
        expect(iframe.style.transform).toBe(`scale(${160 / 1920})`);

        // The last of a burst of over/out wins, and the debounce agrees.
        await act(async () => {
            fileTile.dispatchEvent(
                new MouseEvent('mouseout', { bubbles: true }),
            );
        });
        expect(fileTile.querySelector('iframe')).toBeNull();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        expect(fileTile.querySelector('iframe')).toBeNull();

        await act(async () => {
            urlBody.dispatchEvent(
                new MouseEvent('mouseover', { bubbles: true }),
            );
        });
        expect(urlBody.querySelector('iframe')?.getAttribute('src')).toBe(NEWS);
        expect(urlBody.querySelector('.badge')).toBeNull();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        expect(urlBody.querySelector('iframe')).not.toBeNull();

        expect(
            h.mediaItemProps['/webs/a.html'].genExtraItemContextMenuItems(
                '/webs/a.html',
            ),
        ).toEqual([
            { menuElement: 'Edit', filePath: '/webs/a.html' },
            { menuElement: 'Transition (web file:///webs/a.html)' },
        ]);
    });
});
