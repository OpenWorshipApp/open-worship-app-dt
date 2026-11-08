/**
 * A conversation about one of the user's SLIDE DOCUMENTS, attached to the tab
 * -- from a Documents row's **Open in Chatbot**, the paperclip or a drop.
 *
 * Asked for 2026-11-07 (the user, with a slide document's row menu open on
 * **Open in Chatbot**: _like lyric, add `Open in Chatbot` for AppDocument to
 * let chatbot help modify slides_; then the goal _chatbot be the best choice
 * to help modify appdocument slides_, and _when user attach a screenshot of
 * example sides they want … chatbot should be able to make slides for
 * them_).
 *
 * The song's conversation (`lyricChatHelpers.ts`) is the shape: a question
 * asked while a `.ows` is open in the tab is a `slide` ask. The window reads
 * each attached document as it stands NOW through `owa_slide_edit slides`
 * (unsaved edits included, every box's words whole) and puts it under the
 * question as plain lines (`toSlideAsk`) -- never the file's JSON, whose
 * pictures are megabytes of base64. The ask goes out under its own prompt
 * with `owa_slide_edit`, offered to no other question, and a picture they
 * attached goes with it: the model reads the slides they want off it and
 * makes them, many in one call. The model names a document; the window turns
 * the name into the attached file's path (`resolveSlideEditFile`), so no
 * path ever reaches it or comes from it.
 *
 * Pure, every rule a test: no store, no tool call, no model.
 */
import type { ChatAttachmentType } from './attachmentHelpers';
import { checkIsFileAttachment } from './attachmentHelpers';
import {
    DEFAULT_CHAT_LANG_CODE,
    type AssistantLanguageType,
} from './chatLangHelpers';
import { fillWords, tran } from './chatTranHelpers';
import {
    type LyricAskFileType,
    type LyricTranslateModeType,
    genLyricTranslateReplies,
    pickTranslateLanguage,
    resolveAttachedDocumentFile,
} from './lyricChatHelpers';

export const SLIDE_ASK_KIND = 'slide';
export const SLIDE_EDIT_TOOL_NAME = 'owa_slide_edit';
// A change or two (each one call however many slides), a retry after a
// refusal, and the answer. A picture's slides are ONE add-slides call.
export const SLIDE_MAX_TOOL_ROUNDS = 8;
/** The most slide documents one question reads and may change. */
export const MAX_SLIDE_ASK_FILES = 2;
// What one document may cost the question it rides on: a sermon of twenty
// slides, two boxes each, is ~6 000 characters.
const MAX_SLIDE_DOC_TEXT_CHARS = 14000;
// What a slide document's attachment keeps of its words: a list for the
// chip and the history, never the JSON.
const MAX_SLIDE_FILE_TEXT_CHARS = 8000;

const SLIDE_FILE_PATTERN = /\.ows$/i;

/** Whether a file is one of the app's slide documents, by its name. */
export function checkIsSlideFileName(name: string) {
    return SLIDE_FILE_PATTERN.test(String(name ?? '').trim());
}

/** A slide document's name as the Documents list shows it: no `.ows`. */
export function toSlideDocName(fileName: string) {
    const base =
        String(fileName ?? '')
            .split(/[\\/]/)
            .pop() ?? '';
    return base.replace(SLIDE_FILE_PATTERN, '');
}

/**
 * A slide FILE's words, as its attachment keeps them: each slide's text
 * boxes, a line a slide. A `.ows` is JSON whose pictures are base64 inline --
 * held as it stands, one sermon with photos was megabytes in the tab, and a
 * model shown it reads the app's metadata instead of the slides. Null when it
 * is not one.
 */
