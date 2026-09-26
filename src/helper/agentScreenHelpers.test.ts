/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        isPagePresenter: true,
        managers: [] as any[],
    };
});

vi.mock('../server/appProvider', () => ({
    default: {
        get isPagePresenter() {
            return h.isPagePresenter;
        },
        pathUtils: {
            basename: (filePath: string) => {
                return filePath.split(/[\\/]/).pop() ?? '';
            },
            dirname: (filePath: string) => {
                return filePath.replace(/[\\/][^\\/]*$/, '');
            },
        },
        systemUtils: { isDev: false },
    },
}));
vi.mock('../_screen/managers/screenManagerHelpers', () => ({
    getAllScreenManagers: () => h.managers,
}));

import {
    describeScreensForAgent,
    toBackgroundSummary,
    toBibleSummary,
    toForegroundSummary,
    toSlideSummary,
    toSungText,
} from './agentScreenHelpers';

// The markup open-lyric renders for one chorded line, as it is persisted in
// the on-screen setting: the chord sits INSIDE the word it lands on.
const CHORDED_LINE_HTML =
    '<div class="ol-song-view__section-tile"><section>' +
    '<div class="ol-song-view__section-line">' +
    '<h2 class="ol-song-view__section-title">Verse 2:</h2></div>' +
    '<div class="ol-preview-lines"><div class="ol-preview-line">' +
    '<span class="ol-preview-line__content">' +
    '<span class="ol-preview-lyric-segment">' +
    '<span class="ol-preview-lyric-segment__chord ' +
    'ol-preview-lyric-segment__chord--empty">&nbsp;</span>' +
    '<span class="ol-preview-lyric-segment__text">Amaz</span></span>' +
    '<span class="ol-preview-lyric-segment">' +
    '<span class="ol-preview-lyric-segment__chord">' +
    '<span class="ol-preview-bar" aria-hidden="true">|</span>' +
    '<button class="ol-preview-chord" aria-hidden="true">' +
    '<span class="ol-preview-chord__bracket">[</span>' +
    '<span class="ol-preview-chord__label">G</span>' +
    '<span class="ol-preview-chord__bracket">]</span></button></span>' +
    '<span class="ol-preview-lyric-segment__text">ing grace, how</span>' +
    '</span></span></div>' +
    '<div class="ol-preview-line"><span class="ol-preview-line__content">' +
    'sweet the sound</span></div>' +
    '</div></section></div>';

function genManager(overrides: Record<string, any> = {}) {
    return {
        screenId: 0,
        isShowing: false,
        isLocked: false,
        isSelected: true,
        isDeleted: false,
        stage: 0,
        displayId: 42,
        screenBackgroundManager: { backgroundSrc: null },
        screenVaryAppDocumentManager: { varySlideData: null },
        screenBibleManager: { screenViewData: null },
        screenForegroundManager: {
            foregroundData: {
                countdownData: null,
                stopwatchData: null,
                timeDataList: [],
                marqueeTopData: null,
                marqueeBottomData: null,
                quickTextData: null,
                cameraDataList: [],
                webDataList: [],
            },
        },
        ...overrides,
    };
}

describe('toSungText', () => {
    it('drops the chord boxes and closes the word back up', () => {
        expect(toSungText(CHORDED_LINE_HTML)).toBe(
            'Verse 2: Amazing grace, how sweet the sound',
        );
    });
    it('keeps a space where two lines meet', () => {
        expect(toSungText('<div>first line</div><div>second</div>')).toBe(
            'first line second',
        );
    });
});

describe('toSlideSummary', () => {
    it('names the document without its extension and the slide by its own name', () => {
        const summary = toSlideSummary({
            filePath: 'C:\\data\\documents\\Amazing Grace.owl',
            itemJson: {
                id: 7,
                name: 'Verse 2',
                type: 'lyric-slide',
                stage: 0,
                canvasItems: [{ type: 'html', html: CHORDED_LINE_HTML }],
                metadata: { width: 1920, height: 1080 },
            } as any,
            isRenderFullWidth: false,
        });
        expect(summary).toEqual({
            document: 'Amazing Grace',
            kind: 'song',
            name: 'Verse 2',
            text: 'Verse 2: Amazing grace, how sweet the sound',
        });
    });
    it('cuts a long slide short and says so with an ellipsis', () => {
        const summary = toSlideSummary({
            filePath: '/x/Sunday.ows',
            itemJson: {
                id: 1,
                type: 'slide',
                canvasItems: [
                    { type: 'text', text: 'word '.repeat(80) },
                    { type: 'bible' },
                ],
                metadata: {},
            } as any,
            isRenderFullWidth: false,
        });
        expect(summary?.kind).toBe('slide');
        expect(summary?.name).toBe('slide 1');
        expect(summary?.text?.length).toBeLessThanOrEqual(161);
        expect(summary?.text?.endsWith('…')).toBe(true);
    });
    it('reads a PDF page by number, with no words to give', () => {
        const summary = toSlideSummary({
            filePath: '/x/notes.pdf',
            itemJson: {
                id: 3,
                type: 'pdf-slide',
                pdfPageNumber: 4,
                imagePreviewSrc: '',
                metadata: { width: 1, height: 1 },
            } as any,
            isRenderFullWidth: true,
        });
        expect(summary).toEqual({
            document: 'notes',
            kind: 'PDF page',
            name: 'page 4',
            text: null,
        });
    });
});

