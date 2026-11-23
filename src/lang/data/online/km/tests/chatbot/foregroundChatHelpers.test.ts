import { describe, expect, it } from 'vitest';
import { readForegroundComponentAsk } from '../../../../../../chatbot/foregroundChatHelpers';

// The window's own words for the launcher's labels, as the Khmer dictionary
// gives them.
const LABEL_MAP: Record<string, string> = {
    Time: 'ម៉ោង',
    Stopwatch: 'នាឡិកាបញ្ឈប់',
    Countdown: 'រាប់ថយក្រោយ',
};
const translate = (key: string) => {
    return LABEL_MAP[key] ?? key;
};

describe('a foreground component named in Khmer (EC-563)', () => {
    it('reads the clock by the words people use for it', () => {
        // "Put the time on the screen", then "take the clock off the
        // screen": the first had named nothing, and the verse row's gap had
        // taken "the time" as its verse.
        expect(readForegroundComponentAsk('ដាក់ម៉ោងនៅលើអេក្រង់', translate)).toBe(
            'time',
        );
        expect(readForegroundComponentAsk('ដកនាឡិកាចេញពីអេក្រង់', translate)).toBe(
            'time',
        );
    });

    it('keeps the longer name: a stopwatch is no clock', () => {
        expect(
            readForegroundComponentAsk('ដាក់នាឡិកាបញ្ឈប់លើអេក្រង់', translate),
        ).toBe('stopwatch');
        expect(
            readForegroundComponentAsk('ចាប់ផ្តើមរាប់ថយក្រោយ ៥ នាទី', translate),
        ).toBe('countdown');
    });

    // 2026-11-13, EC-588: "show a message at the bottom of the screen for
    // 15 seconds: …" named nothing, went to the ordinary tool, and came up
    // in the middle, 4 asks of 4 -- English's EC-532 in Khmer.
    it('a message at an edge of the screen is a Quick Text', () => {
        for (const line of [
            'បង្ហាញសារនៅខាងក្រោមអេក្រង់រយៈពេល 15 វិនាទី៖ ម្ចាស់ឡាន ABC 123 ភ្លើងឡានរបស់អ្នកនៅបើក',
            'ដាក់សារនៅខាងលើអេក្រង់៖ សូមបិទទូរស័ព្ទ',
            'បង្ហាញសេចក្ដីជូនដំណឹងនៅផ្នែកខាងក្រោមនៃអេក្រង់',
            'ដាក់ពាក្យស្វាគមន៍នៅខាងលើអេក្រង់',
        ]) {
            expect(readForegroundComponentAsk(line, translate)).toBe(
                'quick-text',
            );
        }
        // The message below or above in the chat names no screen.
        expect(
            readForegroundComponentAsk('បកប្រែសារខាងក្រោម', translate),
        ).toBeNull();
        // Scrolling words at the bottom, a clock moved to a corner, a
        // countdown with a welcome are what they were.
        expect(
            readForegroundComponentAsk(
                'បង្ហាញអក្សររត់នៅខាងក្រោមអេក្រង់៖ សូមស្វាគមន៍',
                translate,
            ),
        ).not.toBe('quick-text');
        expect(
            readForegroundComponentAsk(
                'ផ្លាស់នាឡិកាទៅជ្រុងខាងក្រោមខាងស្ដាំ',
                translate,
            ),
        ).toBe('time');
        expect(
            readForegroundComponentAsk(
                'ដាក់ការរាប់ថយក្រោយ 3 នាទី និងសារស្វាគមន៍នៅខាងលើ',
                translate,
            ),
        ).toBe('countdown');
    });

    it('never "what time is it?"', () => {
        expect(
            readForegroundComponentAsk('តើម៉ោងប៉ុន្មានហើយ?', translate),
        ).toBeNull();
    });
});
