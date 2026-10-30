// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    checkIsExtraBinInstalledMock: vi.fn(),
    getInstalledExtraBinVersionMock: vi.fn(),
    findLocalExtraBinArchiveMock: vi.fn(),
    getExtraBinEntryMock: vi.fn(),
    installExtraBinMock: vi.fn(),
    showFileOrDirExplorerMock: vi.fn(),
    unregisterMock: vi.fn(),
    changedListeners: [] as (() => void)[],
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppEffect: react.useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
        useAppStateAsync: <T,>(callee: () => Promise<T>, deps: any[] = []) => {
            const [value, setValue] = react.useState<T | undefined>();
            react.useEffect(() => {
                let isActive = true;
                callee().then((newValue) => {
                    if (isActive) {
                        setValue(newValue);
                    }
                });
                return () => {
                    isActive = false;
                };
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
            return [value, setValue];
        },
    };
});

vi.mock('../helper/extra-bin/extraBinHelpers', () => ({
    checkIsExtraBinInstalled: h.checkIsExtraBinInstalledMock,
    getExtraBinDirPath: () => '/data/extra-bin/win',
    getInstalledExtraBinVersion: h.getInstalledExtraBinVersionMock,
    registerExtraBinChangedListener: (listener: () => void) => {
        h.changedListeners.push(listener);
        return h.unregisterMock;
    },
}));

vi.mock('../helper/extra-bin/extraBinInstallHelpers', () => ({
    findLocalExtraBinArchive: h.findLocalExtraBinArchiveMock,
    getExtraBinEntry: h.getExtraBinEntryMock,
    installExtraBin: h.installExtraBinMock,
}));

vi.mock('../server/appHelpers', () => ({
    showFileOrDirExplorer: h.showFileOrDirExplorerMock,
}));

// The real comparison lives with the app updater, which drags the whole
// download stack along; dotted numbers compared part by part is all it does.
vi.mock('../server/updatingAppHelpers', () => ({
    checkIsVersionOutdated: (current: string, latest: string) => {
        const currentParts = current.split('.').map(Number);
        const latestParts = latest.split('.').map(Number);
        for (let i = 0; i < latestParts.length; i++) {
            if ((currentParts[i] ?? 0) !== latestParts[i]) {
                return (currentParts[i] ?? 0) < latestParts[i];
            }
        }
        return false;
    },
}));

vi.mock('./settingSectionFoldHelpers', () => ({
    getIsSettingSectionCollapsed: () => false,
    saveIsSettingSectionCollapsed: vi.fn(),
}));

import SettingOthersExtraBinComp from './SettingOthersExtraBinComp';

const ONLINE_ENTRY = {
    version: '2026.2.1',
    fileFullName: 'bin-2026.2.1.tar.gz',
};

let container: HTMLDivElement;
let root: Root;

function findButton(text: string) {
    return (
        Array.from(container.querySelectorAll('button')).find((button) => {
            return button.textContent?.trim() === text;
        }) ?? null
    );
}

function readDetail(label: string) {
    const detail = Array.from(
        container.querySelectorAll('.app-setting-others-detail'),
    ).find((element) => {
        return (
            element.querySelector('.app-setting-others-label')?.textContent ===
            label
        );
    });
    return detail?.querySelector('.app-data')?.textContent ?? null;
}

function getSection() {
    return container.querySelector('section') as HTMLElement;
}

async function renderPanel() {
    await act(async () => {
        root.render(<SettingOthersExtraBinComp />);
    });
}