export function toSlideFileText(fileText: string) {
    let json: any;
    try {
        json = JSON.parse(fileText);
    } catch (_error) {
        return null;
    }
    if (!Array.isArray(json?.items)) {
        return null;
    }
    const lines: string[] = [`Slides: ${json.items.length}`];
    json.items.forEach((slide: any, index: number) => {
        const words = (
            Array.isArray(slide?.canvasItems) ? slide.canvasItems : []
        )
            .filter((item: any) => {
                return (
                    item?.type === 'text' &&
                    typeof item.text === 'string' &&
                    item.text.trim() !== ''
                );
            })
            .map((item: any) => {
                return item.text.replace(/\s*\n\s*/g, ' / ').trim();
            });
        lines.push(
            `Slide ${index + 1}: ${words.length === 0 ? '(no words)' : words.join(' | ')}`,
        );
    });
    const text = lines.join('\n');
    return text.length > MAX_SLIDE_FILE_TEXT_CHARS
        ? `${text.slice(0, MAX_SLIDE_FILE_TEXT_CHARS)}\n[…]`
        : text;
}

export type SlideAskFileType = LyricAskFileType;

/**
 * The slide documents among a tab's open files -- each a file from disk with
 * its path, once, the first `MAX_SLIDE_ASK_FILES`.
 */
export function findSlideAskFiles(
    attachments: readonly ChatAttachmentType[],
): SlideAskFileType[] {
    const out: SlideAskFileType[] = [];
    for (const attachment of attachments) {
        const filePath = attachment.filePath;
        if (
            typeof filePath !== 'string' ||
            !checkIsSlideFileName(filePath) ||
            out.some((one) => {
                return one.filePath === filePath;
            })
        ) {
            continue;
        }
        out.push({ name: toSlideDocName(filePath), filePath });
    }
    return out.slice(0, MAX_SLIDE_ASK_FILES);
}

/**
 * The slide documents a tab is still about, however many files came after:
 * those of the last question that attached one, unless the tab closed its
 * files since (`closedAfterId`). Not `findOpenFileAttachments`, which keeps
 * only the LAST question's files -- the picture of the slides they want,
 * attached from a folder under the document's card, would have closed the
 * document it was attached to change.
 */
export function findOpenSlideAttachments(
    messages: readonly {
        id: number;
        author: string;
        attachments?: ChatAttachmentType[];
    }[],
    closedAfterId?: number,
): ChatAttachmentType[] {
    for (let index = messages.length - 1; index >= 0; index--) {
        const message = messages[index];
        if (closedAfterId !== undefined && message.id <= closedAfterId) {
            return [];
        }
        if (message.author !== 'you') {
            continue;
        }
        const slideFiles = (message.attachments ?? []).filter((one) => {
            return (
                checkIsFileAttachment(one) &&
                checkIsSlideFileName(one.filePath ?? '')
            );
        });
        if (slideFiles.length > 0) {
            return slideFiles;
        }
    }
    return [];
}

/**
 * What a model's `file` turns into: the attached document's own path, a
 * slide document of the Documents folder by its name, or a `reason`.
 */
export function resolveSlideEditFile(
    file: unknown,
    files: readonly SlideAskFileType[],
) {
    return resolveAttachedDocumentFile(
        file,
        files,
        toSlideDocName,
        'slide document',
    );
}

function toShownNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value)
        ? String(Math.round(value))
        : '?';
}

/** One box as a line: its id, kind, words, style and place. */
function toBoxLine(item: any) {
    const place =
        `at ${toShownNumber(item?.left)},${toShownNumber(item?.top)} ` +
        `size ${toShownNumber(item?.width)}x${toShownNumber(item?.height)}`;
    const locked = item?.locked === true ? ' · locked' : '';
    if (item?.type !== 'text') {
        const source =
            typeof item?.file === 'string'
                ? ` ${item.file}`
                : typeof item?.url === 'string'
                  ? ` ${item.url}`
                  : '';
        return `  box ${item?.id} · ${String(item?.type ?? 'unknown')}${source} · ${place}${locked}`;
    }
    const style = [
        typeof item.fontSize === 'number' ? `${item.fontSize}px` : null,
        typeof item.fontWeight === 'string' && item.fontWeight !== ''
            ? item.fontWeight
            : null,
        typeof item.fontFamily === 'string' && item.fontFamily !== ''
            ? `font "${item.fontFamily}"`
            : null,
        typeof item.color === 'string' ? `color ${item.color}` : null,
        typeof item.backgroundColor === 'string'
            ? `on ${item.backgroundColor}`
            : null,
        `${item.align ?? '?'}/${item.valign ?? '?'}`,
        typeof item.rotate === 'number' && item.rotate !== 0
            ? `rotate ${item.rotate}`
            : null,
        typeof item.round === 'number' ? `round ${item.round}` : null,
    ]
        .filter(Boolean)
        .join(' ');
    const cut =
        item.isTextCut === true
            ? ' (words cut short here -- leave `text` out to keep them)'
            : '';
    return (
        `  box ${item.id} · text ${JSON.stringify(String(item.text ?? ''))}` +
        `${cut} · ${style} · ${place}${locked}`
    );
}

