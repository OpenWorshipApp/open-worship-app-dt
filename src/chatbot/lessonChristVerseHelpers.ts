/**
 * A verse from another book told in Pointing to Jesus is given its own words
 * (BN-154, 2026-11-11, the ab31 read; the goal _chatbot completely smart
 * enough to help prepare a best preaching lesson_).
 *
 * The shape says a verse from elsewhere is quoted as it reads, then its
 * token, never from memory. Sonnet's three errors in ab31 were each such a
 * verse told in the model's own words instead: "Jesus tells His followers
 * that whoever abides in Him will find rest [^Matthew 11:28]" (Matthew 11:28
 * says "Come unto me"), the Pharisees "unclean" and "full of greed"
 * [^Matthew 23:25] ("extortion and excess"), and before them Revelation
 * 7:9's multitude brought "out of fear". A quotation is held to its verse by
 * BN-110; a verse told with no quotation marks was held to nothing. So a NEW
 * lesson's Christ section is read for a reference to another book than its
 * passage's in a sentence that quotes nothing, the window reads that verse
 * (`readCitedVerseTexts`), and the line is named under the change with the
 * verse's own words, for one more edit. Pure.
 */

import kjvBibleConfig from '../helper/bible-helpers/kjvBibleConfig.json';

// The Christ section of a lesson, to the next heading.
const CHRIST_SECTION_PATTERN =
    /^#{1,6}\s*Pointing to Jesus[^\n]*\n([\s\S]*?)(?=^#{1,6}\s|(?![\s\S]))/im;
// A verse token, `[^Matthew 11:28]` or `[^(KJV) Matthew 11:28]`, and a
// reference in brackets, `(1 Corinthians 1:24)`.
const VERSE_TOKEN_PATTERN = /\[\^(?:\([^)\n]*\)\s*)?([^\]\n]+?)\]/g;
const BRACKET_REF_PATTERN =
    /\(((?:[1-3] ?)?[A-Z][a-z]+(?: of [A-Z][a-z]+)? \d{1,3}:\d{1,3}(?:\s*[-–]\s*\d{1,3})?)\)/g;
