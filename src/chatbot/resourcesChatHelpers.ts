/**
 * A conversation about the Resources panel's files -- a chapter's PDF, a
 * Bible note, a links file -- that can go on into any other file there.
 *
 * Asked for 2026-10-17, from a conversation about `LUK.6.pdf`: _let chatbot
 * know it is from `Resources`, let chatbot access all in `Resources` to allow
 * user to ask everything in `Resources`, like followup other chapter (look
 * into other pdf files)_.
 *
 * How it goes: a file attached from inside a Resources folder (the panel's
 * 🤖, the paperclip, a drop) makes every question in its tab a `resources`
 * ask while it stays open (`findOpenFileAttachments`): the ask names the
 * file as the tool does (`toResourcesAsk`), it goes out under a short
 * prompt of its own with `owa_resource_file` -- offered to no other
 * question -- and the model lists and reads the rest of Resources with it,
 * a PDF's pages coming back as pictures.
 *
 * Pure, every rule a test: no store, no tool call, no model.
 */
import { fillWords } from './chatTranHelpers';
import type { BotActionType } from './helpBotHelpers';

export const RESOURCES_ASK_KIND = 'resources';
export const RESOURCES_TOOL_NAME = 'owa_resource_file';
// A listing, a read or two of another file, and the answer.
export const RESOURCES_MAX_TOOL_ROUNDS = 5;

// The pseudo tool under a Resources answer: press it and the file is
// attached to the tab, so the next question is about it. Registered nowhere
// -- only the window handles it (`handleActing`), like the report's Send.
export const RESOURCE_ASK_TOOL_NAME = 'resource-ask';
// A person picks one; three is as many as an answer should offer.
const MAX_RESOURCE_ASK_ACTIONS = 3;
// The label, stored in English and drawn in the window's language
// (`SHOWN_LABEL_PATTERN_LIST` in `ChatbotAppComp.tsx`; held by
// `chatTranLabels.test.ts`).
export const RESOURCE_ASK_LABEL_TEMPLATE = 'Ask about {name}';

// The Read chip is deliberately a chooser, not an instruction to pour a
// chapter into the transcript. Kept separate from the cached Resources
// prompt so a small local model gets the required answer shape on that turn.
export const RESOURCES_READ_MENU_HINT =
    'This was the Resources Read button. In no more than two short sentences, ' +
    'briefly describe what the attached PDF actually covers. Do not ' +
    'transcribe verses, ask a question, or write OPTIONS; the app adds the ' +
    'verse question and buttons after your description.';

export const RESOURCES_RANGE_HINT =
    'This is the one verse chosen from the Resources Read menu. Keep only ' +
    'that verse as the focus. The app has already called owa_lookup_record ' +
    'for it; never complete a verse from memory, shorten it, or use an ' +
    'ellipsis. Render one card with, in this order: (1) its full Bible text, ' +
    '(2) the directly printed cross-reference labels, without expanding ' +
    'their text in this card, and (3) the matching ' +
    'PDF explanation below them. Also call owa_resource_file once with ' +
    'detail "high" and without `pages`, so the complete attached Resources ' +
    'PDF is read before answering. Treat it as one resource and do not talk ' +
    'to the user about pages, batches, pagination, or continuing the file. ' +
    'Read the pictures in document order and join any explanation paragraph ' +
    'that continues across a page boundary before using it. ' +
    'Its pictures are the only source for the PDF wording; never infer text ' +
    'from a PDF text layer or from memory. Do not merely list cross-reference ' +
    'labels. For every cross-reference, call owa_lookup_record before showing ' +
    'it, write the verified full book name rather than a raw abbreviation, ' +
    'and omit it when the lookup cannot read it. ' +
    'Include directly mentioned explanations from other Resources files only ' +
    'within the bounded rules in the system prompt.';

export const RESOURCES_CROSS_REFERENCE_HINT =
    'This was a cross-reference option pressed under a Resources verse card. ' +
    'Call owa_lookup_record for this exact reference and render it as the one ' +
    'main verse in a new card. Never complete it from memory. If its chapter ' +
    'has a matching Resources PDF, list and read that file and put its matching ' +
    'explanation below the verse. Keep any further cross-references as options, ' +
    'not expanded Bible text in this card.';

export function genResourcesRangeHint(
    verseText?: string | null,
    selectedRef?: string | null,
    wholeChapterRef?: string | null,
) {
    if (verseText === undefined || verseText === null) {
        return RESOURCES_RANGE_HINT;
    }
    return (
        RESOURCES_RANGE_HINT +
        '\n\nThe app prepared the chapter index' +
        (wholeChapterRef === undefined || wholeChapterRef === null
            ? ''
            : ` (${wholeChapterRef})`) +
        ' and loaded only this one verse into the model context' +
        (selectedRef === undefined || selectedRef === null
            ? '.'
            : `: ${selectedRef}.`) +
        ' Copy it exactly and in full; do not replace any part with an ' +
        `ellipsis:\n${verseText}`
    );
}

