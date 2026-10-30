// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    appProvider: { isPageReader: true },
    listProps: null as any,
    dirSource: null as unknown,
    getDirSourceSettingName: vi.fn(),
    useGenDirSourceReload: vi.fn(),
    fromFilePath: vi.fn(),
    getDefault: vi.fn(),
    create: vi.fn(),
    checkIsBibleItemOnScreen: vi.fn(),
    sortBibleFilePaths: vi.fn(),
    getFileFullName: vi.fn(),
    checkIsBibleArchiveFileFullName: vi.fn(),
    importDroppedBibleArchive: vi.fn(),
    selectAndImportBibleArchive: vi.fn(),
    askAndImportBibleArchiveFromUrl: vi.fn(),
}));

vi.mock('../others/FileListHandlerComp', () => ({
    default: (props: any) => {
        h.listProps = props;
        return <div className="file-list">{props.header}</div>;
    },
}));
vi.mock('./Bible', () => ({
    default: {
        getDirSourceSettingName: h.getDirSourceSettingName,
        fromFilePath: h.fromFilePath,
        getDefault: h.getDefault,
        create: h.create,
    },
}));
vi.mock('./BibleFileComp', () => ({
    default: ({ index, filePath }: { index: number; filePath: string }) => (
        <div className="bible-file" data-index={index}>
            {filePath}
        </div>
    ),
}));
vi.mock('../helper/dirSourceHelpers', () => ({
    useGenDirSourceReload: h.useGenDirSourceReload,
}));
vi.mock('../helper/settingHelpers', () => ({
    getSettingPrefix: () => 'reader-',
}));
vi.mock('../server/appProvider', () => ({ default: h.appProvider }));
vi.mock('./bibleHelpers', () => ({
    checkIsBibleItemOnScreen: h.checkIsBibleItemOnScreen,
    sortBibleFilePaths: h.sortBibleFilePaths,
}));
vi.mock('../others/labelIconHelpers', () => ({
    toIconedLabel: (labelKey: string) => labelKey,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => <i data-icon={name} />,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../server/fileHelpers', () => ({
    getFileFullName: h.getFileFullName,
}));
vi.mock('./bibleArchiveHelpers', () => ({
    askAndImportBibleArchiveFromUrl: h.askAndImportBibleArchiveFromUrl,
    checkIsBibleArchiveFileFullName: h.checkIsBibleArchiveFileFullName,
    importDroppedBibleArchive: h.importDroppedBibleArchive,
    selectAndImportBibleArchive: h.selectAndImportBibleArchive,
}));

import BibleListComp from './BibleListComp';
import { defaultDataDirNames } from '../helper/constants';

let host: HTMLDivElement;
let root: Root;

async function renderList() {
    await act(async () => {
        root.render(<BibleListComp />);
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.appProvider.isPageReader = true;
    h.listProps = null;
    h.dirSource = { dirPath: '/data/bibles-read' };
    h.getDirSourceSettingName.mockReturnValue('selected-dir-bible-read');
    h.useGenDirSourceReload.mockImplementation(() => h.dirSource);
    h.checkIsBibleArchiveFileFullName.mockImplementation((name: string) =>
        name.endsWith('.owbible.tar.gz'),
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

describe('the Bibles list panel', () => {
    test('waits for its folder before drawing or creating anything', async () => {
        h.dirSource = null;
        await renderList();
        expect(h.useGenDirSourceReload).toHaveBeenCalledWith(
            'selected-dir-bible-read',
        );
        expect(host.innerHTML).toBe('');
        expect(h.getDefault).not.toHaveBeenCalled();
    });

    test("lists the Reader's own bible folder and makes sure the default list exists", async () => {
        await renderList();
        expect(h.getDefault).toHaveBeenCalledTimes(1);
        expect(host.textContent).toBe('Bibles');
        expect(h.listProps).toMatchObject({
            className: 'reader-bible-list app-cue-list',
            mimetypeName: 'bible',
            defaultFolderName: defaultDataDirNames.BIBLE_READ,
            dirSource: h.dirSource,
            userClassName: 'p-0',
            sortFilePaths: h.sortBibleFilePaths,
        });
    });

    test("the Presenter lists the presenter's bible folder", async () => {
        h.appProvider.isPageReader = false;
        await renderList();
        expect(h.listProps.defaultFolderName).toBe(
            defaultDataDirNames.BIBLE_PRESENT,
        );
    });

    test('draws one row per bible list file', async () => {
        await renderList();
        await act(async () => {
            root.render(
                <div>
                    {h.listProps.bodyHandler([
                        '/b/Default.owb',
                        '/b/Easter.owb',
                    ])}
                </div>,
            );
        });
        const rows = [...host.querySelectorAll<HTMLElement>('.bible-file')];
        expect(rows.map((row) => [row.dataset.index, row.textContent])).toEqual(
            [
                ['0', '/b/Default.owb'],
                ['1', '/b/Easter.owb'],
            ],
        );
    });

    test('a new file is a new bible list, and a failed create says so', async () => {
        await renderList();
        h.create.mockResolvedValue({ filePath: '/b/New.owb' });
        expect(await h.listProps.onNewFile('/b', 'New')).toBe(false);
        expect(h.create).toHaveBeenCalledWith('/b', 'New');
        h.create.mockResolvedValue(null);
        expect(await h.listProps.onNewFile('/b', 'New')).toBe(true);
    });

    test('a file is on screen when any verse in it is', async () => {
        await renderList();
        h.fromFilePath.mockImplementation(async (filePath: string) => {
            if (filePath === '/b/Broken.owb') {
                return null;
            }
            return { items: [`${filePath}#1`, `${filePath}#2`] };
        });
        h.checkIsBibleItemOnScreen.mockResolvedValue(true);
        expect(
            await h.listProps.checkIsOnScreen([
                '/b/Default.owb',
                '/b/Broken.owb',
                '/b/Easter.owb',
            ]),
        ).toBe(true);
        expect(h.checkIsBibleItemOnScreen).toHaveBeenCalledWith([
            '/b/Default.owb#1',
            '/b/Default.owb#2',
            '/b/Easter.owb#1',
            '/b/Easter.owb#2',
        ]);
    });

    test('its menu imports a bible list from a file or from a link', async () => {
        await renderList();
        const items = h.listProps.genContextMenuItems();
        expect(items.map((item: any) => item.menuElement)).toEqual([
            'Import',
            'Import From URL',
        ]);
        items[0].onSelect();
        expect(h.selectAndImportBibleArchive).toHaveBeenCalledTimes(1);
        items[1].onSelect();
        expect(h.askAndImportBibleArchiveFromUrl).toHaveBeenCalledTimes(1);
    });

    test('a dropped bible list archive is imported; any other file is left to the list', async () => {
        await renderList();
        const archive = { name: 'Easter.owbible.tar.gz' };
        h.getFileFullName.mockReturnValue('Easter.owbible.tar.gz');
        expect(h.listProps.takeDroppedFile(archive)).toBe(true);
        expect(h.importDroppedBibleArchive).toHaveBeenCalledWith(archive);

        h.getFileFullName.mockReturnValue('Easter.owb');
        expect(h.listProps.takeDroppedFile({ name: 'Easter.owb' })).toBe(false);
        h.getFileFullName.mockReturnValue(undefined);
        expect(h.listProps.takeDroppedFile({})).toBe(false);
        expect(h.importDroppedBibleArchive).toHaveBeenCalledTimes(1);
    });
});
