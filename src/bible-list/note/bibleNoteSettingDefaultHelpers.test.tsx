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
    BIBLE_NOTE_SETTINGS_KEY,
    genHostDefaultSettingStore,
    withHostDefaultEditorSettings,
} from './bibleNoteSettingDefaultHelpers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

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

async function settle(rounds = 6) {
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

async function openNote(storageManager: object) {
    const bibleNote = new BibleNote({
        namesLookupManager: NamesLookupManager.createEmpty(),
        locationsLookupManager: LocationsLookupManager.createEmpty(),
        getLangCode: () => 'en',
        editorExtraFontFamilies: [],
        stickyNoteExtraFontFamilies: [],
        storageManager: storageManager as any,
        saveData: vi.fn(),
        loadData: () => null,
        isOnApp: true,
        isMinimize: true,
    });
    mountedNote = bibleNote;
    host = document.createElement('div');
    document.body.appendChild(host);
    const container = host;
    await act(async () => {
        bibleNote.render(container);
    });
    await settle();
    return container;
}

function findTableOfContentsButton(container: HTMLElement) {
    return container.querySelector(
        '.toolbar button[aria-label="Table of contents"]',
    );
}

describe('genHostDefaultSettingStore', () => {
    // 2026-11-14: the package ships the switch off and the note window has no
    // settings panel, so the button was never reachable.
    test('the note toolbar shows the Table of contents button', async () => {
        const shared = genSharedSettingStore();
        const container = await openNote(
            genHostDefaultSettingStore(shared.store),
        );

        expect(findTableOfContentsButton(container)).not.toBeNull();
        // Turned on by reading alone: nothing reached the shared setting.
        expect(shared.writeList).not.toContain(BIBLE_NOTE_SETTINGS_KEY);
    });

    test('without it the package keeps the button hidden', async () => {
        const container = await openNote(genSharedSettingStore().store);

        expect(findTableOfContentsButton(container)).toBeNull();
    });

    test('a switch stored off stays off', async () => {
        const shared = genSharedSettingStore();
        shared.valueMap.set(
            BIBLE_NOTE_SETTINGS_KEY,
            '{"showTableOfContents":false}',
        );
        const container = await openNote(
            genHostDefaultSettingStore(shared.store),
        );

        expect(findTableOfContentsButton(container)).toBeNull();
    });

    test('passes every other key through untouched', async () => {
        const shared = genSharedSettingStore();
        shared.valueMap.set('lexical-playground-editor-zoom-percent', '120');
        const store = genHostDefaultSettingStore(shared.store);

        expect(store.getSetting('lexical-playground-editor-zoom-percent')).toBe(
            '120',
        );
        store.setSetting(BIBLE_NOTE_SETTINGS_KEY, '{"isDarkMode":true}');
        expect(shared.valueMap.get(BIBLE_NOTE_SETTINGS_KEY)).toBe(
            '{"isDarkMode":true}',
        );
        store.deleteSetting(BIBLE_NOTE_SETTINGS_KEY);
        expect(shared.valueMap.has(BIBLE_NOTE_SETTINGS_KEY)).toBe(false);
        expect(
            await Promise.resolve(
                genHostDefaultSettingStore({
                    ...shared.store,
                    getSetting: async () => '{"isDarkMode":true}',
                }).getSetting(BIBLE_NOTE_SETTINGS_KEY),
            ),
        ).toBe('{"showTableOfContents":true,"isDarkMode":true}');
    });
});

describe('withHostDefaultEditorSettings', () => {
    test('lays the defaults under what is stored', () => {
        expect(JSON.parse(withHostDefaultEditorSettings(null))).toEqual({
            showTableOfContents: true,
        });
        expect(
            JSON.parse(
                withHostDefaultEditorSettings(
                    '{"showInvisibleCharacters":true}',
                ),
            ),
        ).toEqual({ showTableOfContents: true, showInvisibleCharacters: true });
        expect(
            JSON.parse(withHostDefaultEditorSettings({ isDarkMode: true })),
        ).toEqual({ showTableOfContents: true, isDarkMode: true });
    });

    test('a value the editor could not read gets the defaults alone', () => {
        for (const value of ['not json', '[1]', 'null', '7']) {
            expect(JSON.parse(withHostDefaultEditorSettings(value))).toEqual({
                showTableOfContents: true,
            });
        }
    });
});
