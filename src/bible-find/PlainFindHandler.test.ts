import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
    fsReadFile: vi.fn(),
}));

vi.mock('../server/fileHelpers', () => ({ fsReadFile: fixture.fsReadFile }));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    getBibleLocale: async () => 'en-US',
}));
vi.mock('../lang/langHelpers', () => ({
    quickTrimText: (_locale: string, text: string) => text.trim(),
    sanitizeFindingText: async (_locale: string, text: string) => text,
}));
vi.mock('./bibleFindHelpers', () => {
    return {
        calcPerPage: (to: number, from: number) => to - from + 1,
        toFindWildCardText: (_locale: string, text: string) =>
            text
                .split(' ')
                .filter((part) => part !== '')
                .map((part) => `%${part}%`)
                .join(''),
    };
});

import PlainFindHandler, {
    checkIsHoldingInOrder,
    toLikeLowerText,
} from './PlainFindHandler';
import type { PlainFindIndexType } from './PlainFindHandler';

const index: PlainFindIndexType = {
    verses: [
        ['GEN.1:1=>In the beginning God', 'inthebeginninggod'],
        ['JHN.3:16=>For God so loved', 'forgodsoloved'],
        ['JHN.3:17=>For God sent', 'forgodsent'],
        ['1JN.4:8=>God is love', 'godislove'],
    ],
    words: [
        ['loved', 'JHN'],
        ['love', '1JN'],
        ['beloved', 'GEN JHN'],
        ['lord', 'GEN'],
    ],
};

beforeEach(() => {
    vi.useFakeTimers();
    fixture.fsReadFile.mockReset();
    fixture.fsReadFile.mockResolvedValue(JSON.stringify(index));
});

afterEach(() => {
    vi.useRealTimers();
});

describe('plain find helpers', () => {
    it('folds ASCII letters only, the way SQLite LIKE does', () => {
        expect(toLikeLowerText('GoD Ä')).toBe('god Ä');
    });

    it('needs every needle in order without overlap', () => {
        expect(checkIsHoldingInOrder('forgodsoloved', ['god', 'loved'])).toBe(
            true,
        );
        expect(checkIsHoldingInOrder('forgodsoloved', ['loved', 'god'])).toBe(
            false,
        );
        expect(checkIsHoldingInOrder('aba', ['ab', 'ba'])).toBe(false);
    });
});

describe('PlainFindHandler', () => {
    it('pages through matching verses and counts them all', async () => {
        const handler = new PlainFindHandler('cache/KJV.plain.json');
        const firstPage = await handler.doFinding('KJV', {
            text: 'GOD',
            fromLineNumber: 0,
            toLineNumber: 1,
        });
        expect(firstPage?.maxLineNumber).toBe(4);
        expect(firstPage?.content.map((item) => item.text)).toEqual([
            'GEN.1:1:In the beginning God',
            'JHN.3:16:For God so loved',
        ]);
        const secondPage = await handler.doFinding('KJV', {
            text: 'god',
            fromLineNumber: 2,
            toLineNumber: 3,
        });
        expect(secondPage?.content.map((item) => item.text)).toEqual([
            'JHN.3:17:For God sent',
            '1JN.4:8:God is love',
        ]);
        // One read serves every search while the index is held.
        expect(fixture.fsReadFile).toHaveBeenCalledTimes(1);
    });

    it('keeps to the chosen books and answers nothing for an empty query', async () => {
        const handler = new PlainFindHandler('cache/KJV.plain.json', index);
        const found = await handler.doFinding('KJV', {
            text: 'god',
            bookKeys: ['JHN'],
        });
        expect(found?.maxLineNumber).toBe(2);
        expect(await handler.doFinding('KJV', { text: '' })).toBeNull();
        expect(fixture.fsReadFile).not.toHaveBeenCalled();
    });

    it('suggests words holding every typed letter, the exact word first', async () => {
        const handler = new PlainFindHandler('cache/KJV.plain.json', index);
        expect(await handler.loadSuggestionWords('love', 5)).toEqual([
            'love',
            'loved',
            'beloved',
        ]);
        expect(await handler.loadSuggestionWords('lo', 5, ['GEN'])).toEqual([
            'lord',
            'beloved',
        ]);
        expect(await handler.loadSuggestionWords('', 5)).toEqual([]);
    });

    it('drops the index after an idle spell and reads it again on need', async () => {
        const handler = new PlainFindHandler('cache/KJV.plain.json', index);
        await vi.advanceTimersByTimeAsync(30_000);
        await handler.doFinding('KJV', { text: 'god' });
        expect(fixture.fsReadFile).toHaveBeenCalledTimes(1);

        handler.close();
        await handler.doFinding('KJV', { text: 'god' });
        expect(fixture.fsReadFile).toHaveBeenCalledTimes(2);
    });
});
