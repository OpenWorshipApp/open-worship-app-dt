// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    fsCheckDirExist: vi.fn(),
    fsCheckFileExist: vi.fn(),
    showAppContextMenu: vi.fn(),
    showFileOrDirExplorer: vi.fn(),
}));

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
        appUtils: { handleError: vi.fn() },
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../server/fileHelpers', () => ({
    fsCheckDirExist: state.fsCheckDirExist,
    fsCheckFileExist: state.fsCheckFileExist,
    pathBasename: (filePath: string) => filePath.split('/').pop() ?? '',
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: state.showAppContextMenu,
}));
vi.mock('../helper/helpers', () => ({
    getMenuTitleRevealFile: () => 'Reveal in File Explorer',
}));
vi.mock('../server/appHelpers', () => ({
    showFileOrDirExplorer: state.showFileOrDirExplorer,
}));

import { PathPreviewerComp } from './PathPreviewerComp';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.fsCheckDirExist.mockResolvedValue(true);
    state.fsCheckFileExist.mockResolvedValue(true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

async function flush() {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
}

function getLabel() {
    return host.querySelector<HTMLDivElement>('.app-ellipsis-left')!;
}

describe('PathPreviewerComp', () => {
    test('shows a folder path without its leading slash', async () => {
        await act(async () =>
            root.render(<PathPreviewerComp dirOrFilePath="/home/me/Songs" />),
        );
        await flush();
        expect(getLabel().querySelector('bdi')!.textContent).toBe(
            'home/me/Songs',
        );
        expect(getLabel().title).toBe('home/me/Songs');
        expect(getLabel().className).toContain('text-muted');
        expect(getLabel().className).not.toContain('pointer');
        expect(state.fsCheckDirExist).toHaveBeenCalledWith('/home/me/Songs');
        expect(state.fsCheckFileExist).not.toHaveBeenCalled();
    });

    test('a file that is gone is flagged as an invalid path', async () => {
        state.fsCheckFileExist.mockResolvedValue(false);
        await act(async () =>
            root.render(
                <PathPreviewerComp dirOrFilePath="C:/docs/a.ows" isFile />,
            ),
        );
        await flush();
        expect(state.fsCheckFileExist).toHaveBeenCalledWith('C:/docs/a.ows');
        expect(state.fsCheckDirExist).not.toHaveBeenCalled();
        expect(getLabel().title).toBe('Invalid Path');
        expect(getLabel().className).toContain('text-danger-emphasis');
        expect(getLabel().className).not.toContain('text-muted');
    });

    test('a missing folder is flagged too', async () => {
        state.fsCheckDirExist.mockResolvedValue(false);
        await act(async () =>
            root.render(<PathPreviewerComp dirOrFilePath="/gone" />),
        );
        await flush();
        expect(getLabel().title).toBe('Invalid Path');
    });

    test('name-only shows the file name before its first dot', async () => {
        await act(async () =>
            root.render(
                <PathPreviewerComp
                    dirOrFilePath="/docs/My Song.v2.ows"
                    isShowingNameOnly
                    isFile
                />,
            ),
        );
        await flush();
        expect(getLabel().textContent).toBe('My Song');
        // The tooltip keeps the whole path.
        expect(getLabel().title).toBe('docs/My Song.v2.ows');
    });

    test('name-only keeps a name that starts with a dot', async () => {
        await act(async () =>
            root.render(
                <PathPreviewerComp
                    dirOrFilePath="/docs/.hidden"
                    isShowingNameOnly
                />,
            ),
        );
        await flush();
        expect(getLabel().textContent).toBe('.hidden');
    });

    test('a clickable path looks it and reports the click', async () => {
        const onClick = vi.fn();
        await act(async () =>
            root.render(
                <PathPreviewerComp dirOrFilePath="/docs" onClick={onClick} />,
            ),
        );
        await flush();
        expect(getLabel().className).toContain('pointer');
        await act(async () => getLabel().click());
        expect(onClick).toHaveBeenCalledOnce();
    });

    test('without explorer access a right-click offers nothing', async () => {
        await act(async () =>
            root.render(<PathPreviewerComp dirOrFilePath="/docs" />),
        );
        await flush();
        await act(async () =>
            getLabel().dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            ),
        );
        expect(state.showAppContextMenu).not.toHaveBeenCalled();
        expect(host.querySelector('button')).toBeNull();
    });

    test('with explorer access both the right-click and the dots reveal it', async () => {
        await act(async () =>
            root.render(
                <PathPreviewerComp
                    dirOrFilePath="/home/me/Songs"
                    canOpenFileExplorer
                />,
            ),
        );
        await flush();
        await act(async () =>
            getLabel().dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            ),
        );
        expect(state.showAppContextMenu).toHaveBeenCalledOnce();
        const [, items] = state.showAppContextMenu.mock.calls[0];
        expect(items).toHaveLength(1);
        expect(items[0].menuElement).toBe('Reveal in File Explorer');
        items[0].onSelect();
        // The original path, slash and all.
        expect(state.showFileOrDirExplorer).toHaveBeenCalledExactlyOnceWith(
            '/home/me/Songs',
        );

        const dots = host.querySelector<HTMLButtonElement>('button')!;
        await act(async () => dots.click());
        expect(state.showAppContextMenu).toHaveBeenCalledTimes(2);
    });
});
