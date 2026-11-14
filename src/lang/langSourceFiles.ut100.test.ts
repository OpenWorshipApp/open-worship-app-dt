import { describe, expect, it } from 'vitest';

// The app's own copy, imported with its extension so `vitest.config.ts`'s
// `owa-lang-source-files` plugin (which swaps a bare `langSourceFiles` for the
// checkout reader) lets it through. This module is what keeps every language
// but English out of `dist/`: if it ever answered anything, a build would ship
// the source packages.
import {
    listSourceLangPlugins,
    loadSourceLangData,
    loadSourceLangFile,
} from './langSourceFiles.ts';
import * as vitestCopy from './langSourceFiles';

describe('langSourceFiles (the app build)', () => {
    it('is not the copy tests read the checkout through', () => {
        expect(listSourceLangPlugins).not.toBe(
            vitestCopy.listSourceLangPlugins,
        );
    });

    it('lists no source language package', () => {
        expect(listSourceLangPlugins()).toEqual([]);
    });

    it('loads no language data and no language file', async () => {
        await expect(loadSourceLangData('xx')).resolves.toBeNull();
        await expect(
            loadSourceLangFile('xx', 'dictionary.json'),
        ).resolves.toBeNull();
    });
});
