// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// A Webs tile's body -- a still capture at rest, the live page only under
// the pointer -- and the grid of file and URL tiles grouped by colour note.

const { state, mocks } = vi.hoisted(() => ({
    state: {
        imageData: null as string | null,
        sections: [] as any[],
        mediaItemProps: [] as any[],
        urlItemProps: [] as any[],
    },
    mocks: {
        capture: vi.fn(),
        sections: vi.fn(),
    },
}));

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            src: `file:///${filePath}`,
            fullName: filePath.split('/').at(-1),
        }),
    },
}));
vi.mock('./RenderBackgroundScreenIdsComp', () => ({
    default: ({ screenIds }: { screenIds: number[] }) => (
        <span data-screen-ids={screenIds.join(',')} />
    ),
}));
vi.mock('./BackgroundMediaItemComp', () => ({
    default: (props: any) => {
        state.mediaItemProps.push(props);
        return (
            <div data-media-item={props.filePath}>
                {props.rendChild(
                    props.filePath,
                    [['2', {}]],
                    props.thumbnailWidth,
                    props.thumbnailHeight,
                    <span data-extra-child />,
                )}
            </div>
        );
    },
}));
vi.mock('../others/FillingFlexCenterComp', () => ({
    default: ({ width, className }: any) => (
        <span data-filling={width} className={className} />
    ),
}));
vi.mock('./RenderBackgroundWebIframeComp', () => ({
    default: ({ iframeSource, width, height }: any) => (
        <iframe
            title="live page"
            data-src={iframeSource.src}
            data-size={`${width}x${height}`}
        />
    ),
    BackgroundWebPlaceHolderComp: ({
        height,
        imageData,
        isUrl,
        isPlaying,
    }: any) => (
        <span
            data-placeholder
            data-height={height}
            data-image={imageData ?? ''}
            data-is-url={String(isUrl)}
            data-is-playing={String(isPlaying)}
        />
    ),
}));
vi.mock('./backgroundWebHelpers', () => ({
    genBackgroundWebExtraItemContextMenuItems: (filePath: string) => [
        { menuElement: 'Edit', filePath },
    ],
}));
vi.mock('./backgroundTransitionMenuHelpers', () => ({
    genBackgroundItemTransitionMenuItems: (type: string, src: string) => [
        { menuElement: 'Transition', type, src },
    ],
}));
vi.mock('../helper/capturingHelpers', () => ({
    useWebCapturing: (src: string) => {
        mocks.capture(src);
        return state.imageData;
    },
}));
vi.mock('./BackgroundWebUrlItemComp', () => ({
    default: (props: any) => {
        state.urlItemProps.push(props);
        return <div data-url-item={props.urlSource.id} />;
    },
}));
vi.mock('../helper/colorNoteHelpers', () => ({
    genColorBar: (colorNote: string) => <hr data-color-bar={colorNote} />,
}));
vi.mock('./backgroundWebCompHelpers', () => ({
    genBackgroundWebColorSections: (filePaths: string[], urlSources: any[]) => {
        mocks.sections(filePaths, urlSources);
        return state.sections;
    },
}));

import { basicRenderBody, RenderWebChildComp } from './BackgroundWebChildComp';

let container: HTMLDivElement;
let root: Root;
const urlSource = {
    id: 'u1',
    src: 'https://one.example/',
    fullName: 'https://one.example/',
} as any;

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.imageData = null;
    state.sections = [];
    state.mediaItemProps = [];
    state.urlItemProps = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

function query(selector: string) {
    return container.querySelector(selector) as HTMLElement | null;
}

describe('a web tile body', () => {
    test('shows the still capture at rest, and the live page only while hovered', async () => {
        state.imageData = 'data:image/png;base64,capture';
        await act(async () => {
            root.render(
                <RenderWebChildComp
                    fileOrUrlSource={urlSource}
                    selectedBackgroundSrcList={[
                        ['1', {} as any],
                        ['3', {} as any],
                    ]}
                    width={160}
                    height={90}
                    isUrl
                    extraChild={<span data-extra-child />}
                />,
            );
        });
        expect(mocks.capture).toHaveBeenCalledWith('https://one.example/');
        const body = container.firstElementChild as HTMLElement;
        expect(body.title).toBe('https://one.example/');
        expect(body.style.height).toBe('90px');
        expect(query('[data-screen-ids]')!.dataset.screenIds).toBe('1,3');
        expect(query('[data-placeholder]')!.dataset).toMatchObject({
            height: '90',
            image: 'data:image/png;base64,capture',
            isUrl: 'true',
            isPlaying: 'false',
        });
        expect(query('iframe')).toBeNull();
        expect(query('[data-extra-child]')).not.toBeNull();

        await act(async () => {
            body.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        });
        expect(query('iframe')!.dataset).toMatchObject({
            src: 'https://one.example/',
            size: '160x90',
        });
        expect(query('[data-placeholder]')!.dataset.isPlaying).toBe('true');

        await act(async () => {
            body.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
        });
        expect(query('iframe')).toBeNull();
    });

    test('a pointer passing over and out settles on where it ended', async () => {
        await act(async () => {
            root.render(
                <RenderWebChildComp
                    fileOrUrlSource={urlSource}
                    selectedBackgroundSrcList={[]}
                    width={160}
                    height={90}
                />,
            );
        });
        const body = container.firstElementChild as HTMLElement;
        expect(query('[data-placeholder]')!.dataset.isUrl).toBe('false');
        await act(async () => {
            body.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            body.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
            body.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        });
        expect(query('iframe')).not.toBeNull();
        // The trailing check a second later agrees with the last move.
        await act(async () => vi.advanceTimersByTimeAsync(1000));
        expect(query('iframe')).not.toBeNull();
        await act(async () => {
            body.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
            await vi.advanceTimersByTimeAsync(1000);
        });
        expect(query('iframe')).toBeNull();
    });
});

