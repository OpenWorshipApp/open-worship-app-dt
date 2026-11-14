import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    ensureLyricStageSetting,
    markLyricStageSettingStale,
    peekLyricSongFontFamily,
    resetLyricStageSettingMemo,
    setLyricStageSettingMemo,
    setLyricStageSettingReader,
    toLyricFontFamilyStack,
    toValidLyricFontFamily,
    toValidLyricStageSetting,
} from './lyricSongStageSettingHelpers';

afterEach(() => {
    setLyricStageSettingReader(null);
    resetLyricStageSettingMemo();
    vi.useRealTimers();
});

describe('lyricSongStageSettingHelpers', () => {
    it('keeps only what a font family name is made of', () => {
        expect(toValidLyricFontFamily("'Body Face'")).toBe('Body Face');
        expect(toValidLyricFontFamily('  Face  Two ')).toBe('Face Two');
        expect(toValidLyricFontFamily('app-Face_2.0')).toBe('app-Face_2.0');
        expect(toValidLyricFontFamily('a; color: red')).toBeNull();
        expect(toValidLyricFontFamily('a} body {')).toBeNull();
        expect(toValidLyricFontFamily('a"b')).toBeNull();
        expect(toValidLyricFontFamily('../x')).toBeNull();
        expect(toValidLyricFontFamily('x'.repeat(65))).toBeNull();
        expect(toValidLyricFontFamily('')).toBeNull();
        expect(toValidLyricFontFamily(12)).toBeNull();
        expect(toValidLyricStageSetting({ fontFamily: 'Face', x: 1 })).toEqual({
            fontFamily: 'Face',
        });
        expect(toValidLyricStageSetting({ fontFamily: 'a;b' })).toBeNull();
        expect(toValidLyricStageSetting(null)).toBeNull();
    });

    it('puts the song face in front of the app face', () => {
        expect(toLyricFontFamilyStack('Body Face', 'app-Ui')).toBe(
            '"Body Face", app-Ui',
        );
        expect(toLyricFontFamilyStack('Body Face', undefined)).toBe(
            '"Body Face"',
        );
        expect(toLyricFontFamilyStack(null, 'app-Ui')).toBe('app-Ui');
        expect(toLyricFontFamilyStack(null, undefined)).toBeUndefined();
    });

    it('has no font of its own with no reader, and survives a failing one', async () => {
        expect(await ensureLyricStageSetting('/a.owl')).toBeNull();
        expect(peekLyricSongFontFamily('/a.owl')).toBeNull();
        setLyricStageSettingReader(async () => {
            throw new Error('unreadable');
        });
        expect(await ensureLyricStageSetting('/b.owl')).toBeNull();
    });

    it('reads a song once while fresh, shares a read in flight, re-reads when stale', async () => {
        const reader = vi.fn(async () => {
            return { fontFamily: 'Body Face' };
        });
        setLyricStageSettingReader(reader);
        const [first, second] = await Promise.all([
            ensureLyricStageSetting('/a.owl'),
            ensureLyricStageSetting('/a.owl'),
        ]);
        expect([first, second]).toEqual(['Body Face', 'Body Face']);
        expect(reader).toHaveBeenCalledTimes(1);
        await ensureLyricStageSetting('/a.owl');
        expect(reader).toHaveBeenCalledTimes(1);
        expect(peekLyricSongFontFamily('/a.owl')).toBe('Body Face');

        reader.mockResolvedValueOnce({ fontFamily: 'Other Face' });
        markLyricStageSettingStale('/a.owl');
        // The last font is still peeked until the read lands.
        expect(peekLyricSongFontFamily('/a.owl')).toBe('Body Face');
        expect(await ensureLyricStageSetting('/a.owl')).toBe('Other Face');
        expect(reader).toHaveBeenCalledTimes(2);
    });

    it('re-reads after the fresh window, and forgets the oldest of 17', async () => {
        vi.useFakeTimers({ now: 1000 });
        const reader = vi.fn(async (filePath: string) => {
            return { fontFamily: `Face ${filePath.length}` };
        });
        setLyricStageSettingReader(reader);
        await ensureLyricStageSetting('/a.owl');
        vi.setSystemTime(1000 + 9_000);
        await ensureLyricStageSetting('/a.owl');
        expect(reader).toHaveBeenCalledTimes(1);
        vi.setSystemTime(1000 + 11_000);
        await ensureLyricStageSetting('/a.owl');
        expect(reader).toHaveBeenCalledTimes(2);

        for (let index = 0; index < 16; index += 1) {
            await ensureLyricStageSetting(`/song-${index}.owl`);
        }
        expect(peekLyricSongFontFamily('/a.owl')).toBeNull();
        expect(peekLyricSongFontFamily('/song-15.owl')).not.toBeNull();
    });

    it('takes what was just written without a read', async () => {
        const reader = vi.fn(async () => {
            return null;
        });
        setLyricStageSettingReader(reader);
        setLyricStageSettingMemo('/a.owl', { fontFamily: 'Written Face' });
        expect(await ensureLyricStageSetting('/a.owl')).toBe('Written Face');
        expect(reader).not.toHaveBeenCalled();
        setLyricStageSettingMemo('/a.owl', null);
        expect(peekLyricSongFontFamily('/a.owl')).toBeNull();
    });
});
