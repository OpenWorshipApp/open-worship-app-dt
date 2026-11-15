import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { dirSourceSettingNames } from '../helper/constants';
import { FOREGROUND_COMPONENT_KEYS } from './foregroundComponentKeys';
import {
    FOREGROUND_COMPONENT_RULE_MAP,
    QUICK_TEXT_DEFAULT_DELAY_SECOND,
    QUICK_TEXT_DEFAULT_LIVE_SECOND,
    genClockOwnSettingNames,
    genForegroundOwnSettingNames,
    genQuickTextOwnSettingNames,
    getForegroundPropsFlags,
    toClockIdListSettingName,
    toForegroundSessionsTarget,
} from './foregroundComponentRules';
import { genStopwatchHistorySettingName } from './stopwatchHistoryHelpers';

// The keys a panel spells for ITSELF in its own `genOwnSettingNames`, read as
// source text: the rule must name the very keys that panel writes, or the
// assistant writes a session the panel never shows.
function readPanelOwnSettingNames(fileName: string, suffix: string) {
    const source = readFileSync(path.join(__dirname, fileName), 'utf8');
    const start = source.indexOf('function genOwnSettingNames(suffix: string)');
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf('\n}', start);
    const body = source.slice(start, end);
    const nameList: string[] = [];
    const pattern = /`([^`$]+)\$\{suffix\}`/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(body)) !== null) {
        nameList.push(`${match[1]}${suffix}`);
    }
    return nameList;
}

describe('what each foreground component keeps', () => {
    it('files every session-holding component under its own prefix, one per suffix', () => {
        const prefixOf = (suffix: string) => {
            return FOREGROUND_COMPONENT_KEYS.flatMap((key) => {
                const prefix =
                    FOREGROUND_COMPONENT_RULE_MAP[key].toSessionPrefix?.(
                        suffix,
                    );
                return prefix === undefined ? [] : [prefix];
            });
        };
        expect(prefixOf('-s2')).toEqual([
            'message-s2',
            'marquee-top-s2',
            'marquee-bottom-s2',
            'quick-text-s2',
            'countdown-s2',
            'stopwatch-s2',
            'video-show-s2',
            'image-show-s2',
            'fill-show-s2',
            'animation-show-s2',
            'web-show-s2',
        ]);
        // The Default session is the empty suffix: the bare prefix.
        expect(prefixOf('')).toContain('video-show');
        expect(new Set(prefixOf('-s2')).size).toBe(prefixOf('-s2').length);
    });

    it('files a clock, a camera and a source screen by the item, never by a session', () => {
        const { time, camera, screen } = FOREGROUND_COMPONENT_RULE_MAP;
        expect(time.toSessionPrefix).toBeUndefined();
        expect(time.toItemPrefix?.('c1')).toBe('time-c1');
        expect(camera.toItemPrefix?.('cam-9')).toBe('camera-cam-9');
        // `screen-show-`, so a source screen's keys never collide with the
        // keys of the screen that owns them (swept when it is deleted).
        expect(screen.toItemPrefix?.('2')).toBe('screen-show-2');
        expect(screen.toItemPrefix?.('2')).not.toBe('screen-2');
        expect(camera.hasSessions).toBe(false);
        expect(screen.hasSessions).toBe(false);
        expect(time.hasSessions).toBe(true);
    });

    it('gives Long Text Show sessions but no Properties at all', () => {
        const rule = FOREGROUND_COMPONENT_RULE_MAP['long-text'];
        expect(rule.hasSessions).toBe(true);
        expect(rule.toSessionPrefix).toBeUndefined();
        expect(rule.toItemPrefix).toBeUndefined();
        expect(getForegroundPropsFlags('long-text')).toBeNull();
        expect(genForegroundOwnSettingNames('long-text', '-s3')).toEqual([
            'long-text-setting-s3',
        ]);
    });

    it('hands each component the Properties rows its panel shows', () => {
        expect(getForegroundPropsFlags('message')).toEqual({
            isFontSize: true,
            isGeometry: true,
            isCommonStyle: true,
            isBlendMode: false,
        });
        // A marquee is a band across the screen: no place, its own size row.
        expect(getForegroundPropsFlags('marquee-top')).toMatchObject({
            isFontSize: false,
            isGeometry: false,
            isCommonStyle: true,
        });
        // Quick Text's side margins are its width.
        expect(getForegroundPropsFlags('quick-text')).toMatchObject({
            isFontSize: true,
            isMargin: true,
        });
        expect(getForegroundPropsFlags('time')?.isFontSize).toBe(true);
        for (const key of ['video', 'image', 'web', 'screen'] as const) {
            expect(getForegroundPropsFlags(key)).toEqual({
                isFontSize: false,
                isGeometry: true,
                isCommonStyle: false,
                isBlendMode: true,
            });
        }
        expect(getForegroundPropsFlags('camera')).toEqual({
            isFontSize: false,
            isGeometry: true,
            isCommonStyle: true,
            isBlendMode: true,
        });
    });

    it('keeps each media session on its own folder, Web Show on the Background Webs one', () => {
        expect(genForegroundOwnSettingNames('video', '-a')).toEqual([
            `${dirSourceSettingNames.FOREGROUND_VIDEO}-a`,
        ]);
        expect(genForegroundOwnSettingNames('image', '')).toEqual([
            dirSourceSettingNames.FOREGROUND_IMAGE,
        ]);
        expect(genForegroundOwnSettingNames('web', '-b')).toEqual([
            `${dirSourceSettingNames.BACKGROUND_WEB}-b`,
        ]);
        expect(dirSourceSettingNames.FOREGROUND_VIDEO).not.toBe(
            dirSourceSettingNames.BACKGROUND_VIDEO,
        );
    });

    it('names no own setting for a camera or a source screen', () => {
        expect(genForegroundOwnSettingNames('camera', '-a')).toEqual([]);
        expect(genForegroundOwnSettingNames('screen', '-a')).toEqual([]);
    });

    it("lists a Time session's clocks under one key, and each clock's own four", () => {
        expect(genForegroundOwnSettingNames('time', '-s1')).toEqual([
            toClockIdListSettingName('-s1'),
        ]);
        expect(toClockIdListSettingName('-s1')).toBe(
            'foreground-time-id-list-s1',
        );
        expect(genClockOwnSettingNames('k7')).toEqual({
            cityName: 'foreground-city-name-setting-k7',
            hourOffset: 'foreground-timezone-minute-offset-setting-k7',
            zoneName: 'foreground-timezone-name-setting-k7',
            is24HourFormat: 'foreground-time-is-24-hour-format-setting-k7',
        });
    });

    it("keeps a stopwatch session's reset history beside its auto start", () => {
        expect(genForegroundOwnSettingNames('stopwatch', '-x')).toEqual([
            'foreground-stopwatch-auto-start-setting-x',
            genStopwatchHistorySettingName('-x'),
        ]);
    });

    it('times a quick text per session, five seconds and no delay by default', () => {
        expect(QUICK_TEXT_DEFAULT_DELAY_SECOND).toBe(0);
        expect(QUICK_TEXT_DEFAULT_LIVE_SECOND).toBe(5);
        expect(genForegroundOwnSettingNames('quick-text', '-q')).toEqual(
            Object.values(genQuickTextOwnSettingNames('-q')),
        );
        expect(genQuickTextOwnSettingNames('-q')).toEqual({
            text: 'foreground-quick-text-setting-q',
            delay: 'foreground-quick-text-time-delay-q',
            live: 'foreground-quick-text-time-to-live-q',
            isInfinite: 'foreground-quick-text-is-infinite-q',
        });
    });

    it('gives two sessions of a component no key in common', () => {
        for (const key of FOREGROUND_COMPONENT_KEYS) {
            if (!FOREGROUND_COMPONENT_RULE_MAP[key].hasSessions) {
                continue;
            }
            const defaultNames = genForegroundOwnSettingNames(key, '');
            const otherNames = genForegroundOwnSettingNames(key, '-s9');
            expect(otherNames.length).toBe(defaultNames.length);
            for (const name of otherNames) {
                expect(name.endsWith('-s9')).toBe(true);
                expect(defaultNames).not.toContain(name);
            }
        }
    });

    it('keeps the sessions strip of a component apart from a Background tab of the same word', () => {
        expect(toForegroundSessionsTarget('image')).toBe('foreground-image');
        expect(toForegroundSessionsTarget('quick-text')).toBe(
            'foreground-quick-text',
        );
    });

    it('names the very keys the Messages and Countdown panels write', () => {
        for (const [fileName, key] of [
            ['ForegroundMessageComp.tsx', 'message'],
            ['ForegroundCountDownComp.tsx', 'countdown'],
        ] as const) {
            const panelNames = readPanelOwnSettingNames(fileName, '-p4');
            expect(panelNames.length).toBeGreaterThan(0);
            expect(genForegroundOwnSettingNames(key, '-p4')).toEqual(
                panelNames,
            );
        }
        // The countdown keeps the names it always had (`foreground-date`).
        expect(genForegroundOwnSettingNames('countdown', '')).toContain(
            'foreground-date-setting',
        );
    });

    it("names the marquees' keys as their panel does", () => {
        const source = readFileSync(
            path.join(__dirname, 'ForegroundMarqueeComp.tsx'),
            'utf8',
        );
        for (const position of ['top', 'bottom'] as const) {
            const key = `marquee-${position}` as const;
            const read = (field: string) => {
                const match = new RegExp(
                    `${field}:\\s*'(foreground-marquee-${position}-[a-z-]+)'`,
                ).exec(source);
                expect(match).not.toBeNull();
                return `${match![1]}-m1`;
            };
            expect(genForegroundOwnSettingNames(key, '-m1')).toEqual([
                read('textSettingName'),
                read('fontSizeSettingName'),
                read('speedSettingName'),
            ]);
        }
    });
});