describe('the Webs grid body', () => {
    const removeUrl = vi.fn(async () => {});
    const changeColorNote = vi.fn();

    async function renderBody(viewMode: 'thumbnail' | 'list') {
        await act(async () => {
            root.render(
                basicRenderBody(
                    [urlSource],
                    160,
                    removeUrl,
                    changeColorNote,
                    viewMode,
                    '0:file:///b.html',
                    ['b.html', 'a.html'],
                ),
            );
        });
    }

    test('lays out one colour group after another, files before URLs', async () => {
        state.sections = [
            { colorNote: '#ff0000', filePaths: ['b.html'], urlSources: [] },
            {
                colorNote: '#00ff00',
                filePaths: ['a.html'],
                urlSources: [urlSource],
            },
        ];
        await renderBody('thumbnail');
        expect(mocks.sections).toHaveBeenCalledWith(
            ['b.html', 'a.html'],
            [urlSource],
        );
        const order = Array.from(
            container.querySelectorAll(
                '[data-color-bar], [data-media-item], [data-url-item], [data-filling]',
            ),
        ).map(
            (element) =>
                (element as HTMLElement).dataset.colorBar ??
                (element as HTMLElement).dataset.mediaItem ??
                (element as HTMLElement).dataset.urlItem ??
                'filler',
        );
        expect(order).toEqual([
            '#ff0000',
            'b.html',
            'filler',
            '#00ff00',
            'a.html',
            'u1',
            'filler',
        ]);
        // Grid rows wrap; 16:9 tiles.
        expect(
            container.querySelector('[data-media-item]')!.parentElement!
                .className,
        ).toBe('d-flex justify-content-center flex-wrap');
        expect(state.mediaItemProps[0]).toMatchObject({
            filePath: 'b.html',
            dragType: 'bg-web',
            noDraggable: false,
            isNameOnTop: false,
            thumbnailWidth: 160,
            thumbnailHeight: 90,
            viewMode: 'thumbnail',
            layerMarker: '0:file:///b.html',
        });
        expect(state.urlItemProps[0]).toMatchObject({
            urlSource,
            thumbnailWidth: 160,
            thumbnailHeight: 90,
            onRemove: removeUrl,
            onColorNoteChange: changeColorNote,
            viewMode: 'thumbnail',
        });
    });

    test('a file tile body is the web child of that file, with its own menu rows', async () => {
        state.sections = [{ filePaths: ['a.html'], urlSources: [] }];
        await renderBody('thumbnail');
        // One group: no colour bar at all.
        expect(container.querySelector('[data-color-bar]')).toBeNull();
        const tile = container.querySelector('[data-media-item="a.html"]')!;
        expect(
            (tile.querySelector('[data-screen-ids]') as HTMLElement).dataset
                .screenIds,
        ).toBe('2');
        expect((tile.firstElementChild as HTMLElement).title).toBe('a.html');
        expect(tile.querySelector('[data-extra-child]')).not.toBeNull();
        expect(
            state.mediaItemProps[0].genExtraItemContextMenuItems('a.html'),
        ).toEqual([
            { menuElement: 'Edit', filePath: 'a.html' },
            {
                menuElement: 'Transition',
                type: 'web',
                src: 'file:///a.html',
            },
        ]);
    });

    test('a list is one column, with no filler at the end', async () => {
        state.sections = [{ filePaths: ['a.html'], urlSources: [urlSource] }];
        await renderBody('list');
        expect(
            container.querySelector('[data-media-item]')!.parentElement!
                .className,
        ).toBe('d-flex flex-column');
        expect(container.querySelector('[data-filling]')).toBeNull();
        expect(state.urlItemProps[0].viewMode).toBe('list');
    });
});
