// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
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
        key === 'ពគប' ? 'app-Battambang' : '',
}));
vi.mock('../server/fileHelpers', () => ({
    getAvailableFileName: h.getAvailableFileName,
    toPortableFileName: (name: string) => name.replace(':', ' '),
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
            return `${this.bibleKey === 'KJV' ? 'Genesis' : 'លោកុប្បត្តិ'} 1:${verseStart}${verseStart === verseEnd ? '' : `-${verseEnd}`}`;
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
    test('creates the title and one verse per slide, with each selected translation and its own font', async () => {
        const source = passage();
        await generateBibleItemSlides(source, ['KJV', 'ពគប', 'ពគប']);
        const [dir, name, slides] = h.create.mock.calls[0];
        expect(dir).toBe('/documents');
        expect(name).toBe('Genesis 1 3-5 KJV-ពគប');
        expect(slides).toHaveLength(4);
        expect(slides.map((slide: any) => slide.id)).toEqual([0, 1, 2, 3]);
        expect(
            slides[0].canvasItems.slice(1).map((item: any) => item.text),
        ).toEqual(['(KJV) Genesis 1:3-5', '(ពគប) លោកុប្បត្តិ 1:3-5']);
        for (const [index, slide] of slides.slice(1).entries()) {
            const main = slide.canvasItems.filter(
                (item: any) => item.type === 'bible',
            );
            expect(main.map((item: any) => item.bibleKeys[0])).toEqual([
                'KJV',
                'ពគប',
            ]);
            expect(main.map((item: any) => item.fontFamily)).toEqual([
                'Arial',
                'app-Battambang',
            ]);
            expect(main.map((item: any) => item.bibleItemTarget)).toEqual(
                Array(2).fill({
                    bookKey: 'GEN',
                    chapter: 1,
                    verseStart: index + 3,
                    verseEnd: index + 3,
                }),
            );
            expect(main[0].top + main[0].height).toBeLessThan(main[1].top);
            expect(main[0].fontSize).toBeGreaterThan(0);
            expect(slide.canvasItems[0]).toMatchObject({
                id: 0,
                locked: true,
                backgroundColor: '#101b29db',
                left: 19,
                top: 10,
                width: 1882,
                height: 1060,
            });
            expect(
                new Set(slide.canvasItems.map((item: any) => item.id)).size,
            ).toBe(slide.canvasItems.length);
        }
        expect(source.target).toEqual({
            bookKey: 'GEN',
            chapter: 1,
            verseStart: 3,
            verseEnd: 5,
        });
        expect(source.bibleKey).toBe('KJV');
        expect(h.directory.fireRefreshEvent).toHaveBeenCalledOnce();
        expect(h.fontsLoad).toHaveBeenCalledWith(
            expect.stringContaining('app-Battambang'),
        );
        expect(document.body.children).toHaveLength(0);
    });

    test('places a smaller muted next verse at bottom right, and omits it from title and final slide', async () => {
        await generateBibleItemSlides(passage(), ['KJV', 'ពគប']);
        const slides = h.create.mock.calls[0][2];
        expect(slides[0].canvasItems).toHaveLength(3);
        expect(slides[3].canvasItems).toHaveLength(3);
        for (const [index, slide] of slides.slice(1, -1).entries()) {
            const previews = slide.canvasItems.slice(3);
            expect(previews).toHaveLength(2);
            for (const [language, preview] of previews.entries()) {
                const main = slide.canvasItems[language + 1];
                expect(preview.text).toContain(`verse ${index + 4}`);
                expect(preview.fontFamily).toBe(main.fontFamily);
                expect(preview.fontSize).toBeLessThan(main.fontSize);
                expect(preview.fontSize / main.fontSize).toBeCloseTo(0.85);
                expect(preview.color).toBe('#ffffff59');
                expect(preview.textHorizontalAlignment).toBe('right');
                expect(preview.top).toBeGreaterThan(
                    slide.canvasItems[2].top + slide.canvasItems[2].height,
                );
                expect(preview.top + preview.height).toBeLessThan(1080);
            }
        }
    });

    test('applies a chosen font size and light palette while preserving the inset and next-verse ratio', async () => {
        await generateBibleItemSlides(passage(), ['ពគប'], {
            fontSize: 32,
            theme: 'light',
        });
        const slides = h.create.mock.calls[0][2];
        for (const slide of slides) {
            expect(slide.canvasItems[0]).toMatchObject({
                backgroundColor: '#f4f3efdb',
                left: 19,
                top: 10,
                width: 1882,
                height: 1060,
            });
        }
        expect(slides[0].canvasItems[1].fontSize).toBeCloseTo(32 * (112 / 88));
        expect(slides[0].canvasItems[1].color).toBe('#182330');
        for (const slide of slides.slice(1)) {
            for (const main of slide.canvasItems.slice(1, 3)) {
                expect(main).toMatchObject({
                    fontSize: 32,
                    color: '#182330',
                    isLightTheme: true,
                });
            }
            for (const preview of slide.canvasItems.slice(3)) {
                expect(preview.fontSize).toBeCloseTo(32 * 0.85);
                expect(preview.color).toBe('#18233066');
            }
        }
    });

    test('follows each Bible own reading direction, and only its own', async () => {
        // The Aramaic Peshitta reads right to left; the Khmer beside it does
        // not, and one box must never take the other one direction.
        h.getBibleInfoIsRtl.mockImplementation(async (bibleKey: string) => {
            return bibleKey === 'Aramaic';
        });
        await generateBibleItemSlides(passage('Aramaic'), ['ពគប']);
        const slides = h.create.mock.calls[0][2];
        const [rtlTitle, ltrTitle] = slides[0].canvasItems.slice(1);
        expect(rtlTitle.textDirection).toBe('rtl');
        expect(ltrTitle.textDirection).toBeUndefined();
        for (const slide of slides.slice(1)) {
            const [rtlVerse, ltrVerse] = slide.canvasItems.slice(1, 3);
            expect(rtlVerse).toMatchObject({
                textDirection: 'rtl',
                textHorizontalAlignment: 'right',
            });
            expect(ltrVerse.textDirection).toBeUndefined();
            expect(ltrVerse.textHorizontalAlignment).toBe('left');
            const previews = slide.canvasItems.slice(3);
            if (previews.length === 0) {
                continue;
            }
            expect(previews[0]).toMatchObject({
                textDirection: 'rtl',
                textHorizontalAlignment: 'right',
            });
            expect(previews[1].textDirection).toBeUndefined();
            expect(previews[1].textHorizontalAlignment).toBe('left');
        }
    });

    test.each([0, -1, NaN, Infinity])(
        'rejects invalid font size %s before creating a document',
        async (fontSize) => {
            expect(
                await generateBibleItemSlides(passage(), [], { fontSize }),
            ).toBeNull();
            expect(h.create).not.toHaveBeenCalled();
        },
    );

    test('uses the KJV reference in the filename even when the source is Khmer', async () => {
        await generateBibleItemSlides(passage('ពគប', 3, 3));
        expect(h.create.mock.calls[0][1]).toBe('Genesis 1 3 ពគប');
        expect(h.create.mock.calls[0][2]).toHaveLength(2);
    });

    test('uses the available filename without overwriting a prior document', async () => {
        h.getAvailableFileName.mockResolvedValue('Genesis 1 3-5 KJV (2)');
        await generateBibleItemSlides(passage());
        expect(h.create.mock.calls[0][1]).toBe('Genesis 1 3-5 KJV (2)');
    });

    test('refuses a missing verse in any translation before writing anything', async () => {
        h.getVerses
            .mockResolvedValueOnce({ 3: 'a', 4: 'b', 5: 'c' })
            .mockResolvedValueOnce({ 3: 'a', 5: 'c' });
        expect(await generateBibleItemSlides(passage(), ['ពគប'])).toBeNull();
        expect(h.create).not.toHaveBeenCalled();
        expect(h.toast).toHaveBeenCalledWith(
            'Generate Slides',
            'Bible passage is unavailable in: ពគប',
        );
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

    test('fits overflowing text, keeps reading sizes consistent, and removes measurement nodes', async () => {
        vi.spyOn(
            HTMLElement.prototype,
            'scrollHeight',
            'get',
        ).mockImplementation(function (this: HTMLElement) {
            return Number.parseFloat(this.style.fontSize) * 30;
        });
        await generateBibleItemSlides(passage(), ['ពគប']);
        const slides = h.create.mock.calls[0][2];
        const sizes = slides
            .slice(1)
            .map((slide: any) => slide.canvasItems[1].fontSize);
        expect(new Set(sizes).size).toBe(1);
        expect(sizes[0]).toBeLessThan(88 / Math.sqrt(2));
        for (const slide of slides.slice(1, -1)) {
            const items = slide.canvasItems.slice(1);
            for (let i = 1; i < items.length; i++) {
                expect(items[i].top).toBeGreaterThan(
                    items[i - 1].top + items[i - 1].height,
                );
            }
            expect(items[2].fontSize / items[0].fontSize).toBeCloseTo(0.85);
            expect(items[3].top + items[3].height).toBeLessThan(1080);
        }
        expect(document.body.children).toHaveLength(0);
    });
});
