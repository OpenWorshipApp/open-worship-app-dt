import { describe, expect, test } from 'vitest';

import { OPEN_LYRIC_FENCE_LIST } from '../../tools/owa-devtools-mcp/openLyric.mjs';
import {
    LYRIC_PART_NAME_LIST,
    NATIVE_MENU_ITEM_MAP,
    toAnswerShownInLanguage,
    toRepliesShownInLanguage,
} from './answerLanguageHelpers';

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
        // English and French keep every chip.
        expect(
            toRepliesShownInLanguage(['Show me'], 'en', translateLabel),
        ).toEqual(['Show me']);
        expect(
            toRepliesShownInLanguage(['Montrez-moi'], 'fr', translateLabel),
        ).toEqual(['Montrez-moi']);
    });

    test('a Latin-script language keeps its brackets, gets its labels', () => {
        expect(show('Cliquez sur Mini Screen (à droite).', 'fr')).toBe(
            'Cliquez sur អេក្រង់តូច (à droite).',
        );
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
        // A language written in Latin letters is left alone.
        expect(show('Cliquez 预览', 'fr')).toBe('Cliquez 预览');
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

    test('the native menu items are the ones electronMenu.ts writes', async () => {
        const { readFileSync } = await import('node:fs');
        const source = readFileSync('electron/electronMenu.ts', 'utf-8');
        const labelList = [...source.matchAll(/label: ['`]([^'`$]+)['`]/g)]
            .map((match) => {
                return match[1];
            })
            .filter((label) => {
                return ![
                    'File',
                    'Edit',
                    'View',
                    'Tools',
                    'Window',
                    'Insert',
                    'Preferences...',
                ].includes(label);
            });
        const listed = Object.values(NATIVE_MENU_ITEM_MAP).flat();
        expect(new Set(listed)).toEqual(
            new Set([...labelList, 'Reset Position and Size']),
        );
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

    test('the song part names are the Open Lyric fences', () => {
        expect(LYRIC_PART_NAME_LIST).toEqual(
            OPEN_LYRIC_FENCE_LIST.map((fence) => {
                return fence.header;
            }),
        );
    });
});