// A quotation of twelve letters or more: held to its verse by BN-110. Every
// pair of marks is matched (BN-282): six letters asked of the pattern had
// paired a short quote's closing mark with the next one's opening.
const QUOTE_PATTERN = /[«“"]([^«»“”"\n]{1,400})[»”"]/gu;
const MIN_QUOTE_LETTERS = 12;
// At most this many lines are named under one change.
const MAX_CHRIST_VERSES = 2;

const BOOK_NAME_KEY_MAP = new Map<string, string>([
    ...Object.entries(kjvBibleConfig.keyBookMap as Record<string, string>).map(
        ([key, name]): [string, string] => {
            return [name.toLowerCase(), key];
        },
    ),
    ['psalm', 'PSA'],
    ['psalms', 'PSA'],
]);

/** The book key a reference names, `Matthew 11:28` -> `MAT`; else null. */
export function toRefBook(ref: string) {
    const name = String(ref ?? '')
        .trim()
        .replace(/\s*\d{1,3}(?::.*)?$/, '')
        .toLowerCase();
    return BOOK_NAME_KEY_MAP.get(name) ?? null;
}

export type ChristVerseType = { sentence: string; ref: string };

// The sentences of a section: a line, cut at a sentence's end.
function toSentenceList(text: string) {
    // A quotation's own end too: `…and strength." In the Gospels, …`.
    return text
        .split(/\n+|(?<=[.!?]|[.!?]["”»])\s+(?=[A-Z"“«])/)
        .map((sentence) => {
            return sentence.trim();
        })
        .filter((sentence) => {
            return sentence !== '';
        });
}

function checkHasQuotation(sentence: string) {
    for (const match of sentence.matchAll(QUOTE_PATTERN)) {
        if ((match[1].match(/\p{L}/gu) ?? []).length >= MIN_QUOTE_LETTERS) {
            return true;
        }
    }
    return false;
}

/**
 * The lines of a lesson's Pointing to Jesus that name a verse of another
 * book than the passage's and quote nothing: told in the model's words.
 */
export function findUnquotedChristVerses(
    text: string,
    passageRef: string | null,
): ChristVerseType[] {
    const section = CHRIST_SECTION_PATTERN.exec(String(text ?? ''))?.[1];
    const passageBook = passageRef === null ? null : toRefBook(passageRef);
    if (section === undefined || passageBook === null) {
        return [];
    }
    const found: ChristVerseType[] = [];
    for (const sentence of toSentenceList(section)) {
        if (checkHasQuotation(sentence)) {
            continue;
        }
        const refList = [
            ...[...sentence.matchAll(VERSE_TOKEN_PATTERN)].map((match) => {
                return match[1].trim();
            }),
            ...[...sentence.matchAll(BRACKET_REF_PATTERN)].map((match) => {
                return match[1].replace(/\s*–\s*/, '-');
            }),
        ];
        const ref = refList.find((one) => {
            const book = toRefBook(one);
            return book !== null && book !== passageBook;
        });
        if (ref === undefined) {
            continue;
        }
        found.push({ sentence, ref });
        if (found.length >= MAX_CHRIST_VERSES) {
            break;
        }
    }
    return found;
}

// BN-163 (ab35, ab36, both readers: Pointing to Jesus scored 1 of 2 in 13
// lessons of 32 by Opus): a word of the passage, quoted, put on Christ --
// "He took the "tormentors" of judgment upon himself" (Matthew 18:34, the
// king's), "He is the ultimate "river" of living water" (Psalm 46:4),
// "allowed himself to be "scorched"" (the rootless seed), "taking the
// "desolations" of the cross" (the LORD's works). A verb that makes the
// word his, then the quotation. BN-262 (ab93, Sonnet, two errors in one
// batch): "He was the one whose "bones" were crushed on the cross" (David's
// own distress, Psalm 32:3 -- not a bone of him was broken, John 19:36) and
// "He was mocked as "feeble" by the rulers of His day" (Sanballat's word
// for the Jews, Nehemiah 4:2) -- "whose" and a mocking verb make it his too.
const STRETCHED_WORD_PATTERN =
    /\b(?:took|takes?|taken|taking|bore|bears?|borne|bearing|carried|carr(?:y|ies|ying)|endured|endures?|enduring|suffered|suffers?|suffering|became|becomes?|provided|provides?|providing|(?:allowed|let|allowing|letting) himself (?:to )?be|(?:is|was|became|becomes) (?:the|our) (?:ultimate|true|real|greater|final|perfect)|whose|(?:is|was|were|being) (?:mocked|scorned|derided|ridiculed|taunted|reviled|jeered at|scoffed at|sneered at) (?:as|for being|for))\s+(?:the |our |all |every |that |this |his |her |a |an )?(?:ultimate |full |final |whole |very |true |real |greater |perfect )?["“]([^"”\n]{3,40})["”]/giu;
// What the Scriptures say he bore -- "who his own self bare our sins"
// (1 Peter 2:24), "made a curse for us" (Galatians 3:13), "borne our
// griefs" (Isaiah 53:4) -- is said of him rightly, whatever the passage.
const BORNE_WORD_PATTERN =
    /^(?:(?:our|the|his|all) )?(?:sins?|iniquit(?:y|ies)|transgressions?|trespass(?:es)?|\w*guilt\w*|curse[sd]?|griefs?|sorrows?|stripes|chastisement|punishment|death|shame|reproach(?:es)?|wrath|judge?ments?|condemnation|penalty)$/i;
// At most this many lines are named under one change.
const MAX_STRETCHED_WORDS = 2;

export type StretchedChristWordType = { sentence: string; text: string };

// A phrase as words: letters and digits, lower case, one space apart.
function toWordKey(text: string) {
    return ` ${String(text ?? '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim()} `;
}

/**
 * The lines of a lesson's Pointing to Jesus that put a word of its OWN
 * passage on Christ -- `passageWords` being the passage as this ask read
 * it (`readPassageVerseWords`) -- each with what to say instead. A word
 * the passage does not have (John's "good shepherd" in a Psalm 23 lesson)
 * is left: it is another verse's, held by BN-154.
 */
export function findStretchedChristWords(
    text: string,
    passageWords: string,
): StretchedChristWordType[] {
    const section = CHRIST_SECTION_PATTERN.exec(String(text ?? ''))?.[1];
    const passageKey = toWordKey(passageWords);
    if (section === undefined || passageKey.trim() === '') {
        return [];
    }
    const found: StretchedChristWordType[] = [];
    for (const sentence of toSentenceList(section)) {
        const word = [...sentence.matchAll(STRETCHED_WORD_PATTERN)]
            .map((match) => {
                return match[1].trim();
            })
            .find((one) => {
                const key = toWordKey(one);
                return (
                    (one.match(/\p{L}/gu) ?? []).length >= 4 &&
                    key.trim().split(' ').length <= 5 &&
                    !BORNE_WORD_PATTERN.test(key.trim()) &&
                    passageKey.includes(key)
                );
            });
        if (word === undefined) {
            continue;
        }
        found.push({
            sentence,
            text:
                `"${word}" is the passage's own word for what IT tells of, ` +
                'and the passage never says it of Christ -- say how what the ' +
                'passage MEANS leads to his work, with a verse that says so, ' +
                'never its word put on him',
        });
        if (found.length >= MAX_STRETCHED_WORDS) {
            break;
        }
    }
    return found;
}

/** The passage a new lesson is written on: its passage block, else its first lone token. */
export function readLessonPassageRef(changeList: readonly any[]) {
    for (const change of Array.isArray(changeList) ? changeList : []) {
        if (change?.kind === 'passage' && typeof change?.ref === 'string') {
            return change.ref as string;
        }
        if (typeof change?.text !== 'string') {
            continue;
        }
        const line = change.text.split('\n').find((one: string) => {
            return /^\s*\[\^[^\]\n]+\]\s*$/.test(one);
        });
        if (line !== undefined) {
            return (
                /\[\^(?:\([^)\n]*\)\s*)?([^\]\n]+?)\]/.exec(line)?.[1] ?? null
            );
        }
    }
    return null;
}

