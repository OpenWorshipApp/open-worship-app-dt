// @vitest-environment jsdom

import { describe, expect, test, vi } from 'vitest';

vi.mock('../../server/appProvider', () => ({
    default: {
        isDev: false,
        systemUtils: {
            isWindows: true,
            isMac: false,
            isLinux: false,
            isDev: false,
        },
        pathUtils: {
            sep: '/',
            join: (...paths: string[]) => paths.join('/'),
            basename: (path: string) => path,
            dirname: (path: string) => path,
        },
        messageUtils: { listenForData: vi.fn(), sendData: vi.fn() },
    },
}));

import KeyboardEventListener, {
    toShortcutKey,
} from '../../event/KeyboardEventListener';
import {
    checkIsDrawShortcutKey,
    drawShortcutMap,
} from './screenDrawShortcutHelpers';

function keyEvent(key: string, extra: Partial<KeyboardEventInit> = {}) {
    return new KeyboardEvent('keydown', { key, ...extra });
}

describe('screenDrawShortcutHelpers', () => {
    test('every shortcut id maps to at least one event mapper with a key', () => {
        for (const eventMapperList of Object.values(drawShortcutMap)) {
            expect(eventMapperList.length).toBeGreaterThan(0);
            for (const eventMapper of eventMapperList) {
                expect(eventMapper.key).toBeTruthy();
            }
        }
    });

    test('no two shortcut ids claim the same key combination', () => {
        // Compare on the SAME identity the dispatcher uses (platform-filtered,
        // then rendered through toShortcutKey), rather than hand-picking control
        // fields: keying off `wControlKey` alone both misses Ctrl-combo
        // collisions and misreads the platform-scoped Linux Ctrl+Y mapper as a
        // bare `y`.
        const shortcutKeyList = Object.values(drawShortcutMap)
            .flatMap((eventMapperList) => {
                return KeyboardEventListener.filterEventMappersByPlatform(
                    eventMapperList,
                );
            })
            .map(toShortcutKey);
        expect(new Set(shortcutKeyList).size).toBe(shortcutKeyList.length);
    });

    test('checkIsDrawShortcutKey matches palette keys but not Ctrl combos', () => {
        for (const key of ['e', 'b', '[', ']', '{', '}', '-', '=', 's', '3']) {
            expect(checkIsDrawShortcutKey(keyEvent(key))).toBe(true);
        }
        // Uppercase (caps lock / shift) still resolves to the same palette key.
        expect(checkIsDrawShortcutKey(keyEvent('E'))).toBe(true);
        // Not bound, and Ctrl/Alt/Meta combos stay with the canvas handler.
        expect(checkIsDrawShortcutKey(keyEvent('a'))).toBe(false);
        expect(checkIsDrawShortcutKey(keyEvent('ArrowRight'))).toBe(false);
        expect(checkIsDrawShortcutKey(keyEvent('e', { ctrlKey: true }))).toBe(
            false,
        );
        expect(checkIsDrawShortcutKey(keyEvent('z', { ctrlKey: true }))).toBe(
            false,
        );
    });

    test('checkIsDrawShortcutKey resolves the key by physical code, not layout', () => {
        // AZERTY: the physical `KeyQ` position reports `event.key === 'a'`, and
        // `KeyA` reports 'q'. The dispatcher matches on toEnUsKey (i.e. `code`),
        // so this gate must too — testing `event.key` would swallow the quality
        // shortcut here while the panel was still listening for it, leaving every
        // letter shortcut dead on non-US layouts.
        expect(checkIsDrawShortcutKey(keyEvent('a', { code: 'KeyQ' }))).toBe(
            true,
        );
        expect(checkIsDrawShortcutKey(keyEvent('q', { code: 'KeyA' }))).toBe(
            false,
        );
        // Digits are normalized the same way (AZERTY `Digit3` types '"').
        expect(checkIsDrawShortcutKey(keyEvent('"', { code: 'Digit3' }))).toBe(
            true,
        );
    });
});
