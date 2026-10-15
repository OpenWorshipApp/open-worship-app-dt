// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    type Mark = { id: string; color?: string; comment?: string };
    type Item = {
        id: number;
        verseKey: string;
        highlights: Mark[];
        comments: Mark[];
    };
    const files = new Map<string, Item[]>();
    const toast = vi.fn();
    const saves = vi.fn();
    let defaultPath: string | null = '/notes/default.note';
    let failSave = false;

    class FakeNoteItem {
        id: number;
        verseKey: string;
        highlights: Mark[] = [];
        comments: Mark[] = [];
        constructor(data: { metadata: { id: number }; verseKey: string }) {
            this.id = data.metadata.id;
            this.verseKey = data.verseKey;
        }
        static genNewVerseJsonData(
            verseKey: string,
            title: string,
            content: string,
        ) {
            return { metadata: { id: -1 }, verseKey, title, content };
        }
        get isVerseItem() {
            return this.verseKey !== '';
        }
        get annotationCount() {
            return this.highlights.length + this.comments.length;
        }
    }

    class FakeNote {
        items: FakeNoteItem[];
        constructor(public filePath: string) {
            this.items = (files.get(filePath) ?? []).map((stored) => {
                const item = new FakeNoteItem({
                    metadata: { id: stored.id },
                    verseKey: stored.verseKey,
                });
                item.highlights = structuredClone(stored.highlights);
                item.comments = structuredClone(stored.comments);
                return item;
            });
        }
        static async getDefault() {
            return defaultPath === null ? null : new FakeNote(defaultPath);
        }
        static async fromFilePath(path: string) {
            return files.has(path) ? new FakeNote(path) : null;
        }
        get maxItemId() {
            return Math.max(0, ...this.items.map((item) => item.id));
        }
        getItemById(id: number) {
            return this.items.find((item) => item.id === id) ?? null;
        }
        async addAndSaveNoteItem(item: FakeNoteItem) {
            saves('add', item.id);
            if (failSave) return false;
            files.set(this.filePath, [...this.items, item].map(toStored));
            return true;
        }
        async updateAndSaveNoteItem(item: FakeNoteItem, silent: boolean) {
            saves('update', item.id, silent);
            if (failSave) return false;
            files.set(this.filePath, this.items.map(toStored));
            return true;
        }
        async deleteNoteItem(item: FakeNoteItem) {
            saves('delete', item.id);
            if (failSave) return false;
            files.set(
                this.filePath,
                this.items
                    .filter((candidate) => candidate !== item)
                    .map(toStored),
            );
            return true;
        }
    }
    function toStored(item: FakeNoteItem): Item {
        return {
            id: item.id,
            verseKey: item.verseKey,
            highlights: structuredClone(item.highlights),
            comments: structuredClone(item.comments),
        };
    }
    return {
        files,
        toast,
        saves,
        FakeNote,
        FakeNoteItem,
        setDefaultPath: (path: string | null) => {
            defaultPath = path;
        },
        setFailSave: (value: boolean) => {
            failSave = value;
        },
    };
});

vi.mock('./Note', () => ({ default: h.FakeNote }));
vi.mock('./NoteItem', () => ({ default: h.FakeNoteItem }));
vi.mock('../../toast/toastHelpers', () => ({ showSimpleToast: h.toast }));
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../helper/loggerHelpers', () => ({
    appWarning: vi.fn(),
    appError: vi.fn(),
}));
vi.mock('../../helper/timeoutHelpers', () => ({ genTimeoutAttempt: vi.fn() }));

import {
    addVerseComment,
    addVerseHighlight,
    removeVerseAnnotation,
    updateVerseComment,
    updateVerseHighlightColor,
    type VerseAnchorType,
} from './verseAnnotationHelpers';

const anchor: VerseAnchorType = {
    verseKey: '(KJV) GEN 22:1',
    shortVerse: 'GEN 22:1',
    title: '(KJV) Genesis 22:1',
};
const selection = { start: 2, end: 7, text: 'words' };
const path = '/notes/default.note';

beforeEach(() => {
    h.files.clear();
    h.files.set(path, []);
    h.toast.mockClear();
    h.saves.mockClear();
    h.setDefaultPath(path);
    h.setFailSave(false);
});

