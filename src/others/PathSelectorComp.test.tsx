// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { checkDirExistMock, showSimpleToastMock } = vi.hoisted(() => ({
    checkDirExistMock: vi.fn(),
    showSimpleToastMock: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../context-menu/ContextMenuDotsButtonComp', () => ({
    default: () => null,
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: vi.fn(),
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: vi.fn(),
}));
vi.mock('../helper/helpers', () => ({
    getMenuTitleRevealFile: vi.fn(),
}));
vi.mock('../server/appHelpers', () => ({
    copyToClipboard: vi.fn(),
    showFileOrDirExplorer: vi.fn(),
}));
vi.mock('../server/appProvider', () => ({
    default: { isPageSetting: true, systemUtils: { isDev: false } },
}));
vi.mock('../server/fileHelpers', () => ({
    fsCheckDirExist: checkDirExistMock,
    // The path editor's folder picker, shown when the box is empty.
    selectDirs: vi.fn(),
}));
vi.mock('../setting/settingHelpers', () => ({
    openPathSetting: vi.fn(),
}));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));
vi.mock('./RenderPathTitleComp', () => ({
    default: ({ dirSource }: { dirSource: { dirPath: string } }) => (
        <span>{dirSource.dirPath}</span>
    ),
}));

import PathSelectorComp from './PathSelectorComp';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';

/**
 * Stands in for a `DirSource`: what the selector reads (`dirPath`), what it
 * compares with (`checkIsSameDirPath`) and the setter a drop commits through,
 * which here records each commit.
 */
function genDirSource(initialDirPath: string) {
    const committedDirPaths: string[] = [];
    let dirPath = initialDirPath;
    const dirSource = {
        get dirPath() {
            return dirPath;
        },
        set dirPath(newDirPath: string) {
            committedDirPaths.push(newDirPath);
            dirPath = newDirPath;
        },
        checkIsSameDirPath(otherDirPath: string) {
            return !!dirPath && dirPath === otherDirPath;
        },
    };
    return { dirSource, committedDirPaths };
}

/**
 * A drag event shaped the way a real one arrives: the paths come from
 * `appFilePath`, which the electron preload stamps onto every dropped `File`
 * (a dropped folder included), and jsdom's own `DataTransfer` cannot hold
 * files.
 */
function genDragEvent(
    type: string,
    { paths = [], kind = 'file' }: { paths?: string[]; kind?: string } = {},
) {
    const event: any = new Event(type, { bubbles: true, cancelable: true });
    event.dataTransfer = {
        items: paths.map(() => {
            return { kind };
        }),
        files: paths.map((filePath) => {
            return { appFilePath: filePath };
        }),
        dropEffect: 'none',
    };
    return event;
}

