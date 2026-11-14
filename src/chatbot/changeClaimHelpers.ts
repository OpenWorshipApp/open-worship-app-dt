// An answer saying it changed the note or the study when nothing did
// (BN-53, EC-499, EC-501), and such a claim written INTO the study as its
// new words (EC-505): the words that say so, in English here and in every
// other language in its own data (`changeClaims`, EC-508) -- a Gemma 4 model
// answers in the person's own language, so English's alone saw nothing of
// it. A leaf: the provider loop reads it, and so do the tests that hold
// every language to its words without loading that loop.
import { type ChangeClaimWordsType } from './chatLangHelpers';

// What an answer says after a change to a note: the change it made, in the
// first person. "I put" alone is also an offer ("shall I put it at the
// end?"): only "I've put" claims it. Read on `toClaimReadText`'s words, so
// the curly "I’ve" is "I've".
const NOTE_CLAIM_PATTERN =
    /\bI(?:'ve| have) (?:added|made|changed|moved|removed|put|drawn|updated|centred|centered|coloured|colored|enlarged|replaced|inserted|fixed|corrected|translated|ticked|underlined|bolded|highlighted|created|written|rewritten)\b|\bI (?:added|made|changed|moved|removed|drew|updated|centred|centered|coloured|colored|enlarged|replaced|inserted|fixed|corrected|translated|ticked|underlined|bolded|highlighted|created|wrote|rewrote)\b/i;

// And what the prompt has it say of that change: it is not saved yet, and
// Undo this change puts it back -- a claim of a change in a note's answer,
// and no more than the truth of a NEW study a card holds (EC-700), which
// nothing has saved either (each language's `unsaved`).
const UNSAVED_CLAIM_PATTERN =
    /\bnot saved yet\b|\bUndo this change puts it back\b/i;

// The button a change's card has: an answer telling them to press Save
// changes, with no card under it, claims a change too.
const SAVE_CHANGES_CLAIM_PATTERN = /\bSave changes\b/i;

// Words pointing at the study file ITSELF, as a report of a change to it
// does ("in the study file", "press Save changes"); a study's own do not.
const STUDY_FILE_POINTER_PATTERN =
    /\b(?:study file|the file|this file|your file)\b|\bSave changes\b/i;
const MARKDOWN_HEADING_LINE_PATTERN = /^#{1,6}\s/;

// Words as the claim readers read them: NFC, the invisible format
// characters out, the curly apostrophes straight -- as a typed line is read
// (`toStudyAskLine`), and as every language's `changeClaims` is written.
function toClaimReadText(words: string) {
    return words
        .normalize('NFC')
        .replace(/\p{Cf}/gu, '')
        .replace(/[‘’ʻʼ]/g, "'");
}

/**
 * Whether words claim a change: English's claim words, and those of the
 * language the answer is written in (`claimWords`, EC-508); with
 * `isSaveClaim`, a Save changes named too (a study's card).
 */
export function checkHasChangeClaim(
    words: string,
    claimWords: ChangeClaimWordsType | null,
    isSaveClaim: boolean,
) {
    const text = toClaimReadText(words);
    return (
        NOTE_CLAIM_PATTERN.test(text) ||
        UNSAVED_CLAIM_PATTERN.test(text) ||
        (isSaveClaim && SAVE_CHANGES_CLAIM_PATTERN.test(text)) ||
        claimWords?.claim?.test(text) === true ||
        claimWords?.unsaved?.test(text) === true ||
        (isSaveClaim && claimWords?.save?.test(text) === true)
    );
}

/**
 * Whether words report a change MADE, in the first person: English's claim
 * words and the answer language's `claim` -- never "not saved yet" (each
 * language's `unsaved`) nor a Save changes (2026-11-14, EC-700). Read under
 * a card holding a NEW study, which is not saved yet whatever is asked: an
 * answer there says so, and the ask itself tells the model so.
 */
export function checkHasMadeChangeClaim(
    words: string,
    claimWords: ChangeClaimWordsType | null,
) {
    const text = toClaimReadText(words);
    return (
        NOTE_CLAIM_PATTERN.test(text) || claimWords?.claim?.test(text) === true
    );
}

// What an answer says after a change to the FOREGROUND, which a note's words
// do not cover: a countdown started, a clock taken off, everything cleared.
// First person only, as `NOTE_CLAIM_PATTERN`: "has been cleared" and "is now
// off" are what a read of the screens says too. "I set" and "I reset" are
// also offers ("shall I set it?"), so only "I've set" claims them.
const FOREGROUND_CLAIM_PATTERN =
    /\bI(?:'ve| have) (?:started|stopped|cleared|hidden|taken|paused|resumed|restarted|turned|set|reset|shown)\b|\bI (?:started|stopped|cleared|hid|took|paused|resumed|restarted|turned)\b/i;

/**
 * Whether words claim a change to the foreground (EC-558): its own verbs in
 * English and in the answer's language (`claimWords.foreground`, EC-607 --
 * a Spanish "He iniciado una cuenta regresiva" over nothing put up had been
 * read by no word: the language's note words say "added", never
 * "started"), then every change claim a note's or a study's answer can
 * make -- English's and the answer language's.
 */
export function checkHasForegroundClaim(
    words: string,
    claimWords: ChangeClaimWordsType | null,
) {
    const text = toClaimReadText(words);
    return (
        FOREGROUND_CLAIM_PATTERN.test(text) ||
        claimWords?.foreground?.test(text) === true ||
        checkHasChangeClaim(words, claimWords, false)
    );
}

/**
 * The report of a change that a CHANGE to a study file would write into it
 * (2026-11-11, EC-505): its first line of words -- a heading stepped over --
 * claims a change (`NOTE_CLAIM_PATTERN`, or Save changes) and points at the
 * file itself. Seen live: gemma4:cloud, asked to fix one Khmer line, sent
 * its earlier answer "I have fixed the cross-references in the study file
 * …" as the new words of the English discussion questions. Null for a
 * study's own words, and for a new study (no `file`), which takes nothing
 * of the person's away. In English, and in the language the answer is
 * written in (`claimWords`, EC-508): a claim and a pointer of either.
 */
export function findStudyChangeReport(
    args: any,
    claimWords: ChangeClaimWordsType | null = null,
): string | null {
    if (typeof args?.file !== 'string' || args.file.trim() === '') {
        return null;
    }
    for (const field of ['content', 'append'] as const) {
        const text = typeof args[field] === 'string' ? args[field] : '';
        const line = text
            .replace(/\r\n?/g, '\n')
            .split('\n')
            .map((one: string) => {
                return one.trim();
            })
            .find((one: string) => {
                return one !== '' && !MARKDOWN_HEADING_LINE_PATTERN.test(one);
            });
        if (line === undefined) {
            continue;
        }
        const readLine = toClaimReadText(line);
        const isFilePointed =
            STUDY_FILE_POINTER_PATTERN.test(readLine) ||
            claimWords?.file?.test(readLine) === true ||
            claimWords?.save?.test(readLine) === true;
        if (isFilePointed && checkHasChangeClaim(line, claimWords, true)) {
            return line;
        }
    }
    return null;
}