/**
 * Said under the lesson written: each such line, by its block where the
 * window read the note, with the words the verse has, for one more edit.
 */
export function genChristVerseNote(
    found: readonly (ChristVerseType & { verse: string })[],
    blockNumbers: readonly (number | null)[] = [],
) {
    if (found.length === 0) {
        return null;
    }
    const said = found.map((item, index) => {
        const block = blockNumbers[index] ?? null;
        const sentence =
            item.sentence.length > 200
                ? `${item.sentence.slice(0, 200)}…`
                : item.sentence;
        const verse = item.verse.replace(/^\(\d+\):\s*/, '').trim();
        return (
            (block === null ? '' : `block ${block}: `) +
            `"${sentence}" -- ${item.ref} reads: "${verse}"`
        );
    });
    const numberList = blockNumbers
        .slice(0, found.length)
        .filter((block, index, list) => {
            return block !== null && list.indexOf(block) === index;
        });
    const isEveryNumbered =
        blockNumbers.length >= found.length &&
        !blockNumbers.slice(0, found.length).includes(null);
    const change = isEveryNumbered
        ? ` -- {block: ${numberList.length === 1 ? numberList[0] : '<each>'}, ` +
          'text: <its words, the verse quoted word for word as it reads, ' +
          'then its token>}' +
          (numberList.length === 1
              ? ''
              : ` for each of blocks ${numberList.join(' and ')}`) +
          ' --'
        : ', the verse quoted word for word as it reads, then its token,';
    return (
        '(The change is made, but Pointing to Jesus tells a verse in other ' +
        "words than its own, and a hearer takes them for Scripture's: " +
        `${said.join('; ')}. Change ONLY ${found.length === 1 ? 'that line' : 'those lines'} ` +
        `with ONE more edit${change} saying of it only what those words say, ` +
        'every other block as it is now -- then answer.)'
    );
}
