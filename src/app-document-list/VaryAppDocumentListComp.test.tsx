// @vitest-environment jsdom

import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    dirSource: { dirPath: 'C:/documents', checkExtraFile: undefined as any },
    props: null as any,
    createDocument: vi.fn(),
    createLyric: vi.fn(),
    convertOffice: vi.fn(),
    importDropped: vi.fn(),
    selectArchive: vi.fn(),
    importUrlArchive: vi.fn(),
    onScreen: vi.fn(),
    songSelectSetting: vi.fn(),
    signedIn: vi.fn(),
    askForURL: vi.fn(),
    request: vi.fn(),
    stream: vi.fn(),
    move: vi.fn(),
    toast: vi.fn(),
    showProgress: vi.fn(),
    hideProgress: vi.fn(),
    message: vi.fn(),
    error: vi.fn(),
    getInstance: vi.fn(),
    sharedLink: vi.fn(),
}));

vi.mock('../others/FileListHandlerComp', () => ({
    default: (props: any) => {
        h.props = props;
        return createElement('div', { className: 'file-list' }, props.header);
    },
}));
vi.mock('./VaryAppDocumentFileComp', () => ({
    default: ({ filePath, index }: { filePath: string; index: number }) =>
        createElement(
            'div',
            { 'data-kind': 'document' },
            `${index}:${filePath}`,
        ),
}));
vi.mock('../lyric-list/LyricFileComp', () => ({
    default: ({ filePath, index }: { filePath: string; index: number }) =>
        createElement('div', { 'data-kind': 'lyric' }, `${index}:${filePath}`),
}));
vi.mock('./AppDocument', () => ({ default: { create: h.createDocument } }));
vi.mock('../lyric-list/Lyric', () => ({ default: { create: h.createLyric } }));
vi.mock('../server/fileHelpers', () => ({
    fsMove: h.move,
    getDownloadPath: () => 'C:/downloads',
    getFileDotExtension: (name: string) => name.slice(name.lastIndexOf('.')),
    getFileFullName: (file: string | { name: string }) =>
        typeof file === 'string' ? file.split('/').at(-1) : file.name,
    getMimetypeExtensions: (name: string) => [name],
    mimetypeDocx: 'mime/docx',
    mimetypePdf: 'mime/pdf',
    mimetypePptx: 'mime/pptx',
    pathJoin: (...parts: string[]) => parts.join('/'),
    toFileFullNameFromUrl: () => 'downloaded.pdf',
}));
vi.mock('../helper/FileSource', () => ({
    default: { getInstance: h.getInstance },
}));
vi.mock('../helper/constants', () => ({
    defaultDataDirNames: { APP_DOCUMENT: 'documents' },
    dirSourceSettingNames: { APP_DOCUMENT: 'document-setting' },
}));
vi.mock('./appDocumentHelpers', () => ({
    checkIsDocx: (ext: string) => ext.toLowerCase() === '.docx',
    checkIsLyric: (ext: string) => ext.toLowerCase() === '.owl',
    checkIsPdf: (ext: string) => ext.toLowerCase() === '.pdf',
    checkIsPptx: (ext: string) => ext.toLowerCase() === '.pptx',
    checkIsVaryAppDocumentFilePathOnScreen: h.onScreen,
    convertOfficeFile: h.convertOffice,
    supportOfficeFileExtensions: ['.odp'],
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../others/labelIconHelpers', () => ({
    toIconedLabel: (label: string) => label,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));
vi.mock('../background/downloadHelper', () => ({
    askForURL: h.askForURL,
    getOpenSharedLinkMenuItem: h.sharedLink,
    messageCallback: h.message,
    streamDownloadFile: h.stream,
}));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: h.toast }));
vi.mock('../progress-bar/progressBarHelpers', () => ({
    showProgressBar: h.showProgress,
    hideProgressBar: h.hideProgress,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: h.error }));
