import { describe, expect, test } from 'vitest';

import {
    checkIsAppWorkAsk,
    checkIsClosingLine,
    pickVerseFindBible,
    readTypedVerseContentAsk,
    readTypedVerseFindAsk,
} from './verseAskLanguageHelpers';

// The questions are the elder-persona run's own (2026-10-17), read with the
// Khmer package's real `assistant.json`: a test of the data as much as of
// the code.

describe('readTypedVerseFindAsk', () => {
    test('English is read as before', () => {
        expect(
            readTypedVerseFindAsk(
                'Help me find a Bible verse in "KJV": love your enemies',
            ),
        ).toEqual({ bibleKey: 'KJV', remembered: 'love your enemies' });
    });

    test('the Khmer frame, with and without a Bible and words', () => {
        expect(readTypedVerseFindAsk('ជួយខ្ញុំស្វែងរកខគម្ពីរមួយ')).toEqual({
            bibleKey: null,
            remembered: null,
        });
        expect(
            readTypedVerseFindAsk('ជួយខ្ញុំស្វែងរកខគម្ពីរមួយក្នុង «ពគប»'),
        ).toEqual({ bibleKey: 'ពគប', remembered: null });
        expect(
            readTypedVerseFindAsk(
                'ជួយខ្ញុំស្វែងរកខគម្ពីរមួយក្នុង «KJV»: ទុកចិត្តដល់ព្រះយេហូវ៉ា',
            ),
        ).toEqual({ bibleKey: 'KJV', remembered: 'ទុកចិត្តដល់ព្រះយេហូវ៉ា' });
        expect(
            readTypedVerseFindAsk(
                'ជួយរកខគម្ពីរមួយផង ចាំមិនច្បាស់ទេ ព្រះយេស៊ូប្រាប់ឲ្យស្រឡាញ់ខ្មាំងសត្រូវ',
            )?.remembered,
        ).toBe('ចាំមិនច្បាស់ទេ ព្រះយេស៊ូប្រាប់ឲ្យស្រឡាញ់ខ្មាំងសត្រូវ');
    });

    test('zero-width spaces between Khmer words do not hide the frame', () => {
        expect(
            readTypedVerseFindAsk(
                ['ជួយ', 'ខ្ញុំ', 'ស្វែងរក', 'ខគម្ពីរ', 'មួយ'].join(
                    String.fromCharCode(0x200b),
                ),
            ),
        ).toEqual({ bibleKey: null, remembered: null });
    });

    test('a how-do-I is left to the assistant', () => {
        expect(readTypedVerseFindAsk('ជួយរកខគម្ពីរយ៉ាងម៉េច')).toBeNull();
        expect(
            readTypedVerseFindAsk('តើខ្ញុំរកខគម្ពីរយ៉ាងដូចម្ដេច?'),
        ).toBeNull();
    });

    test('a verse to put on the screen is the app’s work', () => {
        expect(
            readTypedVerseFindAsk('ជួយរកខគម្ពីរ ហើយដាក់វាលើអេក្រង់'),
        ).toBeNull();
    });
});

