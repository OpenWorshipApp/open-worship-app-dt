import { describe, expect, test } from 'vitest';
import {
    toAnswerShownInLanguage,
    toRepliesShownInLanguage,
} from '../../../../../../chatbot/answerLanguageHelpers';

// What the app's dictionary says for the labels the elder-persona run saw a
// model write in English inside Khmer answers (2026-10-17).
const LABEL_MAP: Record<string, string> = {
    'Go Back to Presenter': 'ត្រឡប់ទៅកម្មវិធីបង្ហាញ',
    'Mini Screen': 'អេក្រង់តូច',
    'Presenting Flow': 'តារាងកម្មវិធី',
    'Bible Lookup': 'ស្វែងរកព្រះគម្ពីរ',
    Open: 'បើក',
    Enter: 'បញ្ចូល',
    Help: 'ជំនួយ',
    Tools: 'ឧបករណ៍',
    'Keyboard Shortcuts': 'ផ្លូវកាត់ក្ដារចុច',
    Verse: 'ខគម្ពីរ',
};
const translateLabel = (label: string) => {
    return LABEL_MAP[label] ?? label;
};

function show(text: string, langCode = 'km') {
    return toAnswerShownInLanguage(text, langCode, translateLabel);
}

describe('toAnswerShownInLanguage', () => {
    test('English answers are left as they are', () => {
        const text = 'Click **Mini Screen** (on the right) and press Enter.';
        expect(show(text, 'en')).toBe(text);
    });

    test('a sentence-case control name in bold is the button it names', () => {
        // The lookup card's own labels: no capital after the first word, so
        // the run pass below read only the first word and the label stayed
        // English in a Khmer answer (seen live 2026-10-19).
        const showLookup = (text: string) => {
            return toAnswerShownInLanguage(text, 'km', (label) => {
                return (
                    {
                        ...LABEL_MAP,
                        'Its verses': 'ខគម្ពីររបស់វា',
                        'Family and places': 'គ្រួសារ និងទីកន្លែង',
                        'Open another passage': 'បើកបទគម្ពីរផ្សេង',
                    }[label] ?? label
                );
            });
        };
        expect(showLookup('ចុច **Its verses** ដើម្បីមើល។')).toBe(
            'ចុច **ខគម្ពីររបស់វា** ដើម្បីមើល។',
        );
        expect(showLookup('ចុច **Family and places**។')).toBe(
            'ចុច **គ្រួសារ និងទីកន្លែង**។',
        );
        // A control named in quotes rather than bold (seen live 2026-10-19).
        expect(showLookup('ចុច "Its verses" ខាងក្រោម។')).toBe(
            'ចុច "ខគម្ពីររបស់វា" ខាងក្រោម។',
        );
        expect(showLookup('ចុច “Family and places”។')).toBe(
            'ចុច "គ្រួសារ និងទីកន្លែង"។',
        );
        // Out of bold, the same words are left for the translator.
        expect(showLookup('ចុច Its verses ដើម្បីមើល។')).toBe(
            'ចុច Its verses ដើម្បីមើល។',
        );
    });

    test('an English gloss in brackets after Khmer words goes', () => {
        expect(show('ចុចលើរូបកង់ធ្មេញ (Settings) នៅខាងលើ។')).toBe(
            'ចុចលើរូបកង់ធ្មេញ នៅខាងលើ។',
        );
        expect(show('ឃ្លានេះមាននៅក្នុង ទំនុកដំកើង ២៣:១ (Psalm 23:1)។')).toBe(
            'ឃ្លានេះមាននៅក្នុង ទំនុកដំកើង ២៣:១។',
        );
        expect(show('សូមប្រើកណ្ដុរ (mouse) ចុចឱ្យជាប់')).toBe(
            'សូមប្រើកណ្ដុរ ចុចឱ្យជាប់',
        );
        expect(show('ពេលនេះអេក្រង់ធំត្រូវបានបិទ (Off)។')).toBe(
            'ពេលនេះអេក្រង់ធំត្រូវបានបិទ។',
        );
        // After a book named in bold or in quotes (2026-10-23).
        expect(show('**ហេព្រើរ** (Hebrews) ១១:៧')).toBe('**ហេព្រើរ** ១១:៧');
        expect(show('«១ ពេត្រុស» (1 Peter)')).toBe('«១ ពេត្រុស»');
    });

    test('a bracket a reader needs stays', () => {
        // A key, as the key cap prints it.
        expect(show('រក្សាទុកដោយចុច (Ctrl+S)។')).toBe(
            'រក្សាទុកដោយចុច (Ctrl+S)។',
        );
        expect(show('បិទ/បើកអេក្រង់ (F5)')).toBe('បិទ/បើកអេក្រង់ (F5)');
        // Its own letters inside.
        expect(show('ចុចប៊ូតុង (ឧទាហរណ៍៖ KJV)')).toBe(
            'ចុចប៊ូតុង (ឧទាហរណ៍៖ KJV)',
        );
        // A command and an address.
        expect(show('សូមវាយ (/btw សំណួរ)')).toBe('សូមវាយ (/btw សំណួរ)');
        expect(show('មើល (https://openworship.app)')).toBe(
            'មើល (https://openworship.app)',
        );
        // Not after the language's own words.
        expect(show('Open Worship App (OWA) ល្អ')).toBe(
            'Open Worship App (OWA) ល្អ',
        );
    });

    test('a button named in English is written as the button shows', () => {
        expect(show('ចុចប៊ូតុង 🖥️ Go Back to Presenter នៅខាងលើ។')).toBe(
            'ចុចប៊ូតុង 🖥️ ត្រឡប់ទៅកម្មវិធីបង្ហាញ នៅខាងលើ។',
        );
        expect(show('មើលក្នុងប្រអប់ Mini Screen នៅខាងស្តាំ។')).toBe(
            'មើលក្នុងប្រអប់ អេក្រង់តូច នៅខាងស្តាំ។',
        );
        expect(show('ចុច **Bible Lookup**')).toBe('ចុច **ស្វែងរកព្រះគម្ពីរ**');
    });

    test('the bracket goes before its words would be translated twice', () => {
        expect(show('ប្រើ តារាងកម្មវិធី (Presenting Flow)។')).toBe(
            'ប្រើ តារាងកម្មវិធី។',
        );
    });

    test('one word is never taken out of a longer name, nor a key', () => {
        expect(show('ក្នុង Open Worship App')).toBe('ក្នុង Open Worship App');
        expect(show('ហើយចុច Enter')).toBe('ហើយចុច Enter');
        // A label inside a longer run of capitals is still found.
        expect(show('ចុច Mini Screen Options ឥឡូវ')).toBe(
            'ចុច អេក្រង់តូច Options ឥឡូវ',
        );
    });

    test('a single-word run the dictionary knows is the label', () => {
        expect(show('ចុច Open')).toBe('ចុច បើក');
    });

    test('a chip the reader cannot read is dropped', () => {
        expect(
            toRepliesShownInLanguage(
                [
                    'How do I show it on screen?',
                    'ស្វែងរកខផ្សេងទៀត',
                    '/btw what does the Bible Reader do?',
                    'Mini Screen',
                ],
                'km',
                translateLabel,
            ),
        ).toEqual(['ស្វែងរកខផ្សេងទៀត', 'អេក្រង់តូច']);
        // A few Khmer letters in an English chip, and a command, are not
        // for a reader of Khmer either; a key cap in a Khmer chip is.
        expect(
            toRepliesShownInLanguage(
                [
                    'ទេ thanks',
                    'Back to the អានព្រះគម្ពីរ',
                    '/btw សំណួរផ្សេង',
                    'ខ្ញុំចុច F5 ហើយតែមិនចេញ',
                ],
                'km',
                translateLabel,
            ),
        ).toEqual(['ខ្ញុំចុច F5 ហើយតែមិនចេញ']);
        // English keeps every chip.
        expect(
            toRepliesShownInLanguage(['Show me'], 'en', translateLabel),
        ).toEqual(['Show me']);
    });

    // The text-size answer on gemma4:cloud (2026-11-04, EC-459): the Malay
    // for "small" alone between Khmer words in a chip, a word the answer
    // above never says. A name the answer says, and a key, stay.
    test('a chip with a word of a third language the answer never says goes', () => {
        const replies = [
            'តើខ្ញុំធ្វើឱ្យវា Kecil វិញដោយរបៀបណា?',
            'សូមបើកការស្វែងរកនៅក្នុង Google ម្ដងទៀតសម្រាប់ខ្ញុំ',
            'តើលោក Noah ជានរណានៅក្នុងព្រះគម្ពីរ?',
            'ខ្ញុំចុច Esc ហើយតែវាមិនបិទទេ',
        ];
        const answer =
            'ដើម្បីធ្វើឱ្យអក្សរធំជាងនេះ សូមអានអំពី Noah ឬស្វែងរកនៅ Google។';
        expect(
            toRepliesShownInLanguage(
                replies,
                'km',
                translateLabel,
                undefined,
                'km',
                answer,
            ),
        ).toEqual(replies.slice(1));
        // With no answer to read it against, nothing is taken for a third
        // language's word.
        expect(toRepliesShownInLanguage(replies, 'km', translateLabel)).toEqual(
            replies,
        );
        // Nor in a lesson on an English verse's words, which ARE the lesson.
        expect(
            toRepliesShownInLanguage(
                replies,
                'km',
                translateLabel,
                { isLatinKept: true },
                'km',
                answer,
            ),
        ).toEqual(replies);
    });

    // The whole corpus asked in Khmer (2026-10-17): letters of a third script
    // slipped into Khmer words and chips -- Chinese, Telugu, Bengali, Arabic.
    test('a third script is taken out of a Khmer answer, signs and all', () => {
        expect(show('ចុចលើផ្ទាំងមើលជាមុន预览 នៅខាងស្ដាំ')).toBe(
            'ចុចលើផ្ទាំងមើលជាមុន នៅខាងស្ដាំ',
        );
        expect(show('ពាក្យ కోథాయ ក្នុងបញ្ជី')).toBe('ពាក្យ  ក្នុងបញ្ជី');
        expect(show('ការកំណត់الخاص របស់អ្នក')).toBe('ការកំណត់ របស់អ្នក');
        expect(show('នៅឯណា কোথায়?')).toBe('នៅឯណា ?');
        // Khmer itself, its digits, a key cap, emoji and a quoted name stay.
        expect(show('ចុច F5 ២ ដង 👍 លើ «Amazing Grace»')).toBe(
            'ចុច F5 ២ ដង 👍 លើ «Amazing Grace»',
        );
        // 2026-10-23, a word lesson: a Tibetan vowel sign on a Khmer letter
        // goes; Khmer's own signs and a shared accent stay.
        expect(show('ការបញ្ចេញសំឡេង៖ ហ\u0F71ារ៉ាគីអា')).toBe(
            'ការបញ្ចេញសំឡេង៖ ហារ៉ាគីអា',
        );
        expect(show('ពាក្យ e\u0301 លើ')).toBe('ពាក្យ e\u0301 លើ');
    });

    // 2026-10-23: a lowercase word of another language inside Khmer words --
    // `podkre` (Polish, underline) for the person's own highlight.
    test('a stray lowercase Latin word inside Khmer words is taken out', () => {
        expect(show('លើខ ១១ អ្នកបានគូស podkre ពាក្យថា')).toBe(
            'លើខ ១១ អ្នកបានគូស ពាក្យថា',
        );
        expect(show('ខ្ញុំប្រាប់អ្នកleថា')).toBe('ខ្ញុំប្រាប់អ្នកថា');
        expect(show('ដើម្បីរក្សាhonneur របស់គាត់')).toBe(
            'ដើម្បីរក្សា របស់គាត់',
        );
        // Before a gloss, which goes too.
        expect(show('ការគូស podkre (Highlights):')).toBe('ការគូស:');
        // A file name, a key, a name and a word at the edge of the sentence
        // stay.
        for (const kept of [
            'បើក GEN.8.pdf ឥឡូវនេះ',
            'ចុច Ctrl+S ដើម្បីរក្សាទុក',
            'លោក Noah បានសង់អាសនៈ',
            'សូមអរគុណ ok',
        ]) {
            expect(show(kept)).toBe(kept);
        }
    });

    // The whole corpus asked in Khmer (2026-10-17, EC-316): _ជំនួយ → …_ for
    // Help → under eight questions, and _ol:ខគម្ពីរ 1_ for `ol:Verse 1`.
    test('the menu bar keeps its English name at the head of a path', () => {
        expect(show('ចុច **Help** → **Keyboard Shortcuts**')).toBe(
            'ចុច **Help** → **ផ្លូវកាត់ក្ដារចុច**',
        );
        expect(show('នៅលើរបារម៉ឺនុយ ចុច ជំនួយ → ផ្លូវកាត់ក្ដារចុច។')).toBe(
            'នៅលើរបារម៉ឺនុយ ចុច Help → ផ្លូវកាត់ក្ដារចុច។',
        );
        expect(show('សូមចូលទៅកាន់ **ឧបករណ៍** › Start')).toBe(
            'សូមចូលទៅកាន់ **Tools** › Start',
        );
        // Glued to the word before it, it gets a space.
        expect(show('ចុចជំនួយ → ផ្លូវកាត់ក្ដារចុច')).toBe(
            'ចុច Help → ផ្លូវកាត់ក្ដារចុច',
        );
        // Not in the middle of a path, and not without one.
        expect(show('ការកំណត់ → ជំនួយ → ផ្សេងទៀត')).toBe(
            'ការកំណត់ → ជំនួយ → ផ្សេងទៀត',
        );
        expect(show('សុំជំនួយពីគេ។')).toBe('សុំជំនួយពីគេ។');
        // After the language's word for a menu (pass 6: _ម៉ឺនុយ ជំនួយ_ for
        // the Help menu under six tips answers), whole words only.
        expect(show('ចុចម៉ឺនុយ ជំនួយ ខាងលើ')).toBe('ចុចម៉ឺនុយ Help ខាងលើ');
        expect(show('បើកម៉ឺនុយ **ជំនួយ** ហើយ')).toBe('បើកម៉ឺនុយ **Help** ហើយ');
        expect(show('ចុចម៉ឺនុយ Help ខាងលើ')).toBe('ចុចម៉ឺនុយ Help ខាងលើ');
        expect(show('ម៉ឺនុយ ជំនួយការ')).toBe('ម៉ឺនុយ ជំនួយការ');
        // Or before an item only that menu has (pass 7: "click Help, then
        // choose Tips of the Day").
        const showTips = (text: string) => {
            return toAnswerShownInLanguage(text, 'km', (label) => {
                return (
                    {
                        ...LABEL_MAP,
                        'Tips of the Day': 'គន្លឹះប្រចាំថ្ងៃ',
                        'Open Online Help': 'បើកជំនួយតាមអ៊ីនធឺណិត',
                    }[label] ?? label
                );
            });
        };
        expect(showTips('ចុច ជំនួយ រួចជ្រើសរើស គន្លឹះប្រចាំថ្ងៃ។')).toBe(
            'ចុច Help រួចជ្រើសរើស គន្លឹះប្រចាំថ្ងៃ។',
        );
        // The ? button carries Open Online Help too: no telling them apart.
        expect(showTips('ចុច ជំនួយ រួចជ្រើសរើស បើកជំនួយតាមអ៊ីនធឺណិត។')).toBe(
            'ចុច ជំនួយ រួចជ្រើសរើស បើកជំនួយតាមអ៊ីនធឺណិត។',
        );
        // Not across a sentence.
        expect(showTips('សុំជំនួយ។ គន្លឹះប្រចាំថ្ងៃ')).toBe(
            'សុំជំនួយ។ គន្លឹះប្រចាំថ្ងៃ',
        );
        // A button called Help elsewhere is still the button.
        expect(show('ចុច Help នៅខាងលើ')).toBe('ចុច ជំនួយ នៅខាងលើ');
    });

    test('what is typed is left as it stands, and a song part is English', () => {
        expect(show('វាយ `ol:Verse 1` ហើយ `Mini Screen`')).toBe(
            'វាយ `ol:Verse 1` ហើយ `Mini Screen`',
        );
        expect(show('បន្ទាត់ ol:Verse 2 មុន')).toBe('បន្ទាត់ ol:Verse 2 មុន');
        expect(show('ប្លុក ol:ខគម្ពីរ 3 និង `ol: ខគម្ពីរ 1`')).toBe(
            'ប្លុក ol:Verse 3 និង `ol:Verse 1`',
        );
    });

    // Pass 6: _Help → ជជែក AI_ (three answers) and _Edit → ស្វែងរក_.
    test("a menu's own items stay English after its name", () => {
        const showWith = (text: string) => {
            const map: Record<string, string> = {
                ...LABEL_MAP,
                'AI Chat': 'ជជែក AI',
                Find: 'ស្វែងរក',
                Edit: 'កែសម្រួល',
            };
            return toAnswerShownInLanguage(text, 'km', (label) => {
                return map[label] ?? label;
            });
        };
        expect(showWith('បើក **Help** → **AI Chat** នៅលើរបារម៉ឺនុយ')).toBe(
            'បើក **Help** → **AI Chat** នៅលើរបារម៉ឺនុយ',
        );
        expect(showWith('បើក ជំនួយ → ជជែក AI នៅលើរបារម៉ឺនុយ')).toBe(
            'បើក Help → AI Chat នៅលើរបារម៉ឺនុយ',
        );
        expect(showWith('ចុច កែសម្រួល → ស្វែងរក')).toBe('ចុច Edit → Find');
        // A few words on in the same sentence, no arrow (redo of pass 6:
        // "the Help menu, then choose Report a Problem"), and only there.
        const showReport = (text: string) => {
            return toAnswerShownInLanguage(text, 'km', (label) => {
                return (
                    {
                        ...LABEL_MAP,
                        'Report a Problem': 'រាយការណ៍បញ្ហា',
                    }[label] ?? label
                );
            });
        };
        expect(
            showReport(
                'ចុចប៊ូតុង រាយការណ៍បញ្ហា (ឬម៉ឺនុយ Help រួចជ្រើសរើស រាយការណ៍បញ្ហា)។',
            ),
        ).toBe(
            'ចុចប៊ូតុង រាយការណ៍បញ្ហា (ឬម៉ឺនុយ Help រួចជ្រើសរើស Report a Problem)។',
        );
        expect(showReport('ម៉ឺនុយ Help មានវា។ ចុចប៊ូតុង រាយការណ៍បញ្ហា')).toBe(
            'ម៉ឺនុយ Help មានវា។ ចុចប៊ូតុង រាយការណ៍បញ្ហា',
        );
        // Under another menu it is that menu's translated item.
        expect(showWith('ចុច **Tools** → **AI Chat**')).toBe(
            'ចុច **Tools** → **ជជែក AI**',
        );
        // And the button of that name elsewhere is the button.
        expect(showWith('ចុចប៊ូតុង AI Chat')).toBe('ចុចប៊ូតុង ជជែក AI');
    });

    // Pass 8 (EC-329): a song's slide _(2)-Verse 1_ came out as
    // _(2)-ខគម្ពីរ 1_ (a Bible verse), and Verse alone was translated in a
    // list of part names.
    test('a song part named as a song names it stays as it stands', () => {
        expect(show('ចុចស្លាយ (2)-Verse 1 ក្នុងបញ្ជី')).toBe(
            'ចុចស្លាយ (2)-Verse 1 ក្នុងបញ្ជី',
        );
        expect(show('កូដ៖ Verse V, Chorus C, Bridge B។')).toBe(
            'កូដ៖ Verse V, Chorus C, Bridge B។',
        );
        // Alone, it is still the dictionary's word.
        expect(show('អាន Verse នោះ')).toBe('អាន ខគម្ពីរ នោះ');
    });
});