vi.mock('../helper/bible-helpers/downloadHelpers', () => ({
    initHttpRequest: h.request,
}));
vi.mock('../helper/dirSourceHelpers', () => ({
    useGenDirSourceReload: () => h.dirSource,
}));
vi.mock('./appDocumentArchiveHelpers', () => ({
    askAndImportAppDocumentArchiveFromUrl: h.importUrlArchive,
    checkIsAppDocumentArchiveFileFullName: (name: string) =>
        name.endsWith('.owadoc'),
    importDroppedAppDocumentArchive: h.importDropped,
    selectAndImportAppDocumentArchive: h.selectArchive,
}));
vi.mock('../plugins/song-select/SongSelectSearchPopupComp', () => ({
    default: ({ onClose }: { onClose: () => void }) =>
        createElement('button', { onClick: onClose }, 'SongSelect popup'),
}));
vi.mock('../plugins/song-select/songSelectSettingHelpers', () => ({
    checkIsSongSelectSignedIn: h.signedIn,
    getSongSelectSetting: h.songSelectSetting,
}));
vi.mock('../plugins/public-domain-songs/PublicDomainSongsPopupComp', () => ({
    default: ({ onClose }: { onClose: () => void }) =>
        createElement('button', { onClick: onClose }, 'Public songs popup'),
}));

import VaryAppDocumentListComp from './VaryAppDocumentListComp';

type MenuItem = {
    menuElement: ReactNode;
    onSelect: () => void | Promise<void>;
};
let root: Root;
let container: HTMLDivElement;

async function renderList() {
    await act(async () => root.render(createElement(VaryAppDocumentListComp)));
}

async function addingMenu(): Promise<MenuItem[]> {
    return h.props.genItemsAddingMenuItems([]);
}

