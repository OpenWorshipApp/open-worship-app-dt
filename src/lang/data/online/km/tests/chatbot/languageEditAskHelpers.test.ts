import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { setChatTranslator } from '../../../../../../chatbot/chatTranHelpers';
import {
    readLanguageNoteStyleAsk,
    readLanguageSizeAsk,
} from '../../../../../../chatbot/languageEditAskHelpers';
import { readNoteStyleAsk } from '../../../../../../chatbot/noteChatHelpers';
import {
    findWindowDoneCardAsk,
    readSlideSizeAsk,
} from '../../../../../../chatbot/slideChatHelpers';

// BN-16 (2026-11-08, the goal _work great for all languages_): the text
// size and a whole-note style, typed in Khmer, are done by the help window
// with no model, as the English lines are -- from `textSizeAsks`,
// `noteStyleAsks` and `colorWords` in this package's `assistant.json`.

const DICTIONARY = JSON.parse(
    readFileSync(join(__dirname, '..', '..', 'dictionary.json'), 'utf8'),
) as Record<string, string>;

afterEach(() => {
    setChatTranslator(
        (text) => text,
        (text) => text,
    );
});

describe('a text size typed in Khmer', () => {
    test('larger, smaller, one size', () => {
        for (const asked of [
            DICTIONARY['Make the words larger'],
            'សូមធ្វើឱ្យអក្សរធំជាងនេះបន្តិច',
            'ពង្រីកអក្សរ',
            'ពង្រីកទំហំអក្សរទាំងអស់',
            'ធ្វើឱ្យអក្សរ​ធំជាងមុន',
        ]) {
            expect(readLanguageSizeAsk(asked)).toEqual({ kind: 'larger' });
        }
        for (const asked of [
            DICTIONARY['Make the words smaller'],
            'បង្រួមអក្សរ',
            'បន្ថយទំហំអក្សរ',
        ]) {
            expect(readLanguageSizeAsk(asked)).toEqual({ kind: 'smaller' });
        }
        expect(readLanguageSizeAsk('កំណត់ទំហំអក្សរ ២០ px')).toEqual({
            kind: 'set',
            size: 20,
        });
        // As the slide and note shortcuts read it.
        expect(readSlideSizeAsk('ពង្រីកអក្សរ')).toEqual({
            kind: 'scale',
            factor: 1.25,
        });
    });

    test('a part, or big letters that may be capitals, is the assistant’s', () => {
        for (const asked of [
            'ធ្វើឱ្យចំណងជើងធំជាងមុន',
            // "Big letters" is also the editor's Uppercase.
            'ធ្វើឱ្យអក្សរធំ',
            'ធ្វើឱ្យពាក្យ ព្រះ នៅបន្ទាត់ទីមួយ ធំជាងមុន',
        ]) {
            expect(readLanguageSizeAsk(asked)).toBeNull();
        }
    });
});

describe('a style for the whole note typed in Khmer', () => {
    test('bold, centred, a colour, cleared', () => {
        expect(readLanguageNoteStyleAsk('ធ្វើឱ្យអក្សរទាំងអស់ដិត')).toEqual({
            styles: ['bold'],
        });
        expect(readLanguageNoteStyleAsk('ដាក់អក្សរទាំងអស់នៅកណ្ដាល')).toEqual({
            align: 'center',
        });
        expect(
            readLanguageNoteStyleAsk('ធ្វើឱ្យអក្សរទាំងអស់ទៅជាពណ៌ក្រហម'),
        ).toEqual({ color: 'red' });
        expect(readLanguageNoteStyleAsk('សម្អាតទម្រង់អក្សរទាំងអស់')).toEqual({
            clear: true,
        });
        // As the note shortcut reads it.
        expect(readNoteStyleAsk('ធ្វើឱ្យកំណត់ត្រាទាំងមូលដិត')).toEqual({
            styles: ['bold'],
        });
    });

    // 2026-11-09: the W-60 page's own examples -- "everything" as well as
    // the letters, and a font named with no word for font, as English reads
    // "use Georgia for the whole note" (a name the font box lacks is the
    // assistant's, genNoteStyleChanges).
    test('everything, and a font with no word for font', () => {
        expect(readLanguageNoteStyleAsk('ដាក់អ្វីៗទាំងអស់នៅកណ្ដាល')).toEqual({
            align: 'center',
        });
        expect(readLanguageNoteStyleAsk('ធ្វើឱ្យអ្វីៗទាំងអស់ដិត')).toEqual({
            styles: ['bold'],
        });
        expect(
            readLanguageNoteStyleAsk('ប្រើ Georgia សម្រាប់កំណត់ត្រាទាំងមូល'),
        ).toEqual({ font: 'Georgia' });
        expect(
            readLanguageNoteStyleAsk(
                'ប្រើពុម្ពអក្សរ Georgia សម្រាប់កំណត់ត្រាទាំងមូល',
            ),
        ).toEqual({ font: 'Georgia' });
        // One part is still the assistant's.
        expect(
            readLanguageNoteStyleAsk('ប្រើ Georgia សម្រាប់ចំណងជើង'),
        ).toBeNull();
    });

    test('one word, or a colour it does not name, is the assistant’s', () => {
        expect(
            readLanguageNoteStyleAsk(
                'ធ្វើឱ្យពាក្យ ព្រះ នៅបន្ទាត់ទីមួយ ទៅជាពណ៌ក្រហម',
            ),
        ).toBeNull();
        expect(
            readLanguageNoteStyleAsk('ធ្វើឱ្យអក្សរទាំងអស់ទៅជាពណ៌ស្វាយខ្ចី'),
        ).toBeNull();
    });
});

describe('a card button pressed in Khmer', () => {
    test('is asked in its English, which the window reads', () => {
        setChatTranslator(
            (text) => DICTIONARY[text] ?? text,
            (text) => DICTIONARY[text] ?? text,
        );
        expect(findWindowDoneCardAsk(DICTIONARY['Make the words larger'])).toBe(
            'Make the words larger',
        );
        expect(findWindowDoneCardAsk('ពិនិត្យអក្ខរាវិរុទ្ធ')).toBeNull();
    });
});