/**
 * One slide document as the model reads it: its size and count, then every
 * slide with its boxes, a line a box -- words as a JSON string, so a line
 * break shows as `\n` and a translation keeps it. Plain lines, never the
 * app's JSON: a model shown JSON writes JSON back.
 */
function toNameList(value: unknown) {
    return Array.isArray(value)
        ? value.filter((one): one is string => {
              return typeof one === 'string';
          })
        : [];
}

/**
 * The document's own background and what the Background panel holds -- the
 * names `set-background` takes. Nothing when the read carried no choices
 * (an `owa_slide_file` read, or a folder that could not be listed).
 */
function toBackgroundLines(described: any) {
    const choices = described?.backgroundChoices;
    if (choices === null || typeof choices !== 'object') {
        return [];
    }
    const lines = [''];
    if (typeof described.documentBackground === 'string') {
        lines.push(
            'Document background (behind slides with none of their own): ' +
                described.documentBackground,
        );
    }
    const pictures = toNameList(choices.pictures);
    const videos = toNameList(choices.videos);
    lines.push(
        pictures.length === 0 && videos.length === 0
            ? 'Backgrounds you can use: none yet (the Background panel is empty)'
            : 'Backgrounds you can use: ' +
                  [
                      pictures.length > 0
                          ? `pictures ${pictures.join(', ')}`
                          : null,
                      videos.length > 0 ? `videos ${videos.join(', ')}` : null,
                  ]
                      .filter(Boolean)
                      .join('; ') +
                  (choices.isTruncated === true
                      ? ' (and more: a word of a name, like sunrise, finds one)'
                      : ''),
    );
    return lines;
}

export function toSlideDocumentText(described: any) {
    if (described === null || typeof described !== 'object') {
        return null;
    }
    const slides: any[] = Array.isArray(described.slides)
        ? described.slides
        : [];
    const lines = [
        `Slides: ${toShownNumber(described.slideCount)} · each ` +
            `${toShownNumber(described.width)} x ` +
            `${toShownNumber(described.height)} pixels`,
    ];
    if (typeof described.note === 'string') {
        lines.push(described.note);
    }
    for (const slide of slides) {
        const facts = [
            typeof slide?.name === 'string' ? `"${slide.name}"` : null,
            slide?.isDisabled === true ? 'disabled' : null,
            typeof slide?.width === 'number'
                ? `its own size ${slide.width} x ${slide.height}`
                : null,
            typeof slide?.background === 'string'
                ? `background: ${slide.background}`
                : null,
        ].filter(Boolean);
        lines.push(
            '',
            `Slide ${toShownNumber(slide?.number)}` +
                (facts.length > 0 ? ` (${facts.join(', ')})` : ''),
        );
        const items: any[] = Array.isArray(slide?.items) ? slide.items : [];
        if (items.length === 0) {
            lines.push('  (no boxes)');
        }
        for (const item of items) {
            lines.push(toBoxLine(item));
        }
        if (typeof slide?.itemCount === 'number') {
            lines.push(`  … ${slide.itemCount} boxes in all`);
        }
    }
    lines.push(...toBackgroundLines(described));
    const text = lines.join('\n').trim();
    return text.length > MAX_SLIDE_DOC_TEXT_CHARS
        ? `${text.slice(0, MAX_SLIDE_DOC_TEXT_CHARS)}\n[... the rest was not included; ${SLIDE_EDIT_TOOL_NAME} "slides" with \`slide\` reads on from a slide]`
        : text;
}

