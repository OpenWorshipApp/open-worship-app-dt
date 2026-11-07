/**
 * Every language but English lives in its own package, `src/lang/data/online/<code>/`,
 * and nowhere else (2026-11-03, the user: _make sure no non-english data tied
 * to the code base beside src/lang/data_, and _in the future all non-english
 * is modular_). The rule and the scan are `extra-work/language-confinement.mjs`
 * (`node extra-work/language-confinement.mjs <path>` lists what is left under
 * a path); this holds the gate to finding nothing.
 */
import { describe, expect, test } from 'vitest';

import {
    listScannedFiles,
    scanLanguageConfinement,
} from '../../extra-work/language-confinement.mjs';

function describeFound(list: { file: string; lines: number[] }[]) {
    return list
        .map(({ file, lines }) => {
            return `${file}: ${lines.slice(0, 8).join(',')}`;
        })
        .join('\n');
}

describe('every language but English lives in src/lang/data', () => {
    const fileList = listScannedFiles();
    const { foreign, codes } = scanLanguageConfinement({ fileList });

    test('the scan sees the code base', () => {
        expect(fileList).toContain('src/lang/langHelpers.ts');
        expect(fileList).toContain('tools/owa-devtools-mcp/server.mjs');
        expect(fileList).toContain('electron/index.ts');
        expect(fileList).not.toContain(
            'src/lang/data/online/km/dictionary.json',
        );
    });

    test('no letter of another language outside it', () => {
        expect(foreign, describeFound(foreign)).toEqual([]);
    });

    test('no code names a non-English package', () => {
        expect(codes, describeFound(codes)).toEqual([]);
    });
});
