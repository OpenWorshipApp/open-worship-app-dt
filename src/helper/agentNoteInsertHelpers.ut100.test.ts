/**
 * The note editor's Insert menu as new blocks (`agentNoteInsertHelpers.ts`):
 * each object's refusals in its own words, the dates a person says, media
 * by its kind, a sticky note over the ones there, and what a read shows
 * for each object.
 */
import { describe, expect, test } from 'vitest';

import {
    genNoteInsertNode,
    readNoteDate,
    toNoteInsertText,
    toNoteMediaType,
    type NoteInsertContextType,
} from './agentNoteInsertHelpers';

type NodeType = Record<string, any>;

function genContext(extra: Partial<NoteInsertContextType> = {}) {
    return {
        genInline: (line: string) => {
            return [{ type: 'text', text: line }];
        },
        style: '',
        root: { type: 'root', children: [] },
        now: new Date(2026, 10, 8, 15, 30),
        genId: () => 'abcde',
        ...extra,
    } as NoteInsertContextType;
}

function reasonOf(
    kind: Parameters<typeof genNoteInsertNode>[0],
    text: string,
    extra: Partial<NoteInsertContextType> = {},
    color?: string,
) {
    const result = genNoteInsertNode(kind, text, color, genContext(extra));
    if (!('reason' in result)) {
        throw new Error('expected a refusal');
    }
    return result.reason;
}

function nodeOf(kind: Parameters<typeof genNoteInsertNode>[0], text: string) {
    const result = genNoteInsertNode(kind, text, undefined, genContext());
    if (!('node' in result)) {
        throw new Error('expected a node');
    }
    return result.node;
}

describe('a table', () => {
    const NEEDS_WORDS =
        'A table needs its words in `text`: a line a row, the cells of a ' +
        'row between "|", the first row the headings.';

    test('no rows -- or only a Markdown ruler -- is no table', () => {
        expect(reasonOf('table', '')).toBe(NEEDS_WORDS);
        expect(reasonOf('table', '|---|:---:|')).toBe(NEEDS_WORDS);
    });

    test('more than 50 rows or 20 columns is too big', () => {
        const tooLong = Array.from({ length: 51 }, (_, index) => {
            return `row ${index}`;
        }).join('\n');
        const tooWide = Array.from({ length: 21 }, (_, index) => {
            return `c${index}`;
        }).join('|');
        for (const words of [tooLong, tooWide]) {
            expect(reasonOf('table', words)).toBe(
                'A table is 50 rows and 20 columns at most.',
            );
        }
        // 50 rows of 20 columns is still a table.
        const most = Array.from({ length: 50 }, () =>
            tooWide.replace(/\|c20$/, ''),
        ).join('\n');
        const table = nodeOf('table', most);
        expect(table.children).toHaveLength(50);
        expect(table.colWidths).toHaveLength(20);
    });
});

describe('columns and a collapsible block', () => {
    test('columns are two to four', () => {
        const reason =
            "Columns are 2 to 4 side by side: give each column's words in " +
            '`text`, the columns between "|", a column\'s lines by \\n.';
        expect(reasonOf('columns', 'only one')).toBe(reason);
        expect(reasonOf('columns', 'a|b|c|d|e')).toBe(reason);
        expect(nodeOf('columns', 'a|b|c|d').templateColumns).toBe(
            '1fr 1fr 1fr 1fr',
        );
    });

    test('a collapsible block needs its title first', () => {
        const reason =
            'A collapsible block needs its title as the first line of ' +
            '`text`, then the lines it folds.';
        expect(reasonOf('collapsible', '')).toBe(reason);
        expect(reasonOf('collapsible', '  \nthe lines')).toBe(reason);
    });
});

