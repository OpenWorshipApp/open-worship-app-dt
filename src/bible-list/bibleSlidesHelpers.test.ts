// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../media-sessions/folderSessionHelpers', () => ({
    FOLDER_SESSION_BASE_NAMES: [],
    SESSION_URL_PARAM_NAME: 'session',
    getActiveDirSourceSettingName: (settingName: string) => settingName,
    toSessionDirSourceSettingName: (settingName: string) => settingName,
    toSessionDirSourceSettingNameFromParam: (settingName: string) => {
        return settingName;
    },
}));
import type BibleItem from './BibleItem';

const h = vi.hoisted(() => {
    class CanvasItem {
        props: any;
        constructor(props: any) {
            this.props = structuredClone(props);
        }
        applyProps(props: any) {
            Object.assign(this.props, props);
        }
        toJson() {
            return this.props;
        }
        static genDefaultItem() {
            return new CanvasItem({ type: 'text', fontSize: 60, text: '' });
        }
    }
    class BibleCanvasItem extends CanvasItem {
        static genHtml() {
            return '<div>Verse text</div>';
        }
        static async fromBibleItem(id: number, item: any) {
            return new BibleCanvasItem({
                id,
                type: 'bible',
                bibleKeys: [item.bibleKey],
                bibleItemTarget: item.target,
                html: '<div>Verse text</div>',
            });
        }
    }
    return {
        CanvasItem,
        BibleCanvasItem,
        create: vi.fn(),
        getVerses: vi.fn(),
        getBibleInfoIsRtl: vi.fn(),
        getAvailableFileName: vi.fn(),
        refresh: vi.fn(),
        toast: vi.fn(),
        error: vi.fn(),
        fontsLoad: vi.fn(),
        directory: {
            isDirPathValid: true,
            dirPath: '/documents',
            fireRefreshEvent: vi.fn(),
        },
    };
});

