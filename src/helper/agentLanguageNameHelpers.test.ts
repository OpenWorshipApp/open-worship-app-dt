import { describe, expect, it } from 'vitest';

import {
    findNamedLangCode,
    toDownloadSizeText,
    type LangNameSourceType,
} from './agentLanguageNameHelpers';

// Made-up names where a language's own would be another script: the names
// come from the caller, so the rules are the same whatever they are.
const SOURCE_LIST: LangNameSourceType[] = [
    { langCode: 'en', names: ['English'] },
    { langCode: 'de', names: ['German', 'Gerlandish'] },
    { langCode: 'ca', names: ['Catalan, Valencian'] },
    { langCode: 'ms', names: ['Malay'] },
    { langCode: 'ml', names: ['Malayalam'] },
    { langCode: 'ht', names: ['Haitian Creole'] },
    { langCode: 'xx', names: ['Xylo', '☃☄'] },
];

describe('findNamedLangCode', () => {
    it('reads a name anywhere in the words', () => {
        expect(findNamedLangCode('German', SOURCE_LIST)).toBe('de');
        expect(findNamedLangCode('a Bible in german please', SOURCE_LIST)).toBe(
            'de',
        );
        expect(findNamedLangCode('Gerlandish', SOURCE_LIST)).toBe('de');
    });

    it('reads a code or a locale only as the whole answer', () => {
        expect(findNamedLangCode('de', SOURCE_LIST)).toBe('de');
        expect(findNamedLangCode('de-DE', SOURCE_LIST)).toBe('de');
        expect(findNamedLangCode('XX_YY', SOURCE_LIST)).toBe('xx');
        // "ms" inside a sentence is no request for Malay.
        expect(findNamedLangCode('two ms please', SOURCE_LIST)).toBeNull();
    });

    it('takes the first part of a name, and whole words only', () => {
        expect(findNamedLangCode('Catalan', SOURCE_LIST)).toBe('ca');
        expect(findNamedLangCode('Malayalam', SOURCE_LIST)).toBe('ml');
        expect(findNamedLangCode('Malay', SOURCE_LIST)).toBe('ms');
        expect(findNamedLangCode('Generic tribes', SOURCE_LIST)).toBeNull();
    });

    it('prefers the longest name, then the one said first', () => {
        const withCreole = [
            ...SOURCE_LIST,
            { langCode: 'cr', names: ['Creole'] },
        ];
        expect(findNamedLangCode('Haitian Creole', withCreole)).toBe('ht');
        expect(findNamedLangCode('English or German', SOURCE_LIST)).toBe('en');
    });

    it('finds a name in a script written without spaces inside a run', () => {
        expect(findNamedLangCode('☀☃☄☁', SOURCE_LIST)).toBe('xx');
    });

    it('asks the English name of a word only when nothing matched', () => {
        const asked: string[] = [];
        const toEnglish = (word: string) => {
            asked.push(word);
            return word === 'zorbish' ? 'German' : null;
        };
        expect(findNamedLangCode('zorbish', SOURCE_LIST, toEnglish)).toBe('de');
        expect(asked).toContain('zorbish');
        asked.length = 0;
        expect(findNamedLangCode('German', SOURCE_LIST, toEnglish)).toBe('de');
        expect(asked).toEqual([]);
        // A mapper that throws is no answer, not a failure.
        expect(
            findNamedLangCode('nothing here', SOURCE_LIST, () => {
                throw new Error('no world data');
            }),
        ).toBeNull();
    });

    // 2026-11-05, the user's picture: "korea" listed the Korean Bibles and
    // offered no Korean -- the collection reads a word by how a name STARTS.
    it('reads a country or a cut-short name by how the name starts', () => {
        const withMore = [
            ...SOURCE_LIST,
            { langCode: 'ko', names: ['Korean'] },
            { langCode: 'id', names: ['Indonesian'] },
            { langCode: 'th', names: ['Thai'] },
            { langCode: 'mg', names: ['Malagasy'] },
        ];
        expect(findNamedLangCode('korea', withMore)).toBe('ko');
        expect(findNamedLangCode('Korea Bible', withMore)).toBe('ko');
        expect(findNamedLangCode('indonesia', withMore)).toBe('id');
        expect(findNamedLangCode('Germany', withMore)).toBe('de');
        expect(findNamedLangCode('Thailand', withMore)).toBe('th');
        // A whole name still wins over a start.
        expect(findNamedLangCode('Malay', withMore)).toBe('ms');
        // Two languages start so: neither is named.
        expect(findNamedLangCode('mala', withMore)).toBeNull();
        // Under four letters is no start at all.
        expect(findNamedLangCode('kor', withMore)).toBeNull();
        expect(findNamedLangCode('the new version', withMore)).toBeNull();
    });

    it('answers null for no words', () => {
        expect(findNamedLangCode('', SOURCE_LIST)).toBeNull();
        expect(findNamedLangCode('   ', SOURCE_LIST)).toBeNull();
        expect(findNamedLangCode('2019', SOURCE_LIST)).toBeNull();
    });
});

describe('toDownloadSizeText', () => {
    it('says a size the way a person reads it', () => {
        expect(toDownloadSizeText(225_763)).toBe('0.2 MB');
        expect(toDownloadSizeText(13_980_278)).toBe('13 MB');
        expect(toDownloadSizeText(30_966_078)).toBe('30 MB');
        expect(toDownloadSizeText(5 * 1024 * 1024)).toBe('5.0 MB');
        expect(toDownloadSizeText(1000)).toBe('0.1 MB');
    });

    it('says nothing for no size', () => {
        expect(toDownloadSizeText(undefined)).toBeNull();
        expect(toDownloadSizeText(0)).toBeNull();
        expect(toDownloadSizeText('big')).toBeNull();
    });
});