// Said to the model under a pressed translate button, so which way is never
// its guess -- the song's two ways, said for slides.
const SLIDE_TRANSLATE_HINT_MAP: Record<LyricTranslateModeType, string> = {
    replace:
        '(They chose to REPLACE the words with the translation: ONE ' +
        'update-slides call giving every text box with words its ' +
        'translated text, line for line. When no language is named, ask ' +
        'which first, with OPTIONS naming two or three languages -- never ' +
        'the two ways again.)',
    under:
        '(They chose to KEEP the words and add the translation under them: ' +
        "ONE update-slides call where each text box's text is its own lines " +
        'with the translation of each line on the line under it, and its ' +
        'fontSize made smaller (about 0.7 of it) so the box still holds ' +
        'them. When no language is named, ask which first, with OPTIONS ' +
        'naming two or three languages -- never the two ways again.)',
};

/**
 * The question as the model is asked it: what they typed, then each attached
 * document as it reads now, named as `file` takes it.
 */
/**
 * The language a pressed (or typed) translate button names -- `English` out
 * of "Add English under each line" -- or null, for "another language" and
 * anything else. Said to the model in so many words: told only that the way
 * was chosen, gemma4:cloud answered "Add English under each line" with
 * "Which language would you like?" (2026-11-07).
 */
export function readTranslateLanguageName(asked: string) {
    const text = String(asked ?? '').trim();
    for (const template of [
        tran('Replace the words with {language}'),
        tran('Add {language} under each line'),
    ]) {
        const [before, after] = template.split('{language}');
        if (
            after !== undefined &&
            text.length > before.length + after.length &&
            text.startsWith(before) &&
            text.endsWith(after)
        ) {
            const language = text
                .slice(before.length, text.length - after.length)
                .trim();
            const isAnother =
                text === tran('Replace the words with another language') ||
                text === tran('Add another language under each line');
            return isAnother || language === '' ? null : language;
        }
    }
    return null;
}

// Sent with nothing typed -- a picture dropped on the box and Send pressed,
// the way a person shows slides they like. With no words the model was
// handed only the list of what was attached and wrote nothing at all (seen
// live 2026-11-07, gemma4:cloud).
export const SLIDE_WORDLESS_HINT =
    '(They sent this with no words of their own. A picture attached here ' +
    'is a picture of slides they want: make slides that look like it now. ' +
    'With no picture, say in a sentence what you can change and end with ' +
    'OPTIONS.)';

// A typed translation that says WHERE the new lines go. The card's button
// says "under each line" and its hint says it again; typed, _Add the
// English under the Khmer line on slide 3_ was put ABOVE the Khmer by
// gemma4:cloud (seen live 2026-11-07, a copy of a real sermon document),
// the prompt's own rule notwithstanding. Said once more, plainly, beside
// the ask. English words only; a translation word must be in the line, or
// "a box under the title" would be read as a placement of lines.
const SLIDE_TRANSLATE_WORD_PATTERN =
    /translat|language|\b(?:english|khmer|french|spanish|chinese|korean|thai|german|portuguese|vietnamese|japanese|tagalog)\b/i;
const SLIDE_UNDER_WORD_PATTERN = /\b(?:under|below|beneath|underneath)\b/i;
const SLIDE_ABOVE_WORD_PATTERN = /\b(?:above|over|on top of)\b/i;

export const SLIDE_PLACEMENT_HINT_MAP = {
    under:
        '(They said UNDER: each new line goes on the line UNDER the line it ' +
        'translates -- the original line first, then its translation -- ' +
        'never above it.)',
    above:
        '(They said ABOVE: each new line goes on the line ABOVE the line it ' +
        'translates -- the translation first, then the original line.)',
} as const;

