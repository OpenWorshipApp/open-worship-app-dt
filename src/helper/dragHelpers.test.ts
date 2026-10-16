// @vitest-environment jsdom

import { describe, expect, test, vi } from 'vitest';

vi.mock('../server/appProvider', () => {
    return {
        default: {
            isPageReader: false,
            isPagePresenter: false,
            isPageScreen: false,
            systemUtils: { isDev: false },
            pathUtils: {
                sep: '/',
                join: (...paths: string[]) => paths.join('/'),
                basename: (path: string) => path.split('/').pop() ?? '',
                dirname: (path: string) =>
                    path.split('/').slice(0, -1).join('/'),
            },
            envUtils: { isFEUseEffectWarning: false },
            appUtils: {
                base64Encode: (text: string) => text,
                base64Decode: (text: string) => text,
                handleError: (error: any) => {
                    throw error;
                },
            },
            reload: () => {},
            fileUtils: { watch: () => {} },
            messageUtils: { listenForData: () => {}, sendData: () => {} },
        },
    };
});

const {
    addDragPayload,
    deserializeDragData,
    extractDragData,
    extractDropData,
    extractDropDataOfType,
    handleAppDocumentDragStart,
    handleDragStart,
} = await import('./dragHelpers');
const { DragTypeEnum, genDragMimeType } = await import('./DragInf');
const { default: NoteItem } = await import('../bible-list/note/NoteItem');

describe('deserializeDragData', () => {
    // This branch was missing for the whole life of `NoteItem.dragSerialize`,
    // so every note-item drop -- moving one to another note file, reordering one
    // inside a file -- read `null` and silently did nothing.
    test('a note item survives the drag round trip', () => {
        const json = NoteItem.genNewJsonData();
        json.title = 'a title';
        const item = new NoteItem(json, '/notes/a.note');
        const dropped = deserializeDragData(item.dragSerialize());

        expect(dropped).not.toBeNull();
        expect(dropped?.type).toBe(DragTypeEnum.NOTE_ITEM);
        expect(dropped?.item).toBeInstanceOf(NoteItem);
        expect((dropped?.item as any).filePath).toBe('/notes/a.note');
        expect((dropped?.item as any).title).toBe('a title');
    });

    test('an unknown kind is dropped rather than guessed at', () => {
        expect(
            deserializeDragData({ type: 'nonsense' as any, data: {} }),
        ).toBeNull();
    });
});

describe('drag payload transport', () => {
    function makeEvent() {
        const values = new Map<string, string>();
        return {
            values,
            dataTransfer: {
                setData: (kind: string, value: string) => {
                    values.set(kind.toLowerCase(), value);
                },
                getData: (kind: string) => values.get(kind.toLowerCase()) ?? '',
            },
        };
    }

    test('an app document travels by path and advertises its type during hover', () => {
        const event = makeEvent();
        handleAppDocumentDragStart(event, '/docs/sermon.pdf');

        expect(
            event.values.get(genDragMimeType(DragTypeEnum.APP_DOCUMENT)),
        ).toBe('');
        expect(extractDragData(event)).toEqual({
            type: DragTypeEnum.APP_DOCUMENT,
            data: '/docs/sermon.pdf',
        });
        expect(extractDropData(event)).toEqual({
            type: DragTypeEnum.APP_DOCUMENT,
            item: { filePath: '/docs/sermon.pdf' },
        });
        expect(
            extractDropDataOfType(event, DragTypeEnum.BACKGROUND_IMAGE),
        ).toBeNull();
        expect(extractDropDataOfType(event, DragTypeEnum.APP_DOCUMENT)).toEqual(
            extractDropData(event),
        );
    });

    test('a verse drag can carry a second note payload for its other target', () => {
        const event = makeEvent();
        const note = new NoteItem(NoteItem.genNewJsonData(), '/notes/a.note');
        handleAppDocumentDragStart(event, '/docs/sermon.pdf');
        addDragPayload(event, note);

        const dropped = extractDropDataOfType(event, DragTypeEnum.NOTE_ITEM);
        expect(dropped?.type).toBe(DragTypeEnum.NOTE_ITEM);
        expect(dropped?.item).toBeInstanceOf(NoteItem);
        expect((dropped?.item as InstanceType<typeof NoteItem>).filePath).toBe(
            '/notes/a.note',
        );
        expect(extractDropData(event)?.type).toBe(DragTypeEnum.APP_DOCUMENT);

        event.values.set(genDragMimeType(DragTypeEnum.NOTE_ITEM), '{bad');
        expect(extractDropDataOfType(event, DragTypeEnum.NOTE_ITEM)).toBeNull();
    });

    test('plain text, invalid JSON and incomplete drags do not deserialize', () => {
        const event = makeEvent();
        expect(extractDragData(event)).toBeNull();
        for (const text of ['plain text', 'null', '3', '{}']) {
            event.dataTransfer.setData('text', text);
            expect(extractDragData(event)).toBeNull();
            expect(extractDropData(event)).toBeNull();
        }
        handleDragStart(event, {
            dragSerialize: () => ({
                type: '' as (typeof DragTypeEnum)[keyof typeof DragTypeEnum],
                data: 'x',
            }),
        });
        expect(event.values.size).toBe(1);
    });
});
