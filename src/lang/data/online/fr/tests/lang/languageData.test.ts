// @vitest-environment jsdom

import type { LanguageDataType } from '../../../../../langHelpers';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    fontFamilies: ['Arial', 'Georgia'],
    handleError: vi.fn(),
    genFontFaces: vi.fn(),
}));

vi.mock('../../../../../langHelpers', () => ({
    DEFAULT_LANG_CODE: 'en',
    DEFAULT_LOCALE: 'en-US',
    genOpenLyricFontFaces: state.genFontFaces,
}));
vi.mock('../../../../../../server/fontHelpers', () => ({
    getFontFamilies: async () => state.fontFamilies,
}));
vi.mock('../../../../../../helper/errorHelpers', () => ({
    handleError: state.handleError,
}));

import { loadSourceLangData } from '../../../../../langSourceFiles';

// The package as the plugin build makes it: its folder's data through the
// one factory every language shares (`../../../onlineLangPackage.ts`).
const fr: LanguageDataType = await loadSourceLangData('fr');

// Both readers in one object: each method takes the one it reads with.
function genReaders(files: Record<string, unknown>, versions = files) {
    const readJsonFile = vi.fn(async (url: string) => {
        const key = Object.keys(files).find((name) => url.includes(name));
        if (key === undefined) {
            throw new Error(`unreadable ${url}`);
        }
        return files[key];
    });
    const readJsonFileVersion = vi.fn(async (url: string) => {
        const key = Object.keys(versions).find((name) => url.includes(name));
        return key === undefined ? null : versions[key];
    });
    return { readJsonFile, readJsonFileVersion, packageDir: '' } as any;
}

beforeEach(() => {
    state.genFontFaces.mockImplementation(
        (fontFaces: unknown[], option: { title: string }) => [
            ...fontFaces,
            option.title,
        ],
    );
});

describe('French language data', () => {
    test('French never claims a text, and keeps its accents when searching', () => {
        expect(fr.locale).toBe('fr-FR');
        expect(fr.checkIsThisLang('Jean 3:16')).toBe(false);
        expect(fr.genCss()).toBe('');
        expect(fr.sanitizeText(' a ')).toBe(' a ');
        expect(fr.sanitizePreviewText(' a ')).toBe(' a ');
        expect(
            fr.sanitizeFindingText('  Aimez vos ENNEMIS — Élie, 3:16 '),
        ).toBe('aimez vos ennemis élie 3 16');
        expect(fr.trimText('  mot ')).toBe('mot');
        expect(fr.endWord('mot')).toBe('mot ');
        expect(fr.sanitizeTranKey(' Lecteur ')).toBe('lecteur');
        expect(fr.dictionary.reader).toBe('Lecteur');
        expect(fr.transformBibleBookName('1 Jean')).toEqual(['1 Jean']);
        expect(fr.extraBibleContextMenuItems({} as never, {} as never)).toEqual(
            [],
        );
        expect(fr.getBibleKeyNameMap()).toBeTypeOf('object');
    });
});

describe('the lookup data French loads like every language', () => {
    test('reads both maps, and says nothing when either is missing', async () => {
        const lang = fr;
        const readers = genReaders({
            namesMap: { adam: 1 },
            locationsMap: { eden: 2 },
        });
        await expect(lang.getLookupData!(readers)).resolves.toEqual({
            namesMap: { adam: 1 },
            locationsMap: { eden: 2 },
        });
        await expect(lang.getLookupDataVersion!(readers)).resolves.toEqual({
            namesMap: { adam: 1 },
            locationsMap: { eden: 2 },
        });

        const partial = genReaders(
            { namesMap: { adam: 1 } },
            { namesMap: '1.0' },
        );
        await expect(lang.getLookupDataVersion!(partial)).resolves.toBeNull();
        const resolve = vi.fn(
            (bundle: { filePath: string }) => `resolved:${bundle.filePath}`,
        );
        expect(lang.getBibleCrossRefBundleFilePath!(resolve)).toMatch(
            /^resolved:/,
        );
    });

    test('logs an unreadable map and answers nothing', async () => {
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const readers = genReaders({});

        await expect(fr.getLookupData!(readers)).resolves.toBeNull();
        expect(consoleError).toHaveBeenCalledOnce();
        consoleError.mockRestore();
    });
});
