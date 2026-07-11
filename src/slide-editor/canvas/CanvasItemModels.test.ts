import { beforeEach, describe, expect, test, vi } from 'vitest';

import { HEX_COLOR_WHITE } from '../../others/color/colorHelpers';

const {
    BaseCanvasItemMock,
    bibleValidateMock,
    canvasItemErrorFromJsonErrorMock,
    cloneJsonMock,
    fileSourceGetInstanceMock,
    getBibleFontFamilyMock,
    getImageDimMock,
    getSrcDataFromBlobMock,
    getVideoDimMock,
    handleErrorMock,
} = vi.hoisted(() => {
    class BaseCanvasItemMock<T extends { id: number; type: string }> {
        props: T;

        constructor(props: T) {
            this.props = { ...props };
        }

        static validate(json: any) {
            if (typeof json.id !== 'number' || typeof json.type !== 'string') {
                throw new TypeError('Invalid canvas item data');
            }
        }

        applyProps(props: Record<string, unknown>) {
            Object.assign(this.props as object, props);
        }

        toJson() {
            return this.props;
        }
    }

    return {
        BaseCanvasItemMock,
        bibleValidateMock: vi.fn(),
        canvasItemErrorFromJsonErrorMock: vi.fn((json: any) => ({
            type: 'error',
            json,
        })),
        cloneJsonMock: vi.fn((value: any) => structuredClone(value)),
        fileSourceGetInstanceMock: vi.fn(),
        getBibleFontFamilyMock: vi.fn(),
        getImageDimMock: vi.fn(),
        getSrcDataFromBlobMock: vi.fn(),
        getVideoDimMock: vi.fn(),
        handleErrorMock: vi.fn(),
    };
});

vi.mock('./CanvasItem', () => ({
    default: BaseCanvasItemMock,
    CanvasItemError: {
        fromJsonError: canvasItemErrorFromJsonErrorMock,
    },
}));

vi.mock('../../helper/errorHelpers', () => ({
    handleError: handleErrorMock,
}));

vi.mock('../../others/color/colorHelpers', () => ({
    HEX_COLOR_WHITE: '#FFFFFF',
}));

vi.mock('../../helper/helpers', () => ({
    cloneJson: cloneJsonMock,
    freezeObject: <T>(value: T) => value,
    getImageDim: getImageDimMock,
    getVideoDim: getVideoDimMock,
}));

vi.mock('../../helper/FileSource', () => ({
    default: {
        getInstance: fileSourceGetInstanceMock,
        getSrcDataFromFrom: getSrcDataFromBlobMock,
    },
}));

vi.mock('../../server/fileHelpers', () => ({
    isSupportedMimetype: vi.fn(() => true),
}));

vi.mock('../../helper/bible-helpers/bibleStyleHelpers', () => ({
    getBibleFontFamily: getBibleFontFamilyMock,
}));

vi.mock('../../bible-list/BibleItem', () => ({
    default: class BibleItemMock {
        static readonly validate = bibleValidateMock;

        constructor(
            public bibleKey = 'KJV',
            private readonly title = 'Genesis 1:1',
            private readonly text = 'In the beginning',
            private readonly target = 'verse',
        ) {}

        async toTitle() {
            return this.title;
        }

        async toTitleWithBibleKey() {
            return `(${this.bibleKey}) ${this.title}`;
        }

        async toText() {
            return this.text;
        }

        async toVerseTextList() {
            return [{ localeVerse: '1', text: this.text }];
        }

        toJson() {
            return {
                target: this.target,
            };
        }
    },
}));

vi.mock('../../server/appProvider', () => ({
    default: {
        appInfo: {
            titleFull: 'Open Worship App',
        },
        systemUtils: {
            isDev: false,
        },
    },
}));

import BibleItem from '../../bible-list/BibleItem';
import CanvasItemBibleItem from './CanvasItemBibleItem';
import CanvasItemHtml, { genHtmlDefaultProps } from './CanvasItemHtml';
import CanvasItemImage from './CanvasItemImage';
import CanvasItemText, { genTextDefaultProps } from './CanvasItemText';
import CanvasItemVideo from './CanvasItemVideo';

