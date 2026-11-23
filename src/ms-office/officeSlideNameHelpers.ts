/**
 * A slide named by its WORDS, not its number (2026-11-21, `EC-774`): asked
 * for "the prayers slide" in a deck with none, the model put the picture on
 * the last slide and called it the prayers slide. A change may now give
 * `slide` as the words the person named it by; the tool finds the one slide
 * saying them, and none or several is a refusal the model asks about. Pure.
 */

export type SlideWordsType = { number: number; text: string };

const MAX_SLIDE_WORDS_CHARS = 120;

/** Lower case, marks and signs as spaces, one space between words. */
export function toSlideWordsKey(text: string) {
    return text
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[\p{P}\p{S}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * The value a change gave as `slide`: a number, digits (`"3"`), the words
 * the slide says, or nothing usable.
 */
export function readSlideValue(
    value: unknown,
):
    | { kind: 'none' }
    | { kind: 'number'; number: number }
    | { kind: 'words'; words: string }
    | { kind: 'bad' } {
    if (value === undefined) {
        return { kind: 'none' };
    }
    if (typeof value === 'number') {
        // checked where it is used: "There is no slide 0"
        return { kind: 'number', number: value };
    }
    if (typeof value !== 'string') {
        return { kind: 'bad' };
    }
    const trimmed = value.trim();
    if (/^\d{1,4}$/.test(trimmed)) {
        return { kind: 'number', number: Number(trimmed) };
    }
    if (
        trimmed.length > MAX_SLIDE_WORDS_CHARS ||
        toSlideWordsKey(trimmed) === ''
    ) {
        return { kind: 'bad' };
    }
    return { kind: 'words', words: trimmed };
}

/** The numbers of the slides whose words hold `words`, in deck order. */
export function findSlidesSaying(
    slides: readonly SlideWordsType[],
    words: string,
) {
    const key = toSlideWordsKey(words);
    if (key === '') {
        return [];
    }
    return slides
        .filter((slide) => {
            return toSlideWordsKey(slide.text).includes(key);
        })
        .map((slide) => {
            return slide.number;
        });
}
