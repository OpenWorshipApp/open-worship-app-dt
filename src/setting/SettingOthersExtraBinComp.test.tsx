// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    checkIsExtraBinInstalledMock,
    getInstalledExtraBinVersionMock,
    findLocalExtraBinArchiveMock,
    getExtraBinEntryMock,
    installExtraBinMock,
    showFileOrDirExplorerMock,
} = vi.hoisted(() => ({
    checkIsExtraBinInstalledMock: vi.fn(),
    getInstalledExtraBinVersionMock: vi.fn(),
    findLocalExtraBinArchiveMock: vi.fn(),
    getExtraBinEntryMock: vi.fn(),
    installExtraBinMock: vi.fn(),
    showFileOrDirExplorerMock: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));

vi.mock('../helper/appHooks', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../helper/appHooks')>();
    return { ...actual, useAppEffect: useEffect };
});

vi.mock('../helper/extra-bin/extraBinHelpers', () => ({
    checkIsExtraBinInstalled: checkIsExtraBinInstalledMock,
    getExtraBinDirPath: () => '/data/extra-bin',
    getInstalledExtraBinVersion: getInstalledExtraBinVersionMock,
}));

vi.mock('../helper/extra-bin/extraBinInstallHelpers', () => ({
    findLocalExtraBinArchive: findLocalExtraBinArchiveMock,
    getExtraBinEntry: getExtraBinEntryMock,
    installExtraBin: installExtraBinMock,
}));

vi.mock('../server/appHelpers', () => ({
    showFileOrDirExplorer: showFileOrDirExplorerMock,
}));

import SettingOthersExtraBinComp from './SettingOthersExtraBinComp';

let container: HTMLDivElement;
let root: Root | null = null;

async function render() {
    await act(async () => {
        root = createRoot(container);
        root.render(<SettingOthersExtraBinComp />);
    });
    // Let both async reads settle.
    await act(async () => {
        await Promise.resolve();
    });
}

function findButton(label: string) {
    return Array.from(container.querySelectorAll('button')).find((button) => {
        return button.textContent?.includes(label);
    });
}

describe('setting SettingOthersExtraBinComp', () => {
    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        container = document.createElement('div');
        document.body.appendChild(container);
        checkIsExtraBinInstalledMock.mockResolvedValue({
            isInstalled: true,
            missingNames: [],
        });
        getInstalledExtraBinVersionMock.mockResolvedValue('0.0.1');
        findLocalExtraBinArchiveMock.mockResolvedValue('bin-0.0.1.tar.gz');
        getExtraBinEntryMock.mockResolvedValue({
            url: 'https://host/bin-0.0.1.tar.gz',
            version: '0.0.1',
        });
        installExtraBinMock.mockResolvedValue(true);
    });
    afterEach(async () => {
        if (root) {
            await act(async () => root?.unmount());
            root = null;
        }
        container.remove();
    });

    test('offers an Update when the published pack is newer', async () => {
        getExtraBinEntryMock.mockResolvedValue({
            url: 'https://host/bin-0.0.2.tar.gz',
            version: '0.0.2',
        });
        await render();

        const updateButton = findButton('Update to');
        expect(updateButton?.textContent).toContain('0.0.2');

        await act(async () => {
            updateButton?.click();
        });
        // The archive being replaced is handed over, or the folder would keep
        // one pack per release.
        expect(installExtraBinMock).toHaveBeenCalledWith({
            entry: { url: 'https://host/bin-0.0.2.tar.gz', version: '0.0.2' },
            isForceDownload: true,
            supersededArchiveFileFullName: 'bin-0.0.1.tar.gz',
        });
    });

    test('offers no Update when the installed pack is current', async () => {
        await render();

        expect(findButton('Update to')).toBeUndefined();
        expect(findButton('Download and Install')).toBeUndefined();
        expect(findButton('Re-extract')).toBeDefined();
        expect(container.textContent).toContain('0.0.1');
    });

    test('offers a fresh install when nothing is installed', async () => {
        checkIsExtraBinInstalledMock.mockResolvedValue({
            isInstalled: false,
            missingNames: ['ffmpeg', 'qjs'],
        });
        getInstalledExtraBinVersionMock.mockResolvedValue(null);
        findLocalExtraBinArchiveMock.mockResolvedValue(null);
        await render();

        expect(container.textContent).toContain('Not installed');
        expect(container.textContent).toContain('ffmpeg, qjs');
        expect(findButton('Download and Install')).toBeDefined();
        // Nothing to re-extract without an archive on disk.
        expect(findButton('Re-extract')).toBeUndefined();
    });

    test('still shows the installed pack when the online check fails', async () => {
        getExtraBinEntryMock.mockResolvedValue(null);
        await render();

        expect(container.textContent).toContain('Could not check for updates');
        expect(container.textContent).toContain('0.0.1');
        expect(findButton('Update to')).toBeUndefined();
    });

    test('reveals the folder by clicking the location path itself', async () => {
        await render();

        await act(async () => {
            findButton('/data/extra-bin')?.click();
        });

        expect(showFileOrDirExplorerMock).toHaveBeenCalledWith(
            '/data/extra-bin',
        );
        expect(installExtraBinMock).not.toHaveBeenCalled();
    });
});
