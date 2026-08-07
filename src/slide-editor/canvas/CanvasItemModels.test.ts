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
    checkCanvasItemsIncludes: (canvasItems: any[], canvasItem: any) => {
        return canvasItems.some((item) => item.id === canvasItem.id);
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
    isSupportedExt: vi.fn(() => true),
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
import CanvasItemAudio from './CanvasItemAudio';
import CanvasItemWebsite from './CanvasItemWebsite';
import CanvasItemYouTube from './CanvasItemYouTube';
import {
    checkIsAppendSelectionModifier,
    getCanvasItemsInRect,
    mergeCanvasItemSelection,
} from './canvasSelectionHelpers';

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

    test('builds media canvas items that point at a remote link', async () => {
        getImageDimMock.mockResolvedValue([640, 480]);
        getVideoDimMock.mockResolvedValue([1920, 1080]);
        const imageUrl = 'https://www.openworship.app/shared/images/Blue.png';
        const videoUrl =
            'https://www.openworship.app/shared/videos/Pink motion.mp4';
        const audioUrl =
            'https://www.openworship.app/shared/audios/Doxology 21&22.mp3';

        // The link is stored as the source verbatim — nothing is inlined or
        // copied into the document.
        const imageItem = await CanvasItemImage.genCanvasItemFromLink(
            500,
            400,
            imageUrl,
        );
        expect(getImageDimMock).toHaveBeenCalledWith(imageUrl);
        expect(imageItem.toJson()).toEqual(
            expect.objectContaining({
                type: 'image',
                srcData: imageUrl,
                mediaWidth: 640,
                mediaHeight: 480,
            }),
        );

        const videoItem = await CanvasItemVideo.genCanvasItemFromLink(
            500,
            400,
            videoUrl,
        );
        expect(getVideoDimMock).toHaveBeenCalledWith(videoUrl);
        expect(videoItem.toJson()).toEqual(
            expect.objectContaining({
                type: 'video',
                filePath: videoUrl,
                mediaWidth: 1920,
                mediaHeight: 1080,
            }),
        );

        // Audio has nothing to measure, so the link is never opened at all.
        const audioItem = CanvasItemAudio.genCanvasItemFromLink(
            500,
            400,
            audioUrl,
        );
        expect(audioItem.toJson()).toEqual(
            expect.objectContaining({
                type: 'audio',
                filePath: audioUrl,
            }),
        );
    });

    test('builds audio canvas items without reading the media', () => {
        const audioJson = {
            ...createBaseBox('audio'),
            filePath: '/slides/song.mp3',
        };
        const item = CanvasItemAudio.fromJson(audioJson as any);

        expect(item).toBeInstanceOf(CanvasItemAudio);
        expect(CanvasItemAudio.gegStyle(audioJson as any)).toEqual({});
        expect(item.getStyle()).toEqual({});
        expect(item.toJson()).toEqual(audioJson);

        const insertedItem = CanvasItemAudio.genFromInsertion(
            400,
            300,
            '/slides/song.mp3',
        );
        expect(insertedItem.toJson()).toEqual(
            expect.objectContaining({
                type: 'audio',
                filePath: '/slides/song.mp3',
                // Centered on the insertion point at the default player size.
                left: 120,
                top: 270,
                width: 560,
                height: 60,
            }),
        );

        const fileItem = CanvasItemAudio.genFromFile(250, 220, {
            appFilePath: '/slides/dropped.mp3',
        } as any);
        expect(fileItem.toJson()).toEqual(
            expect.objectContaining({
                type: 'audio',
                filePath: '/slides/dropped.mp3',
            }),
        );

        // A blob without a resolvable on-disk path cannot become an audio item.
        expect(() => {
            return CanvasItemAudio.genFromFile(100, 100, new Blob(['audio']));
        }).toThrow('Error occurred during resolving audio file path from blob');

        expect(
            CanvasItemAudio.fromJson({
                ...audioJson,
                filePath: '',
            } as any),
        ).toEqual({
            type: 'error',
            json: expect.objectContaining({
                filePath: '',
            }),
        });
    });

    test('builds media props for a box the caller already chose, without measuring', () => {
        // The lyric-attachment factories: the box is decided by the caller, so
        // the media's own ratio would be measured only to be thrown away.
        const boxProps = {
            id: -1,
            top: 19,
            left: 19,
            rotate: 0,
            width: 1882,
            height: 1042,
            backgroundColor: '#00000000',
            backdropFilter: 0,
            roundSizePercentage: 0,
            roundSizePixel: 0,
            locked: true,
        } as any;
        const fileUrl = 'file:///C:/songs/backing.mp3';
        const remoteUrl = 'https://www.openworship.app/shared/images/Blue.png';

        expect(
            CanvasItemImage.genCanvasItemPropsFromLink(remoteUrl, boxProps),
        ).toEqual({
            ...boxProps,
            type: 'image',
            srcData: remoteUrl,
            // The box's own size, NOT the image's — nothing was loaded.
            mediaWidth: 1882,
            mediaHeight: 1042,
        });
        expect(
            CanvasItemVideo.genCanvasItemPropsFromLink(remoteUrl, boxProps),
        ).toEqual({
            ...boxProps,
            type: 'video',
            filePath: remoteUrl,
            mediaWidth: 1882,
            mediaHeight: 1042,
        });
        // A `file://` source is kept verbatim: it is already a URL and must
        // never be run through `pathToFileURL` again.
        expect(
            CanvasItemAudio.genCanvasItemPropsFromLink(fileUrl, boxProps),
        ).toEqual({
            ...boxProps,
            type: 'audio',
            filePath: fileUrl,
        });
        expect(
            CanvasItemYouTube.genCanvasItemPropsFromLink(remoteUrl, boxProps),
        ).toEqual({ ...boxProps, type: 'youtube', url: remoteUrl });
        expect(
            CanvasItemWebsite.genCanvasItemPropsFromLink(remoteUrl, boxProps),
        ).toEqual({ ...boxProps, type: 'website', url: remoteUrl });

        // The whole point of this family: no media is opened to build them.
        expect(getImageDimMock).not.toHaveBeenCalled();
        expect(getVideoDimMock).not.toHaveBeenCalled();
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
            '<div>(<span data-bible-key="NIV">NIV</span>) Psalm 1</div></div>',
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
        expect(legacyHtml).toContain('<div>Genesis 1:1</div></div>');
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
    test('builds website canvas items that keep their embed ratio', () => {
        const item = CanvasItemWebsite.genFromUrl(
            400,
            300,
            'https://example.com',
        ) as CanvasItemWebsite;

        expect(item.props.url).toBe('https://example.com');
        expect(item.props.type).toBe('website');
        // the box is centered on the cursor
        expect(item.props.left).toBe(0);
        expect(item.props.top).toBe(0);
        // it resizes like a video: ratio locked, no styling of its own
        expect(item.shouldLockAspectRatio).toBe(true);
        expect(item.getStyle()).toEqual({});
        expect(item.toJson().url).toBe('https://example.com');

        expect(CanvasItemWebsite.fromJson({ url: 42 } as any)).toEqual(
            expect.objectContaining({ type: 'error' }),
        );
    });

    test('builds YouTube canvas items with an embeddable url', () => {
        const item = CanvasItemYouTube.genFromUrl(
            400,
            300,
            'https://youtu.be/abc123',
        ) as CanvasItemYouTube;

        expect(item.shouldLockAspectRatio).toBe(true);
        expect(item.getStyle()).toEqual({});
        expect(item.embedUrl).toBe(
            'https://www.youtube.com/embed/abc123?rel=0&enablejsapi=1',
        );
    });

    test('selection helpers append, merge, and rubber-band select boxes', () => {
        expect(
            checkIsAppendSelectionModifier({
                shiftKey: true,
                ctrlKey: false,
                metaKey: false,
            }),
        ).toBe(true);
        expect(
            checkIsAppendSelectionModifier({
                shiftKey: false,
                ctrlKey: false,
                metaKey: true,
            }),
        ).toBe(true);
        expect(
            checkIsAppendSelectionModifier({
                shiftKey: false,
                ctrlKey: false,
                metaKey: false,
            }),
        ).toBe(false);

        const first = { id: 1, props: { id: 1 } } as any;
        const second = { id: 2, props: { id: 2 } } as any;
        expect(mergeCanvasItemSelection([first], [first, second])).toEqual([
            first,
            second,
        ]);

        const inside = {
            id: 1,
            props: { id: 1, left: 10, top: 10, width: 50, height: 50 },
        } as any;
        const outside = {
            id: 2,
            props: { id: 2, left: 500, top: 500, width: 10, height: 10 },
        } as any;
        expect(
            getCanvasItemsInRect([inside, outside], {
                minX: 0,
                maxX: 100,
                minY: 0,
                maxY: 100,
            }),
        ).toEqual([inside]);
    });
});
