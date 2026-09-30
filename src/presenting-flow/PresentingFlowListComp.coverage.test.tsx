// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: { dir: null as any, props: null as any, deleteEvent: null as any },
    mocks: {
        create: vi.fn(),
        importSelect: vi.fn(),
        importUrl: vi.fn(),
        importDrop: vi.fn(),
        archiveName: vi.fn(),
        removeSettings: vi.fn(),
        getFullName: vi.fn(),
    },
}));

vi.mock('./PresentingFlowFileComp', () => ({
    default: ({ filePath }: any) => <div>{filePath}</div>,
}));
vi.mock('../others/FileListHandlerComp', () => ({
    default: (props: any) => {
        state.props = props;
        return (
            <section>
                {props.header}
                {props.bodyHandler(['/a.owpf', '/b.owpf'])}
            </section>
        );
    },
}));
vi.mock('./PresentingFlow', () => ({ default: { create: mocks.create } }));
vi.mock('../helper/dirSourceHelpers', () => ({
    useGenDirSourceReload: () => state.dir,
    useFileSourceEvents: (_events: unknown, callback: unknown) => {
        state.deleteEvent = callback;
    },
}));
vi.mock('../helper/constants', () => ({
    defaultDataDirNames: { PRESENTING_FLOW: 'Presenting Flows' },
    dirSourceSettingNames: { PRESENTING_FLOW: 'presenting-flow-dir' },
}));
vi.mock('../others/labelIconHelpers', () => ({
    toIconedLabel: (value: string) => value,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon-${name}`,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (value: string) => value }));
vi.mock('../server/fileHelpers', () => ({
    getFileFullName: mocks.getFullName,
}));
vi.mock('./presentingFlowArchiveHelpers', () => ({
    askAndImportPresentingFlowArchiveFromUrl: mocks.importUrl,
    checkIsPresentingFlowArchiveFileFullName: mocks.archiveName,
    importDroppedPresentingFlowArchive: mocks.importDrop,
    selectAndImportPresentingFlowArchive: mocks.importSelect,
}));
vi.mock('../background/downloadHelper', () => ({
    getOpenSharedLinkMenuItem: () => ({ menuElement: 'Shared' }),
}));
vi.mock('./presentingFlowHelpers', () => ({
    removePresentingFlowSettings: mocks.removeSettings,
}));
vi.mock('./presentingFlowOnScreenHelpers', () => ({
    checkIsAnyPresentingFlowOnScreen: vi.fn(),
}));
vi.mock('./PresentingFlowPreviewFloatingComp', () => ({
    default: () => <aside>floating</aside>,
}));

import PresentingFlowListComp from './PresentingFlowListComp';

beforeEach(() => {
    vi.clearAllMocks();
    state.dir = null;
    state.props = null;
    state.deleteEvent = null;
});

describe('PresentingFlowListComp', () => {
    test('renders only after its directory source is ready and wires list behavior', async () => {
        const container = document.createElement('div');
        const root = createRoot(container);
        await act(async () => root.render(<PresentingFlowListComp />));
        expect(container.innerHTML).toBe('');
        state.dir = { path: '/runs' };
        await act(async () => root.render(<PresentingFlowListComp />));
        expect(container.textContent).toContain('Presenting Flows');
        expect(container.textContent).toContain('/a.owpf');
        expect(container.textContent).toContain('floating');
        expect(state.props).toMatchObject({
            mimetypeName: 'presentingFlow',
            defaultFolderName: 'Presenting Flows',
        });

        mocks.create.mockResolvedValueOnce({});
        await expect(state.props.onNewFile('/runs', 'Sunday')).resolves.toBe(
            false,
        );
        mocks.create.mockResolvedValueOnce(null);
        await expect(state.props.onNewFile('/runs', 'Sunday')).resolves.toBe(
            true,
        );
        await act(async () => root.unmount());
    });

    test('cleans deleted run settings and imports only recognized archives', async () => {
        state.dir = {};
        const root = createRoot(document.createElement('div'));
        await act(async () => root.render(<PresentingFlowListComp />));
        state.deleteEvent(4);
        state.deleteEvent('/other.txt');
        state.deleteEvent('/run.owpf');
        expect(mocks.removeSettings).toHaveBeenCalledWith('/run.owpf');

        mocks.getFullName.mockReturnValueOnce(undefined);
        expect(state.props.takeDroppedFile({})).toBe(false);
        mocks.getFullName.mockReturnValueOnce('file.zip');
        mocks.archiveName.mockReturnValueOnce(false);
        expect(state.props.takeDroppedFile({})).toBe(false);
        const dropped = { path: '/export.owapf.tar.gz' };
        mocks.getFullName.mockReturnValueOnce('export.owapf.tar.gz');
        mocks.archiveName.mockReturnValueOnce(true);
        expect(state.props.takeDroppedFile(dropped)).toBe(true);
        expect(mocks.importDrop).toHaveBeenCalledWith(dropped);

        const menu = state.props.genContextMenuItems();
        expect(menu.map((entry: any) => entry.menuElement)).toEqual([
            'Import',
            'Import From URL',
            'Shared',
        ]);
        menu[0].onSelect();
        menu[1].onSelect();
        expect(mocks.importSelect).toHaveBeenCalled();
        expect(mocks.importUrl).toHaveBeenCalled();
        await act(async () => root.unmount());
    });
});
