// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    provider: {
        systemUtils: {
            isWindows: true,
            isMac: false,
            isLinux: false,
            isDev: false,
        },
    },
    isAIEnabled: true,
}));

vi.mock('../server/appProvider', () => ({ default: state.provider }));
vi.mock('../helper/helpers', () => ({
    cloneJson: <T>(value: T) => structuredClone(value),
}));
vi.mock('../helper/ai/aiHelpers', () => ({
    getIsAIEnabled: () => state.isAIEnabled,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));

import {
    formatShortcutKeys,
    getBibleLookupShortcutGroups,
    getKeyboardShortcutGroups,
    getKeyboardShortcutPageLabel,
} from './keyboardShortcutCatalog';
import type { KeyboardShortcutPageType } from './keyboardShortcutCatalog';
import {
    nextSlideEventMappers,
    previousSlideEventMappers,
    slideMovingEventMappers,
} from './appShortcutMappers';

const PAGE_LIST: (KeyboardShortcutPageType | null)[] = [
    'presenter',
    'reader',
    'appDocumentEditor',
    'bibleNote',
    'setting',
    'webEditor',
    'lyricEditor',
    'lwShare',
    null,
];

type PlatformType = 'windows' | 'mac' | 'linux';

function setPlatform(platform: PlatformType) {
    state.provider.systemUtils.isWindows = platform === 'windows';
    state.provider.systemUtils.isMac = platform === 'mac';
    state.provider.systemUtils.isLinux = platform === 'linux';
}

function findEntry(page: KeyboardShortcutPageType | null, id: string) {
    for (const group of getKeyboardShortcutGroups(page)) {
        const entry = group.entries.find((item) => item.id === id);
        if (entry !== undefined) {
            return entry;
        }
    }
    return null;
}

function listEntryIds(page: KeyboardShortcutPageType | null) {
    return getKeyboardShortcutGroups(page).flatMap((group) => {
        return group.entries.map((entry) => entry.id);
    });
}

describe('keyboardShortcutCatalog', () => {
    beforeEach(() => {
        setPlatform('windows');
        state.isAIEnabled = true;
    });

    test.each(['windows', 'mac', 'linux'] as PlatformType[])(
        'every row of every page has words to show on %s',
        (platform) => {
            setPlatform(platform);
            for (const page of PAGE_LIST) {
                const groups = getKeyboardShortcutGroups(page);
                expect(groups.length).toBeGreaterThan(0);
                for (const group of groups) {
                    expect(group.title).not.toBe('');
                    expect(group.entries.length).toBeGreaterThan(0);
                    for (const entry of group.entries) {
                        const keyTexts = formatShortcutKeys(entry.keys);
                        expect(
                            keyTexts.length,
                            `${String(page)} ${entry.id}`,
                        ).toBeGreaterThan(0);
                        for (const keyText of keyTexts) {
                            expect(keyText.trim()).not.toBe('');
                        }
                    }
                }
            }
        },
    );

    test('a row id names one row per page', () => {
        for (const page of PAGE_LIST) {
            const ids = listEntryIds(page);
            expect(new Set(ids).size).toBe(ids.length);
        }
    });

    test('keys are named the way a person reads them', () => {
        expect(
            formatShortcutKeys(findEntry('presenter', 'slide-next')!.keys),
        ).toEqual(['→', '↓', 'Page Down', 'Space']);
        expect(
            formatShortcutKeys(findEntry('presenter', 'slide-previous')!.keys),
        ).toEqual(['←', '↑', 'Page Up', 'Shift+Space']);
        expect(
            formatShortcutKeys(findEntry('presenter', 'screen-toggle')!.keys),
        ).toEqual(['F5']);
        expect(
            formatShortcutKeys(findEntry('reader', 'lookup-remove-all')!.keys),
        ).toEqual(['Shift+Esc']);
        expect(
            formatShortcutKeys(findEntry('presenter', 'slides-redo')!.keys),
        ).toEqual(['Ctrl+Shift+Z', 'Ctrl+Y']);
    });

    test('a Mac gets its own keys and none of the others', () => {
        setPlatform('mac');
        expect(
            formatShortcutKeys(
                findEntry('reader', 'lookup-split-horizontal')!.keys,
            ),
        ).toEqual(['⌘⇧ S']);
        expect(
            formatShortcutKeys(findEntry('presenter', 'slides-redo')!.keys),
        ).toEqual(['⌘⇧ Z']);
        expect(
            formatShortcutKeys(
                findEntry('presenter', 'open-bible-lookup')!.keys,
            ),
        ).toEqual(['⌃ B', '⌘ B']);
        expect(
            formatShortcutKeys(findEntry('presenter', 'slides-delete')!.keys),
        ).toEqual(['Del', '⌘ Backspace']);
    });

    test('each page lists what it binds and not what it does not', () => {
        const presenterIds = listEntryIds('presenter');
        expect(presenterIds).toContain('lookup-close');
        expect(presenterIds).toContain('lookup-save-show');
        expect(presenterIds).not.toContain('lookup-insert-slide');
        const readerIds = listEntryIds('reader');
        // The Reader shows the lookup inline: no popup to close, no Ctrl+B
        // button to open it.
        expect(readerIds).not.toContain('lookup-close');
        expect(readerIds).not.toContain('open-bible-lookup');
        expect(readerIds).toContain('lookup-next-split');
        const editorIds = listEntryIds('appDocumentEditor');
        expect(editorIds).toContain('lookup-insert-slide');
        expect(editorIds).not.toContain('slide-next');
        expect(listEntryIds('setting')).not.toContain('find');
        expect(listEntryIds(null)).toContain('presenting-control');
    });

    test('the Bible Lookup popup lists only the keys that work inside it', () => {
        const toIds = (page: KeyboardShortcutPageType) => {
            return getBibleLookupShortcutGroups(page).flatMap((group) => {
                return group.entries.map((entry) => entry.id);
            });
        };
        const presenterIds = toIds('presenter');
        expect(presenterIds).toContain('lookup-close');
        expect(presenterIds).toContain('lookup-save-show');
        expect(presenterIds).toContain('dialog-confirm');
        // The popup holds the keyboard: the page's own keys are silent.
        expect(presenterIds).not.toContain('screen-toggle');
        expect(presenterIds).not.toContain('presenting-control');
        const editorIds = toIds('appDocumentEditor');
        expect(editorIds).toContain('lookup-insert-slide');
        expect(editorIds).not.toContain('lookup-save-show');
    });

    test('the assistant key goes with the AI switch', () => {
        expect(listEntryIds('reader')).toContain('app-assistant');
        state.isAIEnabled = false;
        expect(listEntryIds('reader')).not.toContain('app-assistant');
    });

    test('next and previous together are exactly the keys the slides bind', () => {
        const toSorted = (list: unknown[]) => {
            return list.map((item) => JSON.stringify(item)).sort();
        };
        expect(
            toSorted([...nextSlideEventMappers, ...previousSlideEventMappers]),
        ).toEqual(toSorted(slideMovingEventMappers));
    });

    test('every page has a name except the one it does not know', () => {
        for (const page of PAGE_LIST) {
            if (page === null) {
                expect(getKeyboardShortcutPageLabel(page)).toBeNull();
            } else {
                expect(getKeyboardShortcutPageLabel(page)).not.toBe('');
            }
        }
    });
});