/** Where a typed translation asks the new lines to go, or null. */
export function readSlidePlacement(
    asked: string,
): keyof typeof SLIDE_PLACEMENT_HINT_MAP | null {
    const text = String(asked ?? '');
    if (!SLIDE_TRANSLATE_WORD_PATTERN.test(text)) {
        return null;
    }
    const isUnder = SLIDE_UNDER_WORD_PATTERN.test(text);
    const isAbove = SLIDE_ABOVE_WORD_PATTERN.test(text);
    if (isUnder === isAbove) {
        return null;
    }
    return isUnder ? 'under' : 'above';
}

export function toSlideAsk(
    asked: string,
    docs: readonly { name: string; text: string | null }[],
    translateMode: LyricTranslateModeType | null = null,
    isWordless = false,
) {
    const language =
        translateMode === null ? null : readTranslateLanguageName(asked);
    // The card's buttons carry their own hint; a typed line says it here.
    const placement = translateMode === null ? readSlidePlacement(asked) : null;
    const shown = docs.map((doc) => {
        return (
            `(The slide document "${doc.name}" is attached. Change it with ` +
            `${SLIDE_EDIT_TOOL_NAME}, file "${doc.name}". It reads now:\n` +
            `${doc.text ?? `(it could not be read just now; call ${SLIDE_EDIT_TOOL_NAME} with action "slides")`})`
        );
    });
    return [
        ...(isWordless ? [SLIDE_WORDLESS_HINT] : []),
        asked,
        ...(translateMode === null
            ? []
            : [SLIDE_TRANSLATE_HINT_MAP[translateMode]]),
        ...(placement === null ? [] : [SLIDE_PLACEMENT_HINT_MAP[placement]]),
        ...(language === null
            ? []
            : [
                  `(The language is ${language}: translate into it now, in ` +
                      'one call -- do not ask which language.)',
              ]),
        ...shown,
    ].join('\n\n');
}

/**
 * The system prompt of such a conversation: what the tool takes, one call
 * for many slides, and how a picture of the slides wanted becomes slides.
 */
