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
    dragStore,
    extractDragData,
    extractDropData,
    extractDropDataOfType,
    handleAppDocumentDragStart,
    handleAttachBackgroundDrop,
    handleDragStart,
} = await import('./dragHelpers');
const { attachBackgroundManager } =
    await import('../others/AttachBackgroundManager');
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

    // Only a hand-written text drag can do it, but it used to throw out of
    // every drop handler that reads a payload.
    test('a document slide whose inner data does not parse is not ours', () => {
        const event = makeEvent();
        event.dataTransfer.setData(
            'text',
            JSON.stringify({ type: DragTypeEnum.PDF_SLIDE, data: '{bad' }),
        );
        expect(extractDropData(event)).toBeNull();
        expect(extractDropDataOfType(event, DragTypeEnum.PDF_SLIDE)).toBeNull();
    });

    // A screen calls `onDropped` for any drop it cannot read: left set, an OS
    // file dropped there later re-sent the last countdown.
    test("a source's onDropped lasts until its drag ends", () => {
        const onDropped = vi.fn();
        dragStore.onDropped = onDropped;
        handleDragStart(makeEvent(), {
            dragSerialize: () => ({ type: DragTypeEnum.FOREGROUND, data: {} }),
        });
        expect(dragStore.onDropped).toBe(onDropped);
        window.dispatchEvent(new Event('dragend'));
        expect(dragStore.onDropped).toBeNull();
        dragStore.onDropped = onDropped;
        window.dispatchEvent(new Event('dragend'));
        expect(dragStore.onDropped).toBe(onDropped);
        dragStore.onDropped = null;
    });
});

// A row stopped every drop it was handed, so a `.owb` dropped from the disk
// onto a Bibles row never reached the list that copies files in (DD-15).
describe('handleAttachBackgroundDrop', () => {
    function makeDropEvent(text: string) {
        return {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            target: document.createElement('li'),
            dataTransfer: {
                getData: (kind: string) => (kind === 'text' ? text : ''),
            },
        };
    }

    test('a drop that is not a background goes on to the list', () => {
        const attach = vi
            .spyOn(attachBackgroundManager, 'attachDroppedBackground')
            .mockResolvedValue(undefined as any);
        for (const text of [
            '',
            JSON.stringify({ type: DragTypeEnum.APP_DOCUMENT, data: '/a.ows' }),
        ]) {
            const event = makeDropEvent(text);
            event.target.style.opacity = '0.5';
            handleAttachBackgroundDrop(event as any, { filePath: '/b.owb' });
            expect(event.stopPropagation).not.toHaveBeenCalled();
            expect(event.preventDefault).not.toHaveBeenCalled();
            expect(event.target.style.opacity).toBe('1');
        }
        expect(attach).not.toHaveBeenCalled();
        attach.mockRestore();
    });

    test('a background is attached and kept from the list', () => {
        const attach = vi
            .spyOn(attachBackgroundManager, 'attachDroppedBackground')
            .mockResolvedValue(undefined as any);
        const event = makeDropEvent(
            JSON.stringify({
                type: DragTypeEnum.BACKGROUND_COLOR,
                data: '#008080',
            }),
        );
        handleAttachBackgroundDrop(event as any, { filePath: '/b.owb', id: 2 });
        expect(event.stopPropagation).toHaveBeenCalled();
        expect(attach).toHaveBeenCalledWith(
            { type: DragTypeEnum.BACKGROUND_COLOR, item: '#008080' },
            '/b.owb',
            2,
        );
        attach.mockRestore();
    });
});
