import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const getSettingMock = vi.fn();

vi.mock('./settingHelpers', () => ({
    getSetting: (key: string) => {
        return getSettingMock(key);
    },
}));

const IDLE_RELEASE_MILLISECONDS = 5000;

function fireIdleRelease() {
    vi.advanceTimersByTime(IDLE_RELEASE_MILLISECONDS * 2);
}

describe('genDerivedSettingReader', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('derives once while the setting string is unchanged', async () => {
        const { genDerivedSettingReader } =
            await import('./derivedSettingHelpers');
        const derive = vi.fn((sources: string[]) => {
            return { value: sources[0] };
        });
        getSettingMock.mockReturnValue('a');
        const read = genDerivedSettingReader(['one'], derive);

        expect(read()).toEqual({ value: 'a' });
        expect(read()).toEqual({ value: 'a' });
        expect(read()).toEqual({ value: 'a' });
        expect(derive).toHaveBeenCalledOnce();
        // Same object identity — the copy is the caller-facing getter's job.
        expect(read()).toBe(read());
    });

    test('reads each setting exactly once per call, hit or miss', async () => {
        // Load bearing: callers stub `getSetting` with `mockReturnValueOnce`,
        // and a reader that read a name twice would consume the stub on the
        // comparison and then derive from the fallback value instead. It is
        // also plain waste on the hottest read in the app.
        const { genDerivedSettingReader } =
            await import('./derivedSettingHelpers');
        const derive = vi.fn((sources: string[]) => {
            return { value: sources.join('|') };
        });
        const read = genDerivedSettingReader(['one', 'two'], derive);

        getSettingMock.mockReturnValue('a');
        expect(read()).toEqual({ value: 'a|a' });
        expect(getSettingMock).toHaveBeenCalledTimes(2);

        // A hit reads the same two names and nothing more.
        expect(read()).toEqual({ value: 'a|a' });
        expect(getSettingMock).toHaveBeenCalledTimes(4);

        // A miss must not re-read to build its sources either.
        getSettingMock.mockReturnValueOnce('b').mockReturnValueOnce('c');
        expect(read()).toEqual({ value: 'b|c' });
        expect(getSettingMock).toHaveBeenCalledTimes(6);
        expect(derive).toHaveBeenCalledTimes(2);
    });

    test('re-derives when the setting string changes', async () => {
        const { genDerivedSettingReader } =
            await import('./derivedSettingHelpers');
        const derive = vi.fn((sources: string[]) => {
            return { value: sources[0] };
        });
        const read = genDerivedSettingReader(['one'], derive);

        getSettingMock.mockReturnValue('a');
        expect(read()).toEqual({ value: 'a' });
        getSettingMock.mockReturnValue('b');
        expect(read()).toEqual({ value: 'b' });
        expect(derive).toHaveBeenCalledTimes(2);
    });

    test('re-derives when a SECONDARY source changes', async () => {
        // The on-screen maps are filtered against the list of live screens, so
        // adding or deleting a screen has to invalidate them even though their
        // own setting string never moved.
        const { genDerivedSettingReader } =
            await import('./derivedSettingHelpers');
        const derive = vi.fn((sources: string[]) => {
            return sources.join('|');
        });
        const settings: { [key: string]: string } = {
            content: 'unchanged',
            screens: '[1]',
        };
        getSettingMock.mockImplementation((key: string) => {
            return settings[key];
        });
        const read = genDerivedSettingReader(['content', 'screens'], derive);

        expect(read()).toBe('unchanged|[1]');
        expect(derive).toHaveBeenCalledOnce();
        settings.screens = '[1,2]';
        expect(read()).toBe('unchanged|[1,2]');
        expect(derive).toHaveBeenCalledTimes(2);
    });

    test('treats a missing setting as an empty string', async () => {
        const { genDerivedSettingReader } =
            await import('./derivedSettingHelpers');
        const derive = vi.fn((sources: string[]) => {
            return sources[0];
        });
        const read = genDerivedSettingReader(['one'], derive);

        getSettingMock.mockReturnValue(undefined);
        expect(read()).toBe('');
        getSettingMock.mockReturnValue(null);
        expect(read()).toBe('');
        expect(derive).toHaveBeenCalledOnce();
    });

    test('still returns the value when the release fires right after', async () => {
        // Guards the ordering bug where the reader returned the cache field
        // after arming the release: a release that ran synchronously nulled the
        // field and the caller got null instead of the derived map.
        const { genDerivedSettingReader } =
            await import('./derivedSettingHelpers');
        const read = genDerivedSettingReader(['one'], () => {
            return { kept: true };
        });
        getSettingMock.mockReturnValue('a');

        const value = read();
        fireIdleRelease();
        expect(value).toEqual({ kept: true });
    });

    test('keeps the entry while reads keep coming, drops it once they stop', async () => {
        const { genDerivedSettingReader } =
            await import('./derivedSettingHelpers');
        const derive = vi.fn(() => {
            return { big: 'payload' };
        });
        const read = genDerivedSettingReader(['one'], derive);
        getSettingMock.mockReturnValue('a');

        read();
        // Read again just before the window closes: the entry is still in use,
        // so it must survive rather than be dropped on a fixed schedule.
        for (let i = 0; i < 4; i++) {
            vi.advanceTimersByTime(IDLE_RELEASE_MILLISECONDS - 100);
            read();
        }
        expect(derive).toHaveBeenCalledOnce();

        fireIdleRelease();
        read();
        expect(derive).toHaveBeenCalledTimes(2);
    });

    test('drops what it holds once reads stop, then derives again', async () => {
        const { genDerivedSettingReader } =
            await import('./derivedSettingHelpers');
        const derive = vi.fn(() => {
            return { big: 'payload' };
        });
        const read = genDerivedSettingReader(['one'], derive);
        getSettingMock.mockReturnValue('a');

        read();
        read();
        expect(derive).toHaveBeenCalledOnce();
        fireIdleRelease();
        read();
        expect(derive).toHaveBeenCalledTimes(2);
    });

    test('releaseAllDerivedSettings drops every reader', async () => {
        const { genDerivedSettingReader, releaseAllDerivedSettings } =
            await import('./derivedSettingHelpers');
        const deriveOne = vi.fn(() => {
            return 1;
        });
        const deriveTwo = vi.fn(() => {
            return 2;
        });
        const readOne = genDerivedSettingReader(['one'], deriveOne);
        const readTwo = genDerivedSettingReader(['two'], deriveTwo);
        getSettingMock.mockReturnValue('a');

        readOne();
        readTwo();
        expect(deriveOne).toHaveBeenCalledOnce();
        expect(deriveTwo).toHaveBeenCalledOnce();

        releaseAllDerivedSettings();

        readOne();
        readTwo();
        expect(deriveOne).toHaveBeenCalledTimes(2);
        expect(deriveTwo).toHaveBeenCalledTimes(2);
    });
});
