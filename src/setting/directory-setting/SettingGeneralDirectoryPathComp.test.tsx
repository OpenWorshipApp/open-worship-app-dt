// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        selected: null as string | null,
        existing: new Set<string>(),
        childPath: '/songs',
    },
    mocks: {
        getSelected: vi.fn(),
        setSelected: vi.fn(),
        checkUsed: vi.fn(),
        checkShouldSelect: vi.fn(),
        selectChildren: vi.fn(),
        removeChildren: vi.fn(),
        repairLinks: vi.fn(),
        createDir: vi.fn(),
        reload: vi.fn(),
        watch: vi.fn(),
        unwatch: vi.fn(),
        showProgress: vi.fn(),
        hideProgress: vi.fn(),
        toast: vi.fn(),
        alert: vi.fn(),
        forceReload: vi.fn(),
    },
}));

vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../helper/appHooks', async () => {
    const { useEffect, useRef, useState } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppEffectAsync: (
            callback: () => Promise<unknown>,
            deps: unknown[],
        ) =>
            useEffect(() => {
                void callback();
            }, deps),
        useAppStateAsync: <T,>(
            read: () => Promise<T>,
            deps: unknown[] = [],
        ) => {
            const [value, setValue] = useState<T | null>(null);
            useEffect(() => {
                void read().then(setValue);
            }, deps);
            return [value, setValue] as const;
        },
        useAppCurrentRef: (value: unknown) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../../helper/DirSource', () => ({
    default: class DirSource {
        _dirPath = '';
        constructor(readonly settingName: string) {}
        setDirPath(path: string) {
            this._dirPath = path;
        }
    },
}));
vi.mock('../../others/PathSelectorComp', () => ({
    default: ({ dirSource, prefix }: { dirSource: any; prefix: string }) => (
        <div>
            <span>
                {prefix}: {dirSource.dirPath}
            </span>
            {prefix === 'path-parent-dir' ? (
                <>
                    <button
                        type="button"
                        onClick={() => (dirSource.dirPath = '/used')}
                    >
                        Choose used
                    </button>
                    <button
                        type="button"
                        onClick={() => (dirSource.dirPath = '/missing')}
                    >
                        Choose missing
                    </button>
                </>
            ) : null}
        </div>
    ),
}));
vi.mock('./dataDirectories', () => ({
    selectableDataDirectories: [
        {
            title: 'Songs',
            settingName: 'songs',
            defaultDirName: 'Songs',
            iconClassName: 'bi-music-note',
        },
    ],
}));
vi.mock('./directoryHelpers', () => ({
    checkIsUsedDataDir: mocks.checkUsed,
    checkShouldSelectChildDir: mocks.checkShouldSelect,
    getDefaultDataDir: () => '/desktop/data',
    removePathForChildDir: mocks.removeChildren,
    repairDataDirLinks: mocks.repairLinks,
    selectPathForChildDir: mocks.selectChildren,
}));
vi.mock('../../server/fileHelpers', () => ({
    fsCheckDirExist: async (path: string) => state.existing.has(path),
    fsCreateDir: mocks.createDir,
}));
vi.mock('../../server/appProvider', () => ({
    default: { reload: mocks.reload },
}));
vi.mock('../../progress-bar/progressBarHelpers', () => ({
    hideProgressBar: mocks.hideProgress,
    showProgressBar: mocks.showProgress,
}));
vi.mock('../../toast/toastHelpers', () => ({ showSimpleToast: mocks.toast }));
vi.mock('../../popup-widget/popupWidgetHelpers', () => ({
    showAppAlert: mocks.alert,
}));
vi.mock('../settingHelpers', () => ({
    forceReloadAppWindows: mocks.forceReload,
}));
vi.mock('./appLocalStorage', () => ({
    SELECTED_PARENT_DIR_SETTING_NAME: 'parent',
    appLocalStorage: {
        getSelectedParentDirectory: mocks.getSelected,
        setSelectedParentDirectory: mocks.setSelected,
    },
}));
vi.mock('../../others/NoDirSelectedComp', () => ({
    SelectDefaultDirButtonComp: () => <span>Select default child</span>,
}));
vi.mock('../../helper/dirSourceHelpers', () => ({
    useGenDirSourceReload: () => ({ dirPath: state.childPath }),
}));
vi.mock('../../helper/dirWatchingHelpers', () => ({
    unwatchDataDir: mocks.unwatch,
    watchDataDir: mocks.watch,
}));
vi.mock('../../helper/helpers', () => ({
    HIGHLIGHT_SELECTED_CLASSNAME: 'selected',
}));
vi.mock('../SettingCardHeaderComp', () => ({
    default: ({ title, children }: { title: string; children?: ReactNode }) => (
        <header>
            {title}
            {children}
        </header>
    ),
}));
vi.mock('./RenderParentDirHistoryComp', () => ({
    default: () => <span>Recent folders</span>,
}));