vi.mock('../app-document-list/AppDocument', () => ({
    default: { createWithContent: h.create },
}));
vi.mock('../app-document-list/Slide', () => ({
    default: {
        defaultSlideData: (id: number) => ({
            id,
            type: 'slide',
            metadata: { width: 1920, height: 1080 },
            canvasItems: [],
        }),
    },
}));
vi.mock('../helper/DirSource', () => ({
    default: { getInstance: async () => h.directory },
}));
vi.mock('../helper/constants', () => ({
    dirSourceSettingNames: { APP_DOCUMENT: 'documents' },
}));
vi.mock('../helper/bible-helpers/bibleInfoHelpers', () => ({
    getVerses: h.getVerses,
    getBibleInfoIsRtl: h.getBibleInfoIsRtl,
}));
vi.mock('../helper/bible-helpers/bibleModelHelpers', () => ({
    BIBLE_KJV_KEY: 'KJV',
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    getBibleFontFamily: async (key: string) =>
        key === 'KH54' ? 'app-Battambang' : '',
}));
vi.mock('../server/fileHelpers', () => ({
    getAvailableFileName: h.getAvailableFileName,
    toPortableFileName: (name: string) => name.replaceAll(':', ' '),
}));
vi.mock('../server/unlockingHelpers', () => ({
    unlocking: async (_key: string, run: () => any) => run(),
}));
vi.mock('../slide-editor/canvas/CanvasItemBibleItem', () => ({
    default: h.BibleCanvasItem,
}));
vi.mock('../slide-editor/canvas/CanvasItemText', () => ({
    default: h.CanvasItem,
}));
vi.mock('../slide-editor/canvas/canvasHelpers', () => ({
    genTextStyle: (props: any) => ({
        fontSize: `${props.fontSize}px`,
        fontFamily: props.fontFamily,
    }),
    toTextDirection: (isRtl: boolean) => (isRtl ? 'rtl' : undefined),
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/errorHelpers', () => ({ handleError: h.error }));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: h.toast }));

import { generateBibleItemSlides } from './bibleSlidesHelpers';

function passage(bibleKey = 'KJV', start = 3, end = 5): BibleItem {
    return {
        bibleKey,
        target: {
            bookKey: 'GEN',
            chapter: 1,
            verseStart: start,
            verseEnd: end,
        },
        clone() {
            return passage(
                this.bibleKey,
                this.target.verseStart,
                this.target.verseEnd,
            );
        },
        async toTitle() {
            const { verseStart, verseEnd } = this.target;
            return `${this.bibleKey === 'KJV' ? 'Genesis' : '[xx] Genesis'} 1:${verseStart}${verseStart === verseEnd ? '' : `-${verseEnd}`}`;
        },
        async toTitleWithBibleKey() {
            return `(${this.bibleKey}) ${await this.toTitle()}`;
        },
        async toVerseTextList() {
            return [
                {
                    localeVerse: String(this.target.verseStart),
                    text: `${this.bibleKey} verse ${this.target.verseStart}`,
                },
            ];
        },
    } as BibleItem;
}

beforeEach(() => {
    vi.clearAllMocks();
    h.directory.isDirPathValid = true;
    h.getVerses.mockResolvedValue({ 3: 'verse 3', 4: 'verse 4', 5: 'verse 5' });
    h.getBibleInfoIsRtl.mockResolvedValue(false);
    h.getAvailableFileName.mockImplementation(async (_dir, name) => name);
    h.create.mockResolvedValue({ filePath: '/documents/new.ows' });
    Object.defineProperty(document, 'fonts', {
        configurable: true,
        value: { load: h.fontsLoad.mockResolvedValue([]) },
    });
});
afterEach(() => vi.restoreAllMocks());

describe('Bible slide generation', () => {
    test.each([0, -1, NaN, Infinity])(
        'rejects invalid font size %s before creating a document',
        async (fontSize) => {
            expect(
                await generateBibleItemSlides(passage(), [], { fontSize }),
            ).toBeNull();
            expect(h.create).not.toHaveBeenCalled();
        },
    );

    test('is named as Create Lyric names a song: every version, its own reference', async () => {
        await generateBibleItemSlides(passage(), ['NIV']);
        expect(h.getAvailableFileName).toHaveBeenCalledWith(
            '/documents',
            '(KJV) Genesis 1 3-5, (NIV) [xx] Genesis 1 3-5',
            '.ows',
        );
        expect(h.create.mock.calls[0][1]).toBe(
            '(KJV) Genesis 1 3-5, (NIV) [xx] Genesis 1 3-5',
        );
    });

    test('uses the available filename without overwriting a prior document', async () => {
        h.getAvailableFileName.mockResolvedValue('Genesis 1 3-5 KJV (2)');
        await generateBibleItemSlides(passage());
        expect(h.create.mock.calls[0][1]).toBe('Genesis 1 3-5 KJV (2)');
    });

    test('still refuses a one-chapter passage that ends before it starts', async () => {
        expect(await generateBibleItemSlides(passage('KJV', 5, 3))).toBeNull();
        expect(h.error).toHaveBeenCalledWith(
            new Error('Bible passage is unavailable'),
        );
        expect(h.getVerses).not.toHaveBeenCalled();
    });

    test('a verse that cannot be made into a slide item stops the whole document', async () => {
        vi.spyOn(h.BibleCanvasItem, 'fromBibleItem').mockResolvedValueOnce(
            null as any,
        );
        expect(await generateBibleItemSlides(passage())).toBeNull();
        expect(h.error).toHaveBeenCalledWith(
            new Error('Unable to create Bible canvas item'),
        );
        expect(h.toast).toHaveBeenCalledWith(
            'Generate Slides',
            'Unable to generate slides from this Bible item',
        );
        expect(h.create).not.toHaveBeenCalled();
        expect(h.directory.fireRefreshEvent).not.toHaveBeenCalled();
    });

    test('a next verse that cannot be read stops the whole document', async () => {
        const genUnreadablePassage = (): BibleItem => {
            const item = passage('KJV', 3, 4);
            item.clone = genUnreadablePassage;
            item.toVerseTextList = async () => null;
            return item;
        };
        expect(
            await generateBibleItemSlides(genUnreadablePassage()),
        ).toBeNull();
        expect(h.error).toHaveBeenCalledWith(
            new Error('Unable to read the next verse'),
        );
        expect(h.toast).toHaveBeenCalledWith(
            'Generate Slides',
            'Unable to generate slides from this Bible item',
        );
        expect(h.create).not.toHaveBeenCalled();
    });

    test('shrinks a verse too WIDE for its box until it fits', async () => {
        vi.spyOn(
            HTMLElement.prototype,
            'scrollWidth',
            'get',
        ).mockImplementation(function (this: HTMLElement) {
            return Number.parseFloat(this.style.fontSize) * 40;
        });
        await generateBibleItemSlides(passage());
        const slides = h.create.mock.calls[0][2];
        for (const slide of slides.slice(1)) {
            const [verse] = slide.canvasItems.slice(1);
            // Its box is 95% of 1920 wide, plus the renderer's padding.
            expect(verse.fontSize * 40).toBeLessThanOrEqual(
                1824 + verse.fontSize / 5 + 1,
            );
            // Shrunk only as far as the width asks, not to a speck.
            expect(verse.fontSize).toBeGreaterThan(45);
        }
        expect(document.body.children).toHaveLength(0);
    });

    test('reports unavailable storage or a failed save and does not refresh the list', async () => {
        h.directory.isDirPathValid = false;
        expect(await generateBibleItemSlides(passage())).toBeNull();
        expect(h.create).not.toHaveBeenCalled();
        h.directory.isDirPathValid = true;
        h.create.mockResolvedValue(null);
        expect(await generateBibleItemSlides(passage())).toBeNull();
        expect(h.directory.fireRefreshEvent).not.toHaveBeenCalled();
    });
});
