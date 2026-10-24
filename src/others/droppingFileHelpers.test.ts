import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    copy: vi.fn(),
    supported: vi.fn(),
    selectFiles: vi.fn(),
    style: vi.fn(),
    toast: vi.fn(),
    menu: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../server/fileHelpers', () => ({
    fsCopyFilePathToPath: state.copy,
    isSupportedExt: state.supported,
    selectFiles: state.selectFiles,
}));
vi.mock('../helper/helpers', () => ({ changeDragEventStyle: state.style }));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: state.toast }));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: state.menu,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon:${name}`,
}));

import {
    genDirSourceContextMenuItems,
    genDroppingFileOnContextMenu,
    genOnDragLeave,
    genOnDragOver,
    genOnDrop,
    handleFilesSelectionMenuItem,
    readDroppedFiles,
} from './droppingFileHelpers';

function droppedItem(name: string, kind = 'file', isFile = true) {
    return {
        kind,
        webkitGetAsEntry: () => ({ isFile }),
        getAsFile: () => ({ name }),
    };
}

function drag(items: object[] = []) {
    return {
        preventDefault: vi.fn(),
        dataTransfer: { items },
    };
}

beforeEach(() => {
    state.copy.mockReset().mockResolvedValue(undefined);
    state.supported
        .mockReset()
        .mockImplementation((name: string) => name.endsWith('.jpg'));
    state.selectFiles.mockReset();
    state.style.mockReset();
    state.toast.mockReset();
    state.menu.mockReset();
});

describe('folder file entry actions', () => {
    it('marks valid file drags and resets their style on leave', () => {
        const files = drag([droppedItem('one.jpg')]);
        genOnDragOver({ dirPath: '/photos' } as never)(files as never);
        expect(files.preventDefault).toHaveBeenCalledOnce();
        expect(state.style).toHaveBeenCalledWith(files, 'opacity', '0.5');

        state.style.mockClear();
        genOnDragOver({ dirPath: null } as never)(files as never);
        expect(state.style).toHaveBeenCalledWith(files, 'opacity', '0.5');
        state.style.mockClear();
        genOnDragOver({ dirPath: '/photos' } as never)(
            drag([droppedItem('url', 'string')]) as never,
        );
        expect(state.style).not.toHaveBeenCalled();
        genOnDragLeave()(files as never);
        expect(state.style).toHaveBeenCalledWith(files, 'opacity', '1');
    });

    // The browser empties `dataTransfer` once the drop handler yields, and the
    // slide canvas awaits each new item between files: every file has to be
    // out of the list before the first one is handed over.
    it('takes every dropped file before the caller awaits the first', async () => {
        const items = [droppedItem('one.jpg'), droppedItem('two.jpg')];
        const event = drag(items);
        const read: string[] = [];
        for await (const file of readDroppedFiles(event as never)) {
            read.push(file.name);
            items.length = 0;
            await Promise.resolve();
        }
        expect(read).toEqual(['one.jpg', 'two.jpg']);
    });

    it('reads only file entries from a drop and copies accepted files', async () => {
        const items = [
            droppedItem('one.jpg'),
            droppedItem('two.txt'),
            droppedItem('directory', 'file', false),
            droppedItem('url', 'string'),
        ];
        const event = drag(items);
        const read: string[] = [];
        for await (const file of readDroppedFiles(event as never)) {
            read.push(file.name);
        }
        expect(read).toEqual(['one.jpg', 'two.txt']);

        const take = vi.fn((file: { name: string }) => file.name === 'two.txt');
        await genOnDrop({
            dirSource: { dirPath: '/photos' } as never,
            mimetypeName: 'image',
            takeDroppedFile: take as never,
        })(event as never);
        expect(event.preventDefault).toHaveBeenCalledOnce();
        expect(state.style).toHaveBeenCalledWith(event, 'opacity', '1');
        expect(state.supported).toHaveBeenCalledWith('one.jpg', 'image');
        expect(state.copy).toHaveBeenCalledOnce();
        expect(state.copy).toHaveBeenCalledWith({ name: 'one.jpg' }, '/photos');
        expect(take).toHaveBeenCalledTimes(2);
    });

    it('offers to open a folder before accepting a drop', async () => {
        // `DirSource.dirPath` answers '' for a list with no folder.
        for (const dirPath of ['', null]) {
            state.toast.mockClear();
            const event = drag([droppedItem('one.jpg')]);
            await genOnDrop({
                dirSource: { dirPath } as never,
                mimetypeName: 'image',
            })(event as never);
            expect(state.toast).toHaveBeenCalledWith(
                'Open Folder',
                'Please open a folder first',
            );
        }
        expect(state.copy).not.toHaveBeenCalled();
    });

    it('copies selected files except ones a caller consumes', async () => {
        state.selectFiles.mockResolvedValue(['/tmp/one.jpg', '/tmp/two.jpg']);
        const onFileSelected = vi.fn();
        const takeSelectedFile = vi.fn((filePath: string) =>
            filePath.endsWith('two.jpg'),
        );
        await handleFilesSelectionMenuItem({
            windowTitle: 'Add photos',
            extensions: ['jpg'],
            dirPath: '/photos',
            onFileSelected,
            takeSelectedFile,
        });
        expect(state.selectFiles).toHaveBeenCalledWith([
            { name: 'Add photos', extensions: ['jpg'] },
        ]);
        expect(onFileSelected).toHaveBeenCalledWith([
            '/tmp/one.jpg',
            '/tmp/two.jpg',
        ]);
        expect(state.copy).toHaveBeenCalledOnce();
        expect(state.copy).toHaveBeenCalledWith('/tmp/one.jpg', '/photos');
    });

    it('builds reload and caller actions in order and opens the context menu', async () => {
        const reload = vi.fn();
        const dirSource = { dirPath: '/photos', fireReloadEvent: reload };
        const item = (menuElement: string) => ({ menuElement });
        const options = {
            contextMenuItems: [item('Custom')],
            genItemsAddingMenuItems: async () => [item('Add')],
            genNewFileMenuItems: () => [item('New')],
            genContextMenuItems: vi.fn(async () => [item('More')]),
        };
        const event = { type: 'contextmenu' };
        const menuItems = await genDirSourceContextMenuItems(
            dirSource as never,
            options as never,
            event as never,
        );
        expect(menuItems.map((entry) => entry.menuElement)).toEqual([
            'Reload',
            'Custom',
            'Add',
            'New',
            'More',
        ]);
        menuItems[0].onSelect?.(event as never);
        expect(reload).toHaveBeenCalledOnce();
        expect(options.genContextMenuItems).toHaveBeenCalledWith(
            dirSource,
            event,
        );

        await genDroppingFileOnContextMenu(
            dirSource as never,
            options as never,
        )!(event as never);
        expect(state.menu).toHaveBeenCalledWith(event, expect.any(Array));
        expect(
            genDroppingFileOnContextMenu(
                { dirPath: null } as never,
                options as never,
            ),
        ).toBeUndefined();
    });
});
