/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        isPagePresenter: true,
        managers: [] as any[],
        selected: null as any,
        locale: 'en',
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
vi.mock('../app-document-list/appDocumentHelpers', () => ({
    checkIsLyricFilePath: (filePath: string) => filePath.endsWith('.owl'),
    getSelectedVaryAppDocument: async () => h.selected,
}));
vi.mock('../app-document-list/DocxAppDocument', () => ({
    default: { checkIsThisType: (item: any) => item?.kind === 'docx' },
}));
vi.mock('../app-document-list/PdfAppDocument', () => ({
    default: { checkIsThisType: (item: any) => item?.kind === 'pdf' },
}));
vi.mock('../app-document-list/PptxAppDocument', () => ({
    default: { checkIsThisType: (item: any) => item?.kind === 'pptx' },
}));
vi.mock('../app-document-list/PptxSlide', () => ({
    default: {
        checkIsThisType: (item: any) => Array.isArray(item?.subSlides),
        calcIndex: (i: number, j: number) => i + (j + 1) * 0.01,
    },
}));
// The run sheet is its own module with its own test; here it answers empty,
// so this file stays about the selected document.
vi.mock('./agentRunSheetHelpers', () => ({
    describeRunSheetsForAgent: async () => ({ openSheets: [] }),
}));
vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) =>
        h.locale === 'km' && text === 'Slide' ? 'ស្លាយ' : text,
}));

import {
    describePresenterForAgent,
    describeSelectedDocumentForAgent,
    findNeighbourIndex,
    flattenVarySlides,
    pickOnScreenAndNeighbours,
    SLIDE_LIST_LIMIT,
    toDocumentKind,
    type AgentSlideSummaryType,
} from './agentPresenterHelpers';
import { toSlideAccessibleName } from '../app-document-presenter/items/slideAccessibleNameHelpers';

function genSlide(id: number, name: string, extra: any = {}) {
    return {
        id,
        name,
        filePath: 'C:\\docs\\Amazing Grace.ows',
        isDisabled: false,
        toJson: () => ({
            id,
            name,
            canvasItems: extra.text ? [{ type: 'text', text: extra.text }] : [],
        }),
        ...extra,
    };
}

function genDocument(slides: any[], filePath = 'C:\\docs\\Amazing Grace.ows') {
    return {
        filePath,
        getSlides: async () => slides,
    };
}

function genScreen(screenId: number, filePath: string, id: number) {
    return {
        screenId,
        isDeleted: false,
        screenVaryAppDocumentManager: {
            varySlideData: { filePath, itemJson: { id } },
        },
    };
}

describe('toSlideAccessibleName', () => {
    it('is the number and the name, as the card header shows them', () => {
        expect(toSlideAccessibleName(4, '(1)-Verse')).toBe(
            'Slide 4: (1)-Verse',
        );
        expect(toSlideAccessibleName(2.01, ' Sub  slide ')).toBe(
            'Slide 2.01: Sub slide',
        );
    });
    it('is the number alone when the slide has no name', () => {
        expect(toSlideAccessibleName(3, '')).toBe('Slide 3');
        expect(toSlideAccessibleName(3, undefined)).toBe('Slide 3');
    });
    it('follows the interface language, so a Khmer window answers to it', () => {
        h.locale = 'km';
        try {
            expect(toSlideAccessibleName(1, 'First')).toBe('ស្លាយ 1: First');
        } finally {
            h.locale = 'en';
        }
    });
});

describe('findNeighbourIndex', () => {
    const flags = (pattern: string) => {
        return [...pattern].map((char) => ({ isDisabled: char === 'x' }));
    };
    it('steps forward and back, wrapping at either end like the arrow keys', () => {
        expect(findNeighbourIndex(flags('ooo'), 0, true)).toBe(1);
        expect(findNeighbourIndex(flags('ooo'), 2, true)).toBe(0);
        expect(findNeighbourIndex(flags('ooo'), 0, false)).toBe(2);
    });
    it('steps over a disabled slide, in both directions', () => {
        expect(findNeighbourIndex(flags('oxo'), 0, true)).toBe(2);
        expect(findNeighbourIndex(flags('oxo'), 2, false)).toBe(0);
        expect(findNeighbourIndex(flags('oxx'), 0, true)).toBeNull();
    });
    it('has nowhere to go from the only enabled slide', () => {
        expect(findNeighbourIndex(flags('o'), 0, true)).toBeNull();
        expect(findNeighbourIndex(flags('xox'), 1, true)).toBeNull();
        expect(findNeighbourIndex(flags('xxx'), 1, true)).toBeNull();
        expect(findNeighbourIndex(flags(''), 0, true)).toBeNull();
        expect(findNeighbourIndex(flags('oo'), 5, true)).toBeNull();
    });
});

describe('pickOnScreenAndNeighbours', () => {
    const summary = (n: number, extra: Partial<AgentSlideSummaryType> = {}) => {
        return {
            n,
            name: `s${n}`,
            find: `Slide ${n}: s${n}`,
            text: null,
            ...extra,
        };
    };
    it('with nothing on a screen, next is the first slide and previous nothing', () => {
        const picked = pickOnScreenAndNeighbours([summary(1), summary(2)]);
        expect(picked.onScreen).toBeNull();
        expect(picked.next?.n).toBe(1);
        expect(picked.previous).toBeNull();
    });
    it('with nothing on a screen, next skips a disabled first slide', () => {
        const picked = pickOnScreenAndNeighbours([
            summary(1, { isDisabled: true }),
            summary(2),
        ]);
        expect(picked.next?.n).toBe(2);
    });
    it('takes the slide on the lowest screen id when two screens hold different ones', () => {
        const picked = pickOnScreenAndNeighbours([
            summary(1),
            summary(2, { onScreens: [1] }),
            summary(3, { onScreens: [0] }),
        ]);
        expect(picked.onScreen?.n).toBe(3);
        expect(picked.next?.n).toBe(1);
        expect(picked.previous?.n).toBe(2);
    });
});