export const SLIDE_SYSTEM_PROMPT =
    'You are the help assistant inside Open Worship app, a church ' +
    'presentation program, helping a volunteer change a slide document ' +
    'they attached. Each attached document is given under their message ' +
    'as it reads now: its slide size, then every slide with its boxes -- ' +
    'id, kind, words (a JSON string, \\n between lines), font size, style, ' +
    'and place in pixels. Change it with ' +
    `${SLIDE_EDIT_TOOL_NAME}, naming the document in \`file\` exactly as ` +
    'it is given. Make the change asked for, all of it in one call where ' +
    'one call can do it: every slide changed in ONE update-slides call, ' +
    'every new slide in ONE add-slides call. To change a box, ALWAYS give ' +
    'its `id`: an item without `id` is a NEW box. Send only the fields ' +
    "that change, and a box's whole new words in `text`, a line break as a real " +
    'line break. Change only the slides the request is about: when it ' +
    'names none, the slides that lack what was asked -- a slide that ' +
    'already shows it (its English already in a box of its own) stays as ' +
    "it is. WORDS: keep each box's line breaks; when asked to check the " +
    'spelling, change only what ' +
    'is wrong and say what you fixed. Words you can take from the slides ' +
    "are not new words: a translation of a box's words, those words fixed, " +
    'shortened or split, a title made from them. So "add English above the ' +
    'Khmer" means: translate that Khmer into English yourself and write ' +
    'each English line on the line above its Khmer line, in the same box -- ' +
    'do it, never ask them for the words. When a request has one sensible ' +
    'reading, do it rather than ask: every change can be undone. ' +
    'TRANSLATING has two ways and the person chooses: REPLACE the words ' +
    'with the translation, or ADD the translation on the line under each ' +
    'line (above it, when they say above), keeping the words (then make ' +
    'the fontSize about 0.7 of what it was, so the box still holds them). ' +
    'Unless their words already say which ("replace", "instead of" is ' +
    'replace; "under each line", "bilingual", "keep the English" is add), ' +
    'ask which way first and end with OPTIONS: Replace the words | Add it ' +
    'under each line. Once the way is known and the language is not, ask ' +
    'which language, with OPTIONS naming two or three languages. Write ' +
    "natural lines in the target language's own script, and Bible names " +
    'the way that language says them. STYLE: larger is fontSize about 1.25 ' +
    'times, smaller about 0.8, for every text box asked about; colors are ' +
    '#RRGGBB (#RRGGBBAA with opacity); align left|center|right, valign ' +
    'top|center|bottom; keep boxes inside the slide. A PICTURE of slides ' +
    'they want (attached with their message): make slides that look like ' +
    'it -- for each slide it shows, each text box at the same place ' +
    "scaled to this document's slide size, with its words as the picture " +
    'writes them, fontSize scaled the same way, color, fontWeight "bold" ' +
    'when it is bold, align and valign. Look at each box’s corners: a box ' +
    'with ROUNDED corners gets `round`, its corner rounding in pixels ' +
    '(about a sixth of its height when the corners are softly rounded). ' +
    'When their message ' +
    'gives the ' +
    "words, those are the slides' words instead, one slide each, in " +
    '`text` of the text box in the SAME call -- never a text box without ' +
    'its words. BEHIND the boxes: a photo or video behind the words is ' +
    "the slide's BACKGROUND, never a box -- set it with set-background " +
    '(`background` a name, or one word that is in a name; `slides` the ' +
    'slide numbers, every slide when left out), after the slides are ' +
    'made. Use a name they gave, or one that plainly fits what the ' +
    'picture shows; when the list says "and more", the panel holds files ' +
    'not listed, so first try ONE word for what the photo shows ' +
    '(mountain, cross, sunrise, sky) -- the tool finds the file, or names ' +
    'the ones that fit to pick from. Say which one you put there. Only ' +
    'when nothing fits, or the panel is empty, say they drop that picture ' +
    'into the Background panel first. A plain ' +
    'colour behind everything is a box filling the slide (left 0, top 0, ' +
    "the slide's width and height, its backgroundColor, no text), listed " +
    'first. Asked to change a background: a full-slide box gets its ' +
    'backgroundColor changed; otherwise set-background, with a colour, a ' +
    'name, or "none" to take it off. Add them in ONE add-slides call, ' +
    'or restyle the slides already there with update-slides when they ' +
    'asked for those to look like it. When they ask for slides like a ' +
    'picture and none is attached, ask them to attach one and end with ' +
    'NEEDS: file. Never make up the words of a song, a sermon or a Bible ' +
    'verse: ask for words only when nothing on the slides, in their ' +
    'message or in their picture gives them. Boxes that are ' +
    'not text (pictures, videos, Bible passages) can be moved, resized or ' +
    'removed, never given words; a locked box is refused -- say it must be ' +
    'unlocked in the Slide Editor. Remove at most one slide in an answer, ' +
    'and only one they named. When the tool refuses, read its reason, fix ' +
    'the call and try once more; then say plainly what went wrong. After a ' +
    'change, say in a sentence or two what changed, that it is NOT saved ' +
    'yet (a * shows beside its name; Save in the Slide Editor keeps it) -- ' +
    'a background is kept at once, no Save -- and that Undo this change ' +
    'puts it back. Never write the boxes or any ' +
    'JSON out in your answer. End with OPTIONS: two or three next changes ' +
    'they might want.';

// "list me more options", "show the options again", "what can you do?",
// "help" -- a request for the card's buttons, said in a few words and
// nothing else. A sentence with more in it ("more options for the colors")
// is the assistant's.
const DOCUMENT_OPTIONS_ASK_PATTERN_LIST = [
    /^(?:(?:please|pls|can you|could you)\s+)?(?:(?:list|show|give|tell)\s+(?:me\s+)?)?(?:(?:the|your|some|more|all|other)\s+)*(?:help\s+)?(?:options?|choices|buttons|menu)(?:\s+again)?\s*[?.!]*$/i,
    /^what\s+(?:else\s+)?can\s+(?:you|i)\s+do(?:\s+(?:here|for me|with (?:it|this|them)))?\s*[?.!]*$/i,
    /^(?:help|more)\s*[?.!]*$/i,
];

