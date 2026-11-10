import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state } = vi.hoisted(() => ({
    state: {
        settings: new Map<string, string>(),
        dictionaries: [] as Record<string, string>[],
    },
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: (name: string) => state.settings.get(name) ?? null,
    setSetting: (name: string, value: string) => {
        state.settings.set(name, value);
    },
}));
// A label missing from any language package fails here, as it throws in dev.
vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => {
        for (const dictionary of state.dictionaries) {
            if (dictionary[key.trim().toLowerCase()] === undefined) {
                throw new Error(`Missing translation: ${key}`);
            }
        }
        return key;
    },
}));

import { readLangPackageDictionaries } from '../test-setup/langPackageDirs';
import { FOREGROUND_COMPONENT_KEYS } from './foregroundComponentKeys';
import {
    FOREGROUND_PRESET_MAP,
    applyForegroundColorMode,
    applyForegroundPreset,
    getForegroundPreset,
    readForegroundPresetAsk,
    toPresetSessionSuffix,
} from './foregroundPresetHelpers';
import { toForegroundPresetLabel } from './foregroundPresetLabelHelpers';
import { applyQuickTextPreset } from './quickTextPresetHelpers';

const TEXT = { isFontSize: true, isGeometry: true, isCommonStyle: true };
const dictionaries = readLangPackageDictionaries();

beforeEach(() => {
    state.settings.clear();
    state.dictionaries = dictionaries;
});

function apply(
    widgetKey: string,
    prefix: string,
    flags: typeof TEXT,
    presetId: any,
) {
    const preset = getForegroundPreset(widgetKey, presetId);
    expect(preset, `${widgetKey} ${presetId}`).toBeDefined();
    applyForegroundPreset({ widgetKey, prefix, flags, preset: preset! });
}

