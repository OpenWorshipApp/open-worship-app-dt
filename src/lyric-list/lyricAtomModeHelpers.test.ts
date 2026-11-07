// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

// Mocked WHOLESALE, as in `lyricStageStyleHelpers.test.ts`: the real module
// reaches `appProvider`, which this test has no use for.
const h = vi.hoisted(() => ({
    getSetting: vi.fn((_name: string): string | null => null),
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: h.getSetting,
}));

// monaco-editor's clipboard contrib (pulled in by open-lyric) probes these at
// module-eval time and jsdom implements neither. open-lyric is loaded HERE,
// before any test, so its seconds of monaco are not charged to the first
// test's timeout (memory `long-text-show`).
(document as any).queryCommandSupported ??= () => false;
(document as any).execCommand ??= () => false;
const { OpenLyric } = await import('open-lyric');
const {
    getIsLyricAtomMode,
    getLyricAtomLineCounts,
    LYRIC_ATOM_MODE_SETTING_NAME,
    splitLyricPartHtml,
    toLyricAtomLines,
} = await import('./lyricAtomModeHelpers');

beforeEach(() => {
    h.getSetting.mockReset();
    h.getSetting.mockReturnValue(null);
});

// The data-editor-line of every line a piece of markup still holds.
function readLines(html: string) {
    const template = document.createElement('template');
    template.innerHTML = html;
    return Array.from(
        template.content.querySelectorAll('.ol-preview-line'),
    ).map((line) => {
        return Number(line.getAttribute('data-editor-line'));
    });
}

function genLine(lineNumber: number, content: string, className = '') {
    return (
        `<div class="ol-preview-line${className}" ` +
        `data-editor-line="${lineNumber}" style="color: red;">${content}</div>`
    );
}

function genPart(lines: string[]) {
    return (
        '<div class="ol-song-view__section-tile" style="height: 400px;">' +
        '<div class="ol-song-view__section-title">Verse</div>' +
        `<div class="ol-preview-lines">${lines.join('')}</div></div>`
    );
}

const CHORD = '<button class="ol-preview-chord">G</button>';

describe('the switch', () => {
    test('is on only when the setting says true', () => {
        expect(getIsLyricAtomMode()).toBe(false);
        h.getSetting.mockReturnValue('false');
        expect(getIsLyricAtomMode()).toBe(false);
        h.getSetting.mockReturnValue('true');
        expect(getIsLyricAtomMode()).toBe(true);
        expect(h.getSetting).toHaveBeenCalledWith(LYRIC_ATOM_MODE_SETTING_NAME);
    });
});

describe('toLyricAtomLines', () => {
    test('keeps inner blank lines, never the ones around the part', () => {
        expect(toLyricAtomLines('\n\nOne\r\n\nTwo\n \n')).toEqual([
            'One',
            '',
            'Two',
        ]);
        expect(toLyricAtomLines('')).toEqual([]);
    });
});

describe('splitLyricPartHtml', () => {
    test('one line a piece, the part around it and every style kept', () => {
        const pieces = splitLyricPartHtml(
            genPart([
                genLine(1, 'One'),
                genLine(2, '&nbsp;'),
                genLine(3, 'Two'),
            ]),
            3,
        );
        expect(pieces.map(readLines)).toEqual([[1], [2], [3]]);
        expect(pieces[2]).toContain('Two');
        expect(pieces[2]).not.toContain('One');
        expect(pieces[2]).toContain('style="color: red;"');
        expect(pieces[2]).toContain('ol-song-view__section-title');
        expect(pieces[2]).toContain('style="height: 400px;"');
    });

    test('a comment, a progression or a chord line rides with the NEXT line', () => {
        const pieces = splitLyricPartHtml(
            genPart([
                genLine(1, '// softly', ' ol-preview-line--comment'),
                genLine(2, 'One'),
                genLine(3, CHORD),
                genLine(4, 'Two'),
                genLine(5, '| G |', ' ol-preview-line--progression'),
            ]),
            2,
        );
        // The last one has no next line, so it stays with the last.
        expect(pieces.map(readLines)).toEqual([
            [1, 2],
            [3, 4, 5],
        ]);
    });

    test('a chorded line with words is a line of its own', () => {
        const chorded =
            '<span class="ol-preview-lyric-segment__chord">' +
            `${CHORD}</span><span>Amazing</span>`;
        const pieces = splitLyricPartHtml(
            genPart([genLine(1, chorded), genLine(2, 'grace')]),
            2,
        );
        expect(pieces.map(readLines)).toEqual([[1], [2]]);
    });

    test('blank lines around the part are on no piece', () => {
        const pieces = splitLyricPartHtml(
            genPart([
                genLine(1, '&nbsp;'),
                genLine(2, 'One'),
                genLine(3, 'Two'),
                genLine(4, '&nbsp;'),
            ]),
            2,
        );
        expect(pieces.map(readLines)).toEqual([[2], [3]]);
    });

    test('always as many pieces as asked: extra lines join the last', () => {
        const more = splitLyricPartHtml(
            genPart([genLine(1, 'A'), genLine(2, 'B'), genLine(3, 'C')]),
            2,
        );
        expect(more.map(readLines)).toEqual([[1], [2, 3]]);
        const fewer = splitLyricPartHtml(
            genPart([genLine(1, 'A'), genLine(2, 'B')]),
            3,
        );
        expect(fewer.map(readLines)).toEqual([[1], [2], []]);
    });

    test('a part of one line is not cut at all', () => {
        const html = genPart([genLine(1, 'A'), genLine(2, 'B')]);
        expect(splitLyricPartHtml(html, 1)).toEqual([html]);
    });
});

