import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    FOREGROUND_COMPONENT_LIST,
    checkIsForegroundComponentKey,
    toForegroundComponentLabel,
} from './foregroundComponentKeys';
import {
    FOREGROUND_COMPONENT_RULE_MAP,
    getForegroundPropsFlags,
} from './foregroundComponentRules';

// The launcher lazy-loads every panel, so it is read as SOURCE TEXT here --
// the same way the key coverage test reads its labels.
function readLauncherPairs() {
    const source = readFileSync(
        path.join(__dirname, 'foregroundWidgetHelpers.tsx'),
        'utf8',
    );
    const pairs: [string, string][] = [];
    const pattern = /key:\s*'([^']+)',\s*labelKey:\s*'([^']+)'/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
        pairs.push([match[1], match[2]]);
    }
    return pairs;
}

describe('the foreground components, said once', () => {
    it("are the launcher's: the same keys, labels and order", () => {
        expect(
            FOREGROUND_COMPONENT_LIST.map((one) => {
                return [one.key, one.labelKey];
            }),
        ).toEqual(readLauncherPairs());
    });

    it('each has a rule, and Long Text Show alone has no Properties', () => {
        for (const { key } of FOREGROUND_COMPONENT_LIST) {
            expect(FOREGROUND_COMPONENT_RULE_MAP[key]).toBeDefined();
            expect(getForegroundPropsFlags(key) === null).toBe(
                key === 'long-text',
            );
        }
    });

    it('names a key and its label', () => {
        expect(checkIsForegroundComponentKey('quick-text')).toBe(true);
        expect(checkIsForegroundComponentKey('clock')).toBe(false);
        expect(toForegroundComponentLabel('time')).toBe('Time');
    });

    it("files a session's keys where the panels always have", () => {
        expect(
            FOREGROUND_COMPONENT_RULE_MAP.countdown.toOwnSettingNames('-s1'),
        ).toContain('foreground-minutes-setting-s1');
        expect(
            FOREGROUND_COMPONENT_RULE_MAP['quick-text'].toSessionPrefix?.(''),
        ).toBe('quick-text');
        expect(FOREGROUND_COMPONENT_RULE_MAP.camera.toItemPrefix?.('abc')).toBe(
            'camera-abc',
        );
    });
});