describe('foreground presets', () => {
    test('every component with Properties has presets, each named in every language', () => {
        // Long Text Show keeps its own style panel and its own presets.
        const withProperties = FOREGROUND_COMPONENT_KEYS.filter((key) => {
            return key !== 'long-text';
        });
        for (const key of withProperties) {
            expect(FOREGROUND_PRESET_MAP[key]?.length, key).toBeGreaterThan(2);
        }
        for (const presetList of Object.values(FOREGROUND_PRESET_MAP)) {
            for (const preset of presetList) {
                expect(toForegroundPresetLabel(preset.id)).toBeTruthy();
            }
        }
    });

    test('a quick text preset writes its whole look, its seconds and its format', () => {
        state.settings.set(
            'foreground-quick-text-setting-s1',
            'Pastor John\n\nSenior Pastor',
        );
        state.settings.set('quick-text-s1-common-font-family', 'Battambang');
        apply('quick-text', 'quick-text-s1', TEXT, 'speaker');
        const get = (key: string) => state.settings.get(key);
        expect(get('quick-text-s1-setting-show-widget-font-size')).toBe('40');
        expect(get('quick-text-s1-setting-show-widget-width-percentage')).toBe(
            '40',
        );
        expect(
            JSON.parse(
                get('quick-text-s1-setting-show-widget-alignment-data')!,
            ),
        ).toEqual({ horizontalAlignment: 'left', verticalAlignment: 'end' });
        expect(get('quick-text-s1-common-background-color')).toBe('#1D4ED8E6');
        expect(
            JSON.parse(get('quick-text-s1-setting-show-widget-decoration')!),
        ).toMatchObject({ textAlign: 'left', padding: 0.5, shadow: 'medium' });
        expect(get('foreground-quick-text-time-to-live-s1')).toBe('10');
        expect(get('foreground-quick-text-setting-s1')).toBe(
            '### Pastor John\n\nSenior Pastor',
        );
        // The font the operator chose for the language is theirs.
        expect(get('quick-text-s1-common-font-family')).toBe('Battambang');
    });

    test('a box with nothing of the person in it gets the preset example', () => {
        // Never typed in: the session still shows its sample.
        expect(applyQuickTextPreset('', 'bible-verse')).toBe(true);
        expect(state.settings.get('foreground-quick-text-setting')).toBe(
            '### (KJV) John 3:16\n\nFor God so loved the world, that he ' +
                'gave his only begotten Son, that whosoever believeth in him ' +
                'should not perish, but have everlasting life.',
        );
        // Emptied by hand: the same.
        state.settings.set('foreground-quick-text-setting-s4', '  ');
        applyQuickTextPreset('-s4', 'song-title');
        expect(state.settings.get('foreground-quick-text-setting-s4')).toBe(
            '**Amazing Grace**\n\n*John Newton*',
        );
        // The sample itself counts as untouched, words of their own never.
        state.settings.set(
            'foreground-quick-text-setting-s5',
            '## This is Title\n\ntext **bold** and *italic*.',
        );
        applyQuickTextPreset('-s5', 'speaker');
        expect(state.settings.get('foreground-quick-text-setting-s5')).toBe(
            '### Pastor John Smith\n\nSenior Pastor, Grace Church',
        );
        state.settings.set('foreground-quick-text-setting-s6', 'Mine');
        applyQuickTextPreset('-s6', 'speaker');
        expect(state.settings.get('foreground-quick-text-setting-s6')).toBe(
            '### Mine',
        );
        expect(applyQuickTextPreset('', 'urgent-alert' as any)).toBe(false);
    });

    test('a Bible Verse look sets a long passage smaller', () => {
        state.settings.set(
            'foreground-quick-text-setting-s3',
            '**(KJV) Proverbs 17:22-28**\n\n' + 'word '.repeat(200),
        );
        expect(applyQuickTextPreset('-s3', 'bible-verse')).toBe(true);
        // 1 023 letters: 45px for three verses' worth, smaller past it.
        expect(
            state.settings.get('quick-text-s3-setting-show-widget-font-size'),
        ).toBe('31');
        expect(
            state.settings.get(
                'quick-text-s3-setting-show-widget-width-percentage',
            ),
        ).toBe('100');
        expect(
            JSON.parse(
                state.settings.get(
                    'quick-text-s3-setting-show-widget-decoration',
                )!,
            ),
        ).toMatchObject({ textAlign: 'left', padding: 1 });
        expect(state.settings.get('foreground-quick-text-setting-s3')).toMatch(
            /^### \(KJV\) Proverbs 17:22-28\n\n/,
        );
    });

    test('a marquee gets colours and its speed, never a place or a font size', () => {
        const marqueeFlags = {
            isFontSize: false,
            isGeometry: false,
            isCommonStyle: true,
        };
        apply(
            'marquee-bottom',
            'marquee-bottom-s2',
            marqueeFlags,
            'urgent-alert',
        );
        const keys = [...state.settings.keys()];
        expect(keys.some((key) => key.includes('alignment'))).toBe(false);
        expect(keys.some((key) => key.includes('width-percentage'))).toBe(
            false,
        );
        expect(keys.some((key) => key.endsWith('font-size-s2'))).toBe(false);
        expect(
            state.settings.get('marquee-bottom-s2-common-background-color'),
        ).toBe('#B91C1CF2');
        expect(
            state.settings.get('foreground-marquee-bottom-speed-percentage-s2'),
        ).toBe('130');
    });

    test('a picture gets a place and a frame, never a text colour', () => {
        const pictureFlags = {
            isFontSize: false,
            isGeometry: true,
            isCommonStyle: false,
        };
        apply('video', 'video-show', pictureFlags, 'picture-in-picture');
        expect(
            state.settings.get(
                'video-show-setting-show-widget-width-percentage',
            ),
        ).toBe('30');
        expect(
            [...state.settings.keys()].some((key) => key.includes('common')),
        ).toBe(false);
        // The dressing a picture starts from has no padding round it.
        expect(
            JSON.parse(
                state.settings.get(
                    'video-show-setting-show-widget-decoration',
                )!,
            ),
        ).toMatchObject({ padding: 0, shadow: 'strong' });
    });

    test('a preset goes on in the side the words are on, or the one asked for', () => {
        const get = (key: string) => state.settings.get(key);
        // Fresh: white words, the Dark side -- the preset's own colours.
        apply('quick-text', 'quick-text-s1', TEXT, 'speaker');
        expect(get('quick-text-s1-common-color')).toBe('#FFFFFF');
        expect(get('quick-text-s1-common-background-color')).toBe('#1D4ED8E6');
        // Words made dark by hand: the next preset comes on Light.
        state.settings.set('quick-text-s1-common-color', '#111827');
        apply('quick-text', 'quick-text-s1', TEXT, 'bible-verse');
        expect(get('quick-text-s1-common-color')).toBe('#000000');
        expect(get('quick-text-s1-common-background-color')).toBe('#FFFFFFB3');
        // Asked for by name, whatever the words are now.
        applyForegroundPreset({
            widgetKey: 'quick-text',
            prefix: 'quick-text-s1',
            flags: TEXT,
            preset: getForegroundPreset('quick-text', 'bible-verse')!,
            mode: 'dark',
        });
        expect(get('quick-text-s1-common-color')).toBe('#FFFFFF');
        expect(get('quick-text-s1-common-background-color')).toBe('#000000B3');
    });

    test("the switch turns a session's own colours, the box keeping its colour", () => {
        state.settings.set('message-s2-common-color', '#FFFFFF');
        state.settings.set('message-s2-common-background-color', '#B45309E6');
        expect(applyForegroundColorMode('message-s2', 'dark')).toBe(false);
        expect(applyForegroundColorMode('message-s2', 'light')).toBe(true);
        expect(state.settings.get('message-s2-common-color')).toBe('#000000');
        expect(state.settings.get('message-s2-common-background-color')).toBe(
            '#F6954BE6',
        );
        expect(applyForegroundColorMode('message-s2', 'dark')).toBe(true);
        expect(state.settings.get('message-s2-common-background-color')).toBe(
            '#B45309E6',
        );
        // Nothing set yet: the panel's own defaults are what is turned.
        expect(applyForegroundColorMode('countdown', 'light')).toBe(true);
        expect(state.settings.get('countdown-common-color')).toBe('#000000');
    });

    test('a preset asked for in words, with or without its side', () => {
        const read = (text: string) => {
            const ask = readForegroundPresetAsk('quick-text', text);
            return ask === null
                ? null
                : { id: ask.preset?.id ?? null, mode: ask.mode };
        };
        expect(read('speaker')).toEqual({ id: 'speaker', mode: null });
        expect(read('Speaker Light')).toEqual({
            id: 'speaker',
            mode: 'light',
        });
        expect(read('dark bible verse')).toEqual({
            id: 'bible-verse',
            mode: 'dark',
        });
        expect(read('bible-verse-light')).toEqual({
            id: 'bible-verse',
            mode: 'light',
        });
        expect(read('light mode')).toEqual({ id: null, mode: 'light' });
        expect(read('center')).toBeNull();
        expect(read('')).toBeNull();
        // A marquee's sides are the switch, no longer presets of its own.
        expect(
            FOREGROUND_PRESET_MAP['marquee-top'].map((preset) => preset.id),
        ).toEqual(['announcement', 'bible-verse', 'urgent-alert']);
    });

    test('every preset of a box of words says its own font size', () => {
        // Left out, a clock kept the panel's 100px default and its digits
        // ran out of a corner box (the user's picture, 2026-11-09).
        for (const [widgetKey, presetList] of Object.entries(
            FOREGROUND_PRESET_MAP,
        )) {
            if (
                [
                    'marquee-top',
                    'marquee-bottom',
                    'video',
                    'image',
                    'web',
                    'screen',
                    'camera',
                ].includes(widgetKey)
            ) {
                continue;
            }
            for (const preset of presetList) {
                expect(
                    preset.look.fontSize,
                    `${widgetKey} ${preset.id}`,
                ).toBeGreaterThan(0);
                expect(
                    preset.look.scale ?? 1,
                    `${widgetKey} ${preset.id}`,
                ).toBe(1);
            }
        }
    });

    test('a clock filed under its own id has no session and sets nothing of its own', () => {
        expect(toPresetSessionSuffix('time', 'time-abc')).toBe('-abc');
        expect(toPresetSessionSuffix('quick-text', 'quick-text')).toBe('');
        expect(toPresetSessionSuffix('countdown', 'other')).toBe('');
        const clockFlags = {
            isFontSize: true,
            isGeometry: true,
            isCommonStyle: true,
        };
        apply('time', 'time-abc', clockFlags, 'center');
        // Large by its font at scale 1, not stretched by `scale`.
        expect(state.settings.get('time-abc-setting-show-widget-scale')).toBe(
            '1',
        );
        expect(
            state.settings.get('time-abc-setting-show-widget-font-size'),
        ).toBe('120');
        expect(
            [...state.settings.keys()].every((key) => {
                return key.startsWith('time-abc-');
            }),
        ).toBe(true);
    });
});
