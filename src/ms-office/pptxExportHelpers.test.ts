// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const fake = vi.hoisted(() => ({
    entries: [] as Array<{ name: string; data: unknown }>,
    streams: [] as any[],
    mediaResults: [] as unknown[],
    createdPaths: [] as string[],
    failOnStream: 0,
    deleteFile: vi.fn(async () => {}),
    toast: vi.fn(),
    reveal: vi.fn(),
    showProgress: vi.fn(),
    hideProgress: vi.fn(),
    showMessage: vi.fn(),
    handleError: vi.fn(),
}));

vi.mock('../server/appProvider', () => ({
    default: {
        appInfo: { title: 'Open Worship' },
        systemUtils: { isDev: false },
    },
}));
vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: { getItem: () => null, setItem: () => {} },
}));
vi.mock('../server/fileHelpers', () => ({
    getDownloadPath: () => '/downloads',
    fsDeleteFile: fake.deleteFile,
    fsCreateWriteStream: (path: string) => {
        const stream = {
            path,
            destroyed: false,
            handlers: new Map<string, (...args: any[]) => void>(),
            on(name: string, handler: (...args: any[]) => void) {
                this.handlers.set(name, handler);
                return this;
            },
            once(name: string, handler: (...args: any[]) => void) {
                this.handlers.set(name, handler);
                return this;
            },
            write(_chunk: Uint8Array, callback: (error?: Error) => void) {
                callback(
                    fake.failOnStream === fake.streams.length
                        ? new Error('disk full')
                        : undefined,
                );
            },
            end(callback: () => void) {
                callback();
            },
            destroy() {
                this.destroyed = true;
            },
        };
        fake.streams.push(stream);
        return stream;
    },
}));
vi.mock('../helper/archiveNameHelpers', () => ({
    toArchiveFileName: (name: string) => `${name}.pptx`,
    genNextArchiveFilePath: async (_dir: string, name: string) => {
        const path = `/downloads/${name}`;
        fake.createdPaths.push(path);
        return path;
    },
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: fake.handleError }));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: fake.toast }));
vi.mock('../server/appHelpers', () => ({ showFileOrDirExplorer: fake.reveal }));
vi.mock('../progress-bar/progressBarHelpers', () => ({
    showProgressBar: fake.showProgress,
    hideProgressBar: fake.hideProgress,
    showProgressBarMessage: fake.showMessage,
}));
vi.mock('./officeZipHelpers', () => ({
    OfficeZipWriter: class {
        constructor(
            private readonly write: (data: Uint8Array) => Promise<void>,
        ) {}
        async addEntry(name: string, data: unknown) {
            fake.entries.push({ name, data });
            await this.write(Uint8Array.of(1));
        }
        async finish() {
            await this.write(Uint8Array.of(2));
        }
    },
}));
vi.mock('./pptxSlideMeasureHelpers', () => ({
    PptxSlideMeasurer: class {
        constructor(
            private readonly addMedia: (
                key: string,
                load: () => Promise<{ bytes: Uint8Array; extension: string }>,
            ) => Promise<unknown>,
        ) {}
        async init() {}
        async measureSlide(slide: { note: string; picture?: boolean }) {
            if (slide.picture) {
                const load = async () => ({
                    bytes: Uint8Array.of(4),
                    extension: 'png',
                });
                fake.mediaResults.push(
                    await this.addMedia('shared-picture', load),
                );
                fake.mediaResults.push(
                    await this.addMedia('shared-picture', load),
                );
            }
            return { note: slide.note };
        }
        destroy() {}
    },
}));
vi.mock('./pptxXmlHelpers', () => {
    const xml = () => '<xml/>';
    return {
        genPptxSlideSize: () => ({ widthEmu: 1000, heightEmu: 600 }),
        genPptxUnits: () => ({}),
        genAppPropsXml: xml,
        genContentTypesXml: xml,
        genCorePropsXml: xml,
        genNotesMasterRelsXml: xml,
        genNotesMasterXml: xml,
        genNotesSlideRelsXml: xml,
        genNotesSlideXml: xml,
        genPresPropsXml: xml,
        genPresentationRelsXml: xml,
        genPresentationXml: xml,
        genRootRelsXml: xml,
        genSlideLayoutRelsXml: xml,
        genSlideLayoutXml: xml,
        genSlideMasterRelsXml: xml,
        genSlideMasterXml: xml,
        genSlideRelsXml: xml,
        genSlideXml: xml,
        genTableStylesXml: xml,
        genThemeXml: xml,
        genViewPropsXml: xml,
    };
});

