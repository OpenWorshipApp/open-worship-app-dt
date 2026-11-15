// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../media-sessions/useFileListSessions', () => ({
    useFileListSessions: (settingName: string) => ({
        activeId: '',
        isDefaultSession: true,
        dirSourceSettingName: settingName,
        element: null,
    }),
}));

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
    createNewFileDetail: vi.fn(),
    openMarkdownNoteFile: vi.fn(),
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
vi.mock('./MarkdownNoteFileComp', () => ({
    default: ({ index, filePath }: { index: number; filePath: string }) => (
        <div className="markdown-note-file" data-index={index}>
            {filePath}
        </div>
    ),
    openMarkdownNoteFile: h.openMarkdownNoteFile,
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
    createNewFileDetail: h.createNewFileDetail,
    getFileFullName: h.getFileFullName,
}));
vi.mock('./bibleNoteArchiveHelpers', () => ({
    askAndImportBibleNoteArchiveFromUrl: h.askAndImportBibleNoteArchiveFromUrl,
    checkIsBibleNoteArchiveFileFullName: h.checkIsBibleNoteArchiveFileFullName,
    importDroppedBibleNoteArchive: h.importDroppedBibleNoteArchive,
    selectAndImportBibleNoteArchive: h.selectAndImportBibleNoteArchive,
}));
vi.mock('./noteHelpers', () => ({ sortNoteFilePaths: h.sortNoteFilePaths }));
// The real hooks read the app's provider as they load.
vi.mock('../../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return { useAppEffect: useEffect };
});

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
            extraMimetypeNames: ['markdown'],
            defaultFolderName: defaultDataDirNames.BIBLE_NOTES,
            dirSource: h.dirSource,
            userClassName: 'p-0',
            sortFilePaths: h.sortNoteFilePaths,
        });
    });

    // 2026-11-11, the user: _make markdown be the part of bible-note area as
    // well, so user can create either bible-note or markdown file_.
    test('draws a note row for a note file and a Markdown row for a Markdown file', async () => {
        await renderList();
        await act(async () => {
            root.render(
                <div>
                    {h.listProps.bodyHandler([
                        '/n/Default.own',
                        '/n/Study.md',
                        '/n/Old.MARKDOWN',
                        '/n/Easter.own',
                    ])}
                </div>,
            );
        });
        const rows = [
            ...host.querySelectorAll<HTMLElement>(
                '.note-file, .markdown-note-file',
            ),
        ];
        expect(
            rows.map((row) => [
                row.className,
                row.dataset.index,
                row.textContent,
            ]),
        ).toEqual([
            ['note-file', '0', '/n/Default.own'],
            ['markdown-note-file', '1', '/n/Study.md'],
            ['markdown-note-file', '2', '/n/Old.MARKDOWN'],
            ['note-file', '3', '/n/Easter.own'],
        ]);
    });

    test('its menu makes either a Bible note or a Markdown file', async () => {
        await renderList();
        expect(h.listProps.newFileKinds).toEqual([
            { key: 'note', title: 'New Bible Note', iconName: 'journal-text' },
            {
                key: 'markdown',
                title: 'New Markdown File',
                iconName: 'markdown',
            },
        ]);
    });

    test('a new Markdown file starts with its name as its heading and opens', async () => {
        await renderList();
        h.createNewFileDetail.mockResolvedValue('/n/Easter Study.md');
        expect(
            await h.listProps.onNewFile('/n', 'Easter Study', 'markdown'),
        ).toBe(false);
        expect(h.createNewFileDetail).toHaveBeenCalledWith(
            '/n',
            'Easter Study',
            '# Easter Study\n',
            'markdown',
        );
        expect(h.openMarkdownNoteFile).toHaveBeenCalledExactlyOnceWith(
            '/n/Easter Study.md',
        );
        expect(h.create).not.toHaveBeenCalled();
        // A name refused or taken leaves the name box open, and opens nothing.
        h.createNewFileDetail.mockResolvedValue(null);
        expect(
            await h.listProps.onNewFile('/n', 'Easter Study', 'markdown'),
        ).toBe(true);
        expect(h.openMarkdownNoteFile).toHaveBeenCalledTimes(1);
    });

    test('a dropped Markdown file is copied in as a note file is', async () => {
        await renderList();
        expect(h.listProps.checkExtraFile('Study.md')).toBe(true);
        expect(h.listProps.checkExtraFile('Study.mkdn')).toBe(true);
        expect(h.listProps.checkExtraFile('Study.pdf')).toBe(false);
        expect(h.listProps.checkExtraFile('Study.md.exe')).toBe(false);
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
        expect(await h.listProps.onNewFile('/n', 'New', 'note')).toBe(false);
        expect(h.create).toHaveBeenCalledWith('/n', 'New');
        h.create.mockResolvedValue(null);
        expect(await h.listProps.onNewFile('/n', 'New', 'note')).toBe(true);
        expect(h.createNewFileDetail).not.toHaveBeenCalled();
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