function menuItem(items: MenuItem[], title: string) {
    const item = items.find(({ menuElement }) => menuElement === title);
    expect(item, `missing menu item ${title}`).toBeDefined();
    return item!;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('crypto', { randomUUID: () => 'file-id' });
    h.dirSource = { dirPath: 'C:/documents', checkExtraFile: undefined };
    h.props = null;
    for (const value of Object.values(h)) {
        if (vi.isMockFunction(value)) value.mockReset();
    }
    h.createDocument.mockResolvedValue({});
    h.createLyric.mockResolvedValue({});
    h.getInstance.mockImplementation((filePath: string) => ({
        filePath,
        fullName: filePath.split('/').at(-1),
        dotExtension: filePath.slice(filePath.lastIndexOf('.')),
        genNextFilePath: async () => `${filePath}.next`,
    }));
    h.sharedLink.mockReturnValue({ menuElement: 'Open shared links' });
    h.askForURL.mockResolvedValue(null);
    h.request.mockResolvedValue({ body: 'stream' });
    h.stream.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('Documents list', () => {
    it('configures file types and routes lyric rows to the lyric component', async () => {
        await renderList();
        expect(container.textContent).toBe('Documents');
        expect(h.props.extraMimetypeNames).toEqual(['lyric']);
        expect(h.props.fileSelectionOption.extensions).toEqual([
            'appDocument',
            'lyric',
            'pdf',
            'pptx',
            'docx',
            'odp',
        ]);
        const rows = h.props.bodyHandler([
            'C:/documents/a.owl',
            'C:/documents/b.pdf',
        ]);
        await act(async () => root.render(createElement('div', {}, rows)));
        expect(
            container.querySelector('[data-kind="lyric"]')?.textContent,
        ).toBe('0:C:/documents/a.owl');
        expect(
            container.querySelector('[data-kind="document"]')?.textContent,
        ).toBe('1:C:/documents/b.pdf');
    });

    it('recognizes supported document files and ignores Office lock files', async () => {
        await renderList();
        expect(h.props.checkExtraFile('a.pdf')).toBe(true);
        expect(h.props.checkExtraFile('a.pptx')).toBe(true);
        expect(h.props.checkExtraFile('a.docx')).toBe(true);
        expect(h.props.checkExtraFile('~$draft.docx')).toBe(false);
        expect(h.props.checkExtraFile('song.owl')).toBe(true);
        expect(h.props.checkExtraFile('unknown.txt')).toBe(false);
        expect(h.dirSource.checkExtraFile('a.pdf')).toEqual({
            fileFullName: 'a.pdf',
            appMimetype: 'mime/pdf',
        });
        expect(h.dirSource.checkExtraFile('~$draft.pptx')).toBeNull();
        expect(h.dirSource.checkExtraFile('a.docx')).toEqual({
            fileFullName: 'a.docx',
            appMimetype: 'mime/docx',
        });
        expect(h.dirSource.checkExtraFile('a.txt')).toBeNull();
    });

    it('imports archives and converts supported Office drops', async () => {
        await renderList();
        expect(h.props.takeDroppedFile('C:/incoming/song.owadoc')).toBe(true);
        expect(h.importDropped).toHaveBeenCalledWith('C:/incoming/song.owadoc');
        expect(h.props.takeDroppedFile('C:/incoming/draft.docx')).toBe(false);
        expect(h.props.takeDroppedFile('C:/incoming/slides.odp')).toBe(true);
        expect(h.convertOffice).toHaveBeenCalledWith(
            'C:/incoming/slides.odp',
            h.dirSource,
        );
        expect(h.props.takeDroppedFile({ name: '' })).toBe(false);
        expect(
            h.props.fileSelectionOption.takeSelectedFile(
                'C:/incoming/slides.odp',
            ),
        ).toBe(true);
    });

    it('creates each document kind and checks screen paths until one is visible', async () => {
        await renderList();
        expect(
            h.props.newFileKinds.map(({ key }: { key: string }) => key),
        ).toEqual(['app-document', 'lyric']);
        expect(
            await h.props.onNewFile('C:/documents', 'Service', 'app-document'),
        ).toBe(false);
        expect(await h.props.onNewFile('C:/documents', 'Song', 'lyric')).toBe(
            false,
        );
        expect(h.createDocument).toHaveBeenCalledWith(
            'C:/documents',
            'Service',
        );
        expect(h.createLyric).toHaveBeenCalledWith('C:/documents', 'Song');
        h.onScreen.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
        expect(
            await h.props.checkIsOnScreen([
                'first.pdf',
                'second.pdf',
                'third.pdf',
            ]),
        ).toBe(true);
        expect(h.onScreen.mock.calls.map(([path]) => path)).toEqual([
            'first.pdf',
            'second.pdf',
        ]);
        h.onScreen.mockReset().mockResolvedValue(false);
        expect(await h.props.checkIsOnScreen(['first.pdf'])).toBe(false);
    });

    it('builds import menus and opens the catalog popup', async () => {
        await renderList();
        const shared = h.props.genContextMenuItems();
        expect(shared).toEqual([{ menuElement: 'Open shared links' }]);
        h.signedIn.mockReturnValue(false);
        let items = await addingMenu();
        expect(items.map(({ menuElement }) => menuElement)).toContain(
            'Import From Public Domain Songs',
        );
        expect(items.map(({ menuElement }) => menuElement)).not.toContain(
            'Import From SongSelect',
        );
        menuItem(items, 'Import').onSelect();
        menuItem(items, 'Import From URL').onSelect();
        expect(h.selectArchive).toHaveBeenCalledTimes(1);
        expect(h.importUrlArchive).toHaveBeenCalledTimes(1);
        await act(async () =>
            menuItem(items, 'Import From Public Domain Songs').onSelect(),
        );
        expect(container.textContent).toContain('Public songs popup');
        await act(async () =>
            container.querySelector<HTMLButtonElement>('button')!.click(),
        );
        expect(container.textContent).not.toContain('Public songs popup');
        h.signedIn.mockReturnValue(true);
        items = await addingMenu();
        await act(async () =>
            menuItem(items, 'Import From SongSelect').onSelect(),
        );
        expect(container.textContent).toContain('SongSelect popup');
    });

    it('downloads to a temporary path, moves the file and clears progress', async () => {
        await renderList();
        h.askForURL.mockResolvedValue('https://example.org/slides.pdf');
        const items = await addingMenu();
        await act(async () => menuItem(items, 'Download From URL').onSelect());
        expect(h.request).toHaveBeenCalledWith(
            new URL('https://example.org/slides.pdf'),
        );
        expect(h.stream).toHaveBeenCalledWith(
            'C:/downloads/file-id.owa-downloading',
            { body: 'stream' },
            h.message,
        );
        expect(h.move).toHaveBeenCalledWith(
            'C:/downloads/file-id.owa-downloading',
            'C:/documents/downloaded.pdf.next',
        );
        expect(h.hideProgress).toHaveBeenCalledWith(
            'https://example.org/slides.pdf',
        );
        expect(h.error).not.toHaveBeenCalled();
        h.request.mockRejectedValueOnce(new Error('offline'));
        await act(async () => menuItem(items, 'Download From URL').onSelect());
        expect(h.error).toHaveBeenCalledTimes(1);
        expect(h.hideProgress).toHaveBeenCalledTimes(2);
    });
});
