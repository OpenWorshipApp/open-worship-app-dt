import { describe, expect, it } from 'vitest';

import languageNameMap from '../lang/data/en/language-names.json';
import { checkHasLanguageName } from './languageNameWordHelpers';

// Every name English's table gives a language, each of its other names
// ("Catalan, Valencian") apart and the part in brackets left off: the words
// a sentence may name a language by. None is picked out here.
function listTableNames() {
    return Object.values(languageNameMap as Record<string, string>).flatMap(
        (name) => {
            return name
                .split(/[,;]/)
                .map((part) => {
                    return part.split('(')[0].trim();
                })
                .filter((part) => {
                    return part.length >= 3;
                });
        },
    );
}

describe('checkHasLanguageName', () => {
    it('finds every language of the table by its English name, in any case', () => {
        const nameList = listTableNames();
        expect(nameList.length).toBeGreaterThan(100);
        for (const name of nameList) {
            expect([
                name,
                checkHasLanguageName(`add the ${name} lines`),
            ]).toEqual([name, true]);
            expect([
                name,
                checkHasLanguageName(`${name.toUpperCase()} above each line`),
            ]).toEqual([name, true]);
            expect([
                name,
                checkHasLanguageName(`under the ${name.toLowerCase()}.`),
            ]).toEqual([name, true]);
        }
    });

    it('reads a name as a whole word, never inside a longer one', () => {
        expect(checkHasLanguageName('an Englishman wrote it')).toBe(false);
        expect(checkHasLanguageName('the unenglish spelling')).toBe(false);
        expect(checkHasLanguageName('English')).toBe(true);
    });

    it('finds nothing in a line that names no language', () => {
        for (const text of [
            '',
            'Put a box under the title',
            'make the words larger',
            'add a slide after slide 3',
            'xx-XX',
        ]) {
            expect([text, checkHasLanguageName(text)]).toEqual([text, false]);
        }
    });
});