/** The whole installed-Bible chapter represented by a chapter PDF. */
export function toResourceChapterRef(
    fileNames: readonly string[],
): string | null {
    const file = fileNames.find((name) => {
        return /(?:^|\/)[A-Z0-9]{3}\.\d+\.pdf$/i.test(name);
    });
    const chapter =
        file === undefined
            ? null
            : /(?:^|\/)([A-Z0-9]{3})\.(\d+)\.pdf$/i.exec(file);
    return chapter === null ? null : `${chapter[1]} ${chapter[2]}`;
}

/**
 * A bare chapter lookup identifies its real last verse in the passage key,
 * even when its preview text is abbreviated. Turn that into the exact second
 * chapter boundary without loading every verse into one model request.
 */
export function toWholeResourceChapterRef(
    lookupResult: unknown,
    chapterRef: string,
) {
    if (lookupResult === null || typeof lookupResult !== 'object') {
        return chapterRef;
    }
    const passages = (lookupResult as { passages?: unknown }).passages;
    if (!Array.isArray(passages)) return chapterRef;
    const key = (passages[0] as { key?: unknown } | undefined)?.key;
    if (typeof key !== 'string') return chapterRef;
    const escaped = chapterRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${escaped}:1-\\d+$`, 'i').test(key) ? key : chapterRef;
}

/** The last verse discovered by a bare chapter lookup. */
export function toResourceChapterVerseCount(
    lookupResult: unknown,
    chapterRef: string,
) {
    const whole = toWholeResourceChapterRef(lookupResult, chapterRef);
    const match = /:1-(\d+)$/.exec(whole);
    return match === null ? null : Number(match[1]);
}

/** A bounded, deterministic queue for Full chapter's isolated verse asks. */
export function genResourceChapterVerseSequence(lastVerse: number) {
    const safeLastVerse = Math.min(
        200,
        Math.max(1, Number.isFinite(lastVerse) ? Math.floor(lastVerse) : 1),
    );
    return Array.from({ length: safeLastVerse }, (_, index) => index + 1);
}

/** The installed-Bible reference represented by a chapter PDF plus a choice. */
export function toResourcePassageRef(
    fileNames: readonly string[],
    range: string,
): string | null {
    const chapterRef = toResourceChapterRef(fileNames);
    if (chapterRef === null) return null;
    if (range === 'Full chapter') return `${chapterRef}:1`;
    const verse = /^\s*(\d+)(?:\s*[-–]\s*\d+)?\s*$/.exec(range);
    if (verse === null) return null;
    return `${chapterRef}:${verse[1]}`;
}

/** Predictable next-verse buttons even when a small model mangles OPTIONS. */
export function genResourceRangeReplies(
    range: string,
    lastVerse?: number | null,
): string[] {
    const match =
        range === 'Full chapter'
            ? ['', '1']
            : /^\s*(\d+)(?:\s*[-–]\s*\d+)?\s*$/.exec(range);
    if (match === null) return [];
    const verse = Number(match[1]);
    return [
        (verse + 1).toString(),
        (verse + 2).toString(),
        (verse + 3).toString(),
    ].filter((reply) => {
        return lastVerse == null || Number(reply) <= lastVerse;
    });
}

/**
 * Keep reliable next-range navigation without throwing away the model's
 * cross-reference choices. The prompt permits only references it actually
 * quoted; this final shape check keeps prose and duplicate navigation out of
 * the buttons.
 */
export function genResourceReadingReplies(
    range: string,
    modelReplies: readonly string[],
    lastVerse?: number | null,
) {
    const navigation = genResourceRangeReplies(range, lastVerse);
    const seen = new Set<string>();
    const crossReferences: string[] = [];
    for (const reply of modelReplies) {
        // Small models occasionally put two verified references into one
        // option. One button must open one verse card, so split the list here.
        for (const part of reply.split(/\s*[,;|]\s*/u)) {
            const value = part.trim();
            const key = value.toLocaleLowerCase();
            if (
                value.length === 0 ||
                value.length > 80 ||
                !/[:：]\s*\p{N}/u.test(value) ||
                // A vision model once exposed legacy-font guesses such as
                // "mf 3:7" and "kc 23:6-8" as buttons. A verified reference
                // can always use the full book name; do not make a raw short
                // OCR token look authoritative.
                /^[A-Za-z]{1,3}\s+\p{N}/u.test(value) ||
                /^\s*\p{N}+\s*[-–]\s*\p{N}+\s*$/u.test(value) ||
                seen.has(key)
            ) {
                continue;
            }
            seen.add(key);
            crossReferences.push(value);
            if (crossReferences.length >= 2) break;
        }
        if (crossReferences.length >= 2) break;
    }
    return [...crossReferences, ...navigation].slice(0, 5);
}

/**
 * The exact installed-Bible verse kept outside the model. If a PDF reading
 * degenerates, this is still safe to show: it came from owa_lookup_record,
 * not from the model's memory or its reading of a tiny page image.
 */
export function toResourceVerseFallback(lookupResult: unknown) {
    if (lookupResult === null || typeof lookupResult !== 'object') return null;
    const result = lookupResult as { bible?: unknown; passages?: unknown };
    if (!Array.isArray(result.passages)) return null;
    const passage = result.passages[0] as
        | { key?: unknown; ref?: unknown; title?: unknown; text?: unknown }
        | undefined;
    if (passage === undefined || typeof passage.text !== 'string') return null;
    const text = passage.text.trim();
    if (text.length === 0) return null;
    const label = [passage.title, passage.ref, passage.key].find((value) => {
        return typeof value === 'string' && value.trim().length > 0;
    });
    const bible =
        typeof result.bible === 'string' && result.bible.trim().length > 0
            ? result.bible.trim()
            : null;
    const heading =
        typeof label === 'string'
            ? `**${label.trim()}${bible === null ? '' : ` · ${bible}`}**\n\n`
            : '';
    return heading + text;
}

/** Remove a cross-reference line that visibly contains raw OCR guesses. */
export function sanitizeResourceReadingAnswer(answer: string) {
    return answer
        .split(/\r?\n/)
        .filter((line) => {
            return !(
                /^\s*(?:[-*]\s*)?(?:xref|cross[- ]references?)\s*:/i.test(
                    line,
                ) && /\b[A-Za-z]{1,3}\s+\p{N}+\s*[:：]\s*\p{N}/u.test(line)
            );
        })
        .join('\n')
        .trim();
}

/**
 * Reject the common vision-model failure where one word or short phrase is
 * repeated until the response limit. This is deliberately narrow: normal
 * emphasis is fine, while six identical words or four identical phrases in
 * immediate succession can never be a faithful commentary transcription.
 */
export function checkIsDegenerateResourceReading(answer: string) {
    const words = answer.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    for (let phraseLength = 1; phraseLength <= 5; phraseLength++) {
        const minimumRepeats = phraseLength === 1 ? 6 : 4;
        const span = phraseLength * minimumRepeats;
        for (let start = 0; start + span <= words.length; start++) {
            let isRepeated = true;
            for (let offset = phraseLength; offset < span; offset++) {
                if (
                    words[start + offset] !==
                    words[start + (offset % phraseLength)]
                ) {
                    isRepeated = false;
                    break;
                }
            }
            if (isRepeated) return true;
        }
    }
    return false;
}

/**
 * A button for each file the assistant READ that this tab is not already
 * asking about, up to three. `readFileNames` are the `file` fields
 * `owa_resource_file` answered with; `openFileNames` are the files the tab
 * already has (`findResourceFileNames`). The args carry the Resources name
 * (`pdf/LUK.7.pdf`), never a path.
 */
export function genResourceAskActions(
    readFileNames: readonly string[],
    openFileNames: readonly string[],
): BotActionType[] {
    const openKeySet = new Set(
        openFileNames.map((fileName) => {
            return fileName.toLowerCase();
        }),
    );
    const seen = new Set<string>();
    const actions: BotActionType[] = [];
    for (const fileName of readFileNames) {
        const key = fileName.toLowerCase();
        if (openKeySet.has(key) || seen.has(key)) {
            continue;
        }
        seen.add(key);
        const name = fileName.split('/').pop() ?? fileName;
        actions.push({
            label: fillWords(RESOURCE_ASK_LABEL_TEMPLATE, { name }),
            toolName: RESOURCE_ASK_TOOL_NAME,
            args: { file: fileName },
        });
        if (actions.length >= MAX_RESOURCE_ASK_ACTIONS) {
            break;
        }
    }
    return actions;
}

/**
 * The line that tells the model where the open file is and how the rest of
 * Resources is named. In the USER turn: the file changes per tab, and the
 * system prompt is a cached prefix.
 */
export function toResourcesAsk(asked: string, fileNames: string[]) {
    const named = fileNames
        .map((fileName) => {
            return `"${fileName}"`;
        })
        .join(', ');
    return (
        `${asked}\n\n(The attached ${fileNames.length === 1 ? 'file is' : 'files are'} ` +
        `${named} in the user's Resources folders. Read any other file ` +
        `there with ${RESOURCES_TOOL_NAME}.)`
    );
}

