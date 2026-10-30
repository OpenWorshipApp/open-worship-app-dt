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
        selectChildrenIfNeeded: vi.fn(),
        removeChildren: vi.fn(),
        handleError: vi.fn(),
        repairLinks: vi.fn(),
        createDir: vi.fn(),
        reload: vi.fn(),
        watch: vi.fn(),
        unwatch: vi.fn(),
        showProgress: vi.fn(),
        hideProgress: vi.fn(),
        toast: vi.fn(),
        alert: vi.fn(async (..._args: unknown[]) => {}),
        forceReload: vi.fn(),
        selectDirs: vi.fn(async () => [] as string[]),
        copyTo: vi.fn(),
        confirm: vi.fn(async (..._args: unknown[]) => false),
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
                    <button
                        type="button"
                        onClick={() => (dirSource.dirPath = 'data')}
                    >
                        Choose relative
                    </button>
                    <button
                        type="button"
                        onClick={() => (dirSource.dirPath = '')}
                    >
                        Clear box
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            // Enter, then the blur the question causes.
                            dirSource.dirPath = '/missing';
                            dirSource.dirPath = '/missing';
                        }}
                    >
                        Enter then blur
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
    selectPathForChildDirIfNeeded: mocks.selectChildrenIfNeeded,
}));
vi.mock('../../helper/errorHelpers', () => ({
    handleError: mocks.handleError,
}));
vi.mock('../../server/fileHelpers', () => ({
    checkIsNativeAbsolutePath: (path: string) => path.startsWith('/'),
    fsCheckDirExist: async (path: string) => state.existing.has(path),
    fsCreateDir: mocks.createDir,
    selectDirs: mocks.selectDirs,
}));
vi.mock('./dataDirMoveHelpers', () => ({
    copyDataDirTo: mocks.copyTo,
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
    showAppConfirm: mocks.confirm,
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
vi.mock('../SettingCardHeaderComp', () => ({
    default: ({ title, children }: { title: string; children?: ReactNode }) => (
        <header>
            {title}
            {children}
        </header>
    ),
}));
vi.mock('./RenderParentDirHistoryComp', () => ({
    default: ({
        suggestedDirPath,
        onSuggestedUsing,
    }: {
        suggestedDirPath?: string | null;
        onSuggestedUsing?: () => void;
    }) => (
        <span>
            Recent folders
            {suggestedDirPath ? (
                <button type="button" onClick={onSuggestedUsing}>
                    Use This Folder {suggestedDirPath}
                </button>
            ) : null}
        </span>
    ),
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
        await act(async () => click('Use This Folder'));
        expect(mocks.createDir).toHaveBeenCalledWith('/desktop/data');
        expect(mocks.unwatch).toHaveBeenCalledOnce();
        expect(mocks.setSelected).toHaveBeenCalledWith('/desktop/data');
        // Asked once: choosing the folder asks, and the button no longer
        // asks the same question beside it.
        expect(mocks.selectChildren).toHaveBeenCalledExactlyOnceWith(
            '/desktop/data',
        );
        expect(mocks.watch).toHaveBeenCalledOnce();
        expect(host.textContent).toContain('Child Directories');
    });

    test('the parent directory sits outside the Path Settings card', async () => {
        await renderSettings();
        // No folder: no card at all, only the choice.
        expect(host.textContent).toContain('Parent Directory:');
        expect(host.textContent).not.toContain('Path Settings');
        // No box and no highlight ring round it either.
        expect(host.querySelector('.app-highlight-selected')).toBeNull();

        await act(async () => click('Use This Folder'));
        const header = [...host.querySelectorAll('header')].find((one) => {
            return one.textContent === 'Path Settings';
        });
        expect(header).toBeDefined();
        const card = header!.closest('.card')!;
        const parentTitle = [...host.querySelectorAll('div')].find((one) => {
            return one.textContent === 'Parent Directory:';
        })!;
        expect(card.contains(parentTitle)).toBe(false);
        // Above the card, the first thing on the page.
        expect(
            parentTitle.compareDocumentPosition(card) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
        expect(card.textContent).toContain('Child Directories');
    });

    test('copies the data folder to a place the person picks, then offers it', async () => {
        state.selected = '/home/.owa/open-worship-data';
        state.existing.add('/home/.owa/open-worship-data');
        state.existing.add('/media/stick/open-worship-data');
        mocks.checkUsed.mockResolvedValue(true);
        mocks.selectDirs.mockResolvedValueOnce(['/media/stick']);
        mocks.copyTo.mockResolvedValueOnce({
            isCopied: true,
            toDirPath: '/media/stick/open-worship-data',
        });
        mocks.confirm.mockResolvedValueOnce(true);
        await renderSettings();

        await act(async () => click('Copy Data Folder'));
        await act(async () => Promise.resolve());

        expect(mocks.copyTo).toHaveBeenCalledWith(
            '/home/.owa/open-worship-data',
            '/media/stick',
            expect.anything(),
        );
        expect(mocks.confirm.mock.calls[0][1]).toContain(
            '/media/stick/open-worship-data',
        );
        // Switched to: a used data folder, so the windows reload on it.
        expect(mocks.setSelected).toHaveBeenCalledWith(
            '/media/stick/open-worship-data',
        );
    });

    test('a cancelled pick copies nothing, and a failed copy says why', async () => {
        state.selected = '/home/.owa/open-worship-data';
        state.existing.add('/home/.owa/open-worship-data');
        await renderSettings();
        await act(async () => click('Copy Data Folder'));
        expect(mocks.copyTo).not.toHaveBeenCalled();

        mocks.selectDirs.mockResolvedValueOnce(['/media/stick']);
        mocks.copyTo.mockResolvedValueOnce({
            isCopied: false,
            toDirPath: '/media/stick/open-worship-data',
            errorMessage: 'The stick is full',
        });
        await act(async () => click('Copy Data Folder'));
        await act(async () => Promise.resolve());
        expect(mocks.alert.mock.calls.at(-1)?.[1]).toContain(
            'The stick is full',
        );
        expect(mocks.confirm).not.toHaveBeenCalled();
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

    test('asks before making a typed folder that is not there, and No changes nothing', async () => {
        state.selected = '/old';
        state.existing.add('/old');
        await renderSettings();
        await act(async () => click('Choose missing'));
        expect(mocks.confirm).toHaveBeenCalledOnce();
        expect(mocks.confirm.mock.calls[0][0]).toBe('Create Data Folder');
        expect(mocks.confirm.mock.calls[0][1]).toContain('/missing');
        expect(mocks.confirm.mock.calls[0][2]).toMatchObject({
            confirmButtonLabel: 'Create',
        });
        // A slip of the keyboard made an empty data folder and used it.
        expect(mocks.createDir).not.toHaveBeenCalled();
        expect(mocks.setSelected).not.toHaveBeenCalled();
        expect(mocks.removeChildren).not.toHaveBeenCalled();
        expect(mocks.unwatch).not.toHaveBeenCalled();
    });

    test('Create makes the typed folder and asks about its standard folders', async () => {
        state.selected = '/old';
        state.existing.add('/old');
        mocks.confirm.mockResolvedValueOnce(true);
        await renderSettings();
        await act(async () => click('Choose missing'));
        expect(mocks.createDir).toHaveBeenCalledWith('/missing');
        expect(mocks.setSelected).toHaveBeenCalledWith('/missing');
        expect(mocks.selectChildren).toHaveBeenCalledExactlyOnceWith(
            '/missing',
        );
        expect(mocks.removeChildren).not.toHaveBeenCalled();
    });

    test('the blur after Enter does not ask the same question again', async () => {
        state.selected = '/old';
        state.existing.add('/old');
        await renderSettings();
        await act(async () => click('Enter then blur'));
        expect(mocks.confirm).toHaveBeenCalledOnce();
        expect(mocks.setSelected).not.toHaveBeenCalled();
    });

    test('an emptied box keeps the data folder in use', async () => {
        state.selected = '/old';
        state.existing.add('/old');
        await renderSettings();
        await act(async () => click('Clear box'));
        // It used to stop using the data folder: every window showed
        // "No Parent Directory Selected" after one Backspace.
        expect(mocks.setSelected).not.toHaveBeenCalled();
        expect(mocks.removeChildren).not.toHaveBeenCalled();
        expect(mocks.confirm).not.toHaveBeenCalled();
    });

    test('a path that is not a whole one is refused with a word', async () => {
        state.selected = '/old';
        state.existing.add('/old');
        state.existing.add('data');
        await renderSettings();
        await act(async () => click('Choose relative'));
        expect(mocks.toast).toHaveBeenCalledWith(
            'Choose a folder',
            expect.stringContaining('/desktop/data'),
        );
        expect(mocks.setSelected).not.toHaveBeenCalled();
        expect(mocks.createDir).not.toHaveBeenCalled();
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

describe('general directory settings: the paths taken less often', () => {
    test('Reset All Child Directories asks about the folder in use', async () => {
        state.selected = '/data';
        await renderSettings();
        await act(async () => click('Reset All Child Directories'));
        expect(mocks.selectChildren).toHaveBeenCalledExactlyOnceWith('/data');
    });

    test('Repair Links with no data folder to repair says nothing', async () => {
        state.selected = '/data';
        mocks.repairLinks.mockResolvedValueOnce(null);
        await renderSettings();
        await act(async () => click('Repair Links'));
        expect(mocks.hideProgress).toHaveBeenCalledWith(
            'repair-data-dir-links',
        );
        expect(mocks.toast).not.toHaveBeenCalled();
        expect(mocks.alert).not.toHaveBeenCalled();
        expect(mocks.forceReload).not.toHaveBeenCalled();
    });

    test('a typed folder that cannot be made is reported and not used', async () => {
        state.selected = '/old';
        state.existing.add('/old');
        mocks.confirm.mockResolvedValueOnce(true);
        const error = new Error('EACCES');
        mocks.createDir.mockRejectedValueOnce(error);
        await renderSettings();
        await act(async () => click('Choose missing'));
        expect(mocks.handleError).toHaveBeenCalledWith(error);
        expect(mocks.toast).toHaveBeenCalledWith(
            'Create Data Folder',
            'Fail to create folder "/missing"',
        );
        expect(mocks.setSelected).not.toHaveBeenCalled();
        expect(mocks.unwatch).not.toHaveBeenCalled();
    });

    test('a typed folder still missing after Create is not used', async () => {
        state.selected = '/old';
        state.existing.add('/old');
        mocks.confirm.mockResolvedValueOnce(true);
        // Made "successfully", yet not there to be found.
        mocks.createDir.mockResolvedValueOnce(undefined);
        await renderSettings();
        await act(async () => click('Choose missing'));
        expect(mocks.handleError).not.toHaveBeenCalled();
        expect(mocks.toast).toHaveBeenCalledWith(
            'Create Data Folder',
            'Fail to create folder "/missing"',
        );
        expect(mocks.setSelected).not.toHaveBeenCalled();
    });

    test('a folder gone right after it is chosen drops the standard folders', async () => {
        state.selected = '/old';
        state.existing.add('/old');
        state.existing.add('/used');
        mocks.setSelected.mockImplementation(async (path: string) => {
            state.selected = path;
            state.existing.delete(path);
        });
        await renderSettings();
        await act(async () => click('Choose used'));
        expect(mocks.unwatch).toHaveBeenCalledOnce();
        expect(mocks.setSelected).toHaveBeenCalledWith('/used');
        expect(mocks.removeChildren).toHaveBeenCalledOnce();
        expect(mocks.selectChildren).not.toHaveBeenCalled();
        expect(mocks.reload).not.toHaveBeenCalled();
        expect(mocks.watch).toHaveBeenCalledOnce();
    });
});