describe('flattenVarySlides', () => {
    it('numbers a PPTX sub-slide the way its badge does', () => {
        const flat = flattenVarySlides([
            genSlide(0, 'a') as any,
            genSlide(1, 'b', {
                subSlides: [genSlide(10, 'b1'), genSlide(11, 'b2')],
            }) as any,
            genSlide(2, 'c') as any,
        ]);
        expect(flat.map((one) => one.viewIndex)).toEqual([1, 2, 2.01, 2.02, 3]);
    });
});

describe('toDocumentKind', () => {
    it('names the kinds a volunteer would', () => {
        expect(toDocumentKind({ kind: 'pdf', filePath: 'a.pdf' } as any)).toBe(
            'PDF',
        );
        expect(
            toDocumentKind({ kind: 'pptx', filePath: 'a.pptx' } as any),
        ).toBe('PowerPoint');
        expect(
            toDocumentKind({ kind: 'docx', filePath: 'a.docx' } as any),
        ).toBe('Word document');
        expect(toDocumentKind({ filePath: 'a.owl' } as any)).toBe('song');
        expect(toDocumentKind({ filePath: 'a.ows' } as any)).toBe(
            'slide document',
        );
    });
});

describe('describeSelectedDocumentForAgent', () => {
    it('lists the slides with their words, marks the one on screen and names the next', async () => {
        const filePath = 'C:\\docs\\Amazing Grace.ows';
        const slides = [
            genSlide(0, 'Verse 1', {
                text: 'Amazing grace how sweet the sound',
            }),
            genSlide(1, 'Verse 2', {
                text: "'Twas grace that taught my heart to fear",
            }),
            genSlide(2, 'Verse 3', { text: 'Through many dangers' }),
        ];
        h.managers = [genScreen(0, filePath, 1)];
        const described = await describeSelectedDocumentForAgent(
            genDocument(slides, filePath) as any,
        );
        expect(described.name).toBe('Amazing Grace');
        expect(described.kind).toBe('slide document');
        expect(described.slideCount).toBe(3);
        expect(described.slides.map((one) => one.find)).toEqual([
            'Slide 1: Verse 1',
            'Slide 2: Verse 2',
            'Slide 3: Verse 3',
        ]);
        expect(described.slides[1].onScreens).toEqual([0]);
        expect(described.slides[0].onScreens).toBeUndefined();
        expect(described.onScreen?.n).toBe(2);
        expect(described.next?.find).toBe('Slide 3: Verse 3');
        expect(described.next?.text).toBe('Through many dangers');
        expect(described.previous?.n).toBe(1);
        expect(described.moreCount).toBeUndefined();
    });
    it('ignores a screen holding a slide of another document', async () => {
        h.managers = [genScreen(0, 'C:\\docs\\Other.ows', 0)];
        const described = await describeSelectedDocumentForAgent(
            genDocument([genSlide(0, 'Only')]) as any,
        );
        expect(described.onScreen).toBeNull();
        expect(described.next?.n).toBe(1);
    });
    it('cuts a long document to the first slides and counts the rest', async () => {
        h.managers = [];
        const slides = Array.from({ length: SLIDE_LIST_LIMIT + 10 }, (_, i) => {
            return genSlide(i, `page ${i + 1}`);
        });
        const described = await describeSelectedDocumentForAgent(
            genDocument(slides) as any,
        );
        expect(described.slides).toHaveLength(SLIDE_LIST_LIMIT);
        expect(described.moreCount).toBe(10);
        expect(described.slideCount).toBe(SLIDE_LIST_LIMIT + 10);
    });
    it("cuts a slide's words to a line and never carries a path", async () => {
        h.managers = [];
        const described = await describeSelectedDocumentForAgent(
            genDocument([
                genSlide(0, 'Long', { text: 'word '.repeat(40).trim() }),
            ]) as any,
        );
        expect(described.slides[0].text?.length).toBeLessThanOrEqual(61);
        expect(described.slides[0].text?.endsWith('…')).toBe(true);
        expect(JSON.stringify(described)).not.toContain('C:\\\\');
    });
});

describe('describePresenterForAgent', () => {
    it('is not authoritative off the presenter page, and says nothing else', async () => {
        h.isPagePresenter = false;
        try {
            const state = await describePresenterForAgent();
            expect(state).toEqual({
                isAuthoritative: false,
                selectedDocument: null,
                runSheet: null,
            });
        } finally {
            h.isPagePresenter = true;
        }
    });
    it('answers null with nothing selected', async () => {
        h.selected = null;
        const state = await describePresenterForAgent();
        // The run sheet is read whatever the selection: a service driven
        // from a run sheet may have nothing selected at all.
        expect(state).toEqual({
            isAuthoritative: true,
            selectedDocument: null,
            runSheet: { openSheets: [] },
        });
    });
    it('describes the selected document', async () => {
        h.managers = [];
        h.selected = genDocument([genSlide(0, 'One')]);
        const state = await describePresenterForAgent();
        expect(state.selectedDocument?.name).toBe('Amazing Grace');
        expect(state.selectedDocument?.next?.find).toBe('Slide 1: One');
    });
});