describe('toBackgroundSummary', () => {
    it('names a file by its basename and a colour by its value', () => {
        expect(
            toBackgroundSummary({ type: 'video', src: '/bg/videos/sea.mp4' }),
        ).toEqual({ kind: 'video', name: 'sea.mp4' });
        expect(toBackgroundSummary({ type: 'color', src: '#112233' })).toEqual({
            kind: 'color',
            name: '#112233',
        });
        expect(toBackgroundSummary(null)).toBeNull();
    });
});

describe('toBibleSummary', () => {
    it('reads the reference and the version off the rendered list', () => {
        expect(
            toBibleSummary({
                type: 'bible-item',
                locale: 'en',
                scroll: 0,
                selectedKJVVerseKey: null,
                bibleItemData: {
                    renderedList: [
                        { bibleKey: 'KJV', title: 'John 3:16', verses: [] },
                        { bibleKey: 'KHSV', title: 'យ៉ូហាន 3:16', verses: [] },
                    ] as any,
                    bibleItem: {
                        id: 1,
                        bibleKey: 'KJV',
                        target: {
                            bookKey: 'JHN',
                            chapter: 3,
                            verseStart: 16,
                            verseEnd: 16,
                        },
                        metadata: {},
                    },
                },
            }),
        ).toEqual({
            reference: 'John 3:16',
            version: 'KJV',
            versions: ['KJV', 'KHSV'],
        });
    });
});

describe('toForegroundSummary', () => {
    it('names each widget and what it is showing', () => {
        const items = toForegroundSummary({
            messageDataList: [],
            countdownData: null,
            stopwatchData: { dateTime: new Date() },
            timeDataList: [
                {
                    id: 'a',
                    timezoneMinuteOffset: 0,
                    title: 'Phnom Penh',
                },
            ],
            marqueeTopData: { text: 'Welcome <b>everyone</b>' },
            marqueeBottomData: null,
            quickTextData: null,
            cameraDataList: [],
            webDataList: [],
            videoDataList: [{ filePath: 'C:\\media\\snow.mp4' }],
            imageDataList: [{ filePath: '/media/logo.png' }],
        });
        expect(items).toEqual([
            'stopwatch',
            'clock "Phnom Penh"',
            'marquee at the top: "Welcome <b>everyone</b>"',
            'video snow.mp4',
            'picture logo.png',
        ]);
    });
});

describe('describeScreensForAgent', () => {
    it('reports one screen per manager, blank or not, in id order', () => {
        h.isPagePresenter = true;
        h.managers = [
            genManager({ screenId: 1, isShowing: true }),
            genManager({
                screenId: 0,
                screenBibleManager: {
                    screenViewData: {
                        type: 'bible-item',
                        locale: 'en',
                        scroll: 0,
                        selectedKJVVerseKey: null,
                        bibleItemData: {
                            renderedList: [
                                {
                                    bibleKey: 'KJV',
                                    title: 'Psalm 23:1',
                                    verses: [],
                                },
                            ],
                            bibleItem: { id: 1, bibleKey: 'KJV' },
                        },
                    },
                },
            }),
            genManager({ screenId: 2, isDeleted: true }),
        ];
        const result = describeScreensForAgent();
        expect(result.isAuthoritative).toBe(true);
        expect(result.screens.map((screen) => screen.screenId)).toEqual([0, 1]);
        expect(result.screens[0].bible).toEqual({
            reference: 'Psalm 23:1',
            version: 'KJV',
        });
        expect(result.screens[0].isBlank).toBe(false);
        expect(result.screens[1].isBlank).toBe(true);
        expect(result.screens[1].isShowing).toBe(true);
    });
    it('says when it is not the presenter answering', () => {
        h.isPagePresenter = false;
        h.managers = [];
        expect(describeScreensForAgent()).toEqual({
            isAuthoritative: false,
            screens: [],
        });
    });
});
