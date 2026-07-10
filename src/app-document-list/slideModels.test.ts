import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    getDefaultScreenDisplayMock,
    getFontFamiliesMock,
    handleErrorMock,
    fileSourceGetInstanceMock,
    fileSourceGetInstanceBySrcMock,
    pathJoinMock,
} = vi.hoisted(() => ({
    getDefaultScreenDisplayMock: vi.fn(),
    getFontFamiliesMock: vi.fn(),
    handleErrorMock: vi.fn(),
    fileSourceGetInstanceMock: vi.fn(),
    fileSourceGetInstanceBySrcMock: vi.fn(),
    pathJoinMock: vi.fn(),
}));

vi.mock('../_screen/managers/screenHelpers', () => ({
    getDefaultScreenDisplay: getDefaultScreenDisplayMock,
}));

vi.mock('../server/fontHelpers', () => ({
    getFontFamilies: getFontFamiliesMock,
}));

vi.mock('../helper/helpers', () => ({
    cloneJson: <T>(value: T) => structuredClone(value),
}));

vi.mock('../helper/errorHelpers', () => ({
    handleError: handleErrorMock,
}));

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: fileSourceGetInstanceMock,
        getInstanceBySrc: fileSourceGetInstanceBySrcMock,
    },
}));

vi.mock('../server/fileHelpers', () => ({
    pathJoin: pathJoinMock,
}));

import { DragTypeEnum } from '../helper/DragInf';
import DocxSlide from './DocxSlide';
import PdfSlide from './PdfSlide';
import PptxSlide from './PptxSlide';
import Slide from './Slide';

function createSlideJson(id: number) {
    return {
        id,
        name: `Slide ${id}`,
        metadata: {
            width: 320,
            height: 180,
        },
        canvasItems: [],
    };
}