describe('a date as a person says it', () => {
    const NOW = new Date(2026, 10, 8, 15, 30);

    test("tomorrow and yesterday, at this computer's midnight", () => {
        expect(readNoteDate('Tomorrow', NOW)).toEqual(new Date(2026, 10, 9));
        expect(readNoteDate(' yesterday ', NOW)).toEqual(new Date(2026, 10, 7));
        // Over a month's end.
        expect(readNoteDate('yesterday', new Date(2026, 10, 1, 8))).toEqual(
            new Date(2026, 9, 31),
        );
        expect(readNoteDate('tomorrow', new Date(2026, 11, 31, 8))).toEqual(
            new Date(2027, 0, 1),
        );
    });

    test('a date that is not one, or a time past the day, is none', () => {
        for (const words of [
            'next week',
            '08/11/2026',
            '2026-02-30',
            '2026-11-08 24:00',
            '2026-11-08 09:60',
        ]) {
            expect(readNoteDate(words, NOW)).toBeNull();
        }
        expect(readNoteDate('2026-02-28 23:59', NOW)).toEqual(
            new Date(2026, 1, 28, 23, 59),
        );
    });

    test('a date block that cannot be read says what it takes', () => {
        expect(reasonOf('date', 'someday')).toBe(
            'A date is "today", "tomorrow", "yesterday" or "YYYY-MM-DD" ' +
                '(a time may follow: "2026-12-25 09:30").',
        );
    });
});

describe('a poll', () => {
    test('a question and at least two choices', () => {
        const reason =
            'A poll needs its question as the first line of `text`, then a ' +
            'line for each of at least two choices.';
        expect(reasonOf('poll', 'Which hymn?')).toBe(reason);
        expect(reasonOf('poll', 'Which hymn?\n- Amazing Grace')).toBe(reason);
        expect(reasonOf('poll', '')).toBe(reason);
    });

    test('twenty choices at most', () => {
        const choices = Array.from({ length: 21 }, (_, index) => {
            return `- choice ${index}`;
        });
        expect(reasonOf('poll', ['Pick', ...choices].join('\n'))).toBe(
            'A poll has 20 choices at most.',
        );
    });

    test('with no id maker, each choice gets a short id of letters and no votes', () => {
        const result = genNoteInsertNode(
            'poll',
            'Which hymn?\n1. Amazing Grace\n2) Be Thou My Vision',
            undefined,
            genContext({ genId: undefined }),
        );
        if (!('node' in result)) {
            throw new Error(result.toString());
        }
        const poll = result.node.children[0];
        expect(poll.question).toBe('Which hymn?');
        expect(poll.options.map((option: NodeType) => option.text)).toEqual([
            'Amazing Grace',
            'Be Thou My Vision',
        ]);
        for (const option of poll.options) {
            expect(option.uid).toMatch(/^[a-z]{0,5}$/);
            expect(option.votes).toEqual([]);
        }
    });
});

describe('a video, a website and media by a link', () => {
    test('a bare YouTube id is a video', () => {
        expect(nodeOf('video', ' dQw4w9WgXcQ ')).toMatchObject({
            type: 'youtube',
            videoID: 'dQw4w9WgXcQ',
        });
    });

    test('a website is an http(s) link and never YouTube', () => {
        const reason =
            'A website is its link in `text` (https://…); a YouTube link ' +
            'is kind "video".';
        expect(reasonOf('website', 'not a link')).toBe(reason);
        expect(reasonOf('website', 'ftp://example.org/file')).toBe(reason);
        expect(reasonOf('website', 'https://youtu.be/dQw4w9WgXcQ')).toBe(
            reason,
        );
        expect(reasonOf('website', 'https://m.youtube.com/watch')).toBe(reason);
    });

    test('media is a link or a whole path; a pdf and a video by their names', () => {
        expect(reasonOf('media', 'notes/picture.png')).toBe(
            'Media needs a link (https://…) or a whole path on this ' +
                'computer in the first line of `text`; its title may follow ' +
                'on the next line.',
        );
        expect(
            nodeOf('media', 'C:\\docs\\study.pdf').children[0],
        ).toMatchObject({
            mediaType: 'pdf',
            altText: 'study.pdf',
            src: 'C:\\docs\\study.pdf',
        });
        expect(
            nodeOf('media', 'https://example.org/v/clip.MP4?t=3').children[0],
        ).toMatchObject({ mediaType: 'video', altText: 'clip.MP4' });
    });

    test('a source kept inside the note is read by its data type', () => {
        expect(toNoteMediaType('data:application/pdf;base64,JVBER')).toBe(
            'pdf',
        );
        expect(toNoteMediaType('data:video/webm;base64,GkXf')).toBe('video');
        expect(toNoteMediaType('data:audio/ogg;base64,T2dn')).toBe('audio');
        expect(toNoteMediaType('data:image/png;base64,iVBO')).toBe('image');
    });
});