describe('PathSelectorComp folder dropping', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        checkDirExistMock.mockReset();
        checkDirExistMock.mockImplementation(async (dirPath: string) => {
            return !dirPath.includes('.');
        });
        showSimpleToastMock.mockReset();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        vi.unstubAllGlobals();
    });

    async function render(
        dirSource: ReturnType<typeof genDirSource>['dirSource'],
        isFolderDroppable = true,
    ) {
        await act(async () => {
            root.render(
                <PathSelectorComp
                    prefix="path-test"
                    dirSource={dirSource as any}
                    isFolderDroppable={isFolderDroppable}
                />,
            );
        });
    }

    function getSelector() {
        const selector = container.querySelector('.path-selector');
        if (selector === null) {
            throw new Error('Missing path selector');
        }
        return selector as HTMLElement;
    }

    async function dispatch(event: Event) {
        await act(async () => {
            getSelector().dispatchEvent(event);
        });
        // The folder check settles a `stat` later.
        await act(async () => {
            await new Promise((resolve) => {
                setTimeout(resolve, 0);
            });
        });
    }

    test('dragging files over the box claims the drop and outlines it', async () => {
        const { dirSource } = genDirSource('/data/old');
        await render(dirSource);
        const event = genDragEvent('dragover', { paths: ['/data/new'] });
        await dispatch(event);
        // Without `preventDefault` the browser never fires `drop`: the
        // "no entry" cursor of the user's picture.
        expect(event.defaultPrevented).toBe(true);
        expect(event.dataTransfer.dropEffect).toBe('copy');
        expect(getSelector().className).toContain('path-selector-dropping');
    });

    test('a dragged verse or slide is not offered a folder drop', async () => {
        const { dirSource } = genDirSource('/data/old');
        await render(dirSource);
        const event = genDragEvent('dragover', {
            paths: ['GEN 1:1'],
            kind: 'string',
        });
        await dispatch(event);
        expect(event.defaultPrevented).toBe(false);
        expect(getSelector().className).not.toContain('path-selector-dropping');
    });

    test('a dropped folder becomes the path through its setter', async () => {
        const { dirSource, committedDirPaths } = genDirSource('/data/old');
        await render(dirSource);
        await dispatch(genDragEvent('dragover', { paths: ['/data/new'] }));
        const event = genDragEvent('drop', { paths: ['/data/new'] });
        await dispatch(event);
        expect(event.defaultPrevented).toBe(true);
        expect(committedDirPaths).toEqual(['/data/new']);
        expect(showSimpleToastMock).not.toHaveBeenCalled();
        expect(getSelector().className).not.toContain('path-selector-dropping');
    });

    test('an empty box takes a dropped folder too', async () => {
        const { dirSource, committedDirPaths } = genDirSource('');
        await render(dirSource);
        await dispatch(genDragEvent('drop', { paths: ['/data/new'] }));
        expect(committedDirPaths).toEqual(['/data/new']);
    });

    test('the first folder among dropped files is the one taken', async () => {
        const { dirSource, committedDirPaths } = genDirSource('/data/old');
        await render(dirSource);
        await dispatch(
            genDragEvent('drop', {
                paths: ['/data/song.xml', '/data/new', '/data/other'],
            }),
        );
        expect(committedDirPaths).toEqual(['/data/new']);
    });

    test('a dropped file says to drop a folder and changes nothing', async () => {
        const { dirSource, committedDirPaths } = genDirSource('/data/old');
        await render(dirSource);
        await dispatch(genDragEvent('drop', { paths: ['/data/song.xml'] }));
        expect(committedDirPaths).toEqual([]);
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Choose a folder',
            'Drop a folder, not a file',
        );
    });

    test('a path that cannot be read is not taken for a folder', async () => {
        checkDirExistMock.mockRejectedValue(new Error('EACCES'));
        const { dirSource, committedDirPaths } = genDirSource('/data/old');
        await render(dirSource);
        await dispatch(genDragEvent('drop', { paths: ['/share/gone'] }));
        expect(committedDirPaths).toEqual([]);
        expect(showSimpleToastMock).toHaveBeenCalledTimes(1);
    });

    test('dropping the folder already in use asks nothing again', async () => {
        const { dirSource, committedDirPaths } = genDirSource('/data/old');
        await render(dirSource);
        await dispatch(genDragEvent('drop', { paths: ['/data/old'] }));
        // The setter is what asks about child folders or reloads every
        // window; the same folder must not set that off.
        expect(committedDirPaths).toEqual([]);
    });

    test('a box that does not opt in leaves the drop to whatever holds it', async () => {
        const { dirSource, committedDirPaths } = genDirSource('/data/old');
        await render(dirSource, false);
        const dragOverEvent = genDragEvent('dragover', {
            paths: ['/data/new'],
        });
        await dispatch(dragOverEvent);
        const dropEvent = genDragEvent('drop', { paths: ['/data/new'] });
        await dispatch(dropEvent);
        // A file list's path row sits inside a drop target that COPIES
        // dropped files into the folder; it must still get them.
        expect(dragOverEvent.defaultPrevented).toBe(false);
        expect(dropEvent.defaultPrevented).toBe(false);
        expect(committedDirPaths).toEqual([]);
        expect(checkDirExistMock).not.toHaveBeenCalled();
    });

    test('the data folder row offers no Unset Directory Path', async () => {
        const menuLabelsOf = async (isUnsettable?: boolean) => {
            vi.mocked(showAppContextMenu).mockClear();
            const { dirSource } = genDirSource('/data/old');
            await act(async () => {
                root.render(
                    <PathSelectorComp
                        prefix="path-test"
                        dirSource={dirSource as any}
                        isUnsettable={isUnsettable}
                    />,
                );
            });
            await dispatch(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
            const [, items] = vi.mocked(showAppContextMenu).mock.calls[0];
            return (items as any[]).map((item) => item.menuElement);
        };
        // A child folder may be unset.
        expect(await menuLabelsOf()).toContain('Unset Directory Path');
        // The data folder cannot: its emptied value is put back, so the item
        // did nothing and said nothing.
        const parentLabels = await menuLabelsOf(false);
        expect(parentLabels).not.toContain('Unset Directory Path');
        expect(parentLabels).toContain('Copy to Clipboard');
    });
});
