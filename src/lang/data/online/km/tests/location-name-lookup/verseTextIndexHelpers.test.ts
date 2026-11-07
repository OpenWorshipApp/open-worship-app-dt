import { describe, expect, test, vi } from 'vitest';

// The module under test reaches for the data folder and the app version at
// import time through these; the matching functions themselves are pure.
vi.mock('../../../../../../server/appProvider', () => ({
    default: {
        isPageScreen: false,
        systemUtils: { isDev: false },
        appInfo: { version: '1.0.0' },
        messageUtils: { sendData: vi.fn() },
    },
}));
vi.mock('../../../../../../server/fileHelpers', () => ({
    fsCheckFileExist: vi.fn(async () => false),
    fsCreateDir: vi.fn(async () => undefined),
    fsReadFile: vi.fn(async () => null),
    fsWriteFile: vi.fn(async () => ''),
    pathJoin: (...paths: string[]) => paths.join('/'),
}));
vi.mock('../../../../../../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: { defaultStorageDirPath: '/tmp/data' },
}));

import { getVerseTextLookupLangCode } from '../../../../../../location-name-lookup/verseTextIndexHelpers';
import { ensureLangPlugins } from '../../../../../langHelpers';

describe('getVerseTextLookupLangCode', () => {
    test('a bible in a language that ships a lookup package uses it', async () => {
        // The languages a window knows once its plugins are read.
        await ensureLangPlugins();
        expect(getVerseTextLookupLangCode('ពគប', 'km-KH')).toBe('km');
        // Its own package's names, whatever the bible is called.
        expect(getVerseTextLookupLangCode('គខប', 'km-KH')).toBe('km');
    });
});
