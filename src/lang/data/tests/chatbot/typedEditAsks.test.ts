import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
    detectTypedLanguage,
    OTHER_CHAT_LANG_CODE,
} from '../../../../chatbot/chatLangHelpers';
import {
    readLanguageNoteStyleAsk,
    readLanguageSizeAsk,
} from '../../../../chatbot/languageEditAskHelpers';
import { readNoteStyleAsk } from '../../../../chatbot/noteChatHelpers';
import { readSlideSizeAsk } from '../../../../chatbot/slideChatHelpers';
import { checkHasLangPackage } from '../../../../test-setup/langPackageDirs';

// BN-31 (2026-11-08, the goal _work great for all languages_): every typed
// language says "make the text bigger", "smaller" and "make all the text
// bold" in its own `typed.json` (`textSizeAsks`, `noteStyleAsks`), so the
// help window does them with no model in every language, as it does in
// English, Khmer and French. One sample of each, as a person types it; a
// language whose package is not in the checkout is not asked.
//
// BN-34 (2026-11-08): a bold shortcut is never a language's word for a
// COLOUR or a size. Eight had been written with the word for black (Zulu,
// Xhosa, Chichewa, Kinyarwanda, Kirundi, Yoruba, Igbo, Fijian) -- and the
// model, asked the same words live, made the line black, so the window would
// have made bold what somebody asked to be black. Those say the loanword
// "bold"; Tibetan, whose word for thick is its word for big, has none (no
// `bold` sample): the model is asked.

// BN-41 (2026-11-09): nine languages no reader could confirm -- Tibetan,
// Shona, Somali, Kirundi, Igbo, Yoruba, Tongan, Oromo, Malagasy -- keep only
// the phrases a BLIND reading gave back as their job, with no other request
// in them (a sample left out: the assistant does it).
type SampleType = {
    folder: string;
    larger?: string;
    smaller?: string;
    bold?: string;
    firstLineBold: string;
};

// The words for black and dark the bold shortcuts had used: never bold.
const COLOUR_ASK_LIST = [
    'yenza wonke umbhalo ube mnyama',
    'pangani zilembo zonse kukhala zakuda',
    "shyira inyandiko yose mu nyuguti z'umukara",
    'shira inyuguti zose mu birabura',
    'jẹ́ kí gbogbo ọ̀rọ̀ dúdú',
    'mee ka ederede niile gbaa ọchịchịrị',
    'vakaloaloataka na volavola kece',
    // BN-40 (2026-11-09, an independent read of every language's words):
    // six more said bold with a word for dark.
    'მთელი ტექსტი გაამუქე',
    'اجعل كل النص غامقا',
    'همه متن را پررنگ کن',
    'සියලු පෙළ තද කරන්න',
    'làm đậm tất cả chữ',
    'pon todo o texto en negra',
];

// BN-40: phrases that ask for something else than the letters' size -- more
// or fewer WORDS, a summary or an expansion, CAPITALS -- the window had read
// as a size. The model reads them.
const OTHER_MEANING_ASK_LIST = [
    'ongeza herufi',
    'punguza herufi',
    'ขยายข้อความ',
    'ย่อข้อความ',
    'fẹ ọ̀rọ̀ náà',
    'dín ọ̀rọ̀ kù',
    'kuza inyandiko',
    'gabanya inyandiko',
    'amplia el text',
    'redueix el text',
    'amplía o texto',
    'reduce o texto',
    'ጽሑፉን አስፋ',
    'ጽሑፉን አሳንስ',
    'metni büyük yap',
    'metni küçük yap',
    'mətni böyük et',
    'mətni kiçik et',
    'besarkan huruf',
    'kecilkan huruf',
    'pangani zilembo kukhala zazikulu',
    'ita mavara makuru',
    'ita mavara madiki',
    'xarfaha weyn',
    'deixe o texto maior',
    'texto menor',
    'បង្កើនពាក្យ',
    'បន្ថយពាក្យ',
    'ពង្រីកពាក្យ',
    'បង្រួមពាក្យ',
    'réduis le texte',
    'réduis la note',
    // BN-41: read blind as glorify, herd, shorten, capitals or "the big
    // text", in the languages no reader could confirm.
    'kudza mavara',
    'kurisa mavara',
    'deredza mavara',
    'weyn qoraalka',
    'qoraalka weyn',
    'xarfaha yaree',
    'yaree qoraalka',
    'kuza inyuguti',
    'toya inyuguti',
    'mee ka ederede buo ibu',
    'mee ka mkpụrụedemede buo ibu',
    'mee ka ederede dị obere',
    'jẹ́ kí ọ̀rọ̀ kéré',
    'je ki oro tobi',
    "fakalahi'i 'a e tohi",
    "fakasi'isi'i 'a e tohi",
    'barreeffama guddisi',
    'qubee guddisi',
    'barreeffama xiqqeessi',
    'ahenao ny soratra',
    'ataovy kely kokoa ny soratra',
];