describe('verse annotation persistence', () => {
    test('creates a verse item and adds subsequent marks to that item', async () => {
        const highlight = await addVerseHighlight(anchor, selection, 'yellow');
        const comment = await addVerseComment(
            anchor,
            selection,
            'Remember this',
        );

        expect(highlight).toMatchObject({ filePath: path, noteItemId: 1 });
        expect(comment).toMatchObject({ filePath: path, noteItemId: 1 });
        expect(comment?.annotationId).not.toBe(highlight?.annotationId);
        expect(h.files.get(path)).toMatchObject([
            {
                id: 1,
                verseKey: anchor.verseKey,
                highlights: [
                    {
                        id: highlight?.annotationId,
                        color: 'yellow',
                        ...selection,
                    },
                ],
                comments: [
                    {
                        id: comment?.annotationId,
                        comment: 'Remember this',
                        ...selection,
                    },
                ],
            },
        ]);
        expect(h.saves.mock.calls).toEqual([
            ['add', 1],
            ['update', 1, true],
        ]);
    });

    test('serializes rapid writes to one file and keeps every mark', async () => {
        const results = await Promise.all([
            addVerseHighlight(anchor, selection, 'yellow'),
            addVerseHighlight(anchor, selection, 'green'),
            addVerseComment(anchor, selection, 'Third'),
        ]);
        expect(results.map((result) => result?.noteItemId)).toEqual([1, 1, 1]);
        expect(h.files.get(path)).toHaveLength(1);
        expect(h.files.get(path)?.[0]).toMatchObject({
            highlights: [{ color: 'yellow' }, { color: 'green' }],
            comments: [{ comment: 'Third' }],
        });
    });

    test('edits only the matching mark and skips unchanged or missing ids', async () => {
        const highlight = (await addVerseHighlight(
            anchor,
            selection,
            'yellow',
        ))!;
        const comment = (await addVerseComment(anchor, selection, 'First'))!;

        expect(
            await updateVerseHighlightColor(
                path,
                1,
                highlight.annotationId,
                'blue',
            ),
        ).toBe(true);
        expect(
            await updateVerseComment(path, 1, comment.annotationId, 'Edited'),
        ).toBe(true);
        expect(
            await updateVerseHighlightColor(
                path,
                1,
                highlight.annotationId,
                'blue',
            ),
        ).toBe(false);
        expect(await updateVerseComment(path, 1, 'missing', 'Ignored')).toBe(
            false,
        );
        expect(h.files.get(path)?.[0]).toMatchObject({
            highlights: [{ color: 'blue' }],
            comments: [{ comment: 'Edited' }],
        });
        expect(
            h.saves.mock.calls.filter(([op]) => op === 'update'),
        ).toHaveLength(3);
    });

    test('removes one mark, then deletes the empty verse item', async () => {
        const highlight = (await addVerseHighlight(
            anchor,
            selection,
            'yellow',
        ))!;
        const comment = (await addVerseComment(anchor, selection, 'Text'))!;
        expect(await removeVerseAnnotation(path, 1, 'missing')).toBe(false);
        expect(
            await removeVerseAnnotation(path, 1, highlight.annotationId),
        ).toBe(true);
        expect(h.files.get(path)?.[0]).toMatchObject({
            highlights: [],
            comments: [{ id: comment.annotationId }],
        });
        expect(await removeVerseAnnotation(path, 1, comment.annotationId)).toBe(
            true,
        );
        expect(h.files.get(path)).toEqual([]);
        expect(h.saves).toHaveBeenCalledWith('delete', 1);
    });

    test('reports an unavailable note directory and failed saves', async () => {
        h.setDefaultPath(null);
        expect(await addVerseHighlight(anchor, selection, 'yellow')).toBeNull();
        expect(h.toast).toHaveBeenCalledWith(
            'Saving Verse Mark',
            'Bible notes directory is not set',
        );

        h.setDefaultPath(path);
        h.setFailSave(true);
        expect(await addVerseComment(anchor, selection, 'Unsaved')).toBeNull();
        expect(h.files.get(path)).toEqual([]);
    });

    test('refuses updates to a missing file, missing item, or ordinary note item', async () => {
        expect(
            await updateVerseComment('/notes/missing.note', 1, 'x', 'Text'),
        ).toBe(false);
        expect(await updateVerseComment(path, 1, 'x', 'Text')).toBe(false);
        h.files.set(path, [
            { id: 1, verseKey: '', highlights: [], comments: [] },
        ]);
        expect(await removeVerseAnnotation(path, 1, 'x')).toBe(false);
        expect(h.saves).not.toHaveBeenCalled();
    });
});
