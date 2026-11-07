import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { colorNotes } = vi.hoisted(() => ({
    colorNotes: new Map<string, string | null>(),
}));

vi.mock('./FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            filePath,
            colorNote: colorNotes.get(filePath),
        }),
    },
}));

import {
    genColorBar,
    genColorNoteDataList,
    genFilePathColorMap,
    UNKNOWN_COLOR_NOTE,
} from './colorNoteHelpers';

describe('genColorBar', () => {
    test('items with no colour note are divided by a plain rule', () => {
        expect(renderToStaticMarkup(genColorBar(UNKNOWN_COLOR_NOTE))).toBe(
            '<hr/>',
        );
    });

    test('a colour group is headed by a one-pixel bar in its colour', () => {
        expect(renderToStaticMarkup(genColorBar('#ff8800'))).toBe(
            '<hr style="background-color:#ff8800;height:1px;border:0"/>',
        );
    });
});

describe('grouping file paths by colour note', () => {
    beforeEach(() => {
        colorNotes.clear();
    });

    test('each path lands under its note, and unmarked ones under unknown', () => {
        colorNotes.set('/songs/a.lyric', 'red');
        colorNotes.set('/songs/c.lyric', 'blue');
        colorNotes.set('/songs/d.lyric', 'red');
        colorNotes.set('/songs/e.lyric', null);
        const colorMap = genFilePathColorMap([
            '/songs/a.lyric',
            '/songs/b.lyric',
            '/songs/c.lyric',
            '/songs/d.lyric',
            '/songs/e.lyric',
        ]);
        expect(colorMap).toEqual({
            [UNKNOWN_COLOR_NOTE]: ['/songs/b.lyric', '/songs/e.lyric'],
            red: ['/songs/a.lyric', '/songs/d.lyric'],
            blue: ['/songs/c.lyric'],
        });
        // The groups are listed by colour, with the unmarked ones last.
        expect(genColorNoteDataList(colorMap)).toEqual([
            'blue',
            'red',
            UNKNOWN_COLOR_NOTE,
        ]);
    });
});
