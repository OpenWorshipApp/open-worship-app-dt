import { describe, expect, test } from 'vitest';

import { readStudyFileAsk } from '../../../../../../chatbot/studyFileChatHelpers';

// EC-464 (2026-11-09): a study file asked for in Khmer goes to the study
// ask, as the English lines do -- from `studyFileAsks` in this package's
// `assistant.json`. A how-to and a Bible note stay their own.

describe('a study file asked for in Khmer', () => {
    test('a making word and a study file, study content or Resources', () => {
        for (const asked of [
            'បង្កើតឯកសារសិក្សាសម្រាប់ ម៉ាថាយ ៣:៣-៧',
            'សូមធ្វើឯកសារធនធានសម្រាប់ យ៉ូហាន ៣:១៦',
            'រក្សាទុកក្នុងឯកសារធនធាន',
            'សរសេរមេរៀនសិក្សាអំពី យ៉ូហាន ៣',
        ]) {
            expect(readStudyFileAsk(asked)).toBe(true);
        }
    });

    test('a how-to, a note and a plain question are not', () => {
        for (const asked of [
            'តើបង្កើតឯកសារសិក្សាដោយរបៀបណា?',
            'បង្កើតកំណត់ត្រាសិក្សា យ៉ូហាន ៣:១៦',
            'យ៉ូហាន ៣:១៦ មានន័យអ្វី?',
        ]) {
            expect(readStudyFileAsk(asked)).toBe(false);
        }
    });
});
