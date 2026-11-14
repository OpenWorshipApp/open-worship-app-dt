import { describe, expect, test, vi } from 'vitest';

import * as chatLangHelpers from '../../../../chatbot/chatLangHelpers';

// "a" is English's commonest word and a little word of a dozen other
// languages too, so it names no language by itself (2026-11-14, EC-651).
// With every language installed it is shared and weighs little; with a few,
// the one that lists it had been a line's only reading: beside four
// installed languages, an English "start a stopwatch" typed in an English
// app was named one of them and answered in it. Each such package is
// installed here alone beside English, as a church that added one would
// have it.

type HelpersType = typeof chatLangHelpers;

const SHARED_WORD = 'a';
const ENGLISH_LINE_LIST = [
    'start a 5 minute countdown',
    'start a 10 minute countdown',
    'start a stopwatch',
    'put up a countdown',
    'add a marquee',
    'open a song',
];

// The languages that list "a" among their little words, with their
// package and three other little words of theirs that English does not
// list (a line of those is still theirs).
const SHARING_LIST = (() => {
    const englishWordSet = new Set(
        chatLangHelpers.listAssistantLanguages().find((language) => {
            return language.code === 'en';
        })?.functionWordSet ?? [],
    );
    return [
        ...chatLangHelpers.listAssistantLanguages(),
        ...chatLangHelpers.listTypedLanguages(),
    ]
        .filter((language) => {
            return (
                language.code !== 'en' &&
                language.isLatinScript &&
                language.functionWordSet.has(SHARED_WORD)
            );
        })
        .map((language) => {
            const ownWordList = [...language.functionWordSet]
                .filter((word) => {
                    return (
                        /^\p{L}{2,}$/u.test(word) && !englishWordSet.has(word)
                    );
                })
                .slice(0, 3);
            return {
                code: language.code,
                packageCode: chatLangHelpers.toPackageLangCode(language.code),
                ownWordList,
            };
        });
})();

async function loadWithOnly(packageCode: string): Promise<HelpersType> {
    vi.resetModules();
    const source = await import('../../../langSourceFiles');
    const store = await import('../../../langFileStore');
    const entryList = source
        .listSourceLangPlugins()
        .filter((plugin) => {
            return plugin.langCode === packageCode;
        })
        .map((plugin) => {
            return [
                plugin.langCode,
                {
                    ...plugin.inlineFiles,
                    'meta.json': { locale: plugin.locale, order: plugin.order },
                },
            ] as [string, Record<string, unknown>];
        });
    store.setLangFiles(entryList, source.loadSourceLangFile);
    return import('../../../../chatbot/chatLangHelpers');
}

describe('a word English writes too names no language by itself (EC-651)', () => {
    for (const { code, packageCode, ownWordList } of SHARING_LIST) {
        test(`installed alone: ${code}`, async () => {
            const helpers = await loadWithOnly(packageCode);
            for (const line of ENGLISH_LINE_LIST) {
                expect(helpers.detectTypedLanguage(line, 'en'), line).toBe(
                    null,
                );
                expect(
                    helpers.pickReplyLanguage(line, { appLangCode: 'en' }),
                    line,
                ).toBe('en');
            }
            // In its own app such a line is answered in its own language.
            expect(
                helpers.pickReplyLanguage('start a stopwatch', {
                    appLangCode: code,
                }),
            ).toBe(code);
            if (ownWordList.length === 3) {
                const [first, second, third] = ownWordList;
                const ownLine = `${first} ${SHARED_WORD} ${second} ${third}`;
                expect(
                    helpers.detectTypedLanguage(ownLine, 'en'),
                    ownLine,
                ).toBe(code);
            }
        });
    }
});