describe('a sticky note and an equation', () => {
    test('a new sticky goes over the ones there, a little below and left', () => {
        const root = {
            type: 'root',
            children: [
                { type: 'sticky', layer: 2 },
                { type: 'paragraph', children: [] },
                { type: 'sticky', layer: 'none' },
            ],
        };
        const result = genNoteInsertNode(
            'sticky',
            'Pray',
            'Pink',
            genContext({ root }),
        );
        if (!('node' in result)) {
            throw new Error(result.toString());
        }
        expect(result.node).toMatchObject({
            type: 'sticky',
            color: 'pink',
            layer: 3,
            // Two there already: 2 x 24px from the first one's place.
            xOffset: 560 - 48,
            yOffset: 24 + 48,
        });
    });

    test('an equation needs its KaTeX, 2000 characters at most', () => {
        const reason =
            'An equation needs its KaTeX in `text` (e.g. "E = mc^2"), 2000 ' +
            'characters at most.';
        expect(reasonOf('equation', '   ')).toBe(reason);
        expect(reasonOf('equation', 'x'.repeat(2001))).toBe(reason);
    });

    test('a drawing with no lines says what it takes', () => {
        expect(reasonOf('drawing', '\n \n')).toBe(
            'A drawing needs its boxes in `text`: a line a box, or "A -> B" ' +
                'for an arrow from box A to box B; 40 lines at most.',
        );
    });
});

describe("the editor's Default Example", () => {
    test('not read is no example', () => {
        const reason = "The editor's example could not be read.";
        expect(reasonOf('example', '')).toBe(reason);
        expect(reasonOf('example', '', { exampleNodes: [] })).toBe(reason);
    });

    test('its nodes are handed over as copies', () => {
        const exampleNodes = [{ type: 'paragraph', children: [] }];
        const result = genNoteInsertNode(
            'example',
            '',
            undefined,
            genContext({ exampleNodes }),
        );
        if (!('nodes' in result)) {
            throw new Error('expected nodes');
        }
        expect(result.nodes).toEqual(exampleNodes);
        expect(result.nodes[0]).not.toBe(exampleNodes[0]);
    });
});

describe('what a read shows for each object', () => {
    test('an equation, a poll, a video and a website', () => {
        expect(toNoteInsertText({ type: 'equation', equation: 'E=mc^2' })).toBe(
            'E=mc^2',
        );
        expect(toNoteInsertText({ type: 'equation' })).toBe('');
        expect(
            toNoteInsertText({
                type: 'poll',
                question: 'Which hymn?',
                options: [{ text: 'Amazing Grace' }, { text: 'Abide' }],
            }),
        ).toBe('Which hymn? - Amazing Grace - Abide');
        expect(toNoteInsertText({ type: 'poll', question: 'Q' })).toBe('Q');
        expect(
            toNoteInsertText({ type: 'youtube', videoID: 'afVN-7vY0KA' }),
        ).toBe('https://www.youtube.com/watch?v=afVN-7vY0KA');
        expect(
            toNoteInsertText({ type: 'website', url: 'https://example.org' }),
        ).toBe('https://example.org');
        expect(toNoteInsertText({ type: 'paragraph' })).toBeNull();
    });

    test('a date chip by its day, a broken one as nothing', () => {
        // Noon UTC is the same day everywhere from UTC-11 to UTC+11.
        expect(
            toNoteInsertText({
                type: 'datetime',
                dateTime: '2026-11-08T12:00:00.000Z',
            }),
        ).toBe('2026-11-08');
        expect(toNoteInsertText({ type: 'datetime', dateTime: 'soon' })).toBe(
            '',
        );
    });
});