// BN-41: read blind as thick-or-big, or misread by the model live.
const UNSURE_BOLD_ASK_LIST = [
    "fakamatolu'i 'a e tohi kotoa",
    'ita mavara ese akakora',
    'barreeffama hunda furdisi',
    'qoraalka oo dhan ka dhig mid qaro weyn',
];

const SAMPLE_MAP = JSON.parse(
    readFileSync(path.join(import.meta.dirname, 'typedEditAsks.json'), 'utf8'),
) as Record<string, SampleType>;
const SAMPLE_LIST = Object.entries(SAMPLE_MAP).filter(([, sample]) => {
    return checkHasLangPackage(sample.folder);
});

describe('the no-model edit asks in every typed language', () => {
    test('every typed language has a sample', () => {
        expect(Object.keys(SAMPLE_MAP).length).toBeGreaterThanOrEqual(85);
    });

    test.each(SAMPLE_LIST)('%s', (_key, sample) => {
        if (sample.larger !== undefined) {
            expect(readLanguageSizeAsk(sample.larger)).toEqual({
                kind: 'larger',
            });
            // As the window's own shortcuts read them, with a closing mark.
            expect(readSlideSizeAsk(`${sample.larger}.`)).toEqual({
                kind: 'scale',
                factor: 1.25,
            });
            expect(readLanguageNoteStyleAsk(sample.larger)).toBeNull();
        }
        if (sample.smaller !== undefined) {
            expect(readLanguageSizeAsk(sample.smaller)).toEqual({
                kind: 'smaller',
            });
        }
        if (sample.bold !== undefined) {
            expect(readLanguageNoteStyleAsk(sample.bold)).toEqual({
                styles: ['bold'],
            });
            expect(readNoteStyleAsk(sample.bold)).toEqual({
                styles: ['bold'],
            });
            // Never the other way round.
            expect(readLanguageSizeAsk(sample.bold)).toBeNull();
        }
        // Typed with the okina (U+02BB) a Tongan or Samoan keyboard has for
        // the apostrophe the patterns write (BN-39).
        const withOkina = (line: string) => {
            return line.replaceAll("'", 'ʻ');
        };
        if (sample.larger !== undefined) {
            expect(readLanguageSizeAsk(withOkina(sample.larger))).toEqual({
                kind: 'larger',
            });
        }
        if (sample.smaller !== undefined) {
            expect(readLanguageSizeAsk(withOkina(sample.smaller))).toEqual({
                kind: 'smaller',
            });
        }
        if (sample.bold !== undefined) {
            expect(readLanguageNoteStyleAsk(withOkina(sample.bold))).toEqual({
                styles: ['bold'],
            });
        }
        // One line made bold is the model's: the window bolds the whole
        // note only when the whole note is asked for.
        expect(readLanguageNoteStyleAsk(sample.firstLineBold)).toBeNull();
        expect(readNoteStyleAsk(sample.firstLineBold)).toBeNull();
        expect(readLanguageSizeAsk(sample.firstLineBold)).toBeNull();
    });

    test('a phrase asking for more or fewer words is never a size', () => {
        expect(
            OTHER_MEANING_ASK_LIST.filter((asked) => {
                return readLanguageSizeAsk(asked) !== null;
            }),
        ).toEqual([]);
    });

    test('a word for black is never the window making text bold', () => {
        expect(
            [...COLOUR_ASK_LIST, ...UNSURE_BOLD_ASK_LIST].filter((asked) => {
                return readLanguageNoteStyleAsk(asked) !== null;
            }),
        ).toEqual([]);
    });
});