function setLocalState({
    isInstalled,
    missingNames = [],
    version = null,
    archive = null,
}: {
    isInstalled: boolean;
    missingNames?: string[];
    version?: string | null;
    archive?: string | null;
}) {
    h.checkIsExtraBinInstalledMock.mockResolvedValue({
        isInstalled,
        missingNames,
    });
    h.getInstalledExtraBinVersionMock.mockResolvedValue(version);
    h.findLocalExtraBinArchiveMock.mockResolvedValue(archive);
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.changedListeners = [];
    setLocalState({ isInstalled: true, version: '2026.2.1' });
    h.getExtraBinEntryMock.mockResolvedValue(ONLINE_ENTRY);
    h.installExtraBinMock.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('SettingOthersExtraBinComp', () => {
    test('shows nothing until the local state has been read', async () => {
        h.checkIsExtraBinInstalledMock.mockReturnValue(new Promise(() => {}));
        await renderPanel();
        expect(container.innerHTML).toBe('');
    });

    test('a missing pack names the missing tools and installs on the press', async () => {
        setLocalState({
            isInstalled: false,
            missingNames: ['yt-dlp', 'ffmpeg'],
        });
        h.getExtraBinEntryMock.mockResolvedValue(null);
        await renderPanel();

        expect(getSection().className).toContain(
            'app-setting-others-attention',
        );
        expect(
            container.querySelector('.app-setting-others-state')!.textContent,
        ).toBe('Not installed');
        expect(readDetail('Missing')).toBe('yt-dlp, ffmpeg');
        expect(readDetail('Installed version')).toBeNull();
        expect(readDetail('Latest version')).toBe(
            'Could not check for updates',
        );
        // No archive on disk: nothing to re-extract.
        expect(readDetail('Archive')).toBeNull();
        expect(findButton('Re-extract')).toBeNull();

        h.checkIsExtraBinInstalledMock.mockClear();
        await act(async () => findButton('Download and Install')!.click());

        expect(h.installExtraBinMock).toHaveBeenCalledWith({
            entry: null,
            isForceDownload: false,
            supersededArchiveFileFullName: null,
        });
        // The press re-reads both halves afterwards.
        expect(h.checkIsExtraBinInstalledMock).toHaveBeenCalled();
        expect(h.getExtraBinEntryMock).toHaveBeenCalledTimes(2);
    });

    test('a pack with nothing reported missing still says it is not installed', async () => {
        setLocalState({ isInstalled: false });
        await renderPanel();
        expect(readDetail('Missing')).toBe('Not installed');
    });

    test('an up-to-date pack is ready and its repairs keep the archive', async () => {
        setLocalState({
            isInstalled: true,
            version: '2026.2.1',
            archive: 'bin-2026.2.1.tar.gz',
        });
        await renderPanel();

        expect(getSection().className).toContain('app-setting-others-ready');
        expect(
            container.querySelector('.app-setting-others-state')!.textContent,
        ).toBe('Installed');
        expect(readDetail('Installed version')).toBe('2026.2.1');
        expect(readDetail('Latest version')).toBe('2026.2.1');
        expect(readDetail('Archive')).toBe('bin-2026.2.1.tar.gz');
        expect(findButton('Download and Install')).toBeNull();
        expect(findButton('Update to 2026.2.1')).toBeNull();

        // Re-extracting needs no network: no forced download.
        await act(async () => findButton('Re-extract')!.click());
        expect(h.installExtraBinMock).toHaveBeenLastCalledWith({
            entry: ONLINE_ENTRY,
            isForceDownload: false,
            supersededArchiveFileFullName: null,
        });
        // Reinstalling is the repair for a corrupt archive: always download.
        await act(async () => findButton('Reinstall')!.click());
        expect(h.installExtraBinMock).toHaveBeenLastCalledWith({
            entry: ONLINE_ENTRY,
            isForceDownload: true,
            supersededArchiveFileFullName: null,
        });
    });

    test('an outdated pack offers the update and hands over the old archive', async () => {
        setLocalState({
            isInstalled: true,
            version: '2026.1.5',
            archive: 'bin-2026.1.5.tar.gz',
        });
        await renderPanel();

        expect(getSection().className).toContain(
            'app-setting-others-attention',
        );
        expect(
            container.querySelector('.app-setting-others-state')!.textContent,
        ).toBe('Update Available');

        await act(async () => findButton('Update to 2026.2.1')!.click());

        expect(h.installExtraBinMock).toHaveBeenCalledWith({
            entry: ONLINE_ENTRY,
            isForceDownload: true,
            supersededArchiveFileFullName: 'bin-2026.1.5.tar.gz',
        });
    });

    test('an installed pack with no version file reports an unknown version', async () => {
        setLocalState({ isInstalled: true, version: null });
        await renderPanel();
        expect(readDetail('Installed version')).toBe('?');
        // No version to compare means no update offer.
        expect(findButton('Update to 2026.2.1')).toBeNull();
    });

    test('says it is checking while the online lookup is in flight', async () => {
        h.getExtraBinEntryMock.mockReturnValue(new Promise(() => {}));
        await renderPanel();
        expect(readDetail('Latest version')).toBe('Checking...');
    });

    test('every button is disabled while an install is running', async () => {
        setLocalState({ isInstalled: false, archive: 'bin-1.tar.gz' });
        let finishInstalling!: () => void;
        h.installExtraBinMock.mockReturnValue(
            new Promise<void>((resolve) => {
                finishInstalling = resolve;
            }),
        );
        await renderPanel();

        await act(async () => findButton('Download and Install')!.click());

        const buttons = Array.from(
            container.querySelectorAll<HTMLButtonElement>('button[disabled]'),
        ).map((button) => {
            return button.textContent?.trim() || button.title;
        });
        expect(buttons).toEqual(
            expect.arrayContaining([
                'Download and Install',
                'Refresh',
                'Re-extract',
                'Reinstall',
            ]),
        );

        await act(async () => finishInstalling());

        expect(findButton('Reinstall')!.disabled).toBe(false);
    });

    test('Refresh re-reads both the local state and the online lookup', async () => {
        await renderPanel();
        expect(h.getExtraBinEntryMock).toHaveBeenCalledTimes(1);
        expect(h.checkIsExtraBinInstalledMock).toHaveBeenCalledTimes(1);

        const refreshButton = container.querySelector(
            'button[aria-label="Refresh"]',
        ) as HTMLButtonElement;
        await act(async () => refreshButton.click());

        expect(h.getExtraBinEntryMock).toHaveBeenCalledTimes(2);
        expect(h.checkIsExtraBinInstalledMock).toHaveBeenCalledTimes(2);
        expect(h.installExtraBinMock).not.toHaveBeenCalled();
    });

    test('a change made elsewhere re-reads only the local files', async () => {
        await renderPanel();
        expect(h.changedListeners).toHaveLength(1);
        setLocalState({ isInstalled: false, missingNames: ['qjs'] });

        await act(async () => h.changedListeners[0]());

        expect(readDetail('Missing')).toBe('qjs');
        expect(h.checkIsExtraBinInstalledMock).toHaveBeenCalledTimes(2);
        // No network for a change on this machine.
        expect(h.getExtraBinEntryMock).toHaveBeenCalledTimes(1);

        act(() => root.unmount());
        expect(h.unregisterMock).toHaveBeenCalledOnce();
        root = createRoot(container);
    });

    test('the location path opens its folder', async () => {
        await renderPanel();
        const locationButton = container.querySelector(
            '.app-setting-others-detail-wide button',
        ) as HTMLButtonElement;
        expect(locationButton.textContent).toBe('/data/extra-bin/win');
        expect(locationButton.title).toContain('Reveal Folder');

        await act(async () => locationButton.click());

        expect(h.showFileOrDirExplorerMock).toHaveBeenCalledWith(
            '/data/extra-bin/win',
        );
    });
});
