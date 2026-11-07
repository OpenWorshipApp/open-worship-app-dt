import { describe, expect, test } from 'vitest';

import {
    EXTRA_BIN_MISSING_ERROR_MESSAGE,
    checkIsExtraBinMissingError,
} from './extraBinErrors';

describe('checkIsExtraBinMissingError', () => {
    test('recognises the rejection the pack check raises, wrapped or not', () => {
        expect(
            checkIsExtraBinMissingError(
                new Error(EXTRA_BIN_MISSING_ERROR_MESSAGE),
            ),
        ).toBe(true);
        expect(
            checkIsExtraBinMissingError(
                new Error(
                    "Error invoking remote method 'download': " +
                        `Error: ${EXTRA_BIN_MISSING_ERROR_MESSAGE}`,
                ),
            ),
        ).toBe(true);
    });

    test('leaves every other failure to the download toast', () => {
        expect(checkIsExtraBinMissingError(new Error('HTTP 403'))).toBe(false);
        expect(checkIsExtraBinMissingError({ code: 'ENOENT' })).toBe(false);
        expect(checkIsExtraBinMissingError(null)).toBe(false);
        expect(checkIsExtraBinMissingError(undefined)).toBe(false);
    });
});
