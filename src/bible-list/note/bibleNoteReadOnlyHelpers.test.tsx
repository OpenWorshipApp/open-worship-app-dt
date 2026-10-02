// @vitest-environment jsdom

import { act } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';

// The REAL editor, so what is checked is the toolbar the user sees. jsdom lacks
// a little of what it touches; the canvas stub is needed before it LOADS (its
// drawing chunk measures a canvas at import), hence hoisted above the imports.
vi.hoisted(() => {
    const noop = () => {};
    const observerClass = class {
        observe = noop;
        unobserve = noop;
        disconnect = noop;
    };
    (globalThis as any).ResizeObserver ??= observerClass;
    (globalThis as any).IntersectionObserver ??= observerClass;
    (globalThis as any).matchMedia ??= () => ({
        matches: false,
        addEventListener: noop,
        removeEventListener: noop,
        addListener: noop,
        removeListener: noop,
    });
    (globalThis as any).scrollTo ??= noop;
    (Range.prototype as any).getBoundingClientRect ??= () => ({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    });
    (Range.prototype as any).getClientRects ??= () => [];
    (HTMLCanvasElement.prototype as any).getContext = () => {
        return new Proxy(
            { filter: 'none' },
            {
                get: (target: any, key) => {
                    return key in target
                        ? target[key]
                        : () => ({ width: 0, data: [] });
                },
            },
        );
    };
});

import {
    BibleNote,
    LocationsLookupManager,
    NamesLookupManager,
} from 'bible-note';

import {
    BIBLE_NOTE_READ_ONLY_SETTING_KEY,
    genPreviewSettingStore,
    lockBibleNoteReadOnly,
} from './bibleNoteReadOnlyHelpers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function genContent(text: string) {
    return JSON.stringify({
        root: {
            children: [
                {
                    children: [
                        {
                            detail: 0,
                            format: 0,
                            mode: 'normal',
                            style: '',
                            text,
                            type: 'text',
                            version: 1,
                        },
                    ],
                    direction: 'ltr',
                    format: '',
                    indent: 0,
                    type: 'paragraph',
                    version: 1,
                    textFormat: 0,
                    textStyle: '',
                },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'root',
            version: 1,
        },
    });
}

// The one store every note window shares, as `appHomeStorage` is.
function genSharedSettingStore() {
    const valueMap = new Map<string, string>();
    const writeList: string[] = [];
    return {
        valueMap,
        writeList,
        store: {
            deleteSetting(key: string) {
                writeList.push(key);
                valueMap.delete(key);
            },
            getSetting(key: string) {
                return valueMap.get(key) ?? null;
            },
            setSetting(key: string, value: any) {
                writeList.push(key);
                valueMap.set(key, value);
            },
        },
    };
}

async function settle(rounds = 8) {
    for (let i = 0; i < rounds; i++) {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
        });
    }
}

let mountedNote: BibleNote | null = null;
let host: HTMLDivElement | null = null;

afterEach(async () => {
    const note = mountedNote;
    if (note !== null) {
        await act(async () => {
            note.unmount();
        });
    }
    mountedNote = null;
    host?.remove();
    host = null;
});

// What `initBibleNote` does for a note previewed from Resources.
async function openPreview(settingStore: object) {
    const saveData = vi.fn();
    const bibleNote = new BibleNote({
        namesLookupManager: NamesLookupManager.createEmpty(),
        locationsLookupManager: LocationsLookupManager.createEmpty(),
        getLangCode: () => 'en',
        editorExtraFontFamilies: [],
        stickyNoteExtraFontFamilies: [],
        storageManager: genPreviewSettingStore(settingStore as any) as any,
        saveData,
        loadData: () => genContent('As the file was saved'),
        isOnApp: true,
        isMinimize: true,
    });
    lockBibleNoteReadOnly(bibleNote);
    mountedNote = bibleNote;
    host = document.createElement('div');
    document.body.appendChild(host);
    const container = host;
    await act(async () => {
        bibleNote.render(container);
    });
    await settle();
    return { bibleNote, container };
}

function getToolbarButtons(container: HTMLElement) {
    return Array.from(
        container.querySelectorAll('.toolbar button'),
    ) as HTMLButtonElement[];
}

describe('lockBibleNoteReadOnly', () => {
    // RD-119: Undo was enabled in a read-only note. The editor locked itself
    // before its toolbar started listening, so the toolbar went on believing it
    // editable: every formatting button was live, and Undo came on with the
    // first step in the history -- here, the file changing on disk, which a
    // preview follows (`initBibleNote`'s watcher sets `content`).
    test('a previewed note keeps its toolbar off, Undo included', async () => {
        const { bibleNote, container } = await openPreview(
            genSharedSettingStore().store,
        );
        await act(async () => {
            bibleNote.content = genContent('Changed on disk');
        });
        await settle(4);

        const buttonList = getToolbarButtons(container);
        const undoButton = container.querySelector(
            '.toolbar button[aria-label="Undo"]',
        ) as HTMLButtonElement | null;
        expect(undoButton).not.toBeNull();
        expect(undoButton!.disabled).toBe(true);
        expect(buttonList.length).toBeGreaterThan(5);
        // Nothing that edits is left live -- only how the page is SHOWN.
        expect(
            buttonList
                .filter((button) => !button.disabled)
                .map((button) => button.getAttribute('aria-label')),
        ).toEqual(['Show invisible characters']);
        expect(bibleNote.isReadOnly).toBe(true);
        expect(
            container
                .querySelector('[contenteditable]')
                ?.getAttribute('contenteditable'),
        ).toBe('false');
    });

    // The editor keeps its lock in the store every note window reads on open,
    // and wrote the HOST's lock there like a press of its own button: after one
    // preview, every editable note opened locked.
    test('a preview leaves the shared lock setting alone', async () => {
        const shared = genSharedSettingStore();

        await openPreview(shared.store);

        expect(shared.writeList).not.toContain(
            BIBLE_NOTE_READ_ONLY_SETTING_KEY,
        );
        expect(shared.valueMap.has(BIBLE_NOTE_READ_ONLY_SETTING_KEY)).toBe(
            false,
        );
    });
});

describe('genPreviewSettingStore', () => {
    test('passes every setting through but the lock', () => {
        const shared = genSharedSettingStore();
        shared.valueMap.set(BIBLE_NOTE_READ_ONLY_SETTING_KEY, 'true');
        const store = genPreviewSettingStore(shared.store);

        store.setSetting('lexical-playground-editor-zoom-percent', '120');
        store.setSetting(BIBLE_NOTE_READ_ONLY_SETTING_KEY, 'true');
        store.deleteSetting(BIBLE_NOTE_READ_ONLY_SETTING_KEY);

        expect(shared.writeList).toEqual([
            'lexical-playground-editor-zoom-percent',
        ]);
        // A lock the USER set in an editable window is read, and kept.
        expect(store.getSetting(BIBLE_NOTE_READ_ONLY_SETTING_KEY)).toBe('true');
    });
});
