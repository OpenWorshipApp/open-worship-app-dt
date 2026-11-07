import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
    listLangPackageCodes,
    toLangPackageDir,
} from '../test-setup/langPackageDirs';

import { findScriptLocale, listScriptSystemFonts } from './langScriptHelpers';

// Every language package that writes in a script of its own says so in its
// `script.json`; these hold each one to what this module makes of it, without
// naming any language.
const scriptFileList = listLangPackageCodes({
    fileName: 'script.json',
})
    .flatMap((langCode) => {
        const filePath = path.join(toLangPackageDir(langCode), 'script.json');
        const meta = JSON.parse(
            readFileSync(
                path.join(toLangPackageDir(langCode), 'meta.json'),
                'utf8',
            ),
        );
        return [
            {
                langCode,
                locale: meta.locale as string,
                order: meta.order as number,
                file: JSON.parse(readFileSync(filePath, 'utf8')) as {
                    scriptPattern?: string;
                    notScriptPattern?: string;
                    systemFonts?: Record<string, string[]>;
                },
            },
        ];
    })
    // The language picker's order, which is the order languages that share
    // a script answer in.
    .sort((one, other) => {
        return one.order - other.order;
    });

/** The locale the first package whose script takes `text` names. */
function findExpectedLocale(text: string) {
    return (
        scriptFileList.find(({ file }) => {
            return (
                typeof file.scriptPattern === 'string' &&
                new RegExp(file.scriptPattern, 'u').test(text) &&
                !(
                    typeof file.notScriptPattern === 'string' &&
                    new RegExp(file.notScriptPattern, 'u').test(text)
                )
            );
        })?.locale ?? null
    );
}

/** The first character past ASCII that a pattern takes, or null. */
function findFirstLetterOf(source: string) {
    const pattern = new RegExp(source, 'u');
    for (let codePoint = 0x80; codePoint <= 0xffff; codePoint++) {
        const character = String.fromCodePoint(codePoint);
        if (pattern.test(character)) {
            return character;
        }
    }
    return null;
}

describe('langScriptHelpers', () => {
    test('text in no package script has no locale', () => {
        expect(findScriptLocale('Amazing grace 1:2')).toBeNull();
        expect(findScriptLocale('✝ ♪')).toBeNull();
        expect(findScriptLocale('')).toBeNull();
    });

    test.each(scriptFileList.map((one) => [one.langCode, one] as const))(
        '%s: its script names its locale, its system faces are offered',
        (_langCode, { locale, file }) => {
            for (const platform of ['windows', 'mac', 'linux'] as const) {
                for (const font of file.systemFonts?.[platform] ?? []) {
                    expect(listScriptSystemFonts(platform)).toContain(font);
                }
            }
            if (typeof file.scriptPattern === 'string') {
                const letter = findFirstLetterOf(file.scriptPattern);
                expect(letter).not.toBeNull();
                // Its own locale, or the first of the languages written in
                // the same script; never none.
                const expected = findExpectedLocale(`abc ${letter}`);
                expect(expected).not.toBeNull();
                expect(findScriptLocale(`abc ${letter}`)).toBe(expected);
                if (
                    scriptFileList.filter(({ file: other }) => {
                        return other.scriptPattern === file.scriptPattern;
                    }).length === 1
                ) {
                    expect(expected).toBe(locale);
                }
            }
            // A letter that says the text is another language's takes it
            // away from this one.
            if (
                typeof file.scriptPattern === 'string' &&
                typeof file.notScriptPattern === 'string'
            ) {
                const letter = findFirstLetterOf(file.scriptPattern);
                const otherLetter = findFirstLetterOf(file.notScriptPattern);
                expect(otherLetter).not.toBeNull();
                expect(findScriptLocale(`${letter}${otherLetter}`)).not.toBe(
                    locale,
                );
            }
        },
    );
});
