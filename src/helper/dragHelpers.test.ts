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

const { deserializeDragData } = await import('./dragHelpers');
const { DragTypeEnum } = await import('./DragInf');
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
