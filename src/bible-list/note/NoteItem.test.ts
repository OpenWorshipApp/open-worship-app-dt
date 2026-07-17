import { beforeEach, describe, expect, test, vi } from 'vitest';

const { getInstanceMock, appErrorMock, handleErrorMock } = vi.hoisted(() => ({
    getInstanceMock: vi.fn(),
    appErrorMock: vi.fn(),
    handleErrorMock: vi.fn(),
}));

vi.mock('../../helper/FileSource', () => ({
    default: {
        getInstance: getInstanceMock,
    },
}));

vi.mock('../../helper/helpers', () => ({
    cloneJson: <T>(value: T) => structuredClone(value),
}));

vi.mock('../../helper/loggerHelpers', () => ({
    appError: appErrorMock,
}));

vi.mock('../../helper/errorHelpers', () => ({
    handleError: handleErrorMock,
}));

import NoteItem from './NoteItem';
import { DragTypeEnum } from '../../helper/DragInf';
import { type NoteItemType } from './noteItemHelpers';

function genValidJson(overrides: Partial<NoteItemType> = {}): NoteItemType {
    return {
        title: 'Title',
        content: 'Content',
        metadata: {
            id: 3,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        },
        ...overrides,
    };
}

describe('bible-list/note NoteItem', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getInstanceMock.mockReturnValue({ filePath: '/notes/a.note' });
    });

    test('exposes and mutates fields through getters/setters', () => {
        const item = new NoteItem(genValidJson(), '/notes/a.note');
        expect(item.id).toBe(3);
        expect(item.title).toBe('Title');
        expect(item.content).toBe('Content');
        expect(item.isOpened).toBe(false);

        item.id = 9;
        item.title = 'New';
        item.content = 'Body';
        item.isOpened = true;
        expect(item.id).toBe(9);
        expect(item.title).toBe('New');
        expect(item.content).toBe('Body');
        expect(item.isOpened).toBe(true);

        const newMeta = {
            id: 9,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        item.metadata = newMeta;
        expect(item.metadata).toBe(newMeta);
    });

    test('defaults title/content to empty and isOpened to false', () => {
        const json = genValidJson();
        delete (json as any).title;
        delete (json as any).content;
        const item = new NoteItem(json, '/notes/a.note');
        expect(item.title).toBe('');
        expect(item.content).toBe('');
        expect(item.isOpened).toBe(false);
    });

    test('checkIsSameId compares against number or NoteItem', () => {
        const item = new NoteItem(genValidJson(), '/notes/a.note');
        expect(item.checkIsSameId(3)).toBe(true);
        expect(item.checkIsSameId(4)).toBe(false);
        const other = new NoteItem(genValidJson({}), '/notes/a.note');
        expect(item.checkIsSameId(other)).toBe(true);
    });

    test('fromJson coerces string dates and returns an instance', () => {
        const json: any = {
            title: 'T',
            content: 'C',
            metadata: {
                id: 1,
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-02T00:00:00.000Z',
            },
        };
        const item = NoteItem.fromJson(json);
        expect(item).toBeInstanceOf(NoteItem);
        expect(json.metadata.createdAt).toBeInstanceOf(Date);
        expect(json.metadata.updatedAt).toBeInstanceOf(Date);
    });

    test('validate throws and logs for malformed data', () => {
        expect(() =>
            NoteItem.validate({
                title: 123,
                content: 'C',
                metadata: {
                    id: 1,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            } as any),
        ).toThrow('Invalid note item data');
        expect(appErrorMock).toHaveBeenCalled();
    });

    test('fromJsonError produces an error item', () => {
        const badJson = { anything: true } as any;
        const item = NoteItem.fromJsonError(badJson, '/notes/a.note');
        expect(item.isError).toBe(true);
        expect(item.jsonError).toBe(badJson);
        // toJson on an error item returns the raw json error
        expect(item.toJson()).toBe(badJson);
    });

    test('toJson returns the structured data for a healthy item', () => {
        const item = new NoteItem(genValidJson(), '/notes/a.note');
        expect(item.toJson()).toEqual({
            title: 'Title',
            content: 'Content',
            metadata: {
                id: 3,
                createdAt: new Date('2026-01-01T00:00:00.000Z'),
                updatedAt: new Date('2026-01-02T00:00:00.000Z'),
            },
        });
    });

    test('clone resets the id unless isKeepId is set', () => {
        const item = new NoteItem(genValidJson(), '/notes/a.note');
        const cloned = item.clone();
        expect(cloned.id).toBe(-1);
        const keptClone = item.clone(true);
        expect(keptClone.id).toBe(3);
    });

    test('save returns false without a note or matching item', async () => {
        const item = new NoteItem(genValidJson(), '/notes/a.note');
        expect(await item.save(null)).toBe(false);

        const emptyNote = {
            getItemById: vi.fn(() => null),
            setItemById: vi.fn(),
            save: vi.fn(async () => true),
        } as any;
        expect(await item.save(emptyNote)).toBe(false);
        expect(emptyNote.save).not.toHaveBeenCalled();
    });

    test('save updates the found item and persists through the note', async () => {
        const item = new NoteItem(genValidJson(), '/notes/a.note');
        item.content = 'updated body';
        const stored = new NoteItem(genValidJson(), '/notes/a.note');
        const note = {
            getItemById: vi.fn(() => stored),
            setItemById: vi.fn(),
            save: vi.fn(async () => true),
        } as any;

        item.note = note;
        expect(await item.save()).toBe(true);
        expect(stored.content).toBe('updated body');
        expect(note.setItemById).toHaveBeenCalledWith(3, stored);
        expect(note.save).toHaveBeenCalled();
    });

    test('update copies content and metadata; syncData copies raw json', () => {
        const item = new NoteItem(genValidJson(), '/notes/a.note');
        const other = new NoteItem(
            genValidJson({ content: 'other', title: 'other-title' }),
            '/notes/a.note',
        );
        item.update(other);
        expect(item.content).toBe('other');
        expect(item.metadata).toEqual(other.metadata);

        item.syncData(other);
        expect(item.toJson().title).toBe('other-title');
    });

    test('dragSerialize/dragDeserialize round-trips with the file path', () => {
        const item = new NoteItem(genValidJson(), '/notes/a.note');
        const serialized = item.dragSerialize();
        expect(serialized.type).toBe(DragTypeEnum.NOTE_ITEM);
        expect(serialized.data.filePath).toBe('/notes/a.note');

        const restored = NoteItem.dragDeserialize(serialized.data);
        expect(restored).toBeInstanceOf(NoteItem);
        expect(restored?.filePath).toBe('/notes/a.note');
    });

    test('dragDeserialize returns null and handles errors on bad data', () => {
        const result = NoteItem.dragDeserialize({ bad: true });
        expect(result).toBeNull();
        expect(handleErrorMock).toHaveBeenCalled();
    });

    test('genNewJsonData produces a fresh template', () => {
        const json = NoteItem.genNewJsonData();
        expect(json.title).toBe('Unnamed');
        expect(json.content).toBe('');
        expect(json.metadata.id).toBe(-1);
        expect(json.metadata.createdAt).toBeInstanceOf(Date);
    });
});
