/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';

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

import {
    findNextRunIndex,
    pickRunNext,
    toRunLineKind,
    type AgentRunLineType,
} from './agentRunSheetHelpers';

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
