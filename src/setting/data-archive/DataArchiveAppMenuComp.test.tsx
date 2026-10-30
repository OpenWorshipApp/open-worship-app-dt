// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
    afterAll,
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from 'vitest';

const h = vi.hoisted(() => ({
    isMainWindow: true,
    menuClickedHandlers: [] as ((event: any, data: any) => Promise<void>)[],
    unregisterMock: vi.fn(),
    setAppMenuItemsMock: vi.fn(),
    checkIsMainWindowMock: vi.fn(),
    handleErrorMock: vi.fn(),
    handleExportingMock: vi.fn(),
    handleImportingMock: vi.fn(),
}));

vi.mock('../../helper/appHooks', async () => {
    const react = await import('react');
    return { useAppEffect: react.useEffect };
});

vi.mock('../../helper/errorHelpers', () => ({
    handleError: h.handleErrorMock,
}));

vi.mock('../../lang/langHelpers', () => ({
    registerAppMenuClicked: (handler: any) => {
        h.menuClickedHandlers.push(handler);
        return h.unregisterMock;
    },
    setAppMenuItems: h.setAppMenuItemsMock,
    tran: (text: string) => `t(${text})`,
}));

vi.mock('../../server/appHelpers', () => ({
    checkIsMainWindow: h.checkIsMainWindowMock,
}));

// Development: the module also leaves the two flows on `globalThis` for a QA
// run that cannot reach the native menu.
vi.mock('../../server/appProvider', () => ({
    default: { systemUtils: { isDev: true } },
}));

vi.mock('./dataArchiveMenuHelpers', () => ({
    handleExporting: h.handleExportingMock,
    handleImporting: h.handleImportingMock,
}));

import DataArchiveAppMenuComp from './DataArchiveAppMenuComp';

let container: HTMLDivElement;
let root: Root;

async function renderMenu() {
    await act(async () => root.render(<DataArchiveAppMenuComp />));
}

function getHandler() {
    expect(h.menuClickedHandlers).toHaveLength(1);
    return h.menuClickedHandlers[0];
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.menuClickedHandlers = [];
    h.checkIsMainWindowMock.mockReturnValue(true);
    h.handleExportingMock.mockResolvedValue(undefined);
    h.handleImportingMock.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

afterAll(() => {
    delete (globalThis as any).tryDataExport;
    delete (globalThis as any).tryDataImport;
});

describe('DataArchiveAppMenuComp', () => {
    test('adds Export Data and Import Data to the File menu of the main window', async () => {
        await renderMenu();

        expect(container.innerHTML).toBe('');
        expect(h.setAppMenuItemsMock).toHaveBeenCalledWith('data-archive', {
            file: [
                {
                    label: 't(Export Data)',
                    clickData: { dataArchive: 'data-archive:export' },
                },
                {
                    label: 't(Import Data)',
                    clickData: { dataArchive: 'data-archive:import' },
                },
            ],
        });
        getHandler();

        act(() => root.unmount());
        expect(h.unregisterMock).toHaveBeenCalledOnce();
        root = createRoot(container);
    });

    test('a window other than the main one adds nothing and listens to nothing', async () => {
        h.checkIsMainWindowMock.mockReturnValue(false);
        await renderMenu();

        expect(h.setAppMenuItemsMock).not.toHaveBeenCalled();
        expect(h.menuClickedHandlers).toEqual([]);
    });

    test('runs the flow of the entry clicked', async () => {
        await renderMenu();
        const handler = getHandler();

        await handler({}, { dataArchive: 'data-archive:export' });
        expect(h.handleExportingMock).toHaveBeenCalledOnce();
        expect(h.handleImportingMock).not.toHaveBeenCalled();

        await handler({}, { dataArchive: 'data-archive:import' });
        expect(h.handleImportingMock).toHaveBeenCalledOnce();
        // From the menu the import asks for its file.
        expect(h.handleImportingMock).toHaveBeenCalledWith();
    });

    test('ignores the clicks of every other menu entry', async () => {
        await renderMenu();
        const handler = getHandler();

        await handler({}, { openExternalUrl: 'https://example.org' });
        await handler({}, { dataArchive: 'data-archive:other' });
        await handler({}, undefined);

        expect(h.handleExportingMock).not.toHaveBeenCalled();
        expect(h.handleImportingMock).not.toHaveBeenCalled();
        expect(h.handleErrorMock).not.toHaveBeenCalled();
    });

    test('a failing flow is reported, not thrown at the menu', async () => {
        const error = new Error('disk full');
        h.handleExportingMock.mockRejectedValue(error);
        await renderMenu();

        await expect(
            getHandler()({}, { dataArchive: 'data-archive:export' }),
        ).resolves.toBeUndefined();

        expect(h.handleErrorMock).toHaveBeenCalledWith(error);
    });

    test('development exposes both flows for a QA run', async () => {
        await (globalThis as any).tryDataExport();
        expect(h.handleExportingMock).toHaveBeenCalledOnce();

        await (globalThis as any).tryDataImport('/backups/data.owadata.tar');
        expect(h.handleImportingMock).toHaveBeenCalledWith(
            '/backups/data.owadata.tar',
        );
    });
});