function createBaseBox(type: string) {
    return {
        id: 11,
        top: 10,
        left: 20,
        rotate: 0,
        width: 300,
        height: 100,
        backgroundColor: '#000000',
        backdropFilter: 0,
        roundSizePercentage: 0,
        roundSizePixel: 0,
        type,
    };
}

describe('CanvasItem models', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getImageDimMock.mockResolvedValue([200, 100]);
        getVideoDimMock.mockResolvedValue([320, 180]);
        fileSourceGetInstanceMock.mockReturnValue({
            src: '/slides/media.png',
            getSrcData: vi.fn(async () => 'data:media'),
        });
        getSrcDataFromBlobMock.mockResolvedValue('data:blob');
        getBibleFontFamilyMock.mockResolvedValue('Battambang');
    });

    test('builds and validates text canvas items', () => {
        expect(genTextDefaultProps()).toEqual({
            text: 'Open Worship App',
            color: HEX_COLOR_WHITE,
            fontSize: 60,
            fontFamily: null,
            fontWeight: null,
            textHorizontalAlignment: 'center',
            textVerticalAlignment: 'center',
        });

        const textJson = {
            ...createBaseBox('text'),
            ...genTextDefaultProps(),
        };
        const item = CanvasItemText.fromJson(textJson as any);

        expect(item).toBeInstanceOf(CanvasItemText);
        expect(CanvasItemText.genStyle(textJson as any)).toEqual(
            expect.objectContaining({
                display: 'flex',
                fontSize: '60px',
                fontFamily: '',
                fontWeight: '',
                color: HEX_COLOR_WHITE,
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '6px',
            }),
        );
        expect(item.getStyle()).toEqual(
            CanvasItemText.genStyle(textJson as any),
        );

        (item as CanvasItemText).applyTextData({
            text: 'Updated',
            fontSize: 48,
        } as any);
        expect(item.toJson()).toEqual(
            expect.objectContaining({
                text: 'Updated',
                fontSize: 48,
            }),
        );

        const defaultItem = CanvasItemText.genDefaultItem();
        expect(defaultItem.toJson()).toEqual(
            expect.objectContaining({
                type: 'text',
                text: 'Open Worship App',
                color: HEX_COLOR_WHITE,
            }),
        );

        expect(() => CanvasItemText.validate(textJson)).not.toThrow();
        expect(() =>
            CanvasItemText.validate({
                ...textJson,
                fontFamily: 'Battambang',
                fontWeight: '700',
            }),
        ).not.toThrow();
        expect(() =>
            CanvasItemText.validate({
                ...textJson,
                fontSize: 'invalid',
            }),
        ).toThrow('Invalid canvas item text data');
        expect(() =>
            CanvasItemText.validate({
                ...textJson,
                fontWeight: 700,
            }),
        ).toThrow('Invalid canvas item text data');

        expect(
            CanvasItemText.fromJson({
                ...textJson,
                fontSize: 'invalid',
            } as any),
        ).toEqual({
            type: 'error',
            json: expect.objectContaining({
                fontSize: 'invalid',
            }),
        });
        expect(handleErrorMock).toHaveBeenCalled();
    });

    test('builds html canvas items and migrates legacy htmlText props', () => {
        const htmlJson = {
            ...createBaseBox('html'),
            ...genHtmlDefaultProps(),
        };
        const item = CanvasItemHtml.fromJson(htmlJson as any);

        expect(item).toBeInstanceOf(CanvasItemHtml);
        expect(item.getStyle()).toEqual(
            CanvasItemHtml.genStyle(htmlJson as any),
        );

        const defaultItem = CanvasItemHtml.genDefaultItem();
        expect(defaultItem.toJson()).toEqual(
            expect.objectContaining({
                type: 'html',
                html: 'Open Worship App',
                color: HEX_COLOR_WHITE,
            }),
        );

        const legacyJson: any = {
            ...createBaseBox('html'),
            ...genHtmlDefaultProps(),
            htmlText: '<b>Legacy</b>',
        };
        delete legacyJson.html;
        const legacyItem = CanvasItemHtml.fromJson(legacyJson);

        expect(legacyItem).toBeInstanceOf(CanvasItemHtml);
        expect((legacyItem.toJson() as any).html).toBe('<b>Legacy</b>');

        expect(() => CanvasItemHtml.validate(htmlJson)).not.toThrow();
        expect(() =>
            CanvasItemHtml.validate({
                ...htmlJson,
                html: 42,
            }),
        ).toThrow('Invalid canvas item html data');
        expect(
            CanvasItemHtml.fromJson({
                ...htmlJson,
                fontSize: 'invalid',
            } as any),
        ).toEqual({
            type: 'error',
            json: expect.objectContaining({
                fontSize: 'invalid',
            }),
        });
    });

    test('builds image canvas items from raw media and files', async () => {
        const imageJson = {
            ...createBaseBox('image'),
            srcData: 'data:image',
            mediaWidth: 200,
            mediaHeight: 100,
        };
        const item = CanvasItemImage.fromJson(imageJson as any);

        expect(item).toBeInstanceOf(CanvasItemImage);
        expect(CanvasItemImage.gegStyle(imageJson as any)).toEqual({});
        expect(item.getStyle()).toEqual({});
        expect(item.toJson()).toEqual(imageJson);

        const generatedItem = await CanvasItemImage.genCanvasItem(
            'data:image',
            200,
            100,
            300,
            250,
        );
        expect(generatedItem.toJson()).toEqual(
            expect.objectContaining({
                type: 'image',
                left: 200,
                top: 200,
                width: 200,
                height: 100,
                mediaWidth: 200,
                mediaHeight: 100,
            }),
        );

        const insertedItem = await CanvasItemImage.genFromInsertion(
            400,
            300,
            '/slides/image.png',
        );
        expect(getImageDimMock).toHaveBeenCalledWith('/slides/media.png');
        expect(insertedItem.toJson()).toEqual(
            expect.objectContaining({
                srcData: 'data:media',
                left: 300,
                top: 250,
            }),
        );

        const fileItem = await CanvasItemImage.genFromFile(
            250,
            220,
            new Blob(['image']),
        );
        expect(getSrcDataFromBlobMock).toHaveBeenCalled();
        expect(fileItem.toJson()).toEqual(
            expect.objectContaining({
                srcData: 'data:blob',
                left: 150,
                top: 170,
            }),
        );

        getSrcDataFromBlobMock.mockResolvedValueOnce(null);
        await expect(
            CanvasItemImage.genFromFile(100, 100, new Blob(['image'])),
        ).rejects.toThrow('Error occurred during reading image data from blob');

        expect(
            CanvasItemImage.fromJson({
                ...imageJson,
                mediaWidth: 'invalid',
            } as any),
        ).toEqual({
            type: 'error',
            json: expect.objectContaining({
                mediaWidth: 'invalid',
            }),
        });
    });

    test('builds video canvas items from insertion data and files', async () => {
        const videoJson = {
            ...createBaseBox('video'),
            filePath: '/slides/video.mp4',
            mediaWidth: 320,
            mediaHeight: 180,
        };
        const item = CanvasItemVideo.fromJson(videoJson as any);

        expect(item).toBeInstanceOf(CanvasItemVideo);
        expect(CanvasItemVideo.gegStyle(videoJson as any)).toEqual({});
        expect(item.getStyle()).toEqual({});
        expect(item.toJson()).toEqual(videoJson);

        const insertedItem = await CanvasItemVideo.genFromInsertion(
            400,
            300,
            '/slides/video.mp4',
        );
        expect(getVideoDimMock).toHaveBeenCalledWith('/slides/media.png');
        // Video references its file by path instead of inlining base64 data.
        expect(insertedItem.toJson()).toEqual(
            expect.objectContaining({
                type: 'video',
                filePath: '/slides/video.mp4',
                left: 240,
                top: 210,
            }),
        );

        const fileItem = await CanvasItemVideo.genFromFile(250, 220, {
            appFilePath: '/slides/dropped.mp4',
        } as any);
        expect(fileItem.toJson()).toEqual(
            expect.objectContaining({
                type: 'video',
                filePath: '/slides/dropped.mp4',
                left: 90,
                top: 130,
            }),
        );

        // A blob without a resolvable on-disk path cannot become a video item.
        await expect(
            CanvasItemVideo.genFromFile(100, 100, new Blob(['video'])),
        ).rejects.toThrow(
            'Error occurred during resolving video file path from blob',
        );

        expect(
            CanvasItemVideo.fromJson({
                ...videoJson,
                filePath: 123,
            } as any),
        ).toEqual({
            type: 'error',
            json: expect.objectContaining({
                filePath: 123,
            }),
        });
    });

    test('builds Bible canvas items from JSON and BibleItem instances', async () => {
        const bibleJson = {
            ...createBaseBox('bible'),
            ...genTextDefaultProps(),
            bibleKeys: ['KJV'],
            bibleItemTarget: 'verse',
            bibleRenderingList: [
                {
                    title: 'Genesis 1:1',
                    text: 'In the beginning',
                },
            ],
        };
        const sourceJson = structuredClone(bibleJson);
        const item = new CanvasItemBibleItem(sourceJson as any);

        sourceJson.bibleKeys.push('NIV');
        expect(item.toJson()).toEqual(bibleJson);

        const fromJsonItem = CanvasItemBibleItem.fromJson(bibleJson as any);
        expect(fromJsonItem).toBeInstanceOf(CanvasItemBibleItem);
        expect(bibleValidateMock).toHaveBeenCalledWith({
            id: -1,
            target: 'verse',
            bibleKey: 'KJV',
        });

        const bibleItem = new (BibleItem as any)(
            'NIV',
            'Psalm 1',
            'Blessed is the man',
            'chapter',
        );
        const fromBibleItem = await CanvasItemBibleItem.fromBibleItem(
            55,
            bibleItem,
        );
        const fromBibleItemJson = fromBibleItem.toJson() as any;
        expect(fromBibleItemJson).toEqual(
            expect.objectContaining({
                id: 55,
                type: 'bible',
                bibleKeys: ['NIV'],
                bibleItemTarget: 'chapter',
                bibleRenderingList: [
                    {
                        title: '(NIV) Psalm 1',
                        text: 'Blessed is the man',
                        verses: [{ num: '1', text: 'Blessed is the man' }],
                    },
                ],
                fontSize: 45,
                fontFamily: 'Battambang',
                textHorizontalAlignment: 'left',
                textVerticalAlignment: 'start',
            }),
        );
        expect(getBibleFontFamilyMock).toHaveBeenCalledWith('NIV');

        // English has no font family of its own.
        getBibleFontFamilyMock.mockResolvedValue(undefined);
        const withoutFontItem = await CanvasItemBibleItem.fromBibleItem(
            56,
            bibleItem,
        );
        expect((withoutFontItem.toJson() as any).fontFamily).toBeNull();
        expect(fromBibleItemJson.html).toContain('<svg');
        expect(fromBibleItemJson.html).toContain(
            '<span>(NIV) Psalm 1</span></div>',
        );
        expect(fromBibleItemJson.html).toContain('>1</sup>Blessed is the man');

        // Verse numbers become superscripts, and every value is escaped.
        expect(
            CanvasItemBibleItem.genHtml([
                {
                    title: '2 & 3 John',
                    text: 'ignored when verses exist',
                    verses: [
                        { num: '1', text: '<script>alert(1)</script>' },
                        { num: '2', text: 'and light' },
                    ],
                },
            ]),
        ).toContain(
            '>1</sup>&lt;script&gt;alert(1)&lt;/script&gt; <sup style=',
        );

        // Bible items saved before verses existed fall back to the flat text,
        // and any stale stored `html` is re-derived from the rendering list.
        const legacyHtml = (
            CanvasItemBibleItem.fromJson({
                ...bibleJson,
                html: '<div>stale markup</div>',
            } as any) as any
        ).toJson().html;
        expect(legacyHtml).not.toContain('stale markup');
        expect(legacyHtml).toContain('<span>Genesis 1:1</span></div>');
        expect(legacyHtml).toContain(
            '<div style="padding: 0.3em;">In the beginning</div>',
        );
        expect(legacyHtml).not.toContain('<sup');

        bibleValidateMock.mockImplementationOnce(() => {
            throw new Error('Invalid bible item');
        });
        expect(CanvasItemBibleItem.fromJson(bibleJson as any)).toEqual({
            type: 'error',
            json: bibleJson,
        });
    });
});
