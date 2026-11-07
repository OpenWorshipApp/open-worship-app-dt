import { afterEach, describe, expect, test, vi } from 'vitest';

import {
    checkIsChosenScript,
    checkIsLanguageWord,
    checkIsWalkthroughEchoWord,
    detectTypedLanguage,
    findYesNoReplies,
    getAssistantLanguage,
    listFrameAliases,
    pickReplyLanguage,
    toAsciiDigits,
    toShownDigits,
} from '../../../../../../chatbot/chatLangHelpers';

afterEach(() => {
    vi.unstubAllGlobals();
});

function stubHtmlLang(lang: string) {
    vi.stubGlobal('document', { documentElement: { lang } });
}

describe('the languages are the files beside the language packages', () => {
    test('Khmer is read as its own script, with its own digits', () => {
        const khmer = getAssistantLanguage('km');
        expect(khmer.name).toBe('Khmer');
        expect(khmer.isLatinScript).toBe(false);
        expect(khmer.scriptPattern.test('ព្រះគម្ពីរ')).toBe(true);
        expect(khmer.scriptPattern.test('Bible')).toBe(false);
        expect(khmer.nativeDigits).toBe('០១២៣៤៥៦៧៨៩');
    });
});

describe('detectTypedLanguage', () => {
    test('a Khmer sentence is Khmer whatever else is in it', () => {
        expect(detectTypedLanguage('តើខ្ញុំបង្ហាញខគម្ពីរដោយរបៀបណា?')).toBe(
            'km',
        );
        expect(detectTypedLanguage('ចុច F5 ដើម្បីបង្ហាញអេក្រង់')).toBe('km');
    });

    test('an English sentence naming a Khmer button is English', () => {
        expect(
            detectTypedLanguage('Where is the លុប button in the window?'),
        ).toBe('en');
    });
});

describe('pickReplyLanguage', () => {
    test('what they typed decides', () => {
        expect(
            pickReplyLanguage('How do I show a song on the screen?', {
                appLangCode: 'km',
            }),
        ).toBe('en');
        expect(
            pickReplyLanguage('តើខ្ញុំបង្ហាញចម្រៀងដោយរបៀបណា?', {
                appLangCode: 'en',
            }),
        ).toBe('km');
    });

    test('a question in the app’s script that quotes English is the app’s', () => {
        expect(
            pickReplyLanguage(
                'ខគម្ពីរដែលនិយាយថា all things work together for good នោះនៅឯណា?',
                { appLangCode: 'km' },
            ),
        ).toBe('km');
        // ...but not in an English app, where the Khmer is what was typed.
        expect(
            pickReplyLanguage('Where is ព្រះគម្ពីរ in the menu?', {
                appLangCode: 'en',
            }),
        ).toBe('en');
    });
});

describe('the words for yes and no', () => {
    test('a whole reply in any language here', () => {
        expect(checkIsLanguageWord('បាទ', 'yes')).toBe(true);
        expect(checkIsLanguageWord('ចាស។', 'yes')).toBe(true);
        expect(checkIsLanguageWord('អត់ទេ', 'no')).toBe(true);
    });

    test('never a sentence that ends in one', () => {
        expect(checkIsLanguageWord('ខ្ញុំមិនឃើញវាទេ', 'no')).toBe(false);
        expect(checkIsLanguageWord('', 'yes')).toBe(false);
    });
});

test('native digits are read as the numbers they are', () => {
    expect(toAsciiDigits('យ៉ូហាន ៣:១៦')).toBe('យ៉ូហាន 3:16');
    expect(toAsciiDigits('John 3:16')).toBe('John 3:16');
});

test('a count is written in the app language’s own digits', () => {
    stubHtmlLang('km');
    expect(toShownDigits(74)).toBe('៧៤');
    expect(toShownDigits('9 to 16')).toBe('៩ to ១៦');
    stubHtmlLang('en');
    expect(toShownDigits(74)).toBe('74');
});

test('a frame marker a model translated is known by the language’s file', () => {
    expect(listFrameAliases('OPTIONS')).toContain('ជម្រើស');
    expect(listFrameAliases('NOTHING')).toEqual([]);
});

describe('checkIsChosenScript', () => {
    test('a Khmer chip under a Khmer answer, or in a Khmer app', () => {
        expect(checkIsChosenScript('បាទ/ចាស', 'ចុចប៊ូតុង', 'en')).toBe(true);
        expect(checkIsChosenScript('បាទ/ចាស', 'Press the button', 'km')).toBe(
            true,
        );
    });

    test('never a script nobody chose', () => {
        expect(checkIsChosenScript('请确认', 'ចុចប៊ូតុង', 'km')).toBe(false);
        expect(checkIsChosenScript('បាទ', 'Press the button', 'en')).toBe(
            false,
        );
    });
});

describe('findYesNoReplies', () => {
    test('a Khmer yes-or-no question gets the Khmer buttons', () => {
        expect(findYesNoReplies('តើអ្នកចង់ឲ្យខ្ញុំបង្ហាញទេ?')).toEqual([
            'បាទ/ចាស',
            'ទេ អរគុណ',
        ]);
    });

    test('English is left to its own lead-ins', () => {
        expect(findYesNoReplies('Would you like me to show you?')).toBeNull();
        expect(findYesNoReplies('តើអ្នកនៅទំព័រណា?')).toBeNull();
    });
});

test('a walkthrough said again in Khmer is an echo', () => {
    expect(checkIsWalkthroughEchoWord('បង្ហាញខ្ញុំម្តងមួយៗ')).toBe(true);
    expect(checkIsWalkthroughEchoWord('បាទ')).toBe(true);
    expect(checkIsWalkthroughEchoWord('ប្តូរពណ៌អក្សរ')).toBe(false);
});
