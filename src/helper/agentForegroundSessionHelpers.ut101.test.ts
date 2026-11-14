// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

// The settings a session lives in, as a plain map: the module reads and
// writes nothing else.
const h = vi.hoisted(() => {
    return { settings: new Map<string, string>() };
});

vi.mock('./settingHelpers', () => ({
    getSetting: (key: string) => h.settings.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        h.settings.set(key, value);
    },
    removeSetting: (key: string) => {
        h.settings.delete(key);
    },
}));

import {
    activateForegroundSession,
    applySettingWrites,
    findForegroundSession,
    genLookCopyWrites,
    genNewForegroundSession,
    genSessionStripKeys,
    getActiveForegroundSession,
    readClockIdList,
    readForegroundSessions,
    readSettingForBackup,
    toForegroundSessionName,
} from './agentForegroundSessionHelpers';

function setSessions(widget: string, list: { id: string; name: string }[]) {
    h.settings.set(`foreground-${widget}-sessions`, JSON.stringify(list));
}

beforeEach(() => {
    h.settings.clear();
});

describe('finding a session', () => {
    beforeEach(() => {
        setSessions('countdown', [
            { id: '', name: 'Default' },
            { id: 's1', name: 'Evening   Service' },
        ]);
    });

    it('finds one by the id an attached chip carries', () => {
        expect(findForegroundSession('countdown', 's1')).toMatchObject({
            id: 's1',
            name: 'Evening   Service',
            suffix: '-s1',
            isActive: false,
        });
    });

    it('finds one by its name, case and spacing aside', () => {
        expect(
            findForegroundSession('countdown', '  EVENING service '),
        ).toMatchObject({ id: 's1' });
        expect(findForegroundSession('countdown', 'Morning')).toBeNull();
    });

    it('finds nothing for a value that is not words', () => {
        expect(findForegroundSession('countdown', 7)).toBeNull();
        expect(findForegroundSession('countdown', null)).toBeNull();
    });

    it('finds nothing for blank words when no session has the empty id', () => {
        setSessions('countdown', [{ id: 's1', name: 'Only' }]);
        expect(findForegroundSession('countdown', '   ')).toBeNull();
    });

    it('takes the first session when the stored active one is gone', () => {
        h.settings.set('foreground-countdown-active-session', 'gone');
        expect(getActiveForegroundSession('countdown')).toMatchObject({
            id: '',
            name: 'Default',
        });
        h.settings.set('foreground-countdown-active-session', 's1');
        expect(getActiveForegroundSession('countdown').id).toBe('s1');
        expect(
            readForegroundSessions('countdown').map((one) => {
                return one.isActive;
            }),
        ).toEqual([false, true]);
    });
});

describe('toForegroundSessionName', () => {
    it("is a heading's or a mark-up line's own words", () => {
        expect(toForegroundSessionName('## John 3:16\n\nFor God')).toBe(
            'John 3:16',
        );
        expect(toForegroundSessionName('\n  \n**Hold** _fast_ `now`')).toBe(
            'Hold fast now',
        );
        expect(toForegroundSessionName('   ')).toBe('');
    });

    it('cuts a long line at a whole word, and a long word where it must', () => {
        const name = toForegroundSessionName(
            'Welcome to the evening service of the church family',
        );
        expect(name).toBe('Welcome to the evening service of the…');
        expect(name.length).toBeLessThanOrEqual(41);
        const word = 'x'.repeat(55);
        expect(toForegroundSessionName(word)).toBe(`${'x'.repeat(40)}…`);
    });
});

describe('genLookCopyWrites', () => {
    it("copies a marquee's own size and speed, and only keys that are set", () => {
        h.settings.set('marquee-top-common-color', '#FF0000');
        h.settings.set('marquee-top-common-font-family', '');
        h.settings.set('foreground-marquee-top-font-size', '48');
        h.settings.set('foreground-marquee-top-speed-percentage', '150');
        const writes = genLookCopyWrites('marquee-top', '', '-s2');
        expect(writes).toEqual(
            expect.arrayContaining([
                { key: 'marquee-top-s2-common-color', value: '#FF0000' },
                { key: 'foreground-marquee-top-font-size-s2', value: '48' },
                {
                    key: 'foreground-marquee-top-speed-percentage-s2',
                    value: '150',
                },
            ]),
        );
        // An empty value is no choice anybody made: not copied.
        expect(
            writes.some((write) => {
                return write.key === 'marquee-top-s2-common-font-family';
            }),
        ).toBe(false);
        expect(writes).toHaveLength(3);
    });

    it('copies nothing for a component whose look belongs to its items', () => {
        h.settings.set('time-setting-show-widget-font-size', '80');
        expect(genLookCopyWrites('time', '', '-s2')).toEqual([]);
    });
});

describe('readClockIdList', () => {
    it('keeps the ids and drops what is not one', () => {
        h.settings.set(
            'foreground-time-id-list-s3',
            JSON.stringify(['c1', 4, null, 'c2']),
        );
        expect(readClockIdList('-s3')).toEqual(['c1', 'c2']);
    });

    it('is empty for a broken or a non-list value', () => {
        h.settings.set('foreground-time-id-list', '{not json');
        expect(readClockIdList('')).toEqual([]);
        h.settings.set('foreground-time-id-list', '{"c1": true}');
        expect(readClockIdList('')).toEqual([]);
    });
});

describe('the strip and the writes', () => {
    it("names a component's strip keys for the backup", () => {
        expect(genSessionStripKeys('quick-text')).toEqual([
            'foreground-quick-text-sessions',
            'foreground-quick-text-active-session',
        ]);
    });

    it('makes a new session id that is never the Default one', () => {
        const fresh = genNewForegroundSession('Youth');
        expect(fresh.name).toBe('Youth');
        expect(fresh.id).not.toBe('');
        expect(fresh.suffix).toBe(`-${fresh.id}`);
        expect(genNewForegroundSession('Again').id).not.toBe(fresh.id);
    });

    it('switches the panel to a session only when it is not on it already', () => {
        setSessions('stopwatch', [
            { id: '', name: 'Default' },
            { id: 's9', name: 'Lap' },
        ]);
        activateForegroundSession('stopwatch', '');
        // Already on Default: nothing is written.
        expect(h.settings.has('foreground-stopwatch-active-session')).toBe(
            false,
        );
        activateForegroundSession('stopwatch', 's9');
        expect(h.settings.get('foreground-stopwatch-active-session')).toBe(
            's9',
        );
        expect(getActiveForegroundSession('stopwatch').name).toBe('Lap');
    });

    it('reads what a write replaces, an absent key as null', () => {
        expect(readSettingForBackup('foreground-message-setting')).toBeNull();
        h.settings.set('foreground-message-setting', 'Hello');
        expect(readSettingForBackup('foreground-message-setting')).toBe(
            'Hello',
        );
    });

    it('writes a value and removes a key written as null', () => {
        h.settings.set('gone-key', 'old');
        applySettingWrites([
            { key: 'kept-key', value: 'new' },
            { key: 'gone-key', value: null },
        ]);
        expect(h.settings.get('kept-key')).toBe('new');
        expect(h.settings.has('gone-key')).toBe(false);
    });
});