import SettingGeneralDirectoryPathComp from './SettingGeneralDirectoryPathComp';

let host: HTMLDivElement;
let root: Root;

async function renderSettings() {
    await act(async () => root.render(<SettingGeneralDirectoryPathComp />));
    await act(async () => Promise.resolve());
}

function click(label: string) {
    const button = [...host.querySelectorAll('button')].find((one) =>
        one.textContent?.includes(label),
    );
    expect(button).toBeDefined();
    button!.click();
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.clearAllMocks();
    state.selected = null;
    state.existing.clear();
    state.childPath = '/songs';
    mocks.getSelected.mockImplementation(async () => state.selected);
    mocks.setSelected.mockImplementation(async (path: string) => {
        state.selected = path;
    });
    mocks.createDir.mockImplementation(async (path: string) => {
        state.existing.add(path);
    });
    mocks.checkUsed.mockResolvedValue(false);
    mocks.checkShouldSelect.mockResolvedValue(false);
    mocks.selectChildren.mockResolvedValue(undefined);
    mocks.removeChildren.mockResolvedValue(undefined);
    mocks.watch.mockResolvedValue(undefined);
    mocks.repairLinks.mockResolvedValue(null);
    mocks.alert.mockResolvedValue(undefined);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('general directory settings', () => {
    test('creates the default parent folder and installs it before child paths', async () => {
        await renderSettings();
        expect(host.textContent).toContain('/desktop/data');
        await act(async () => click('Click here to set default data'));
        expect(mocks.createDir).toHaveBeenCalledWith('/desktop/data');
        expect(mocks.unwatch).toHaveBeenCalledOnce();
        expect(mocks.setSelected).toHaveBeenCalledWith('/desktop/data');
        expect(mocks.selectChildren).toHaveBeenCalledWith('/desktop/data');
        expect(mocks.watch).toHaveBeenCalledOnce();
        expect(host.textContent).toContain('Child Directories');
    });

    test('keeps child links from an existing data folder when it is selected', async () => {
        state.selected = '/old';
        state.existing.add('/used');
        mocks.checkUsed.mockResolvedValue(true);
        await renderSettings();
        await act(async () => click('Choose used'));
        expect(mocks.checkUsed).toHaveBeenCalledWith('/used');
        expect(mocks.setSelected).toHaveBeenCalledWith('/used');
        expect(mocks.reload).toHaveBeenCalledOnce();
        expect(mocks.removeChildren).not.toHaveBeenCalled();
        expect(mocks.selectChildren).not.toHaveBeenCalled();
    });

    test('removes child links when the selected parent does not exist', async () => {
        state.selected = '/old';
        await renderSettings();
        await act(async () => click('Choose missing'));
        expect(mocks.setSelected).toHaveBeenCalledWith('/missing');
        expect(mocks.removeChildren).toHaveBeenCalledOnce();
        expect(mocks.watch).toHaveBeenCalledOnce();
        expect(mocks.reload).not.toHaveBeenCalled();
    });

    test('reports link repair results and reloads only when files changed', async () => {
        state.selected = '/data';
        state.existing.add('/songs');
        mocks.repairLinks.mockResolvedValueOnce({ linkCount: 0, fileCount: 0 });
        mocks.repairLinks.mockResolvedValueOnce({ linkCount: 2, fileCount: 4 });
        await renderSettings();
        await act(async () => click('Repair Links'));
        expect(mocks.toast).toHaveBeenCalledWith(
            'Repair Links',
            'No links to an old location of this data folder were found.',
        );
        expect(mocks.forceReload).not.toHaveBeenCalled();

        await act(async () => click('Repair Links'));
        expect(mocks.alert).toHaveBeenCalledWith(
            'Repair Links',
            expect.stringContaining('Links repaired: 2. Files changed: 4.'),
        );
        expect(mocks.forceReload).toHaveBeenCalledOnce();
        expect(mocks.showProgress).toHaveBeenCalledTimes(2);
        expect(mocks.hideProgress).toHaveBeenCalledTimes(2);
    });
});