/**
 * The system prompt of such a conversation: what Resources is, how its files
 * are named, how to go further, and the one rule that matters -- say what a
 * page says, from the page.
 */
export const RESOURCES_SYSTEM_PROMPT =
    'You are the help assistant inside Open Worship app, a church ' +
    'presentation program, answering questions about the files in the ' +
    "user's Resources folders: the study material they keep beside the " +
    'Bible -- PDFs of commentary or study notes, Bible notes, link lists, ' +
    'pictures. A file is named after the Bible book and chapter it belongs ' +
    'to: "LUK.6.pdf" is Luke chapter 6, "LUK.0.pdf" the introduction to ' +
    'Luke. One file they asked about is attached to their message; a PDF ' +
    'attached or read comes as pictures of its pages. For anything in ' +
    `another file -- the next chapter, another book -- use ${RESOURCES_TOOL_NAME}: ` +
    '`list` with `book` and `chapter` (or `search`) to find it, then `read` ' +
    'the file by the name `list` gives. Read a PDF once with detail "high" ' +
    'and omit `pages`; that returns the complete file. Treat the PDF as one ' +
    'resource and never discuss page batches, pagination, or continuing the ' +
    'file with the user. Read it continuously: when an explanation paragraph ' +
    'starts in one picture and continues in the next, join both parts before ' +
    'answering. The pictures are authoritative: a scan may have ' +
    'no text layer and a legacy Khmer font may expose wrong characters. ' +
    'When their message is just "Read" or its translated equivalent, do not ' +
    'start transcribing the whole chapter. Ask which one verse they want ' +
    'and output an OPTIONS: line ' +
    'with its first three verse numbers plus a Full chapter option. Full ' +
    'chapter starts at verse 1 and continues through the same next-verse ' +
    'buttons; it never puts the chapter into one model request. Every answer ' +
    'card has exactly one main verse. For that selected verse, quote the full ' +
    'Bible verse from ' +
    'owa_lookup_record and name the Bible that returned it. Next, show the ' +
    'cross-reference labels printed beside that selected verse in the PDF. ' +
    'Verify each one by calling owa_lookup_record, then write its full book ' +
    'name; never expose a raw or uncertain abbreviation from the picture. ' +
    'If a lookup cannot read it, omit it. Do not expand its verse text in ' +
    'the same card. Put up to two of ' +
    'those labels in OPTIONS so a press opens that verse in its own card. ' +
    'Then reproduce the matching ' +
    'explanation paragraph or paragraphs from the PDF. In a study Bible page, ' +
    'these explanations are normally in the commentary section below a ' +
    'horizontal rule; each paragraph begins with a bold verse reference, ' +
    'which may cover several verses. Find the paragraph whose leading ' +
    'reference includes the selected verse. Do not merely repeat the Bible ' +
    'verse and call it an explanation. Clearly label Bible text and PDF ' +
    'explanation, retain the PDF paragraph breaks, and name the file. ' +
    'The narrow reference column beside the Bible text is cross-references, ' +
    'not explanation: keep it with the selected verse and do not expand all ' +
    'of it automatically. After the reading, end with an OPTIONS: line ' +
    'containing up to two cross-reference verse labels that you actually ' +
    'quoted, so the user can press one to read it. Do not put navigation ' +
    'ranges or Full there; the app adds those buttons, and never invent a ' +
    'reference. If the explanation ' +
    'for a selected verse is absent or a word is unclear in the page picture, ' +
    'say so rather than silently guessing it. ' +
    'When an explanation paragraph itself names a related verse, keep the ' +
    'selected verse as the only main verse: name the related reference but ' +
    'do not expand its Bible text in this card. Use owa_resource_file to find ' +
    'and read its chapter file and include the ' +
    'matching explanation from that file when it exists. Follow only direct ' +
    'mentions, at most two related resource excerpts in all, and do not ' +
    'continue into a chain of further references. ' +
    'Never name or suggest another Resources file unless owa_resource_file ' +
    'listed it. When they ask for other PDFs, or the page points to another ' +
    'chapter or study file, list the matching files and read each file you ' +
    'recommend with owa_resource_file; reading it is what gives the user a ' +
    'button to continue with that file below the answer. ' +
    'Answer from what the complete document says, in its words, and name the ' +
    'file without discussing its pages. When the files do not say, say so ' +
    'rather than guess. ' +
    'Answer plainly and in a few short paragraphs, for older readers, in ' +
    'the language they write in; do not describe the app or offer a ' +
    'walkthrough.';
