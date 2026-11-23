import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    settings: new Map<string, string>(),
}));

// `toArchiveFileName` is pure; its module's file helpers reach the app.
vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: vi.fn(),
    pathBasename: vi.fn(),
    pathJoin: vi.fn(),
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (name: string) => h.settings.get(name) ?? null,
    setSetting: (name: string, value: string) => {
        h.settings.set(name, value);
    },
}));

import {
    DEFAULT_ANIMATION_EXPORT_OPTIONS,
    genAnimationExportFileName,
    listAnimationExportCodecs,
    listAnimationExportSizes,
    readAnimationExportOptions,
    saveAnimationExportOptions,
    toAnimationExportBitrate,
    toAnimationExportDirSettingName,
    toAnimationExportEdge,
    toAnimationExportWallSeconds,
    toAnimationShaderTime,
    toValidAnimationExportOptions,
} from './animationExportOptionHelpers';
import {
    ANIMATION_STILL_TIME_SECONDS,
    parseAnimation,
    type AnimationType,
} from './animationValueHelpers';
import { listAnimationCategorySrcs } from './animationBuiltInHelpers';

beforeEach(() => {
    h.settings.clear();
});

describe('where a saved animation goes', () => {
    it('is the Default session folder of its panel when no other is chosen', () => {
        expect(toAnimationExportDirSettingName('background', 'image')).toBe(
            'select-dir-image-bg',
        );
        expect(toAnimationExportDirSettingName('background', 'video')).toBe(
            'select-dir-video-bg',
        );
        expect(toAnimationExportDirSettingName('foreground', 'image')).toBe(
            'select-dir-image-fg',
        );
        expect(toAnimationExportDirSettingName('foreground', 'video')).toBe(
            'select-dir-video-fg',
        );
    });

    it('follows the session in use in that panel, and only that panel', () => {
        h.settings.set(
            'background-video-sessions',
            JSON.stringify([
                { id: '', name: 'Default' },
                { id: 'sabc', name: 'Christmas' },
            ]),
        );
        h.settings.set('background-video-active-session', 'sabc');
        expect(toAnimationExportDirSettingName('background', 'video')).toBe(
            'select-dir-video-bg-sabc',
        );
        // Images keeps its own session; Video Show its own.
        expect(toAnimationExportDirSettingName('background', 'image')).toBe(
            'select-dir-image-bg',
        );
        expect(toAnimationExportDirSettingName('foreground', 'video')).toBe(
            'select-dir-video-fg',
        );
    });

    it('falls back to the first session when the one chosen is gone', () => {
        h.settings.set(
            'foreground-image-sessions',
            JSON.stringify([{ id: 'sone', name: 'One' }]),
        );
        h.settings.set('foreground-image-active-session', 'sgone');
        expect(toAnimationExportDirSettingName('foreground', 'image')).toBe(
            'select-dir-image-fg-sone',
        );
    });
});

describe('the options asked for', () => {
    it('makes every edge whole, even and within 16-4096', () => {
        expect(toAnimationExportEdge(1920)).toBe(1920);
        expect(toAnimationExportEdge(1081)).toBe(1080);
        expect(toAnimationExportEdge(1366.6)).toBe(1366);
        expect(toAnimationExportEdge(3)).toBe(16);
        expect(toAnimationExportEdge(99999)).toBe(4096);
        expect(toAnimationExportEdge('nope')).toBe(16);
    });

    it('keeps seconds within 1-300 and a frame rate it offers', () => {
        expect(
            toValidAnimationExportOptions({
                seconds: 0,
                frameRate: 25,
                width: 641,
                height: 361,
            }),
        ).toEqual({ width: 640, height: 360, seconds: 1, frameRate: 30 });
        expect(
            toValidAnimationExportOptions({ seconds: 1000, frameRate: 60 }),
        ).toMatchObject({ seconds: 300, frameRate: 60 });
        expect(toValidAnimationExportOptions(null)).toEqual(
            DEFAULT_ANIMATION_EXPORT_OPTIONS,
        );
    });

    it('remembers the last options, and survives a broken setting', () => {
        expect(readAnimationExportOptions()).toEqual(
            DEFAULT_ANIMATION_EXPORT_OPTIONS,
        );
        saveAnimationExportOptions({
            width: 1280,
            height: 720,
            seconds: 5,
            frameRate: 24,
        });
        expect(readAnimationExportOptions()).toEqual({
            width: 1280,
            height: 720,
            seconds: 5,
            frameRate: 24,
        });
        h.settings.set('animation-export-options', '{not json');
        expect(readAnimationExportOptions()).toEqual(
            DEFAULT_ANIMATION_EXPORT_OPTIONS,
        );
    });

    it('offers the presets then each monitor size not already there', () => {
        expect(
            listAnimationExportSizes([
                { width: 1920, height: 1080 },
                { width: 1440, height: 900 },
                { width: 1365, height: 767 },
            ]),
        ).toEqual([
            { width: 1280, height: 720 },
            { width: 1920, height: 1080 },
            { width: 2560, height: 1440 },
            { width: 3840, height: 2160 },
            { width: 1440, height: 900 },
            { width: 1364, height: 766 },
        ]);
    });
});

describe('the file written', () => {
    it('is named after the animation and its size', () => {
        const options = {
            width: 1920,
            height: 1080,
            seconds: 10,
            frameRate: 30,
        };
        expect(
            genAnimationExportFileName(
                'Christmas - Snowfall',
                'video',
                options,
            ),
        ).toBe('Christmas - Snowfall 1920x1080.mp4');
        expect(genAnimationExportFileName('Glass: 2/3', 'image', options)).toBe(
            'Glass_ 2_3 1920x1080.png',
        );
    });

    it('starts at the still a tile shows, a shader at its speed', () => {
        expect(toAnimationExportWallSeconds(0, 30)).toBe(
            ANIMATION_STILL_TIME_SECONDS,
        );
        expect(toAnimationExportWallSeconds(45, 30)).toBe(
            ANIMATION_STILL_TIME_SECONDS + 1.5,
        );
        const animation = parseAnimation(
            listAnimationCategorySrcs('christmas', 'glsl')[0],
        ) as AnimationType;
        expect(toAnimationShaderTime({ ...animation, speed: 'fast' }, 7)).toBe(
            14,
        );
        expect(toAnimationShaderTime({ ...animation, speed: 'slow' }, 7)).toBe(
            3.5,
        );
    });

    it('asks H.264 for the smallest level that holds the size and rate', () => {
        expect(listAnimationExportCodecs(1920, 1080, 30)).toEqual([
            'avc1.640028',
            'avc1.4D0028',
            'avc1.42E028',
        ]);
        expect(listAnimationExportCodecs(1920, 1080, 60)[0]).toBe(
            'avc1.64002A',
        );
        expect(listAnimationExportCodecs(1280, 720, 30)[0]).toBe('avc1.64001F');
        expect(listAnimationExportCodecs(3840, 2160, 30)[0]).toBe(
            'avc1.640033',
        );
        expect(listAnimationExportCodecs(3840, 2160, 60)[0]).toBe(
            'avc1.640034',
        );
    });

    it('spends about a tenth of a bit a pixel a frame, within 1-40 Mbps', () => {
        expect(toAnimationExportBitrate(1920, 1080, 30)).toBe(6_220_800);
        expect(toAnimationExportBitrate(16, 16, 24)).toBe(1_000_000);
        expect(toAnimationExportBitrate(3840, 2160, 60)).toBe(40_000_000);
    });
});