describe('slide models', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();

        getDefaultScreenDisplayMock.mockReturnValue({
            bounds: { width: 1280, height: 720 },
        });
        getFontFamiliesMock.mockResolvedValue(['arial', 'open sans']);
        fileSourceGetInstanceMock.mockImplementation((filePath: string) => {
            const normalized = filePath.replaceAll('\\', '/');
            const fullName = normalized.split('/').at(-1) ?? normalized;
            const baseDirPath = normalized.includes('/')
                ? normalized.substring(0, normalized.lastIndexOf('/'))
                : '';
            return {
                filePath,
                fullName,
                baseDirPath,
            };
        });
        fileSourceGetInstanceBySrcMock.mockResolvedValue({
            filePath: '/images/page-1.png',
        });
        pathJoinMock.mockImplementation((...parts: string[]) =>
            parts.join('/'),
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test('covers Slide getters, mutation helpers and serialization', async () => {
        const slide = new Slide('/docs/main.ows', {
            ...createSlideJson(3),
            canvasItems: [
                {
                    type: 'text',
                    fontFamily: 'Arial',
                } as any,
                {
                    type: 'shape',
                } as any,
            ],
        });

        expect(slide.isDisabled).toBe(false);
        await expect(slide.getItemFilePath()).resolves.toBe('/docs/main.ows');
        expect(slide.name).toBe('Slide 3');
        expect(slide.id).toBe(3);
        expect(slide.uuid).toBe('main.ows-3');
        expect(slide.cloneOriginalJson).toEqual(slide.toJson());
        expect(slide.fontFamilies()).toEqual(new Set(['Arial']));
        expect(await slide.getUnavailableFontFamilies()).toEqual([]);

        getFontFamiliesMock.mockResolvedValueOnce(['open sans']);
        expect(await slide.getUnavailableFontFamilies()).toEqual(['Arial']);

        slide.name = 'Updated';
        slide.id = 9;
        slide.width = 640;
        slide.height = 360;
        slide.note = 'Speaker note';
        slide.canvasItemsJson = [];
        slide.isDisabled = true;

        expect(slide.isChanged).toBe(true);
        expect(slide.isDisabled).toBe(true);
        expect(slide.toJson().isDisabled).toBe(true);
        slide.isDisabled = false;
        expect(slide.isDisabled).toBe(false);
        expect(slide.name).toBe('Updated');
        expect(slide.id).toBe(9);
        expect(slide.width).toBe(640);
        expect(slide.height).toBe(360);
        expect(slide.note).toBe('Speaker note');
        expect(slide.checkIsWrongDimension({ width: 640, height: 360 })).toBe(
            false,
        );
        expect(slide.checkIsWrongDimension({ width: 641, height: 360 })).toBe(
            true,
        );

        expect(Slide.getDefaultDim()).toEqual({ width: 1280, height: 720 });
        expect(Slide.defaultSlideData(10)).toEqual({
            id: 10,
            metadata: { width: 1280, height: 720 },
            canvasItems: [],
        });

        expect(() => Slide.validate(slide.toJson())).not.toThrow();
        expect(() => Slide.validate({} as any)).toThrow('Invalid slide data');

        const cloned = slide.clone();
        const duplicated = slide.clone(true);
        expect(cloned.id).toBe(-1);
        expect(duplicated.id).toBe(9);
        expect(cloned.checkIsSame(slide)).toBe(false);
        expect(duplicated.checkIsSame(slide)).toBe(true);

        const clipboardText = slide.clipboardSerialize();
        const restored = Slide.clipboardDeserialize(clipboardText);
        expect(restored).toBeInstanceOf(Slide);
        expect(restored?.toJson()).toEqual(slide.toJson());
        expect(Slide.clipboardDeserialize('')).toBeNull();
        expect(Slide.clipboardDeserialize('not-json')).toBeNull();

        expect(slide.dragSerialize()).toEqual({
            type: DragTypeEnum.SLIDE,
            data: clipboardText,
        });
        expect(Slide.dragDeserialize(clipboardText)?.toJson()).toEqual(
            slide.toJson(),
        );

        const clipboardDeserializeSpy = vi
            .spyOn(Slide, 'clipboardDeserialize')
            .mockImplementationOnce(() => {
                throw new Error('drag failed');
            });
        expect(Slide.dragDeserialize('bad-data')).toBeNull();
        expect(handleErrorMock).toHaveBeenCalled();
        clipboardDeserializeSpy.mockRestore();

        const errorSlide = Slide.fromJsonError(
            { invalid: true },
            '/docs/main.ows',
        );
        expect(errorSlide.isError).toBe(true);
        expect(errorSlide.toJson()).toEqual({ invalid: true });
        expect(Slide.checkIsThisType(errorSlide)).toBe(true);
    });

    test('covers PdfSlide DOM serialization and file helpers', async () => {
        vi.stubGlobal(
            'Image',
            class {
                width = 640;
                height = 480;
                onload?: () => void;
                onerror?: () => void;

                set src(_value: string) {
                    queueMicrotask(() => {
                        this.onload?.();
                    });
                }
            },
        );
        vi.stubGlobal('document', {
            createElement: vi.fn((tag: string) => {
                if (tag !== 'canvas') {
                    throw new Error(`Unexpected tag: ${tag}`);
                }
                return {
                    width: 0,
                    height: 0,
                    getContext: vi.fn(() => ({
                        drawImage: vi.fn(),
                    })),
                    toDataURL: vi.fn(() => 'data:image/png;base64,preview'),
                };
            }),
        });

        const pdfSlide = new PdfSlide('/docs/guide.pdf', {
            id: 2,
            name: 'Page 2',
            imagePreviewSrc: 'file:///preview/page-2.png',
            pdfPageNumber: 1,
            metadata: { width: 640, height: 480 },
        });

        expect(pdfSlide.isDisabled).toBe(false);
        expect(pdfSlide.id).toBe(2);
        pdfSlide.id = 5;
        expect(pdfSlide.id).toBe(5);
        expect(pdfSlide.name).toBe('Page 2');
        expect(pdfSlide.pdfPreviewSrc).toBe('file:///preview/page-2.png');
        expect(await pdfSlide.getImageFilePath()).toBe('/images/page-1.png');

        fileSourceGetInstanceBySrcMock.mockResolvedValueOnce(null);
        expect(await pdfSlide.getImageFilePath()).toBeNull();

        expect(pdfSlide.width).toBe(640);
        expect(pdfSlide.height).toBe(480);
        expect(
            pdfSlide.checkIsSame(
                PdfSlide.fromJson(pdfSlide.toJson(), pdfSlide.filePath),
            ),
        ).toBe(true);
        expect(PdfSlide.checkIsThisType(pdfSlide)).toBe(true);
        expect(PdfSlide.tryValidate(pdfSlide.toJson())).toBe(true);
        expect(PdfSlide.tryValidate({ bad: true } as any)).toBe(false);
        expect(() => PdfSlide.validate({ bad: true } as any)).toThrow(
            'Invalid slide data',
        );
        expect(pdfSlide.dragSerialize()).toEqual({
            type: DragTypeEnum.PDF_SLIDE,
            data: JSON.stringify({
                filePath: '/docs/guide.pdf',
                data: pdfSlide.toJson(),
            }),
        });
        await expect(pdfSlide.getItemFilePath()).resolves.toBe(
            '/images/page-1.png',
        );
        await expect(pdfSlide.clipboardSerialize()).resolves.toBe(
            'data:image/png;base64,preview',
        );
        expect(() => pdfSlide.clone()).toThrow('Method not implemented.');

        vi.stubGlobal(
            'Image',
            class {
                onload?: () => void;
                onerror?: () => void;

                set src(_value: string) {
                    queueMicrotask(() => {
                        this.onerror?.();
                    });
                }
            },
        );
        await expect(pdfSlide.clipboardSerialize()).resolves.toBeNull();
    });

    test('covers PptxSlide sub-slides and drag serialization', async () => {
        const pptxSlide = new PptxSlide('/docs/deck.pptx', {
            id: 4,
            htmlFilePath: '/deck/slide-4.html',
            subHtmlFilePaths: ['/deck/sub-1.html', '/deck/sub-2.html'],
            html: '<section>Main</section>',
            subHtmls: ['<section>First</section>', '<section>Second</section>'],
            isDisabled: true,
            note: 'Speaker note',
            metadata: { width: 1280, height: 720 },
            images: [],
            videos: [],
            audios: ['audio/a.mp3', 'audio/b.mp3'],
        });

        expect(pptxSlide.isDisabled).toBe(true);
        expect(pptxSlide.uuid).toBe('deck.pptx-4');
        expect(pptxSlide.htmlFilePath).toBe('/deck/slide-4.html');
        expect(pptxSlide.html).toBe('<section>Main</section>');
        expect(pptxSlide.name).toBe('');
        expect(pptxSlide.note).toBe('Speaker note');
        expect(pptxSlide.width).toBe(1280);
        expect(pptxSlide.height).toBe(720);
        expect(pptxSlide.audioFilePaths).toEqual([
            '/deck/audio/a.mp3',
            '/deck/audio/b.mp3',
        ]);

        const subSlides = pptxSlide.subSlides;
        expect(subSlides).toHaveLength(2);
        expect(subSlides[0].id).toBe(1003);
        expect(subSlides[0].html).toBe('<section>First</section>');
        expect(subSlides[1].id).toBe(1004);

        pptxSlide.id = 8;
        expect(pptxSlide.id).toBe(8);
        expect(
            pptxSlide.checkIsSame(
                PptxSlide.fromJson(pptxSlide.toJson(), pptxSlide.filePath),
            ),
        ).toBe(true);
        expect(PptxSlide.checkIsThisType(pptxSlide)).toBe(true);
        expect(PptxSlide.tryValidate(pptxSlide.toJson())).toBe(true);
        expect(PptxSlide.tryValidate({ bad: true } as any)).toBe(false);
        expect(() => PptxSlide.validate({ bad: true } as any)).toThrow(
            'Invalid slide data',
        );
        expect(await pptxSlide.clipboardSerialize()).toBeNull();
        await expect(pptxSlide.getItemFilePath()).resolves.toBe(
            '/deck/slide-4.html',
        );
        expect(() => pptxSlide.clone()).toThrow('Method not implemented.');
        expect(PptxSlide.calcIndex(2, 3)).toBe(2.04);

        const dragData = JSON.parse(pptxSlide.dragSerialize().data);
        expect(pptxSlide.dragSerialize().type).toBe(DragTypeEnum.PPTX_SLIDE);
        expect(dragData).toEqual({
            filePath: '/docs/deck.pptx',
            data: {
                id: 8,
                htmlFilePath: '/deck/slide-4.html',
                subHtmlFilePaths: ['/deck/sub-1.html', '/deck/sub-2.html'],
                isDisabled: true,
                note: 'Speaker note',
                metadata: { width: 1280, height: 720 },
                images: [],
                videos: [],
                audios: ['audio/a.mp3', 'audio/b.mp3'],
            },
        });
    });

    test('covers DocxSlide drag serialization', async () => {
        const docxSlide = new DocxSlide('/docs/file.docx', {
            id: 7,
            htmlFilePath: '/doc/page-7.html',
            html: '<article>Page</article>',
            metadata: { width: 800, height: 1100 },
        });

        expect(docxSlide.isDisabled).toBe(false);
        expect(docxSlide.id).toBe(7);
        docxSlide.id = 9;
        expect(docxSlide.id).toBe(9);
        expect(docxSlide.htmlFilePath).toBe('/doc/page-7.html');
        expect(docxSlide.html).toBe('<article>Page</article>');
        expect(docxSlide.name).toBe('');
        expect(docxSlide.width).toBe(800);
        expect(docxSlide.height).toBe(1100);
        expect(
            docxSlide.checkIsSame(
                DocxSlide.fromJson(docxSlide.toJson(), docxSlide.filePath),
            ),
        ).toBe(true);
        expect(DocxSlide.checkIsThisType(docxSlide)).toBe(true);
        expect(DocxSlide.tryValidate(docxSlide.toJson())).toBe(true);
        expect(DocxSlide.tryValidate({ bad: true } as any)).toBe(false);
        expect(() => DocxSlide.validate({ bad: true } as any)).toThrow(
            'Invalid slide data',
        );
        expect(await docxSlide.clipboardSerialize()).toBeNull();
        await expect(docxSlide.getItemFilePath()).resolves.toBe(
            '/doc/page-7.html',
        );
        expect(() => docxSlide.clone()).toThrow('Method not implemented.');

        const dragPayload = JSON.parse(docxSlide.dragSerialize().data);
        expect(docxSlide.dragSerialize().type).toBe(DragTypeEnum.DOCX_SLIDE);
        expect(dragPayload).toEqual({
            filePath: '/docs/file.docx',
            data: {
                id: 9,
                htmlFilePath: '/doc/page-7.html',
                metadata: { width: 800, height: 1100 },
            },
        });
    });
});
