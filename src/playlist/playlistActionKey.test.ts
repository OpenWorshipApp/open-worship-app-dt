// @vitest-environment jsdom

import { describe, expect, test, vi } from 'vitest';

vi.mock('../helper/errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: vi.fn() }));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
// Both must stay CLASSES — see the note in `playlistScreenIds.test.ts`.
vi.mock('../bible-list/Bible', () => ({
    default: class {
        static getDefault = vi.fn(async () => null);
    },
}));
vi.mock('../bible-list/BibleItem', () => ({
    default: class {
        static dragDeserialize = vi.fn(() => null);
    },
}));

const {
    checkIsValidPlaylistActionKey,
    readPlaylistActionKeyFromEvent,
    toPlaylistActionKeyEventMapper,
} = await import('./playlistActionKeyHelpers');
const { default: PlaylistItem } = await import('./PlaylistItem');
const { default: Playlist } = await import('./Playlist');
const { collectPlaylistRunShortcutKeys, findPlaylistRunShortcutUuid } =
    await import('./playlistPreviewFloatingHelpers');
const { showSimpleToast } = await import('../toast/toastHelpers');

const METADATA = { app: 'test', fileVersion: 1, initDate: '2026-08-06' };

let instanceCount = 0;

/** The file layer stubbed on the instance, as the other playlist tests do. */
function genPlaylist(items: any[]) {
    instanceCount += 1;
    const playlist = Playlist.getInstance(
        `/playlists/key-${instanceCount}.owp`,
    );
    const jsonData = { items, metadata: METADATA };
    (playlist as any).getJsonData = async () => {
        return jsonData;
    };
    (playlist as any).setJsonData = (newJsonData: any) => {
        jsonData.items = newJsonData.items;
    };
    (playlist as any).save = vi.fn(async () => {
        return true;
    });
    return { playlist, jsonData };
}

function genItem(json: any) {
    return new (PlaylistItem as any)('/playlists/a.owp', json) as InstanceType<
        typeof PlaylistItem
    >;
}

function genKeyItem(uuid: string, actionKey?: string, isDisabled = false) {
    return genItem({
        uuid,
        type: 'action',
        data: 'keyboard-event',
        ...(actionKey === undefined ? {} : { actionKey }),
        ...(isDisabled ? { isDisabled: true } : {}),
    });
}

/** A key press as the capture field sees it. */
function genKeyEvent(overrides: any) {
    return {
        key: 'a',
        code: 'KeyA',
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
        ...overrides,
    };
}

describe('the stored shortcut format', () => {
    test('it is a modifier and a key, in one spelling', () => {
        expect(checkIsValidPlaylistActionKey('Shift+A')).toBe(true);
        expect(checkIsValidPlaylistActionKey('Ctrl+A')).toBe(true);
        expect(checkIsValidPlaylistActionKey('Ctrl+Shift+A')).toBe(true);
        expect(checkIsValidPlaylistActionKey('Ctrl+Shift+F5')).toBe(true);

        // A bare key would take that key away from the run player itself.
        expect(checkIsValidPlaylistActionKey('A')).toBe(false);
        // One shortcut, one spelling — otherwise two lines could both claim it
        // while `Playlist`'s uniqueness check saw two different strings.
        expect(checkIsValidPlaylistActionKey('Shift+Ctrl+A')).toBe(false);
        expect(checkIsValidPlaylistActionKey('Shift+a')).toBe(false);
        // Not portable, so never stored.
        expect(checkIsValidPlaylistActionKey('Alt+A')).toBe(false);
        expect(checkIsValidPlaylistActionKey('Meta+A')).toBe(false);
        expect(checkIsValidPlaylistActionKey('Shift+Shift+A')).toBe(false);
        expect(checkIsValidPlaylistActionKey('')).toBe(false);
        expect(checkIsValidPlaylistActionKey(undefined)).toBe(false);
        expect(checkIsValidPlaylistActionKey(7)).toBe(false);
    });

    test('it speaks the app’s keyboard layer through allControlKey', () => {
        // `allControlKey` and not a per-platform list: one stored string has to
        // match on Windows, Mac and Linux alike.
        expect(toPlaylistActionKeyEventMapper('Ctrl+Shift+A')).toEqual({
            key: 'A',
            allControlKey: ['Ctrl', 'Shift'],
        });
        expect(toPlaylistActionKeyEventMapper('Shift+ArrowUp')).toEqual({
            key: 'ArrowUp',
            allControlKey: ['Shift'],
        });
        expect(toPlaylistActionKeyEventMapper('A')).toBeNull();
    });
});

describe('reading a shortcut off a key press', () => {
    test('a press with a modifier is the shortcut', () => {
        expect(
            readPlaylistActionKeyFromEvent(genKeyEvent({ shiftKey: true })),
        ).toEqual({ actionKey: 'Shift+A', message: null });
        // Layout independent, and one case: `a` and `A` are one shortcut.
        expect(
            readPlaylistActionKeyFromEvent(
                genKeyEvent({ key: 'A', ctrlKey: true, shiftKey: true }),
            ),
        ).toEqual({ actionKey: 'Ctrl+Shift+A', message: null });
        // Shift over a digit gives `!`; the physical key is what is stored.
        expect(
            readPlaylistActionKeyFromEvent(
                genKeyEvent({ key: '!', code: 'Digit1', shiftKey: true }),
            ),
        ).toEqual({ actionKey: 'Shift+1', message: null });
    });

    test('a press that cannot be one says which', () => {
        expect(readPlaylistActionKeyFromEvent(genKeyEvent({}))).toEqual({
            actionKey: null,
            message: 'Hold Ctrl or Shift with the key',
        });
        expect(
            readPlaylistActionKeyFromEvent(
                genKeyEvent({ altKey: true, shiftKey: true }),
            ),
        ).toEqual({
            actionKey: null,
            message: 'Only Ctrl and Shift may be used',
        });
        // A bare modifier on the way to the combination — nothing to say.
        expect(
            readPlaylistActionKeyFromEvent(
                genKeyEvent({ key: 'Shift', code: 'ShiftLeft' }),
            ),
        ).toBeNull();
    });
});

describe('a Keyboard Event element', () => {
    test('it reads as its shortcut and hosts followers, not targets', () => {
        const armed = genKeyItem('u-1', 'Shift+A');
        expect(armed.actionKey).toBe('Shift+A');
        expect(armed.title).toBe('Keyboard Event (Shift+A)');
        expect(armed.actionArming).toEqual({ actionKey: 'Shift+A' });
        // Its CCs go to a SCREEN, so this line must resolve one for them —
        // unlike a `Jump to`, whose one CC merely names a line.
        expect(armed.hostsCcFollowers).toBe(true);
        expect(armed.maxCcItemCount).toBe(Infinity);
        expect(
            PlaylistItem.checkIsCcTargetHost({
                type: 'action',
                data: 'keyboard-event',
            } as any),
        ).toBe(false);
        expect(
            PlaylistItem.checkIsCcTargetHost({
                type: 'action',
                data: 'jump-to',
            } as any),
        ).toBe(true);

        // Not an error row with no shortcut yet — its own menu is the only way
        // to finish the line.
        const unarmed = genKeyItem('u-2');
        expect(unarmed.actionKey).toBeNull();
        expect(unarmed.title).toBe('Keyboard Event');
        expect(unarmed.actionArming).toEqual({});
        expect(() => {
            PlaylistItem.validate(unarmed.toJson() as any);
        }).not.toThrow();
    });

    test('it may never be a CC element itself', () => {
        expect(
            PlaylistItem.resolveCcItemJson({
                type: 'action',
                data: 'keyboard-event',
                actionKey: 'Shift+A',
            } as any),
        ).toBeNull();
    });

    test('a shortcut on a clock is ignored, however the file was edited', () => {
        const timeout = genItem({
            uuid: 'u-3',
            type: 'action',
            data: 'next-timeout',
            actionNumber: 5,
            actionKey: 'Shift+A',
        });
        expect(timeout.actionKey).toBeNull();
        expect(timeout.hostsCcFollowers).toBe(false);
    });
});

describe('a shortcut is unique in its playlist', () => {
    test('adding a second line with the same one is refused', async () => {
        const { playlist, jsonData } = genPlaylist([]);
        expect(
            await playlist.addActionItem('keyboard-event', {
                actionKey: 'Shift+A',
            }),
        ).toBe(true);
        vi.mocked(showSimpleToast).mockClear();
        expect(
            await playlist.addActionItem('keyboard-event', {
                actionKey: 'Shift+A',
            }),
        ).toBe(false);
        expect(jsonData.items).toHaveLength(1);
        expect(showSimpleToast).toHaveBeenCalled();

        // Another shortcut is fine.
        expect(
            await playlist.addActionItem('keyboard-event', {
                actionKey: 'Ctrl+Shift+A',
            }),
        ).toBe(true);
        expect(jsonData.items).toHaveLength(2);
    });

    test('re-arming keeps its own key but cannot take another line’s', async () => {
        const { playlist, jsonData } = genPlaylist([
            {
                uuid: 'u-1',
                type: 'action',
                data: 'keyboard-event',
                actionKey: 'Shift+A',
            },
            {
                uuid: 'u-2',
                type: 'action',
                data: 'keyboard-event',
                actionKey: 'Shift+B',
            },
        ]);
        // Its own is not a clash with itself.
        expect(
            await playlist.setItemActionArming(0, { actionKey: 'Shift+A' }),
        ).toBe(true);
        expect(
            await playlist.setItemActionArming(0, { actionKey: 'Shift+B' }),
        ).toBe(false);
        expect((jsonData.items as any[])[0].actionKey).toBe('Shift+A');

        expect(
            await playlist.setItemActionArming(0, { actionKey: 'Shift+C' }),
        ).toBe(true);
        expect((jsonData.items as any[])[0].actionKey).toBe('Shift+C');
    });

    test('the three armings are alternatives, so one replaces the others', async () => {
        const { playlist, jsonData } = genPlaylist([
            {
                uuid: 'u-1',
                type: 'action',
                data: 'next-timeout',
                actionNumber: 5,
                actionTime: '19:30',
            },
        ]);
        await playlist.setItemActionArming(0, { actionKey: 'Shift+A' });
        const [itemJson] = jsonData.items as any[];
        expect(itemJson.actionKey).toBe('Shift+A');
        expect(itemJson.actionNumber).toBeUndefined();
        expect(itemJson.actionTime).toBeUndefined();
    });

    test('a duplicate is left unarmed rather than claiming the same key', async () => {
        const { playlist, jsonData } = genPlaylist([
            {
                uuid: 'u-1',
                type: 'action',
                data: 'keyboard-event',
                actionKey: 'Shift+A',
            },
        ]);
        expect(await playlist.duplicateItemAtIndex(0)).toBe(true);
        const [original, copy] = jsonData.items as any[];
        expect(original.actionKey).toBe('Shift+A');
        expect(copy.actionKey).toBeUndefined();
        expect(copy.data).toBe('keyboard-event');
    });
});

describe('what the run registers', () => {
    test('armed lines only, deduped, first one winning', () => {
        const playlistItems = [
            genKeyItem('u-1', 'Shift+A'),
            genKeyItem('u-2'),
            genKeyItem('u-3', 'Ctrl+B'),
            // A hand-edited file, or an imported archive: the sheet answers with
            // the first of them rather than registering the key twice.
            genKeyItem('u-4', 'Shift+A'),
            // Parked: it takes no part in the run, so it takes no key either.
            genKeyItem('u-5', 'Shift+C', true),
            genItem({ uuid: 'u-6', type: 'bg-color', data: '#fff' }),
        ];
        expect(collectPlaylistRunShortcutKeys(playlistItems)).toEqual([
            'Shift+A',
            'Ctrl+B',
        ]);
        expect(findPlaylistRunShortcutUuid(playlistItems, 'Shift+A')).toBe(
            'u-1',
        );
        expect(findPlaylistRunShortcutUuid(playlistItems, 'Ctrl+B')).toBe(
            'u-3',
        );
        expect(
            findPlaylistRunShortcutUuid(playlistItems, 'Shift+C'),
        ).toBeNull();
        expect(
            findPlaylistRunShortcutUuid(playlistItems, 'Shift+Z'),
        ).toBeNull();
        expect(collectPlaylistRunShortcutKeys(null)).toEqual([]);
    });
});
