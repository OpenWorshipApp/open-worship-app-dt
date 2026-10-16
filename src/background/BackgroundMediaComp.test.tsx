import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    files: ['/photos/z.jpg', '/photos/a.jpg'] as string[],
    marker: 'screen:1',
    viewMode: 'grid',
    dirSource: { dirPath: '/photos' } as null | { dirPath: string },
    fileListProps: null as null | Record<string, any>,
    gridProps: null as null | Record<string, any>,
}));

vi.mock('../_screen/managers/screenEventHelpers', () => ({
    useScreenBackgroundManagerEvents: () => undefined,
}));
vi.mock('../helper/dirSourceHelpers', () => ({
    useGenDirSourceReload: () => state.dirSource,
}));
vi.mock('../helper/settingHelpers', () => ({
    useStateSettingNumber: () => [200, vi.fn()],
}));
vi.mock('../others/AppRangeComp', () => ({
    useZoomingRegistering: () => undefined,
}));
vi.mock('../server/fileHelpers', () => ({
    getMimetypeExtensions: () => ['jpg'],
}));
vi.mock('./backgroundHelpers', () => ({
    backgroundTypeMapper: { image: 'image', audio: 'audio', color: 'color' },
    genBackgroundLayerMarker: () => state.marker,
}));
vi.mock('./BackgroundViewModeComp', () => ({
    useBackgroundViewModeSetting: () => [state.viewMode, vi.fn()],
}));
vi.mock('../others/FileListHandlerComp', () => ({
    default: (props: Record<string, any>) => {
        state.fileListProps = props;
        return <section>{props.bodyHandler(state.files)}</section>;
    },
}));
vi.mock('../virtual-list/VirtualGridComp', () => ({
    default: (props: Record<string, any>) => {
        state.gridProps = props;
        return <div>{props.items.map(props.renderItem)}</div>;
    },
}));
vi.mock('./BackgroundMediaItemComp', () => ({
    default: ({ filePath }: { filePath: string }) => <span>{filePath}</span>,
}));
vi.mock('./BackgroundFooterComp', () => ({
    default: () => <footer>Footer</footer>,
    defaultRangeSize: { size: 200 },
}));
vi.mock('./BackgroundAutoPlayComp', () => ({
    default: () => <div>Auto play</div>,
}));

import BackgroundMediaComp, { sortMediaFilePaths } from './BackgroundMediaComp';

const baseProps = {
    dragType: 'image' as never,
    dirSourceSettingName: 'select-dir-images',
    rendChild: () => null,
};

beforeEach(() => {
    state.files = ['/photos/z.jpg', '/photos/a.jpg'];
    state.marker = 'screen:1';
    state.viewMode = 'grid';
    state.dirSource = { dirPath: '/photos' };
    state.fileListProps = null;
    state.gridProps = null;
});

describe('background media card', () => {
    it('draws sorted tiles through a virtual grid and offers auto-play for visible media', () => {
        const html = renderToStaticMarkup(
            <BackgroundMediaComp
                {...baseProps}
                autoPlayPrefix="background-image"
                topBarChild={<span>Sessions</span>}
            />,
        );
        expect(html).toContain('Sessions');
        expect(html).toContain('Auto play');
        expect(html).toContain('/photos/a.jpg</span><span>/photos/z.jpg');
        expect(html).toContain('Footer');
        expect(state.gridProps).toMatchObject({
            items: ['/photos/a.jpg', '/photos/z.jpg'],
            isEnabled: true,
            itemWidth: 204,
            estimateRowHeight: 157,
            overscan: 3,
        });
        expect(state.fileListProps).toMatchObject({
            mimetypeName: 'image',
            className: 'app-background-image',
            fileSelectionOption: {
                windowTitle: 'Select image files',
                dirPath: '/photos',
                extensions: ['jpg'],
            },
        });
        expect(state.files).toEqual(['/photos/z.jpg', '/photos/a.jpg']);
        expect(sortMediaFilePaths(state.files)).toEqual([
            '/photos/a.jpg',
            '/photos/z.jpg',
        ]);
    });

    it('keeps the session strip but hides auto-play and the list when nothing is available', () => {
        state.marker = '';
        state.dirSource = null;
        const html = renderToStaticMarkup(
            <BackgroundMediaComp
                {...baseProps}
                autoPlayPrefix="background-image"
                topBarChild={<span>Sessions</span>}
                extraBodyChild={<span>Empty help</span>}
                shouldHideFooter
            />,
        );
        expect(html).toContain('Sessions');
        expect(html).toContain('Empty help');
        expect(html).not.toContain('Auto play');
        expect(html).not.toContain('Footer');
        expect(state.fileListProps).toBeNull();
        expect(state.gridProps).toBeNull();
    });

    it('forces a single-column list and preserves a caller-owned order', () => {
        state.viewMode = 'list';
        const sortFilePaths = vi.fn((paths: string[]) => [...paths].reverse());
        renderToStaticMarkup(
            <BackgroundMediaComp
                {...baseProps}
                isSingleColumn
                isVirtualizationEnabled={false}
                sortFilePaths={sortFilePaths}
                extraHeaderChild={<span>Filter</span>}
            />,
        );
        expect(sortFilePaths).toHaveBeenCalledWith(state.files);
        expect(state.gridProps).toMatchObject({
            items: ['/photos/a.jpg', '/photos/z.jpg'],
            columnCount: 1,
            isEnabled: false,
            itemWidth: 0,
            estimateRowHeight: 30,
        });
    });
});