// BN-33 (2026-11-08): with every language installed, a short line was named
// ANOTHER language on one little word it shares with it -- Hausa Romanian on
// "mai", Kinyarwanda Hausa on "wa" and "mu", Dutch, Italian, Haitian and
// Samoan French on "de", "il", "la" and "le" (French then had the half in
// every app), Ukrainian and Bulgarian Russian and Nepali Hindi by being
// listed first -- and answered in it. A line is named its own language, one
// of its family, or nothing (the app's language) or `other` (the language it
// was written in); never another. In an app shown in it, never anything but
// it: nothing named goes to the app's language, which is it.
const FAMILY_MAP = new Map(
    SAMPLE_LIST.flatMap(([, sample]) => {
        const filePath = path.join(
            import.meta.dirname,
            '..',
            '..',
            'online',
            sample.folder,
            'typed.json',
        );
        if (!existsSync(filePath)) {
            return [];
        }
        const file = JSON.parse(readFileSync(filePath, 'utf8')) as Record<
            string,
            { family?: string }
        >;
        return Object.entries(file).map(([code, entry]) => {
            return [code, entry.family ?? null] as const;
        });
    }),
);

function checkIsOwnLanguage(code: string, found: string | null) {
    const family = FAMILY_MAP.get(code) ?? null;
    return (
        found === code ||
        (found !== null && family !== null && FAMILY_MAP.get(found) === family)
    );
}

describe('the language each sample is named', () => {
    test.each(SAMPLE_LIST)('%s', (key, sample) => {
        const code = key.includes('=') ? key.split('=')[1] : key;
        const lineList = [
            sample.larger,
            sample.smaller,
            sample.bold,
            sample.firstLineBold,
        ].filter((line) => {
            return line !== undefined;
        });
        const wrongList = lineList.flatMap((line) => {
            const inEnglishApp = detectTypedLanguage(line, 'en');
            const inOwnApp = detectTypedLanguage(line, code);
            return [
                ...(checkIsOwnLanguage(code, inEnglishApp) ||
                inEnglishApp === null ||
                inEnglishApp === OTHER_CHAT_LANG_CODE
                    ? []
                    : [`en app: ${line} -> ${inEnglishApp}`]),
                ...(checkIsOwnLanguage(code, inOwnApp) || inOwnApp === null
                    ? []
                    : [`${code} app: ${line} -> ${inOwnApp}`]),
            ];
        });
        expect(wrongList).toEqual([]);
    });
});

// BN-42 (2026-11-09, the free tier asked in 81 languages): "add a line at
// the end saying God is love", as each language types it, is named that
// language or one of its family in an English app -- 24 had gone unnamed or
// to a neighbour (and were answered in English) until their lists held their
// own words for add, at the end and make.
const ADD_LINE_ASK_MAP = JSON.parse(
    readFileSync(path.join(import.meta.dirname, 'addLineAsks.json'), 'utf8'),
) as Record<string, string>;

describe('a typed request to add a line is named its language', () => {
    test.each(
        Object.entries(ADD_LINE_ASK_MAP).filter(([code]) => {
            return FAMILY_MAP.has(code) || code === 'km' || code === 'fr';
        }),
    )('%s', (code, asked) => {
        const found = detectTypedLanguage(asked, 'en');
        expect(checkIsOwnLanguage(code, found) ? code : found).toBe(code);
    });
});
