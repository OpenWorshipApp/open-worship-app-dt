/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runSheetMocks = vi.hoisted(() => ({
    itemsByPath: new Map<string, any[] | null>(),
    slidesByPath: new Map<string, any[] | null>(),
    cursorByPath: new Map<string, number>(),
    childByPath: new Map<string, number | null>(),
    openPaths: [] as string[],
    availablePaths: [] as string[] | null,
    failingPaths: new Set<string>(),
}));

// `fileHelpers` reaches `appProvider` on load (memory
// `appprovider-mock-node-env`); stubbed down to what loading needs. Nothing
// under test here touches a file or a window.
vi.mock('../server/appProvider', () => ({
    default: {
        isPagePresenter: true,
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
vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));
vi.mock('../presenting-flow/PresentingFlow', () => ({
    default: {
        getInstance: (filePath: string) => ({
            getItems: async () => {
                if (runSheetMocks.failingPaths.has(filePath)) {
                    throw new Error('Cannot read run sheet');
                }
                return runSheetMocks.itemsByPath.get(filePath) ?? null;
            },
        }),
    },
}));
vi.mock('../presenting-flow/presentingFlowPreviewFloatingHelpers', () => ({
    getPresentingFlowPreviewFilePaths: () => runSheetMocks.openPaths,
    resolvePresentingFlowPreviewSelectedIndex: (filePath: string) =>
        runSheetMocks.cursorByPath.get(filePath) ?? -1,
    getPresentingFlowPreviewSelectedChildId: (filePath: string) =>
        runSheetMocks.childByPath.get(filePath) ?? null,
    toPresentingFlowPreviewItemKey: (item: any) => item.title,
}));
vi.mock('../presenting-flow/presentingFlowDocumentHelpers', () => ({
    loadVaryAppDocumentSlides: async (filePath: string) =>
        runSheetMocks.slidesByPath.get(filePath) ?? null,
}));
vi.mock('./DirSource', () => ({
    default: {
        getInstance: async () => ({
            getFilePaths: async () => runSheetMocks.availablePaths,
        }),
    },
}));

import {
    findNextRunIndex,
    pickRunNext,
    toRunLineKind,
    describeRunSheetForAgent,
    describeRunSheetsForAgent,
    RUN_LINE_LIST_LIMIT,
    type AgentRunLineType,
} from './agentRunSheetHelpers';

function genItem(title: string, extra: Record<string, any> = {}) {
    return {
        title,
        type: 'slide',
        isAction: false,
        isError: false,
        isBibleItem: false,
        isBackground: false,
        isForeground: false,
        isAudio: false,
        isAppDocument: false,
        isDisabled: false,
        itemFilePath: null,
        checkIsVarySlideDisabled: () => false,
        ...extra,
    };
}

function genLines(...flags: boolean[]): AgentRunLineType[] {
    return flags.map((isParked, i) => {
        const line: AgentRunLineType = {
            n: i + 1,
            title: `Line ${i + 1}`,
            kind: 'slide',
        };
        if (isParked) {
            line.isParked = true;
        }
        return line;
    });
}

// The run player's own rule (`findNextPresentingFlowPreviewIndex`): forward
// only, never wrapping, PARKED the only reason to step over a line. Not held to
// that function directly -- importing it drags the whole presenter graph into
// a unit test -- so the cases are the ones its own comments name.
describe('findNextRunIndex', () => {
    const flags = [false, true, false, true, true, false].map((isParked) => {
        return { isParked };
    });
    it('steps over parked lines only, and stops on everything else', () => {
        expect(findNextRunIndex(flags, -1)).toBe(0);
        expect(findNextRunIndex(flags, 0)).toBe(2);
        expect(findNextRunIndex(flags, 2)).toBe(5);
    });
    it('never wraps', () => {
        expect(findNextRunIndex(flags, 5)).toBe(-1);
        expect(findNextRunIndex([], -1)).toBe(-1);
    });
});

describe('pickRunNext', () => {
    const slides = [
        { n: 1, name: 'Verse 1', isParked: false },
        { n: 2, name: 'Chorus', isParked: true },
        { n: 3, name: 'Verse 2', isParked: false },
    ];

    it('with nothing pressed yet, next is the first line that is not parked', () => {
        const { next, isAtEnd } = pickRunNext(
            genLines(true, false, false),
            -1,
            null,
            -1,
        );
        expect(next?.n).toBe(2);
        expect(isAtEnd).toBe(false);
    });

    it('inside a document the next press is the next slide that is not parked', () => {
        const lines = genLines(false, false);
        const { next } = pickRunNext(lines, 0, slides, 0);
        expect(next?.n).toBe(1);
        expect(next?.slide).toEqual({ n: 3, name: 'Verse 2' });
    });

    it('on the last slide the run leaves the document for the next line', () => {
        const lines = genLines(false, false);
        const { next } = pickRunNext(lines, 0, slides, 2);
        expect(next?.n).toBe(2);
        expect(next?.slide).toBeUndefined();
    });

    it('landed on a document but not yet inside it, next is its first slide', () => {
        const lines = genLines(false, false);
        const { next } = pickRunNext(lines, 0, slides, -1);
        expect(next?.slide).toEqual({ n: 1, name: 'Verse 1' });
    });

    it('past the last line says so, and an empty sheet does not claim to have ended', () => {
        expect(pickRunNext(genLines(false, true), 0, null, -1)).toEqual({
            next: null,
            isAtEnd: true,
        });
        expect(pickRunNext([], -1, null, -1)).toEqual({
            next: null,
            isAtEnd: false,
        });
    });
});

describe('toRunLineKind', () => {
    const base = {
        type: 'slide',
        isAction: false,
        isError: false,
        isBibleItem: false,
        isBackground: false,
        isForeground: false,
        isAudio: false,
        isAppDocument: false,
        itemFilePath: null,
    };
    it('names a whole song and a slide of one apart', () => {
        expect(
            toRunLineKind({
                ...base,
                isAppDocument: true,
                itemFilePath: 'x/a.owl',
            }),
        ).toBe('song');
        expect(
            toRunLineKind({
                ...base,
                type: 'lyric-slide',
                itemFilePath: 'x/a.owl',
            }),
        ).toBe('song slide');
        expect(
            toRunLineKind({
                ...base,
                isAppDocument: true,
                itemFilePath: 'x/a.ows',
            }),
        ).toBe('document');
        expect(
            toRunLineKind({
                ...base,
                type: 'pdfSlide',
                itemFilePath: 'x/a.pdf',
            }),
        ).toBe('PDF page');
    });
    it('a damaged line and an action are said as such before anything else', () => {
        expect(toRunLineKind({ ...base, isError: true, isAction: true })).toBe(
            'damaged line',
        );
        expect(
            toRunLineKind({ ...base, isAction: true, isBibleItem: true }),
        ).toBe('action');
        expect(toRunLineKind({ ...base, isBibleItem: true })).toBe(
            'Bible passage',
        );
    });
});

describe('assistant run-sheet state', () => {
    beforeEach(() => {
        runSheetMocks.itemsByPath.clear();
        runSheetMocks.slidesByPath.clear();
        runSheetMocks.cursorByPath.clear();
        runSheetMocks.childByPath.clear();
        runSheetMocks.openPaths = [];
        runSheetMocks.availablePaths = [];
        runSheetMocks.failingPaths.clear();
    });

    it('reports a document cursor, skips parked slides and truncates only the line list', async () => {
        const filePath = '/runs/Sunday.flow';
        const documentPath = '/songs/Welcome.owl';
        const items = [
            genItem('  Welcome  song  ', {
                isAppDocument: true,
                itemFilePath: documentPath,
                checkIsVarySlideDisabled: (slide: { id: number }) =>
                    slide.id === 12,
            }),
            ...Array.from({ length: RUN_LINE_LIST_LIMIT }, (_, index) =>
                genItem(`Line ${index + 2}`),
            ),
        ];
        runSheetMocks.itemsByPath.set(filePath, items);
        runSheetMocks.slidesByPath.set(documentPath, [
            { id: 11, name: ' Verse  1 ' },
            { id: 12, name: 'Chorus' },
            { id: 13, name: ' Verse  2 ' },
        ]);
        runSheetMocks.cursorByPath.set(filePath, 0);
        runSheetMocks.childByPath.set(filePath, 11);

        const sheet = await describeRunSheetForAgent(filePath);
        expect(sheet?.name).toContain('Sunday');
        expect(sheet?.lineCount).toBe(RUN_LINE_LIST_LIMIT + 1);
        expect(sheet?.lines).toHaveLength(RUN_LINE_LIST_LIMIT);
        expect(sheet?.moreCount).toBe(1);
        expect(sheet?.lines[0]).toMatchObject({
            n: 1,
            title: 'Welcome song',
            kind: 'song',
        });
        expect(sheet?.cursor?.slide).toEqual({
            n: 1,
            name: 'Verse 1',
            isLast: false,
        });
        expect(sheet?.next?.slide).toEqual({ n: 3, name: 'Verse 2' });
        expect(sheet?.isAtEnd).toBeUndefined();
    });

    it('moves past a document at its last playable slide and stops at the end', async () => {
        const filePath = '/runs/Evening.flow';
        const documentPath = '/songs/Closing.owl';
        runSheetMocks.itemsByPath.set(filePath, [
            genItem('Song', {
                isAppDocument: true,
                itemFilePath: documentPath,
            }),
            genItem('Parked announcement', { isDisabled: true }),
            genItem('Dismissal', { isAction: true }),
        ]);
        runSheetMocks.slidesByPath.set(documentPath, [
            { id: 4, name: 'Last verse' },
        ]);
        runSheetMocks.cursorByPath.set(filePath, 0);
        runSheetMocks.childByPath.set(filePath, 4);
        const sheet = await describeRunSheetForAgent(filePath);
        expect(sheet?.cursor?.slide?.isLast).toBe(true);
        expect(sheet?.lines[1].isParked).toBe(true);
        expect(sheet?.next).toMatchObject({ n: 3, kind: 'action' });

        runSheetMocks.cursorByPath.set(filePath, 2);
        const last = await describeRunSheetForAgent(filePath);
        expect(last?.next).toBeNull();
        expect(last?.isAtEnd).toBe(true);
    });

    it('lists available sheets when no run player is open', async () => {
        runSheetMocks.availablePaths = [
            '/runs/Morning.flow',
            '/runs/Evening.flow',
        ];
        const state = await describeRunSheetsForAgent();
        expect(state.openSheets).toEqual([]);
        expect(state.availableSheets).toHaveLength(2);
        expect(state.availableSheets?.[0]).toContain('Morning');
        expect(state.note).toContain('no "next" yet');

        runSheetMocks.availablePaths = [];
        const empty = await describeRunSheetsForAgent();
        expect(empty.availableSheets).toEqual([]);
        expect(empty.note).toContain('lists none');
    });

    it('keeps readable open sheets when another player fails to load', async () => {
        const goodPath = '/runs/Good.flow';
        const badPath = '/runs/Broken.flow';
        runSheetMocks.openPaths = [badPath, goodPath];
        runSheetMocks.failingPaths.add(badPath);
        runSheetMocks.itemsByPath.set(goodPath, [
            genItem('Parked', { isDisabled: true }),
            genItem('Reading', { isBibleItem: true }),
        ]);
        const state = await describeRunSheetsForAgent();
        expect(state.openSheets).toHaveLength(1);
        expect(state.openSheets[0].name).toContain('Good');
        expect(state.openSheets[0].cursor).toBeNull();
        expect(state.openSheets[0].next).toMatchObject({
            n: 2,
            kind: 'Bible passage',
        });
        expect(state.availableSheets).toBeUndefined();
    });

    it('returns null for a run player whose sheet disappeared', async () => {
        runSheetMocks.itemsByPath.set('/runs/Gone.flow', null);
        expect(await describeRunSheetForAgent('/runs/Gone.flow')).toBeNull();
    });
});
