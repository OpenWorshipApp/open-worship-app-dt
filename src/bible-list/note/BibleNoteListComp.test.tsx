// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    listProps: null as any,
    dirSource: null as unknown,
    useGenDirSourceReload: vi.fn(),
    getDefault: vi.fn(),
    create: vi.fn(),
    sortNoteFilePaths: vi.fn(),
    getFileFullName: vi.fn(),
    checkIsBibleNoteArchiveFileFullName: vi.fn(),
    importDroppedBibleNoteArchive: vi.fn(),
    selectAndImportBibleNoteArchive: vi.fn(),
    askAndImportBibleNoteArchiveFromUrl: vi.fn(),
}));

vi.mock('../../others/FileListHandlerComp', () => ({
    default: (props: any) => {
        h.listProps = props;
        return <div className="file-list">{props.header}</div>;
    },
}));
vi.mock('./Note', () => ({
    default: { getDefault: h.getDefault, create: h.create },
}));
vi.mock('./NoteFileComp', () => ({
    default: ({ index, filePath }: { index: number; filePath: string }) => (
        <div className="note-file" data-index={index}>
            {filePath}
        </div>
    ),
}));
vi.mock('../../helper/dirSourceHelpers', () => ({
    useGenDirSourceReload: h.useGenDirSourceReload,
}));
vi.mock('../../others/labelIconHelpers', () => ({
    toIconedLabel: (labelKey: string) => labelKey,
}));
vi.mock('../../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => <i data-icon={name} />,
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../server/fileHelpers', () => ({
    getFileFullName: h.getFileFullName,
}));
vi.mock('./bibleNoteArchiveHelpers', () => ({
    askAndImportBibleNoteArchiveFromUrl: h.askAndImportBibleNoteArchiveFromUrl,
    checkIsBibleNoteArchiveFileFullName: h.checkIsBibleNoteArchiveFileFullName,
    importDroppedBibleNoteArchive: h.importDroppedBibleNoteArchive,
    selectAndImportBibleNoteArchive: h.selectAndImportBibleNoteArchive,
}));
vi.mock('./noteHelpers', () => ({ sortNoteFilePaths: h.sortNoteFilePaths }));

import BibleNoteListComp from './BibleNoteListComp';
import {
    defaultDataDirNames,
    dirSourceSettingNames,
} from '../../helper/constants';

let host: HTMLDivElement;
let root: Root;

async function renderList() {
    await act(async () => {
        root.render(<BibleNoteListComp />);
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.listProps = null;
    h.dirSource = { dirPath: '/data/bible-notes' };
    h.useGenDirSourceReload.mockImplementation(() => h.dirSource);
    h.checkIsBibleNoteArchiveFileFullName.mockImplementation((name: string) =>
        name.endsWith('.owanote.tar.gz'),
    );
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('the Bible Notes list panel', () => {
    test('waits for its folder before drawing or creating anything', async () => {
        h.dirSource = null;
        await renderList();
        expect(h.useGenDirSourceReload).toHaveBeenCalledWith(
            dirSourceSettingNames.BIBLE_NOTES,
        );
        expect(host.innerHTML).toBe('');
        expect(h.getDefault).not.toHaveBeenCalled();
    });

    test('lists the notes folder and makes sure the default note exists', async () => {
        await renderList();
        expect(h.getDefault).toHaveBeenCalledTimes(1);
        expect(host.textContent).toBe('Bible Notes');
        expect(h.listProps).toMatchObject({
            className: 'note-list app-cue-list',
            mimetypeName: 'note',
            defaultFolderName: defaultDataDirNames.BIBLE_NOTES,
            dirSource: h.dirSource,
            userClassName: 'p-0',
            sortFilePaths: h.sortNoteFilePaths,
        });
    });

    test('draws one row per note file', async () => {
        await renderList();
        await act(async () => {
            root.render(
                <div>
                    {h.listProps.bodyHandler([
                        '/n/Default.own',
                        '/n/Easter.own',
                    ])}
                </div>,
            );
        });
        const rows = [...host.querySelectorAll<HTMLElement>('.note-file')];
        expect(rows.map((row) => [row.dataset.index, row.textContent])).toEqual(
            [
                ['0', '/n/Default.own'],
                ['1', '/n/Easter.own'],
            ],
        );
    });

    test('a new file is a new note file, and a failed create says so', async () => {
        await renderList();
        h.create.mockResolvedValue({ filePath: '/n/New.own' });
        expect(await h.listProps.onNewFile('/n', 'New')).toBe(false);
        expect(h.create).toHaveBeenCalledWith('/n', 'New');
        h.create.mockResolvedValue(null);
        expect(await h.listProps.onNewFile('/n', 'New')).toBe(true);
    });

    test('its menu imports a whole note file from a file or from a link', async () => {
        await renderList();
        const items = h.listProps.genContextMenuItems();
        expect(items.map((item: any) => item.menuElement)).toEqual([
            'Import',
            'Import From URL',
        ]);
        items[0].onSelect();
        expect(h.selectAndImportBibleNoteArchive).toHaveBeenCalledTimes(1);
        items[1].onSelect();
        expect(h.askAndImportBibleNoteArchiveFromUrl).toHaveBeenCalledTimes(1);
    });

    test('a dropped note archive is imported; any other file is left to the list', async () => {
        await renderList();
        const archive = { name: 'Sermons.owanote.tar.gz' };
        h.getFileFullName.mockReturnValue('Sermons.owanote.tar.gz');
        expect(h.listProps.takeDroppedFile(archive)).toBe(true);
        expect(h.importDroppedBibleNoteArchive).toHaveBeenCalledWith(archive);

        h.getFileFullName.mockReturnValue('Sermons.own');
        expect(h.listProps.takeDroppedFile({ name: 'Sermons.own' })).toBe(
            false,
        );
        h.getFileFullName.mockReturnValue(undefined);
        expect(h.listProps.takeDroppedFile({})).toBe(false);
        expect(h.importDroppedBibleNoteArchive).toHaveBeenCalledTimes(1);
    });
});