// An answer shown in the window's language where the cleaner must hold back:
// a Hebrew word an answer about a Hebrew verse quotes with its vowel points,
// and a single word in quotes that is a word being discussed.

const QUOTED_LABEL_MAP: Record<string, string> = {
    'Its verses': 'ខគម្ពីររបស់វា',
};
const translateQuotedLabel = (label: string) => {
    return QUOTED_LABEL_MAP[label] ?? label;
};

// Genesis 1:1's first word, pointed: its vowel signs are Hebrew marks.
const BERESHIT = 'בְּרֵאשִׁית';
const KHMER_LESSON = `ពាក្យ ${BERESHIT} មានន័យថា «នៅដើមដំបូង»។`;

describe('a Hebrew word in a Khmer answer', () => {
    test('keeps its letters and its vowel points when the verse being studied is Hebrew', () => {
        expect(
            toAnswerShownInLanguage(KHMER_LESSON, 'km', translateQuotedLabel, {
                scriptText: `${BERESHIT} בָּרָא אֱלֹהִים`,
            }),
        ).toBe(KHMER_LESSON);
    });

    test('is a third script, letters and signs, when nothing about the answer is Hebrew', () => {
        const shown = toAnswerShownInLanguage(
            KHMER_LESSON,
            'km',
            translateQuotedLabel,
        );
        expect(shown).not.toMatch(/\p{Script=Hebrew}/u);
        expect(shown).toContain('មានន័យថា «នៅដើមដំបូង»។');
    });
});

describe('a word in quotes', () => {
    test('a single lowercase word is a word being discussed, and stays as written', () => {
        expect(
            toAnswerShownInLanguage(
                'ពាក្យ "shepherd" មាននៅក្នុងខនេះ។',
                'km',
                translateQuotedLabel,
            ),
        ).toBe('ពាក្យ "shepherd" មាននៅក្នុងខនេះ។');
    });

    test('a quoted label of two words is written as the window shows it', () => {
        expect(
            toAnswerShownInLanguage(
                'ចុច "Its verses" ដើម្បីអាន។',
                'km',
                translateQuotedLabel,
            ),
        ).toBe('ចុច "ខគម្ពីររបស់វា" ដើម្បីអាន។');
    });
});
