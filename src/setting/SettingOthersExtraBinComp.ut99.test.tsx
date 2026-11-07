// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The Extra Binaries row: what it says about the pack on disk and online, and
// which install each of its buttons asks for.
const { state, mocks } = vi.hoisted(() => ({
    state: {
        dirPath: '/data/extra-bin',
        isInstalled: true,
        missingNames: [] as string[],
        installedVersion: '2026.10.01' as string | null,
        archive: 'extra-bin-2026.10.01.tar.gz' as string | null,
        entry: {
            url: 'https://example.org/p.tar.gz',
            version: '2026.10.01',
        } as { url: string; version: string } | null,
        changedListener: null as (() => void) | null,
        sectionProps: null as any,
    },
    mocks: {
        checkInstalled: vi.fn(),
        getVersion: vi.fn(),
        findArchive: vi.fn(),
        getEntry: vi.fn(),
        install: vi.fn(),
        reveal: vi.fn(),
        unregister: vi.fn(),
    },
}));

vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef, useState } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
        useAppStateAsync: <T,>(
            read: () => Promise<T>,
            deps: unknown[] = [],
        ) => {
            const [value, setValue] = useState<T | undefined>(undefined);
            useEffect(() => {
                void read().then(setValue);
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
            return [value, setValue] as const;
        },
    };
});
vi.mock('../helper/extra-bin/extraBinHelpers', () => ({
    checkIsExtraBinInstalled: mocks.checkInstalled,
    getExtraBinDirPath: () => state.dirPath,
    getInstalledExtraBinVersion: mocks.getVersion,
    registerExtraBinChangedListener: (listener: () => void) => {
        state.changedListener = listener;
        return mocks.unregister;
    },
}));
vi.mock('../helper/extra-bin/extraBinInstallHelpers', () => ({
    findLocalExtraBinArchive: mocks.findArchive,
    getExtraBinEntry: mocks.getEntry,
    installExtraBin: mocks.install,
}));
vi.mock('../server/appHelpers', () => ({
    showFileOrDirExplorer: mocks.reveal,
}));
vi.mock('../server/updatingAppHelpers', () => ({
    // Dotted numbers, compared part by part as the real check does.
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
vi.mock('./SettingOthersSectionComp', () => ({
    default: (props: any) => {
        state.sectionProps = props;
        return (
            <section>
                <div className="header">{props.headerActions}</div>
                {props.children}
            </section>
        );
    },
}));

import SettingOthersExtraBinComp from './SettingOthersExtraBinComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

async function wait() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

async function render() {
    await act(async () => {
        root.render(<SettingOthersExtraBinComp />);
    });
    await wait();
}

function getButton(text: string) {
    return Array.from(container.querySelectorAll('button')).find((button) => {
        return button.textContent === text;
    }) as HTMLButtonElement | undefined;
}

function getDetail(label: string) {
    const detail = Array.from(
        container.querySelectorAll('.app-setting-others-detail'),
    ).find((one) => {
        return one.firstElementChild?.textContent === label;
    });
    return detail?.lastElementChild ?? null;
}

async function press(button: HTMLButtonElement) {
    await act(async () => {
        button.click();
    });
    await wait();
}

beforeEach(() => {
    state.dirPath = '/data/extra-bin';
    state.isInstalled = true;
    state.missingNames = [];
    state.installedVersion = '2026.10.01';
    state.archive = 'extra-bin-2026.10.01.tar.gz';
    state.entry = {
        url: 'https://example.org/p.tar.gz',
        version: '2026.10.01',
    };
    state.changedListener = null;
    state.sectionProps = null;
    mocks.checkInstalled.mockImplementation(async () => ({
        isInstalled: state.isInstalled,
        missingNames: state.missingNames,
    }));
    mocks.getVersion.mockImplementation(async () => state.installedVersion);
    mocks.findArchive.mockImplementation(async () => state.archive);
    mocks.getEntry.mockImplementation(async () => state.entry);
    mocks.install.mockResolvedValue(true);
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

describe('what the row says', () => {
    test('nothing is drawn before the files on disk are read', async () => {
        mocks.checkInstalled.mockReturnValue(new Promise(() => {}));
        await render();
        expect(container.innerHTML).toBe('');
    });

    test('an installed, current pack is ready, with its version and archive', async () => {
        await render();
        expect(mocks.findArchive).toHaveBeenCalledWith('/data/extra-bin');
        expect(state.sectionProps.state).toBe('ready');
        expect(state.sectionProps.stateLabel).toBe('Installed');
        expect(state.sectionProps.foldName).toBe('extra-bin');
        expect(getDetail('Installed version')!.textContent).toBe('2026.10.01');
        expect(getDetail('Latest version')!.textContent).toBe('2026.10.01');
        const archive = getDetail('Archive')!.firstElementChild as HTMLElement;
        expect(archive.textContent).toBe('extra-bin-2026.10.01.tar.gz');
        expect(archive.title).toBe(
            'Kept on purpose, so the binaries can be extracted again without downloading.',
        );
        expect(getDetail('Missing')).toBeNull();
        // Nothing to install, only the repairs.
        expect(getButton('Download and Install')).toBeUndefined();
        expect(getButton('Re-extract')).toBeDefined();
        expect(getButton('Reinstall')).toBeDefined();
    });

    test('a missing pack names the tools that are gone', async () => {
        state.isInstalled = false;
        state.missingNames = ['yt-dlp', 'ffmpeg'];
        state.installedVersion = null;
        state.archive = null;
        await render();
        expect(state.sectionProps.state).toBe('attention');
        expect(state.sectionProps.stateLabel).toBe('Not installed');
        expect(getDetail('Missing')!.textContent).toBe('yt-dlp, ffmpeg');
        expect(getDetail('Installed version')).toBeNull();
        expect(getDetail('Archive')).toBeNull();
        expect(getButton('Re-extract')).toBeUndefined();
        expect(getButton('Download and Install')).toBeDefined();
    });

    test('with no names to give, a missing pack just says it is not installed', async () => {
        state.isInstalled = false;
        state.missingNames = [];
        await render();
        expect(getDetail('Missing')!.textContent).toBe('Not installed');
    });

    test('a newer pack online offers the update', async () => {
        state.entry = {
            url: 'https://example.org/p2.tar.gz',
            version: '2026.11.01',
        };
        await render();
        expect(state.sectionProps.state).toBe('attention');
        expect(state.sectionProps.stateLabel).toBe('Update Available');
        expect(getButton('Update to 2026.11.01')).toBeDefined();
        expect(getButton('Download and Install')).toBeUndefined();
    });

    test('the online check says when it is still asking or could not ask', async () => {
        let answer!: (value: unknown) => void;
        mocks.getEntry.mockReturnValue(
            new Promise((resolve) => {
                answer = resolve;
            }),
        );
        await render();
        expect(getDetail('Latest version')!.textContent).toBe('Checking...');
        await act(async () => {
            answer(null);
        });
        expect(getDetail('Latest version')!.textContent).toBe(
            'Could not check for updates',
        );
        // Offline is no fault of the pack on disk.
        expect(state.sectionProps.stateLabel).toBe('Installed');
    });

    test('a pack with no version on disk is shown as unknown, never outdated', async () => {
        state.installedVersion = null;
        state.entry = {
            url: 'https://example.org/p2.tar.gz',
            version: '2026.11.01',
        };
        await render();
        expect(getDetail('Installed version')!.textContent).toBe('?');
        expect(state.sectionProps.stateLabel).toBe('Installed');
        expect(getButton('Update to 2026.11.01')).toBeUndefined();
    });
});

describe('what each button asks for', () => {
    test('Download and Install takes the pack found online, then reads again', async () => {
        state.isInstalled = false;
        state.archive = null;
        let finish!: (value: boolean) => void;
        mocks.install.mockReturnValue(
            new Promise((resolve) => {
                finish = resolve;
            }),
        );
        await render();
        await press(getButton('Download and Install')!);
        expect(mocks.install).toHaveBeenCalledWith({
            entry: state.entry,
            isForceDownload: false,
            supersededArchiveFileFullName: null,
        });
        // Every button waits while the install runs.
        expect(
            Array.from(container.querySelectorAll('button'))
                .filter((button) => button.disabled)
                .map((button) => button.textContent || button.title),
        ).toEqual(['Download and Install', 'Refresh', 'Reinstall', 'Import']);
        expect(mocks.checkInstalled).toHaveBeenCalledTimes(1);

        state.isInstalled = true;
        await act(async () => {
            finish(true);
        });
        await wait();
        expect(mocks.checkInstalled).toHaveBeenCalledTimes(2);
        expect(mocks.getEntry).toHaveBeenCalledTimes(2);
        expect(state.sectionProps.stateLabel).toBe('Installed');
        expect(getButton('Reinstall')!.disabled).toBe(false);
    });

    test('Update downloads again and hands over the archive it replaces', async () => {
        state.entry = {
            url: 'https://example.org/p2.tar.gz',
            version: '2026.11.01',
        };
        await render();
        await press(getButton('Update to 2026.11.01')!);
        expect(mocks.install).toHaveBeenCalledWith({
            entry: state.entry,
            isForceDownload: true,
            supersededArchiveFileFullName: 'extra-bin-2026.10.01.tar.gz',
        });
    });

    test('Re-extract uses the archive on disk; Reinstall downloads it again', async () => {
        await render();
        await press(getButton('Re-extract')!);
        expect(mocks.install).toHaveBeenLastCalledWith({
            entry: state.entry,
            isForceDownload: false,
            supersededArchiveFileFullName: null,
        });
        await press(getButton('Reinstall')!);
        expect(mocks.install).toHaveBeenLastCalledWith({
            entry: state.entry,
            isForceDownload: true,
            supersededArchiveFileFullName: null,
        });
    });

    test('an install with no online answer leaves the choice of pack to the installer', async () => {
        state.entry = null;
        await render();
        await press(getButton('Reinstall')!);
        expect(mocks.install).toHaveBeenCalledWith({
            entry: null,
            isForceDownload: true,
            supersededArchiveFileFullName: null,
        });
    });

    test('Refresh reads the disk and the online pack again', async () => {
        await render();
        const refresh = container.querySelector(
            'button[title="Refresh"]',
        ) as HTMLButtonElement;
        expect(refresh.getAttribute('aria-label')).toBe('Refresh');
        await press(refresh);
        expect(mocks.checkInstalled).toHaveBeenCalledTimes(2);
        expect(mocks.getEntry).toHaveBeenCalledTimes(2);
        expect(mocks.install).not.toHaveBeenCalled();
    });

    test('the location opens the folder, and only when there is one', async () => {
        await render();
        const location = getDetail('Location')!
            .firstElementChild as HTMLElement;
        expect(location.title).toBe('/data/extra-bin\nReveal Folder');
        expect(location.textContent).toBe('/data/extra-bin');
        await press(location as HTMLButtonElement);
        expect(mocks.reveal).toHaveBeenCalledWith('/data/extra-bin');

        await act(async () => {
            root.unmount();
        });
        root = createRoot(container);
        state.dirPath = '';
        mocks.reveal.mockClear();
        await render();
        await press(
            getDetail('Location')!.firstElementChild as HTMLButtonElement,
        );
        expect(mocks.reveal).not.toHaveBeenCalled();
    });
});

describe('a change made in another window', () => {
    test('re-reads the disk only, and stops listening when closed', async () => {
        state.isInstalled = false;
        await render();
        expect(state.sectionProps.stateLabel).toBe('Not installed');
        state.isInstalled = true;
        await act(async () => {
            state.changedListener!();
        });
        await wait();
        expect(state.sectionProps.stateLabel).toBe('Installed');
        expect(mocks.checkInstalled).toHaveBeenCalledTimes(2);
        // The online lookup is not asked again for a local change.
        expect(mocks.getEntry).toHaveBeenCalledTimes(1);
        expect(mocks.unregister).not.toHaveBeenCalled();
        await act(async () => {
            root.unmount();
        });
        expect(mocks.unregister).toHaveBeenCalledOnce();
        root = createRoot(container);
    });
});
