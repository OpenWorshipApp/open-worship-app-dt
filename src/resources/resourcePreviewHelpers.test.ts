import { beforeEach, describe, expect, test, vi } from 'vitest';

const { fsGetFileSizeMock, fsReadFileMock } = vi.hoisted(() => ({
    fsGetFileSizeMock: vi.fn(),
    fsReadFileMock: vi.fn(),
}));

vi.mock('../server/fileHelpers', () => ({
    fsGetFileSize: fsGetFileSizeMock,
    fsReadFile: fsReadFileMock,
}));

import {
    MAX_RESOURCE_NOTE_FILE_SIZE,
    parseResourceNoteItems,
    readResourceNoteItems,
    toResourcePreviewKind,
} from './resourcePreviewHelpers';

function genNoteItem(id: number, title: string, extra: any = {}) {
    return {
        title,
        content: '{"root":{}}',
        metadata: { id, createdAt: '', updatedAt: '' },
        ...extra,
    };
}

describe('toResourcePreviewKind', () => {
    test('a .own is a note, a .md is markdown, the rest go to the OS', () => {
        expect(toResourcePreviewKind('GEN.1.own')).toBe('note');
        expect(toResourcePreviewKind('GEN.1.OWN')).toBe('note');
        expect(toResourcePreviewKind('GEN.1.md')).toBe('markdown');
        expect(toResourcePreviewKind('GEN.1.markdown')).toBe('markdown');
        expect(toResourcePreviewKind('GEN.1.pdf')).toBeNull();
        expect(toResourcePreviewKind('GEN.1.json')).toBeNull();
    });
});

function genMark(id: string, extra: any) {
    return {
        id,
        start: 0,
        end: 5,
        text: `words ${id}`,
        createdAt: '',
        updatedAt: '',
        ...extra,
    };
}

describe('parseResourceNoteItems', () => {
    test('lists notes and marked verses, in the file order', () => {
        const result = parseResourceNoteItems(
            JSON.stringify({
                metadata: {},
                items: [
                    genNoteItem(1, 'Sunday'),
                    genNoteItem(2, ''),
                    genNoteItem(3, '(KJV) Genesis 22:1', {
                        verseKey: '(KJV) GEN 22:1',
                        content: 'GEN 22:1',
                        metadata: {
                            id: 3,
                            createdAt: '',
                            updatedAt: '',
                            isOpened: true,
                        },
                        highlights: [
                            genMark('h1', { color: 'pink' }),
                            // Not a colour of the palette: dropped alone.
                            genMark('h2', { color: 'teal' }),
                        ],
                        comments: [genMark('c1', { comment: 'a thought' })],
                    }),
                    // A verse with no mark left on it says nothing.
                    genNoteItem(4, '(KJV) Genesis 1:1', {
                        verseKey: '(KJV) GEN 1:1',
                        highlights: [],
                        comments: [],
                    }),
                    // Not what `NoteItem.validate` accepts.
                    { title: 'broken', metadata: { id: 5 } },
                    null,
                ],
            }),
        );
        expect(result).toEqual({
            items: [
                { kind: 'note', id: 1, title: 'Sunday' },
                { kind: 'note', id: 2, title: '' },
                {
                    kind: 'verse',
                    id: 3,
                    title: '(KJV) Genesis 22:1',
                    verseKey: '(KJV) GEN 22:1',
                    bibleKey: 'KJV',
                    isOpened: true,
                    highlights: [{ id: 'h1', text: 'words h1', color: 'pink' }],
                    comments: [
                        { id: 'c1', text: 'words c1', comment: 'a thought' },
                    ],
                },
            ],
            failureReason: null,
        });
    });

    test('keeps no content and no offsets', () => {
        const result = parseResourceNoteItems(
            JSON.stringify({
                items: [
                    genNoteItem(1, 'a'),
                    genNoteItem(2, 'b', {
                        verseKey: '(KJV) GEN 1:1',
                        highlights: [genMark('h1', { color: 'blue' })],
                    }),
                ],
            }),
        );
        expect(Object.keys(result.items[0])).toEqual(['kind', 'id', 'title']);
        const verseRow = result.items[1];
        expect(verseRow.kind).toBe('verse');
        if (verseRow.kind === 'verse') {
            expect(verseRow.isOpened).toBe(false);
            expect(Object.keys(verseRow.highlights[0])).toEqual([
                'id',
                'text',
                'color',
            ]);
        }
    });

    test('anything that is not a note file says so', () => {
        for (const text of ['', 'not json', '[]', '{"items": {}}']) {
            expect(parseResourceNoteItems(text).failureReason).toBe(
                'not-a-note',
            );
        }
    });
});

describe('readResourceNoteItems', () => {
    beforeEach(() => {
        fsGetFileSizeMock.mockReset();
        fsReadFileMock.mockReset();
    });

    test('reads and lists a note file', async () => {
        fsGetFileSizeMock.mockResolvedValue(100);
        fsReadFileMock.mockResolvedValue(
            JSON.stringify({ items: [genNoteItem(1, 'a')] }),
        );
        const result = await readResourceNoteItems('/r/GEN.1.own');
        expect(result.items).toEqual([{ kind: 'note', id: 1, title: 'a' }]);
    });

    test('a file over the cap is never read', async () => {
        fsGetFileSizeMock.mockResolvedValue(MAX_RESOURCE_NOTE_FILE_SIZE + 1);
        const result = await readResourceNoteItems('/r/GEN.1.own');
        expect(result.failureReason).toBe('too-large');
        expect(fsReadFileMock).not.toHaveBeenCalled();
    });

    test('an unreadable file never throws', async () => {
        fsGetFileSizeMock.mockRejectedValue(new Error('ENOENT'));
        const result = await readResourceNoteItems('/r/GEN.1.own');
        expect(result.failureReason).toBe('unreadable');
    });
});
