/**
 * A Bible NOTE or a MARKDOWN FILE: which kind of thing the assistant's new
 * words are kept as (2026-11-13, EC-581; the user: _the chatbot usually
 * confuse between bible-note and resource file_, _chatbot should alway
 * provide option to create bible-note or markdown .md file_, _whenever
 * creating bible-note or resource study file should always let user choose
 * between bible-note or markdown file_, then _but if user click and choose
 * step by step explicitely it should skip the confirmation_).
 *
 * What a model makes new -- a note it adds, a study file it drafts -- is
 * held by the window, and the card under the answer lets the person choose:
 * **New Bible Note**, or **Create "<name>.md"** in Resources or in Bible
 * Notes (`genStudyDraftActions`). The one exception is a kind the person
 * already chose by a PRESS -- an option under an answer, a chip -- that
 * names it: that is made as it was chosen, with nothing more to press.
 * Words they TYPED still get the card: the model is what read them, and
 * the model is what confused the two.
 *
 * Read narrowly, on purpose. A kind read where none was chosen makes the
 * wrong thing with nothing asked -- the very confusion this is for -- while
 * a choice missed costs one more press on the card. So "Add notes on verse
 * 3" chooses nothing: a bare "note" is everyday English, and in a study's
 * conversation it asks for words in the study.
 *
 * Pure, every rule a test.
 */
export type CreateKindType = 'note' | 'markdown';

/** The labels the window's language draws for the two kinds. */
export type CreateKindWordsType = {
    note: readonly string[];
    markdown: readonly string[];
};

// A Markdown file by its own words, or by Resources as where it is kept.
const MARKDOWN_KIND_PATTERN =
    /\bmarkdown\b|\.md\b|\bmd[- ]files?\b|\bstudy[- ]files?\b|\b(?:in|into|to)\s+(?:the\s+)?resources\b/i;
// A Bible note named so -- or the whole press a note and nothing else:
// "Note", "A note", "Make it a note", "Save as a new note".
const NOTE_KIND_PATTERN = /\bbible[- ]?notes?\b/i;
const BARE_NOTE_PRESS_PATTERN =
    /^(?:(?:make|create|save|keep|write|put)\s+(?:it\s+)?(?:as\s+|into\s+)?)?(?:an?\s+)?(?:new\s+)?note[.!]?$/i;
// Where a Markdown file is kept is no note: "a Markdown file in Bible
// Notes" is a Markdown file the Bible Notes list shows, and "Bible Notes"
// pressed alone answers "Resources or Bible Notes?", a place.
const BIBLE_NOTES_PLACE_PATTERN =
    /\b(?:in|into|to)\s+(?:the\s+)?bible[- ]?notes(?:\s+list)?\b/gi;
const BIBLE_NOTES_PLACE_PRESS_PATTERN =
    /^(?:(?:in|into|to)\s+)?(?:the\s+)?bible[- ]?notes(?:\s+list)?[.!]?$/i;
// A question about a kind chooses none: "How do I make a Bible note?".
const QUESTION_PRESS_PATTERN =
    /^(?:how|what|where|why|which|who|when|can|could|do|does|is|are)\b/i;

// An option is a few words; a pressed corpus question is a sentence. A
// longer press is no choice of a kind.
const MAX_KIND_PRESS_LENGTH = 160;

function toLooseText(text: string) {
    return text.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
}

function checkHasLabel(text: string, labels: readonly string[]) {
    return labels.some((label) => {
        const loose = toLooseText(String(label ?? ''));
        return loose.length >= 2 && text.includes(loose);
    });
}

function readOneKind(
    raw: string,
    words: CreateKindWordsType,
): CreateKindType | null {
    const text = toLooseText(String(raw ?? ''));
    if (
        text === '' ||
        text.length > MAX_KIND_PRESS_LENGTH ||
        QUESTION_PRESS_PATTERN.test(text) ||
        BIBLE_NOTES_PLACE_PRESS_PATTERN.test(text)
    ) {
        return null;
    }
    const isMarkdown =
        MARKDOWN_KIND_PATTERN.test(text) || checkHasLabel(text, words.markdown);
    const noteText = isMarkdown
        ? text.replace(BIBLE_NOTES_PLACE_PATTERN, ' ').trim()
        : text;
    const isNote =
        NOTE_KIND_PATTERN.test(noteText) ||
        BARE_NOTE_PRESS_PATTERN.test(noteText) ||
        checkHasLabel(noteText, words.note);
    // Both named -- "Bible note or Markdown file?" -- is the question,
    // in whatever words it is asked.
    if (isMarkdown && isNote) {
        return null;
    }
    if (isMarkdown) {
        return 'markdown';
    }
    return isNote ? 'note' : null;
}

/**
 * The kind a PRESS chose, or null: its words in English and in the
 * window's language (the press's own words and the English it was asked
 * as), each read for the two kinds. Two that disagree chose nothing.
 */
export function readPressedCreateKind(
    texts: readonly string[],
    words: CreateKindWordsType = { note: [], markdown: [] },
): CreateKindType | null {
    let kind: CreateKindType | null = null;
    for (const text of texts) {
        const found = readOneKind(text, words);
        if (found === null) {
            continue;
        }
        if (kind !== null && kind !== found) {
            return null;
        }
        kind = found;
    }
    return kind;
}