/**
 * Whether a line under a document's card asks for its buttons again -- the
 * window shows the card once more, with no model. English only: in another
 * language the assistant answers it, and ends on its own options.
 */
export function checkIsDocumentOptionsAsk(asked: string) {
    const text = String(asked ?? '')
        .trim()
        .replace(/\s+/g, ' ');
    return (
        text.length <= 60 &&
        DOCUMENT_OPTIONS_ASK_PATTERN_LIST.some((pattern) => {
            return pattern.test(text);
        })
    );
}

// --- sizes the window changes by itself -------------------------------------

/**
 * Every text box's words larger, smaller, or one size: work with one right
 * answer, done by the WINDOW with no model (2026-11-07, the goal _chatbot be
 * the best choice to help modify appdocument slides_). Asked of a model it
 * waited on one -- 1.3 s on gemma4:cloud, 5.8 s on Free, an empty answer
 * three times of four on the shared server -- and needed one to be there at
 * all, where the Slide Editor's **Bulk Font** answers at once. Done here it
 * is instant, works with no assistant, keeps each box's own size against
 * the others (Bulk Font sets ONE size on every box), and is still one change
 * with **Undo this change** under it.
 */
export type SlideSizeAskType =
    { kind: 'scale'; factor: number } | { kind: 'set'; size: number };

export const SLIDE_SIZE_LARGER_FACTOR = 1.25;
export const SLIDE_SIZE_SMALLER_FACTOR = 0.8;
const SLIDE_FONT_SIZE_MIN = 8;
const SLIDE_FONT_SIZE_MAX = 600;
const SLIDE_SIZE_SHOWN_PAIRS = 4;

// Words that say nothing about WHICH boxes or how: "make all the words on
// every slide larger please" reads as "make words larger".
const SIZE_FILLER_PATTERN =
    /\b(?:please|pls|all|the|every|each|of|on|in|to|a|bit|little|slides?|everywhere)\b/g;

/**
 * The size request in `asked`, or null. English only, a short line and
 * nothing else in it: "make the words larger on slide 2", "make the title
 * larger" or "make it look nicer" are the assistant's -- they choose boxes.
 * A pressed card button asks its own English, so a press in any language is
 * read here.
 */