describe('getLyricAtomLineCounts', () => {
    function genReader(value: string, textMap: Record<string, string>) {
        return {
            value,
            getElementMap: vi.fn(async () => {
                return textMap;
            }),
        };
    }

    test('counts each part from the text stage 0 draws, kept per text', async () => {
        const reader = genReader('v1', { 'Verse 1': 'A\n\nB', Intro: '' });
        expect(await getLyricAtomLineCounts(reader)).toEqual({
            'Verse 1': 3,
            Intro: 0,
        });
        expect(reader.getElementMap).toHaveBeenCalledWith({
            type: 'text',
            isWithInfo: false,
            isWithKeyNote: false,
            isShowingCommentText: false,
        });
        await getLyricAtomLineCounts(reader);
        expect(reader.getElementMap).toHaveBeenCalledTimes(1);
        // The song changed: read again.
        reader.value = 'v2';
        await getLyricAtomLineCounts(reader);
        expect(reader.getElementMap).toHaveBeenCalledTimes(2);
    });

    test('a failed read is not kept', async () => {
        const reader = genReader('v1', {});
        reader.getElementMap.mockRejectedValueOnce(new Error('boom'));
        await expect(getLyricAtomLineCounts(reader)).rejects.toThrow('boom');
        expect(await getLyricAtomLineCounts(reader)).toEqual({});
        expect(reader.getElementMap).toHaveBeenCalledTimes(2);
    });
});

// The REAL open-lyric, because what each stage draws is the library's to
// decide: stage 0 drops a line of chords alone and the comments, stage 1 draws
// both. Every stage must still come out with the count the text gave, each
// piece holding the same line (`data-editor-line` is the song's own line
// number), or a slide id would be another line on another stage.
describe('every stage splits a real song the same way', () => {
    const SONG = [
        '```ol:Config', // 1
        '- Title: Probe', // 2
        '- Structure: IV1C', // 3
        '```', // 4
        '', // 5
        '```ol:Intro', // 6
        '{c: Piano + Pads }', // 7
        '| G | C | G | D |', // 8
        '```', // 9
        '', // 10
        '```ol:Verse 1', // 11
        '', // 12
        '// sing softly', // 13
        '|[G]Amazing grace how |[C]sweet the sound', // 14
        '[G] [D]', // 15
        '', // 16
        'That saved a wretch like me', // 17
        '', // 18
        '```', // 19
        '', // 20
        '```ol:Chorus', // 21
        'Line one', // 22
        '{p: #1}', // 23
        'Line [C]two', // 24
        '```', // 25
    ].join('\n');

    test('stage 0 and stage 1 agree on every line', async () => {
        const openLyric = new OpenLyric({
            value: SONG,
            isSkipStyleInjection: true,
        });
        try {
            const counts = await getLyricAtomLineCounts(openLyric);
            expect(counts).toEqual({ Intro: 1, 'Verse 1': 3, Chorus: 3 });
            const stage0Map = await openLyric.getElementMap({
                type: 'html',
                isWithInfo: false,
                isWithKeyNote: false,
                isShowingIndex: false,
            });
            const stage1Map = await openLyric.getElementMap({
                type: 'html',
                isWithInfo: false,
                isWithKeyNote: true,
                isShowingCommentText: true,
                isShowingTotalIndex: true,
            });
            const split = (dataMap: Record<string, string>, key: string) => {
                return splitLyricPartHtml(dataMap[key], counts[key]).map(
                    readLines,
                );
            };
            expect(split(stage0Map, 'Verse 1')).toEqual([[14], [16], [17]]);
            // The comment goes with the line after it, and so does the line
            // of chords -- with the blank line that follows it.
            expect(split(stage1Map, 'Verse 1')).toEqual([
                [13, 14],
                [15, 16],
                [17],
            ]);
            expect(split(stage0Map, 'Chorus')).toEqual([[22], [23], [24]]);
            expect(split(stage1Map, 'Chorus')).toEqual([[22], [23], [24]]);
        } finally {
            openLyric.destroy();
        }
    }, 30000);
});