import {
    exportAppDocumentToPptx,
    exportAppDocumentsToPptx,
} from './pptxExportHelpers';

function document(name: string, slides: any[]) {
    return {
        fileSource: { name },
        getSlides: vi.fn(async () => slides),
    } as any;
}

describe('PPTX export coordinator', () => {
    beforeEach(() => {
        fake.entries = [];
        fake.streams = [];
        fake.mediaResults = [];
        fake.createdPaths = [];
        fake.failOnStream = 0;
        for (const mock of [
            fake.deleteFile,
            fake.toast,
            fake.reveal,
            fake.showProgress,
            fake.hideProgress,
            fake.showMessage,
            fake.handleError,
        ]) {
            mock.mockClear();
        }
    });

    test('an empty batch writes nothing', async () => {
        expect(await exportAppDocumentsToPptx([])).toEqual([]);
        expect(fake.streams).toHaveLength(0);
        expect(fake.showProgress).not.toHaveBeenCalled();
    });

    test('writes slide and note parts, reuses media and reveals one deck', async () => {
        const deck = document('Service', [
            {
                width: 1920,
                height: 1080,
                note: 'Presenter note',
                picture: true,
            },
            { width: 1920, height: 1080, note: '', isDisabled: true },
        ]);
        expect(await exportAppDocumentToPptx(deck)).toBe(
            '/downloads/Service.pptx',
        );
        expect(deck.getSlides).toHaveBeenCalledOnce();
        expect(fake.entries.map((entry) => entry.name)).toEqual(
            expect.arrayContaining([
                '[Content_Types].xml',
                'ppt/slides/slide1.xml',
                'ppt/slides/slide2.xml',
                'ppt/notesSlides/notesSlide1.xml',
                'ppt/media/image1.png',
            ]),
        );
        expect(
            fake.entries.filter(
                (entry) => entry.name === 'ppt/media/image1.png',
            ),
        ).toHaveLength(1);
        expect(fake.mediaResults).toEqual([
            { fileName: 'image1.png' },
            { fileName: 'image1.png' },
        ]);
        expect(fake.showMessage).toHaveBeenCalledWith('Export to PPTX', '1/2');
        expect(fake.reveal).toHaveBeenCalledOnce();
        expect(fake.reveal).toHaveBeenCalledWith('/downloads/Service.pptx');
        expect(fake.hideProgress).toHaveBeenCalledOnce();
    });

    test('exports several decks serially and reveals Downloads once', async () => {
        const first = document('First', [{ width: 100, height: 50, note: '' }]);
        const second = document('Second', [
            { width: 100, height: 50, note: '' },
        ]);
        expect(
            await exportAppDocumentsToPptx([
                { appDocument: first, name: 'First' },
                { appDocument: second, name: 'Second' },
            ]),
        ).toEqual(['/downloads/First.pptx', '/downloads/Second.pptx']);
        expect(fake.showMessage.mock.calls.map((call) => call[1])).toEqual([
            'First · 1/1',
            'Second · 1/1',
        ]);
        expect(fake.reveal).toHaveBeenCalledOnce();
        expect(fake.reveal).toHaveBeenCalledWith('/downloads');
    });

    test('aborts and removes a partial deck after a write failure', async () => {
        fake.failOnStream = 1;
        const deck = document('Broken', [{ width: 100, height: 50, note: '' }]);
        expect(await exportAppDocumentToPptx(deck)).toBeNull();
        expect(fake.streams[0].destroyed).toBe(true);
        expect(fake.deleteFile).toHaveBeenCalledWith('/downloads/Broken.pptx');
        expect(fake.handleError).toHaveBeenCalledWith(expect.any(Error));
        expect(fake.toast).toHaveBeenCalledWith(
            'Export to PPTX',
            'Unable to export the document to PPTX',
        );
        expect(fake.reveal).not.toHaveBeenCalled();
        expect(fake.hideProgress).toHaveBeenCalledOnce();
    });
});