export function readSlideSizeAsk(asked: string): SlideSizeAskType | null {
    const raw = String(asked ?? '').trim();
    if (raw.length === 0 || raw.length > 80 || /\n/.test(raw)) {
        return null;
    }
    const words = raw
        .toLowerCase()
        .replace(/[.!?,;:]+/g, ' ')
        .replace(SIZE_FILLER_PATTERN, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    // "every box's words", "every box" and "the words" all name every box.
    const what =
        "(?:(?:box(?:'s|es)? )?(?:words|text|letters|font(?: size)?|font sizes?)|box(?:es)?)";
    const scale = new RegExp(`^make ${what} (larger|bigger|smaller)$`).exec(
        words,
    );
    if (scale !== null) {
        return {
            kind: 'scale',
            factor:
                scale[1] === 'smaller'
                    ? SLIDE_SIZE_SMALLER_FACTOR
                    : SLIDE_SIZE_LARGER_FACTOR,
        };
    }
    const set = new RegExp(
        `^(?:make|set|change) ${what} (\\d{1,3}) ?(?:px|pixels?)?$`,
    ).exec(words);
    if (set !== null) {
        const size = Number(set[1]);
        return size >= SLIDE_FONT_SIZE_MIN && size <= SLIDE_FONT_SIZE_MAX
            ? { kind: 'set', size }
            : null;
    }
    return null;
}

export type SlideSizeChangeType = {
    changes: { slide: number; items: { id: number; fontSize: number }[] }[];
    boxCount: number;
    /** `70 → 88, 90 → 112`, or `110 px`: said under the change. */
    sizes: string;
};

/**
 * The `update-slides` changes for `ask` off an `owa_slide_edit` read: every
 * text box that is not locked, each slide one entry. Null when there is
 * nothing to change or the read is not the whole document (a long one is
 * read in parts) -- the assistant takes those.
 */
export function genSlideSizeChanges(
    described: any,
    ask: SlideSizeAskType,
): SlideSizeChangeType | null {
    if (
        described === null ||
        typeof described !== 'object' ||
        described.isTruncated === true ||
        !Array.isArray(described.slides)
    ) {
        return null;
    }
    const pairMap = new Map<number, number>();
    const changes: SlideSizeChangeType['changes'] = [];
    let boxCount = 0;
    for (const slide of described.slides) {
        const items: { id: number; fontSize: number }[] = [];
        for (const item of Array.isArray(slide?.items) ? slide.items : []) {
            if (
                item?.type !== 'text' ||
                item.locked === true ||
                !Number.isInteger(item.id) ||
                typeof item.fontSize !== 'number'
            ) {
                continue;
            }
            const fontSize =
                ask.kind === 'set'
                    ? ask.size
                    : Math.min(
                          SLIDE_FONT_SIZE_MAX,
                          Math.max(
                              SLIDE_FONT_SIZE_MIN,
                              Math.round(item.fontSize * ask.factor),
                          ),
                      );
            if (fontSize === item.fontSize) {
                continue;
            }
            pairMap.set(item.fontSize, fontSize);
            items.push({ id: item.id, fontSize });
        }
        if (items.length > 0 && Number.isInteger(slide?.number)) {
            changes.push({ slide: slide.number, items });
            boxCount += items.length;
        }
    }
    if (changes.length === 0) {
        return null;
    }
    const pairs = [...pairMap.entries()].sort((one, other) => {
        return one[0] - other[0];
    });
    const sizes =
        ask.kind === 'set'
            ? `${ask.size} px`
            : pairs
                  .slice(0, SLIDE_SIZE_SHOWN_PAIRS)
                  .map(([from, to]) => {
                      return `${from} → ${to}`;
                  })
                  .join(', ') +
              (pairs.length > SLIDE_SIZE_SHOWN_PAIRS ? ', …' : '');
    return { changes, boxCount, sizes };
}

/**
 * The sentence under a size change the window made. Through the chatbot's
 * `tran`, the button names inside it as the window draws them.
 */
export function genSlideSizeDoneText(
    name: string,
    change: SlideSizeChangeType,
) {
    return fillWords(
        tran(
            'Done in one change: {count} boxes of “{name}” have a new font ' +
                'size ({sizes}). It is not saved yet: Save in the Slide ' +
                'Editor keeps it, and Undo this change puts it back.',
        ),
        {
            count: String(change.boxCount),
            name,
            sizes: change.sizes,
        },
    );
}

/**
 * The card a slide document opens its tab with, written by the window with
 * no model: that it is attached, what can be done to it, and the changes
 * asked for most as buttons -- the song card's two translate buttons among
 * them. Every button is a question pressed, answered by the assistant with
 * `owa_slide_edit`.
 */
export function genSlideOpeningAnswer(
    fileName: string,
    appLanguage: AssistantLanguageType,
    languages: readonly AssistantLanguageType[],
) {
    const name = toSlideDocName(fileName);
    const target = pickTranslateLanguage(name, appLanguage, languages);
    // Named as the reader of THIS window says it: its own word in a window
    // shown in English, the language's own name in any other.
    const targetName =
        target === null
            ? null
            : appLanguage.code === DEFAULT_CHAT_LANG_CODE
              ? target.name
              : target.nativeName;
    return {
        text: fillWords(
            tran(
                '“{name}” is attached below. I can change these slides for ' +
                    'you: change or translate their words, check the ' +
                    'spelling, make the words larger or smaller, change ' +
                    'their colors and layout, or add, copy, move or remove ' +
                    'slides. Send me a picture of slides you like and I ' +
                    'will make slides that look like it. Press one, or say ' +
                    'what you want.',
            ),
            { name },
        ),
        replies: [
            ...genLyricTranslateReplies(targetName),
            tran('Check the spelling'),
            tran('Make the words larger'),
            tran('Make slides like a picture'),
        ],
        translateLanguage: target,
    };
}