describe('readTypedVerseContentAsk', () => {
    test.each([
        [
            'ខគម្ពីរដែលនិយាយថា all things work together for good នោះនៅឯណា?',
            'all things work together for good',
        ],
        [
            'តើព្រះគម្ពីរនិយាយពីការអត់ទោសចិតសិបដងប្រាំពីរនៅឯណា?',
            'ការអត់ទោសចិតសិបដងប្រាំពីរ',
        ],
        [
            'ព្រះយេហូវ៉ាជាអ្នកគង្វាលខ្ញុំខ្ញុំនឹងមិនខ្វះអ្វីឡើយនៅខណា',
            'ព្រះយេហូវ៉ាជាអ្នកគង្វាលខ្ញុំខ្ញុំនឹងមិនខ្វះអ្វីឡើយ',
        ],
        [
            'ខ្ញុំចាំថាមានរឿងមួយ ព្រះយេស៊ូសួរពេត្រុសបីដងថា តើអ្នកស្រឡាញ់ខ្ញុំឬទេ តើនៅជំពូកណា ខណា?',
            'ខ្ញុំចាំថាមានរឿងមួយ ព្រះយេស៊ូសួរពេត្រុសបីដងថា តើអ្នកស្រឡាញ់ខ្ញុំឬទេ',
        ],
        ['មានខគម្ពីរណាដែលនិយាយអំពីសេចក្ដីសង្ឃឹមទេ?', 'សេចក្ដីសង្ឃឹម'],
        ['រកខគម្ពីរអំពីការអធិស្ឋាន', 'ការអធិស្ឋាន'],
        // A story by its name (EC-389).
        ['តើរឿងទឹកជំនន់នៅក្នុងគម្ពីរណា?', 'រឿងទឹកជំនន់'],
        ['រឿងយ៉ូណាសមាននៅណា', 'រឿងយ៉ូណាស'],
    ])('%s', (asked, words) => {
        expect(readTypedVerseContentAsk(asked)).toEqual({
            kind: 'verse',
            words,
        });
    });

    // The run's own how-do-I, panic and nonsense questions: none is a verse.
    test.each([
        'អក្សតូចពេក ភ្នែកខ្ញុំមើលអត់ឃើញទេ ធ្វើមិចឲ្យវាធំ???',
        'ខ្ញុំចង់អានព្រះគម្ពីរខ្មែរ និងអង់គ្លេសនៅក្បែរគ្នា ដើម្បីប្រៀបធៀប យ៉ូហាន ៣:១៦ តើធ្វើយ៉ាងម៉េច?',
        'ខ្ញុំចង់រកពាក្យ «សង្ឃឹម» ក្នុងព្រះគម្ពីរទាំងមូល ប៉ុន្តែចង់បានតែក្នុងគម្ពីរសញ្ញាថ្មីប៉ុណ្ណោះ',
        'ខ្ញុំរកមិនឃើញប៊ូតុងនោះទេ នៅឯណា?',
        'ខ្ញុំចុចខុស ហើយបាត់ខដែលខ្ញុំកំពុងអាន!!! ជួយផងៗ',
        'អក្សរអត់ចេញលើអេក្រង់ធំទេ!!! ថ្វាយបង្គំចាប់ផ្ដើមហើយ ជួយផងលឿនៗ',
        'ដាក់ ម៉ាថាយ ៥:៤៤ លើអេក្រង់ធំឲ្យខ្ញុំផង',
        'ចេកមួយគីឡូថ្លៃប៉ុន្មាន?',
        'ការកំណត់នៅឯណា?',
        'ខគម្ពីរនេះនៅខណា',
        'តើខ្ញុំដាក់ខគម្ពីរលើអេក្រង់ធំដោយរបៀបណា?',
        'which verse says do not worry',
    ])('%s is not', (asked) => {
        expect(readTypedVerseContentAsk(asked)).toBeNull();
    });
});

describe('pickVerseFindBible', () => {
    const listed = {
        bible: 'KJV',
        bibles: [
            { key: 'KJV', locale: 'en' },
            { key: 'ពគប', locale: 'km' },
            { key: 'FR1910', locale: 'fr' },
        ],
    };

    test('a Khmer ask searches the Khmer Bible over a lookup on KJV', () => {
        expect(pickVerseFindBible(listed, 'km')).toBe('ពគប');
        expect(pickVerseFindBible(listed, 'fr')).toBe('FR1910');
    });

    test('the lookup’s Bible otherwise', () => {
        expect(pickVerseFindBible(listed, 'en')).toBe('KJV');
        expect(pickVerseFindBible(listed, 'th')).toBe('KJV');
        expect(pickVerseFindBible({ ...listed, bible: 'ពគប' }, 'km')).toBe(
            'ពគប',
        );
        expect(pickVerseFindBible(null, 'km')).toBeNull();
    });
});

describe('checkIsClosingLine', () => {
    test('a thank-you or a goodbye, in any language', () => {
        for (const line of [
            'អរគុណច្រើន 🙏',
            'អរគុណ!',
            'Thank you so much',
            'thanks',
            'Merci beaucoup',
        ]) {
            expect(checkIsClosingLine(line), line).toBe(true);
        }
    });

    test('words of a verse are not one', () => {
        for (const line of [
            'អត់មែនទេ ខ្ញុំគិតថានៅក្នុងគម្ពីរលូកាវិញ',
            'thanksgiving in his courts with praise and enter his gates',
            'give thanks unto the Lord',
        ]) {
            expect(checkIsClosingLine(line), line).toBe(false);
        }
    });
});

describe('checkIsAppWorkAsk', () => {
    test('a Khmer line about the screen ends a verse search', () => {
        expect(checkIsAppWorkAsk('ដាក់វាលើអេក្រង់ផង')).toBe(true);
        expect(
            checkIsAppWorkAsk('អត់មែនទេ ខ្ញុំគិតថានៅក្នុងគម្ពីរលូកាវិញ'),
        ).toBe(false);
    });
});
