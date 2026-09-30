// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const settingMap = new Map<string, string>();

vi.mock('../helper/settingHelpers', () => {
    return {
        getSetting: (key: string) => {
            return settingMap.get(key) ?? null;
        },
        setSetting: (key: string, value: string) => {
            settingMap.set(key, value);
        },
    };
});

const {
    DEFAULT_SLIDE_AUTO_PLAY_OPTIONS,
    checkIsSlideAutoPlaying,
    genNextDelaySeconds,
    getSlideAutoPlayRemainingSeconds,
    readSlideAutoPlayOptions,
    setIsSlideAutoPlaying,
    setSlideAutoPlayDueAt,
    toNextIndex,
} = await import('./slideAutoPlayHelpers');

const PREFIX = 'foreground-video';

describe('readSlideAutoPlayOptions', () => {
    beforeEach(() => {
        settingMap.clear();
    });

    it('should default to the old behaviour when nothing is set', () => {
        expect(readSlideAutoPlayOptions(PREFIX)).toEqual(
            DEFAULT_SLIDE_AUTO_PLAY_OPTIONS,
        );
    });

    it('should read what the panel wrote', () => {
        settingMap.set(`${PREFIX}-slide-auto-play-timer-seconds`, '4');
        settingMap.set(`${PREFIX}-slide-auto-play-timer-max-seconds`, '9');
        settingMap.set(`${PREFIX}-slide-auto-play-repeat`, 'none');
        settingMap.set(`${PREFIX}-slide-auto-play-step`, '3');
        settingMap.set(`${PREFIX}-slide-auto-play-until-media-end`, 'true');
        expect(readSlideAutoPlayOptions(PREFIX)).toEqual({
            seconds: 4,
            maxSeconds: 9,
            repeatKind: 'none',
            step: 3,
            isUntilMediaEnd: true,
        });
    });

    it('should refuse a step that would never move and a nonsense repeat', () => {
        settingMap.set(`${PREFIX}-slide-auto-play-step`, '0');
        settingMap.set(`${PREFIX}-slide-auto-play-repeat`, 'sideways');
        const options = readSlideAutoPlayOptions(PREFIX);
        expect(options.step).toBe(1);
        expect(options.repeatKind).toBe('all');
    });

    it('should fall back for a repeat saved before "repeat one" was dropped', () => {
        settingMap.set(`${PREFIX}-slide-auto-play-repeat`, 'one');
        expect(readSlideAutoPlayOptions(PREFIX).repeatKind).toBe('all');
    });

    it('should carry the play state both ways', () => {
        expect(checkIsSlideAutoPlaying(PREFIX)).toBe(false);
        setIsSlideAutoPlaying(PREFIX, true);
        expect(checkIsSlideAutoPlaying(PREFIX)).toBe(true);
        setIsSlideAutoPlaying(PREFIX, false);
        expect(checkIsSlideAutoPlaying(PREFIX)).toBe(false);
    });
});

describe('genNextDelaySeconds', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should be the typed seconds while there is no ceiling', () => {
        const options = { ...DEFAULT_SLIDE_AUTO_PLAY_OPTIONS, seconds: 7 };
        expect(genNextDelaySeconds(options)).toBe(7);
        expect(genNextDelaySeconds({ ...options, maxSeconds: 0 })).toBe(7);
    });

    it('should draw a WHOLE number from 1 up to the ceiling', () => {
        // "Up to N" means exactly that, and the draw is shown in the seconds
        // box -- so the typed seconds are what it REPLACES, not a floor it
        // has to stay above.
        const options = {
            ...DEFAULT_SLIDE_AUTO_PLAY_OPTIONS,
            seconds: 4,
            maxSeconds: 6,
        };
        const randomSpy = vi.spyOn(Math, 'random');
        randomSpy.mockReturnValue(0);
        expect(genNextDelaySeconds(options)).toBe(1);
        randomSpy.mockReturnValue(0.999999);
        expect(genNextDelaySeconds(options)).toBe(6);
        randomSpy.mockRestore();
        for (let i = 0; i < 50; i += 1) {
            const delaySeconds = genNextDelaySeconds(options);
            expect(Number.isInteger(delaySeconds)).toBe(true);
            expect(delaySeconds).toBeGreaterThanOrEqual(1);
            expect(delaySeconds).toBeLessThanOrEqual(6);
        }
    });

    it('should draw a ceiling even with no seconds typed at all', () => {
        const delaySeconds = genNextDelaySeconds({
            ...DEFAULT_SLIDE_AUTO_PLAY_OPTIONS,
            seconds: 0,
            maxSeconds: 3,
        });
        expect(delaySeconds).toBeGreaterThanOrEqual(1);
        expect(delaySeconds).toBeLessThanOrEqual(3);
    });
});

describe('toNextIndex', () => {
    const at = (index: number, extra: Record<string, any> = {}) => {
        return toNextIndex(index, 5, {
            isNext: true,
            step: 1,
            repeatKind: 'all',
            ...extra,
        });
    };

    it('should wrap on repeat all', () => {
        expect(at(0)).toBe(1);
        expect(at(4)).toBe(0);
        expect(at(0, { isNext: false })).toBe(4);
    });

    it('should end the show at either end on no repeat', () => {
        expect(at(3, { repeatKind: 'none' })).toBe(4);
        expect(at(4, { repeatKind: 'none' })).toBeNull();
        expect(at(0, { repeatKind: 'none', isNext: false })).toBeNull();
    });

    it('should jump by the step', () => {
        expect(at(0, { step: 2 })).toBe(2);
        expect(at(4, { step: 2 })).toBe(1);
        expect(at(0, { step: 2, isNext: false })).toBe(3);
    });

    it('should not wrap round a step that overshoots on no repeat', () => {
        // Landing back near the top would be repeating, which is the one
        // thing this mode is not.
        expect(at(3, { step: 4, repeatKind: 'none' })).toBeNull();
    });

    it('should answer null for an index that is not in the list', () => {
        expect(at(-1)).toBeNull();
        expect(at(5)).toBeNull();
        expect(
            toNextIndex(0, 0, { isNext: true, step: 1, repeatKind: 'all' }),
        ).toBeNull();
    });
});

describe('the countdown registry', () => {
    afterEach(() => {
        setSlideAutoPlayDueAt(PREFIX, null);
        vi.useRealTimers();
    });

    it('should say nothing while no show is running', () => {
        expect(getSlideAutoPlayRemainingSeconds(PREFIX)).toBeNull();
    });

    it('should count whole seconds down and never go below zero', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-24T10:00:00Z'));
        setSlideAutoPlayDueAt(PREFIX, Date.now() + 5000);
        expect(getSlideAutoPlayRemainingSeconds(PREFIX)).toBe(5);
        vi.advanceTimersByTime(4200);
        expect(getSlideAutoPlayRemainingSeconds(PREFIX)).toBe(1);
        vi.advanceTimersByTime(3000);
        expect(getSlideAutoPlayRemainingSeconds(PREFIX)).toBe(0);
    });
});
