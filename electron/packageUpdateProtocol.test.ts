import { describe, expect, test } from 'vitest';

import {
    NO_PACKAGE_UPDATES,
    checkHasPackageUpdate,
    mergePackageUpdates,
} from './packageUpdateProtocol';

describe('mergePackageUpdates', () => {
    test('the first report starts from nothing to update', () => {
        expect(mergePackageUpdates(null, {})).toEqual(NO_PACKAGE_UPDATES);
        expect(mergePackageUpdates(null, { langCodes: ['yy'] })).toEqual({
            langCodes: ['yy'],
            isExtraBinOutdated: false,
        });
    });

    test('each half is replaced only by a report that carries it', () => {
        const launch = mergePackageUpdates(null, {
            langCodes: ['xx'],
            isExtraBinOutdated: true,
        });
        // The Languages tab's answer leaves the Extra Binaries' alone ...
        const afterLanguages = mergePackageUpdates(launch, { langCodes: [] });
        expect(afterLanguages).toEqual({
            langCodes: [],
            isExtraBinOutdated: true,
        });
        // ... and the reverse.
        expect(
            mergePackageUpdates(afterLanguages, { isExtraBinOutdated: false }),
        ).toEqual(NO_PACKAGE_UPDATES);
    });

    test('what a window sends is checked, never trusted', () => {
        const current = mergePackageUpdates(null, { langCodes: ['xx'] });
        expect(mergePackageUpdates(current, null)).toBe(current);
        expect(mergePackageUpdates(current, 'xx')).toBe(current);
        expect(
            mergePackageUpdates(current, {
                langCodes: 'xx',
                isExtraBinOutdated: 'yes',
            }),
        ).toEqual(current);
        expect(
            mergePackageUpdates(null, {
                langCodes: ['zz', 'xx', 'xx', 'EN', '../x', 3, 'yy'],
            }).langCodes,
        ).toEqual(['xx', 'yy', 'zz']);
        expect(
            mergePackageUpdates(null, {
                langCodes: Array.from({ length: 200 }, (_value, index) => {
                    return String.fromCharCode(
                        97 + (index % 26),
                        97 + Math.floor(index / 26),
                    );
                }),
            }).langCodes,
        ).toHaveLength(64);
    });
});

describe('checkHasPackageUpdate', () => {
    test('a language or the Extra Binaries lights it; nothing known does not', () => {
        expect(checkHasPackageUpdate(null)).toBe(false);
        expect(checkHasPackageUpdate(NO_PACKAGE_UPDATES)).toBe(false);
        expect(
            checkHasPackageUpdate({
                langCodes: ['xx'],
                isExtraBinOutdated: false,
            }),
        ).toBe(true);
        expect(
            checkHasPackageUpdate({ langCodes: [], isExtraBinOutdated: true }),
        ).toBe(true);
    });
});
