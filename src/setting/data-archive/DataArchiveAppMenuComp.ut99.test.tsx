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

// File → Export Data / Import Data: built in the main window only, each click
// routed to its own flow, every other menu click left alone.
const { state, mocks } = vi.hoisted(() => ({
    state: {
        isMainWindow: true,
        listener: null as
            ((event: unknown, clickData: any) => Promise<void>) | null,
    },
    mocks: {
        setMenu: vi.fn(),
        unregister: vi.fn(),
        handleError: vi.fn(),
        exporting: vi.fn(),
        importing: vi.fn(),
    },
}));

vi.mock('../../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return { useAppEffect: useEffect };
});
vi.mock('../../helper/errorHelpers', () => ({
    handleError: mocks.handleError,
}));
vi.mock('../../lang/langHelpers', () => ({
    registerAppMenuClicked: (listener: any) => {
        state.listener = listener;
        return mocks.unregister;
    },
    setAppMenuItems: mocks.setMenu,
    tran: (text: string) => `[${text}]`,
}));
vi.mock('../../server/appHelpers', () => ({
    checkIsMainWindow: () => state.isMainWindow,
}));
// The dev-only hooks for an automated run are defined at load.
vi.mock('../../server/appProvider', () => ({
    default: { systemUtils: { isDev: true } },
}));
vi.mock('./dataArchiveMenuHelpers', () => ({
    handleExporting: mocks.exporting,
    handleImporting: mocks.importing,
}));

import DataArchiveAppMenuComp from './DataArchiveAppMenuComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

async function render() {
    await act(async () => {
        root.render(<DataArchiveAppMenuComp />);
    });
}

beforeEach(() => {
    state.isMainWindow = true;
    state.listener = null;
    mocks.exporting.mockResolvedValue('exported');
    mocks.importing.mockResolvedValue('imported');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
});

afterAll(() => {
    delete (globalThis as any).tryDataExport;
    delete (globalThis as any).tryDataImport;
});

describe('the File menu entries', () => {
    test('the main window adds both, translated, and listens for them', async () => {
        await render();
        expect(container.innerHTML).toBe('');
        expect(mocks.setMenu).toHaveBeenCalledExactlyOnceWith('data-archive', {
            file: [
                {
                    label: '[Export Data]',
                    clickData: { dataArchive: 'data-archive:export' },
                },
                {
                    label: '[Import Data]',
                    clickData: { dataArchive: 'data-archive:import' },
                },
            ],
        });
        expect(state.listener).not.toBeNull();
        expect(mocks.unregister).not.toHaveBeenCalled();
        await act(async () => {
            root.unmount();
        });
        expect(mocks.unregister).toHaveBeenCalledOnce();
        root = createRoot(container);
    });

    test('a popup window neither adds them nor listens', async () => {
        state.isMainWindow = false;
        await render();
        expect(mocks.setMenu).not.toHaveBeenCalled();
        expect(state.listener).toBeNull();
    });

    test('each entry runs its own flow', async () => {
        await render();
        await state.listener!(null, { dataArchive: 'data-archive:export' });
        expect(mocks.exporting).toHaveBeenCalledOnce();
        expect(mocks.importing).not.toHaveBeenCalled();
        await state.listener!(null, { dataArchive: 'data-archive:import' });
        expect(mocks.importing).toHaveBeenCalledExactlyOnceWith();
        expect(mocks.exporting).toHaveBeenCalledOnce();
    });

    test('a click on any other menu entry is left alone', async () => {
        await render();
        await state.listener!(null, { language: 'km-KH' });
        await state.listener!(null, { dataArchive: 'data-archive:other' });
        await state.listener!(null, null);
        expect(mocks.exporting).not.toHaveBeenCalled();
        expect(mocks.importing).not.toHaveBeenCalled();
        expect(mocks.handleError).not.toHaveBeenCalled();
    });

    test('a flow that fails is reported', async () => {
        const error = new Error('disk full');
        mocks.exporting.mockRejectedValue(error);
        await render();
        await state.listener!(null, { dataArchive: 'data-archive:export' });
        expect(mocks.handleError).toHaveBeenCalledExactlyOnceWith(error);
    });
});

describe('the development hooks', () => {
    test('drive the same two flows as the menu', async () => {
        await expect((globalThis as any).tryDataExport()).resolves.toBe(
            'exported',
        );
        expect(mocks.exporting).toHaveBeenCalledOnce();
        await expect(
            (globalThis as any).tryDataImport('/backups/church.owadata'),
        ).resolves.toBe('imported');
        expect(mocks.importing).toHaveBeenCalledExactlyOnceWith(
            '/backups/church.owadata',
        );
    });
});
