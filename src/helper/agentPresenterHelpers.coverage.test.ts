// @vitest-environment jsdom
/**
 * The Presenter state the sibling suite leaves out: which screens count
 * (deleted, empty and id-less ones do not; two on one slide are both named),
 * a song read through the stage the previewer draws, a run-sheet read that
 * fails without taking the answer with it, and `numberScreenSlidesForAgent`
 * -- a slide on a screen named by the number on its CARD, not its id.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    isPagePresenter: true,
    managers: [] as any[],
    selected: null as any,
    // `C:\docs\Deck.ows` -> the document `varyAppDocumentFromFilePath` gives.
    documents: {} as Record<string, any>,
    stageDocuments: {} as Record<string, any>,
    fromFilePath: vi.fn(),
    stageByStage: vi.fn(),
    runSheets: vi.fn(),
}));

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
vi.mock('../app-document-list/appDocumentHelpers', () => ({
    checkIsLyricFilePath: (filePath: string) => filePath.endsWith('.owl'),
    getSelectedVaryAppDocument: async () => h.selected,
    varyAppDocumentFromFilePath: h.fromFilePath,
}));
vi.mock('../lyric-list/lyricHelpers', () => ({
    getLyricAppDocumentStageByStage: h.stageByStage,
}));
vi.mock('../app-document-list/DocxAppDocument', () => ({
    default: { checkIsThisType: () => false },
}));
vi.mock('../app-document-list/PdfAppDocument', () => ({
    default: { checkIsThisType: () => false },
}));
vi.mock('../app-document-list/PptxAppDocument', () => ({
    default: { checkIsThisType: () => false },
}));
vi.mock('../app-document-list/PptxSlide', () => ({
    default: {
        checkIsThisType: (item: any) => Array.isArray(item?.subSlides),
        calcIndex: (i: number, j: number) => i + (j + 1) * 0.01,
    },
}));
vi.mock('./agentRunSheetHelpers', () => ({
    describeRunSheetsForAgent: h.runSheets,
}));
vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

import type { AgentScreensResultType } from './agentScreenHelpers';
import {
    describePresenterForAgent,
    describeSelectedDocumentForAgent,
    numberScreenSlidesForAgent,
} from './agentPresenterHelpers';

const DECK = 'C:\\docs\\Deck.ows';
const HYMN = 'C:\\docs\\Hymn.owl';

function genSlide(id: number, name: string, extra: Record<string, any> = {}) {
    return {
        id,
        name,
        filePath: extra.filePath ?? DECK,
        isDisabled: false,
        toJson: () => ({
            id,
            name,
            canvasItems: extra.text ? [{ type: 'text', text: extra.text }] : [],
        }),
        ...extra,
    };
}

function genDocument(filePath: string, slides: any[]) {
    return { filePath, getSlides: vi.fn(async () => slides) };
}

function genScreen(screenId: number, varySlideData: unknown) {
    return {
        screenId,
        isDeleted: false,
        screenVaryAppDocumentManager: { varySlideData },
    };
}

function genScreenSummary(screenId: number, slide: any) {
    return {
        screenId,
        isShowing: true,
        isLocked: false,
        isSelected: false,
        displayId: null,
        stage: 0,
        background: null,
        slide,
        bible: null,
        foreground: [],
        isBlank: slide === null,
    };
}

beforeEach(() => {
    h.isPagePresenter = true;
    h.managers = [];
    h.selected = null;
    h.documents = {};
    h.stageDocuments = {};
    h.fromFilePath.mockImplementation((filePath: string) => {
        return h.documents[filePath];
    });
    h.stageByStage.mockImplementation((filePath: string, stage: number) => {
        return [stage, h.stageDocuments[filePath]];
    });
    h.runSheets.mockResolvedValue({ openSheets: [] });
});

describe('which screens hold a slide of the selected document', () => {
    test('a slide on two screens names both, lowest first; deleted, empty and id-less screens are passed over', async () => {
        h.managers = [
            genScreen(2, { filePath: DECK, itemJson: { id: 0 } }),
            genScreen(1, { filePath: DECK, itemJson: { id: 0 } }),
            {
                ...genScreen(0, { filePath: DECK, itemJson: { id: 1 } }),
                isDeleted: true,
            },
            genScreen(3, null),
            genScreen(4, { filePath: DECK, itemJson: {} }),
            genScreen(5, { filePath: DECK, itemJson: { id: null } }),
        ];
        const described = await describeSelectedDocumentForAgent(
            genDocument(DECK, [
                genSlide(0, 'Welcome'),
                genSlide(1, 'Notices'),
            ]) as any,
        );
        expect(described.slides[0].onScreens).toEqual([1, 2]);
        // The deleted screen's slide is not "on screen".
        expect(described.slides[1]).not.toHaveProperty('onScreens');
        expect(described.onScreen?.n).toBe(1);
        expect(described.next?.n).toBe(2);
    });

    test('a disabled slide is marked and skipped as next; a slide with unreadable words keeps its number', async () => {
        h.managers = [genScreen(0, { filePath: DECK, itemJson: { id: 0 } })];
        const broken = {
            ...genSlide(2, 'Broken'),
            toJson: () => {
                throw new Error('bad slide');
            },
        };
        const described = await describeSelectedDocumentForAgent(
            genDocument(DECK, [
                genSlide(0, 'One', { text: 'First words' }),
                genSlide(1, 'Two', { isDisabled: true }),
                broken,
            ]) as any,
        );
        expect(described.slides[1]).toMatchObject({ n: 2, isDisabled: true });
        expect(described.slides[2]).toEqual({
            n: 3,
            name: 'Broken',
            find: 'Slide 3: Broken',
            text: null,
        });
        expect(described.next?.n).toBe(3);
        expect(described.previous?.n).toBe(3);
    });
});

describe('describePresenterForAgent', () => {
    test('a song is described through the stage the previewer draws, not its bare structure', async () => {
        h.selected = genDocument(HYMN, [genSlide(0, 'Verse 1')]);
        h.stageDocuments[HYMN] = genDocument(HYMN, [
            genSlide(0, 'Verse 1', { filePath: HYMN, text: 'Amazing grace' }),
            genSlide(1, 'Chorus', { filePath: HYMN, text: 'How sweet' }),
        ]);
        const state = await describePresenterForAgent();
        expect(h.stageByStage).toHaveBeenCalledWith(HYMN, 0);
        expect(state.selectedDocument).toMatchObject({
            name: 'Hymn',
            kind: 'song',
            slideCount: 2,
            next: { n: 1, text: 'Amazing grace' },
        });
        expect(h.selected.getSlides).not.toHaveBeenCalled();
    });

    test('a run sheet that cannot be read is answered as none, the selection still described', async () => {
        h.runSheets.mockRejectedValue(new Error('run sheet unreadable'));
        h.selected = genDocument(DECK, [genSlide(0, 'Only')]);
        const state = await describePresenterForAgent();
        expect(state.runSheet).toBeNull();
        expect(state.selectedDocument?.slideCount).toBe(1);
    });
});

describe('numberScreenSlidesForAgent', () => {
    test('a slide on a screen is named by the number on its card, not by its id', async () => {
        // Slide id 2 was moved to the front: its card reads 1.
        h.documents[DECK] = genDocument(DECK, [
            genSlide(2, ''),
            genSlide(0, 'Welcome'),
            genSlide(1, 'Notices'),
        ]);
        h.managers = [
            genScreen(0, { filePath: DECK, itemJson: { id: 2 } }),
            genScreen(1, { filePath: DECK, itemJson: { id: 1 } }),
        ];
        const result = {
            isAuthoritative: true,
            screens: [
                genScreenSummary(0, {
                    document: 'Deck',
                    kind: 'slide',
                    name: 'slide 2',
                    text: null,
                }),
                genScreenSummary(1, {
                    document: 'Deck',
                    kind: 'slide',
                    name: 'Notices',
                    text: null,
                }),
            ],
        } as AgentScreensResultType;
        const numbered = await numberScreenSlidesForAgent(result);
        expect(numbered).toBe(result);
        expect(numbered.screens[0].slide).toMatchObject({
            n: 1,
            find: 'Slide 1',
            // An unnamed slide was called by its id; now by its card.
            name: 'slide 1',
        });
        expect(numbered.screens[1].slide).toMatchObject({
            n: 3,
            find: 'Slide 3: Notices',
            name: 'Notices',
        });
        // One read of a document however many screens show it.
        expect(h.fromFilePath).toHaveBeenCalledTimes(1);
    });

    test('a song on a screen is numbered by its drawn stage', async () => {
        h.documents[HYMN] = genDocument(HYMN, []);
        h.stageDocuments[HYMN] = genDocument(HYMN, [
            genSlide(5, 'Verse 1', { filePath: HYMN }),
            genSlide(6, 'Chorus', { filePath: HYMN }),
        ]);
        h.managers = [genScreen(0, { filePath: HYMN, itemJson: { id: 6 } })];
        const result = {
            isAuthoritative: true,
            screens: [
                genScreenSummary(0, {
                    document: 'Hymn',
                    kind: 'song',
                    name: 'Chorus',
                    text: 'How sweet',
                }),
            ],
        } as AgentScreensResultType;
        await numberScreenSlidesForAgent(result);
        expect(result.screens[0].slide).toMatchObject({
            n: 2,
            find: 'Slide 2: Chorus',
        });
    });

    test('a screen with nothing, an unknown screen, a document that will not load, or a slide gone keeps what it had', async () => {
        h.documents['C:\\docs\\Gone.ows'] = {
            filePath: 'C:\\docs\\Gone.ows',
            getSlides: async () => {
                throw new Error('file is gone');
            },
        };
        h.documents[DECK] = genDocument(DECK, [genSlide(0, 'Welcome')]);
        h.managers = [
            genScreen(1, {
                filePath: 'C:\\docs\\Gone.ows',
                itemJson: { id: 0 },
            }),
            genScreen(2, { filePath: DECK, itemJson: { id: 9 } }),
            genScreen(3, { filePath: '', itemJson: { id: 0 } }),
            genScreen(4, { filePath: DECK, itemJson: { id: 0 } }),
        ];
        const slideOf = (name: string) => ({
            document: 'Deck',
            kind: 'slide',
            name,
            text: null,
        });
        const result = {
            isAuthoritative: true,
            screens: [
                genScreenSummary(0, slideOf('no manager')),
                genScreenSummary(1, slideOf('slide 0')),
                genScreenSummary(2, slideOf('slide 9')),
                genScreenSummary(3, slideOf('no file')),
                genScreenSummary(4, null),
            ],
        } as AgentScreensResultType;
        await numberScreenSlidesForAgent(result);
        expect(result.screens.map((screen) => screen.slide)).toEqual([
            slideOf('no manager'),
            slideOf('slide 0'),
            slideOf('slide 9'),
            slideOf('no file'),
            null,
        ]);
    });
});
