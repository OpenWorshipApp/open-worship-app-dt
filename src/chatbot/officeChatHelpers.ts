/**
 * A conversation about one of the user's POWERPOINT (`.pptx`) or WORD
 * (`.docx`) files, attached to the tab -- from a Documents row's **Open in
 * Chatbot**, the paperclip or a drop (EC-761).
 *
 * Asked for 2026-11-20 (the user: _open pptx or docx in chatbot then
 * interact to edit the powerpoint_, _able to undo_, and the goal _chatbot
 * smart enough to help editor the pptx and docx file_). Until then such a
 * file was only READ: its card offered what it is about and a song made of
 * it, and asked to change it, a model had no tool that could.
 *
 * The slide document's conversation (`slideChatHelpers.ts`) is the shape: a
 * question asked while a `.pptx` or `.docx` is open in the tab is an
 * `office` ask. The window reads each attached file as it stands NOW
 * through `owa_office_edit read` -- every line with its id, a slide's
 * speaker notes, the box a line is in -- and puts it under the question as
 * plain lines (`toOfficeAsk`). The ask goes out under its own prompt with
 * `owa_office_edit`, offered to no other question. The model names a file;
 * the window turns the name into the attached file's path
 * (`resolveOfficeEditFile`), so no path ever reaches it or comes from it.
 * A song made of the file (**Make a song from it**) stays the window's own
 * (`deckSongAskHelpers.ts`), asked before any of this.
 *
 * Pure, every rule a test: no store, no tool call, no model.
 */
import type { ChatAttachmentType } from './attachmentHelpers';
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
import {
    SLIDE_PLACEMENT_HINT_MAP,
    findOpenSlideAttachments,
    readSlidePlacement,
    readTranslateLanguageName,
} from './slideChatHelpers';

export const OFFICE_ASK_KIND = 'office';
export const OFFICE_EDIT_TOOL_NAME = 'owa_office_edit';
// A change or two (each one call however many lines), a read after a slide
// was copied, a retry after a refusal, and the answer.
export const OFFICE_MAX_TOOL_ROUNDS = 8;

/**
 * What an answer about a PowerPoint or Word file says after a change the
 * note's words do not cover, in the first person: a size increased, a
 * transition given, a slide hidden (2026-11-20, `EC-770`: with every edit
 * refused, gemma4:cloud answered "I've added a fade transition to every
 * slide" and nothing had changed). "I set" and "I gave" are also offers
 * ("shall I set it?"), so only "I've set" claims them.
 */
export const OFFICE_CLAIM_PATTERN =
    /\bI(?:'ve|\u2019ve| have) (?:increased|decreased|reduced|resized|shrunk|enlarged|set|given|applied|turned|hidden|unhidden|duplicated|copied|deleted|taken|placed|positioned|widened|narrowed|recoloured|recolored|swapped|switched|sized|shown)\b|\bI (?:increased|decreased|reduced|resized|shrank|applied|duplicated|copied|deleted|placed|positioned|widened|narrowed|swapped|switched)\b/i;

/** What the model is told when it said the file changed and it did not. */
export const OFFICE_CLAIM_NUDGE =
    `Not yet: the file did not change -- no ${OFFICE_EDIT_TOOL_NAME} ` +
    '"edit" in this answer changed it (a read changes nothing, and a ' +
    'refused call did nothing: read its reason). When they asked for that ' +
    'change, make it now, fixing what the refusal said; when it cannot be ' +
    'done, say plainly that it was not done and why -- never that it was.';
/** The most PowerPoint or Word files one question reads and may change. */
export const MAX_OFFICE_ASK_FILES = 2;
// What one file may cost the question it rides on: a deck of forty slides
// of a song's lines is ~10 000 characters. Past it, the model reads on.
const MAX_OFFICE_DOC_TEXT_CHARS = 16000;

const OFFICE_FILE_PATTERN = /\.(?:pptx|docx)$/i;

/** Whether a file is a PowerPoint or Word file the assistant can change. */
export function checkIsOfficeEditFileName(name: string) {
    return OFFICE_FILE_PATTERN.test(String(name ?? '').trim());
}

function toBaseName(text: string) {
    return (
        String(text ?? '')
            .split(/[\\/]/)
            .pop() ?? ''
    );
}

export type OfficeAskFileType = LyricAskFileType;

/**
 * The PowerPoint and Word files among a tab's open files -- each a file
 * from disk with its path, once, the first `MAX_OFFICE_ASK_FILES`. Named
 * WITH the extension: a deck and a letter may share a name.
 */
export function findOfficeAskFiles(
    attachments: readonly ChatAttachmentType[],
): OfficeAskFileType[] {
    const out: OfficeAskFileType[] = [];
    for (const attachment of attachments) {
        const filePath = attachment.filePath;
        if (
            typeof filePath !== 'string' ||
            !checkIsOfficeEditFileName(filePath) ||
            out.some((one) => {
                return one.filePath === filePath;
            })
        ) {
            continue;
        }
        out.push({ name: toBaseName(filePath), filePath });
    }
    return out.slice(0, MAX_OFFICE_ASK_FILES);
}

/**
 * Whether the latest question that carried a file from disk carried a
 * PowerPoint or Word file: such a file opened AFTER a song, a slide
 * document, a presenting flow or a note is what the tab is about now
 * (`checkIsNoteOpenedLast`'s rule). False when the tab closed its files
 * since (`closedAfterId`).
 */
export function checkIsOfficeOpenedLast(
    messages: readonly {
        id: number;
        author: string;
        attachments?: ChatAttachmentType[];
    }[],
    closedAfterId?: number,
) {
    for (let index = messages.length - 1; index >= 0; index--) {
        const message = messages[index];
        if (closedAfterId !== undefined && message.id <= closedAfterId) {
            return false;
        }
        if (message.author !== 'you') {
            continue;
        }
        // a picture, a video or a sound alone is no new subject: it is what
        // goes INTO the deck ("put this photo on slide 3", EC-770)
        const filePaths = (message.attachments ?? [])
            .map((one) => {
                return one.filePath;
            })
            .filter((filePath): filePath is string => {
                return (
                    typeof filePath === 'string' &&
                    !OFFICE_PICTURE_PATTERN.test(filePath) &&
                    !OFFICE_MEDIA_PATTERN.test(filePath)
                );
            });
        if (filePaths.length > 0) {
            return filePaths.some(checkIsOfficeEditFileName);
        }
    }
    return false;
}

const DECK_FILE_PATTERN = /\.pptx$/i;

/**
 * Whether a PowerPoint is waiting in the box or open in the tab: there, a
 * slide asked for is one of ITS slides, as in a tab holding a slide
 * document, and only a NEW slide document is made (2026-11-21: asked in
 * French to fade in every slide's title, the window made an empty slide
 * document before the deck was changed).
 */
export function checkHasOpenDeck(
    attachments: readonly ChatAttachmentType[],
    messages: readonly {
        id: number;
        author: string;
        attachments?: ChatAttachmentType[];
    }[],
    closedAfterId?: number,
) {
    const checkIsDeck = (one: ChatAttachmentType) => {
        return DECK_FILE_PATTERN.test(String(one.filePath ?? '').trim());
    };
    if (attachments.some(checkIsDeck)) {
        return true;
    }
    return findOpenSlideAttachments(messages, closedAfterId, (name) => {
        return DECK_FILE_PATTERN.test(name.trim());
    }).some(checkIsDeck);
}

// What a slide draws: the pictures `owa_office_edit` puts into a deck.
const OFFICE_PICTURE_PATTERN = /\.(?:png|jpe?g|gif|bmp)$/i;
// What a slide plays: a video or a sound (2026-11-21), the kinds PowerPoint
// embeds.
const OFFICE_MEDIA_PATTERN = /\.(?:mp4|m4v|mov|wmv|avi|mp3|m4a|wav|wma)$/i;
/** The most attached pictures one office question names to the model. */
export const MAX_OFFICE_ASK_PICTURES = 10;

/**
 * The pictures from disk attached to the tab -- in the box now, then in
 * the tab's questions since its files were closed, newest first -- each
 * once, by its name: what `{picture}` in an office change may name
 * (2026-11-20, `EC-770`). A pasted picture or one of the screen has no
 * file of its own, and is not one.
 */
export function findOfficeAskPictures(
    attachments: readonly ChatAttachmentType[],
    messages: readonly {
        id: number;
        author: string;
        attachments?: ChatAttachmentType[];
    }[] = [],
    closedAfterId?: number,
): OfficeAskFileType[] {
    const out: OfficeAskFileType[] = [];
    const take = (list: readonly ChatAttachmentType[]) => {
        for (const attachment of list) {
            const filePath = attachment.filePath;
            if (
                attachment.kind === 'element' ||
                attachment.window !== undefined ||
                typeof filePath !== 'string' ||
                !(
                    OFFICE_PICTURE_PATTERN.test(filePath) ||
                    OFFICE_MEDIA_PATTERN.test(filePath)
                ) ||
                out.some((one) => {
                    return one.filePath === filePath;
                })
            ) {
                continue;
            }
            out.push({ name: toBaseName(filePath), filePath });
        }
    };
    take(attachments);
    for (let index = messages.length - 1; index >= 0; index--) {
        const message = messages[index];
        if (closedAfterId !== undefined && message.id <= closedAfterId) {
            break;
        }
        if (message.author === 'you') {
            take(message.attachments ?? []);
        }
    }
    return out.slice(0, MAX_OFFICE_ASK_PICTURES);
}

/**
 * A model's office changes with each `picture` -- an attached picture's
 * name, with its extension or without -- turned into that picture's path,
 * or a `reason`. No path a model writes is taken.
 */
export function resolveOfficePictures(
    changes: unknown,
    pictures: readonly OfficeAskFileType[],
): { changes: unknown } | { reason: string } {
    if (!Array.isArray(changes)) {
        return { changes };
    }
    const toComparable = (text: string) => {
        return toBaseName(text).toLowerCase().replace(/\s+/g, ' ').trim();
    };
    const toStem = (text: string) => {
        return toComparable(text).replace(/\.[a-z0-9]{1,5}$/, '');
    };
    // `picture` names an attached picture, `media` a video or a sound
    const KEY_LIST = [
        {
            key: 'picture',
            pattern: OFFICE_PICTURE_PATTERN,
            noneReason:
                'No picture is attached to this chat. Ask them to attach ' +
                'it (the paperclip, or drop it in the box) and say where ' +
                'it goes.',
            what: 'a picture',
        },
        {
            key: 'media',
            pattern: OFFICE_MEDIA_PATTERN,
            noneReason:
                'No video or sound is attached to this chat. Ask them to ' +
                'attach it (the paperclip, or drop it in the box) and say ' +
                'which slide it goes on.',
            what: 'a video or a sound',
        },
    ] as const;
    const resolved: unknown[] = [];
    for (const change of changes) {
        if (typeof change !== 'object' || change === null) {
            resolved.push(change);
            continue;
        }
        let next = change as Record<string, unknown>;
        for (const { key, pattern, noneReason, what } of KEY_LIST) {
            if (!(key in next)) {
                continue;
            }
            const asked = next[key];
            const text = typeof asked === 'string' ? asked.trim() : '';
            const ofKind = pictures.filter((one) => {
                return pattern.test(one.filePath);
            });
            if (ofKind.length === 0) {
                return { reason: noneReason };
            }
            const found =
                /[\\/]/.test(text) || text === ''
                    ? undefined
                    : (ofKind.find((one) => {
                          return toComparable(one.name) === toComparable(text);
                      }) ??
                      ofKind.find((one) => {
                          return toStem(one.name) === toStem(text);
                      }));
            if (found === undefined) {
                return {
                    reason:
                        `\`${key}\` names ${what} attached to this chat by ` +
                        'its name, never a path: ' +
                        ofKind
                            .map((one) => {
                                return `"${one.name}"`;
                            })
                            .join(', ') +
                        '.',
                };
            }
            next = { ...next, [key]: found.filePath };
        }
        resolved.push(next);
    }
    return { changes: resolved };
}

/**
 * A `replace` the model wrote INSIDE a change, read as the deck's own
 * (2026-11-21, `EC-776`): asked in French to change "Pray" to "Worship" in
 * a SmartArt, gemma4:cloud sent `changes: [{replace: [{from, to}]}]` three
 * times; the tool's schema dropped the key it does not know there, each
 * call was refused as a change naming nothing, and the answer said the
 * word was changed. A change holding only `replace` gives its pairs to the
 * call's `replace` and goes; one that also names other things keeps them.
 * A `replace` beside a `slide` is refused: it changes the words everywhere,
 * which the slide named does not ask. One pair alone is read as the list.
 */
export function liftOfficeNestedReplaces(
    changes: unknown,
    replace: unknown,
):
    | { changes: unknown; replace: unknown; isLifted: boolean }
    | { reason: string } {
    if (!Array.isArray(changes)) {
        return { changes, replace, isLifted: false };
    }
    const toPairList = (value: unknown) => {
        if (Array.isArray(value)) {
            return value;
        }
        return typeof value === 'object' && value !== null ? [value] : null;
    };
    const lifted: unknown[] = [];
    const kept: unknown[] = [];
    for (const change of changes) {
        const pairs =
            typeof change === 'object' && change !== null
                ? toPairList((change as Record<string, unknown>).replace)
                : null;
        if (pairs === null) {
            kept.push(change);
            continue;
        }
        const { replace: _replace, ...rest } = change as Record<
            string,
            unknown
        >;
        if (rest.slide !== undefined) {
            return {
                reason:
                    '`replace` changes the words EVERYWHERE in the file and ' +
                    'goes beside `changes`, never inside a change or with a ' +
                    '`slide`: {"replace": [{"from", "to"}]}. To change words ' +
                    'on one slide only, rewrite that line: {"id", "text"}.',
            };
        }
        lifted.push(...pairs);
        if (Object.keys(rest).length > 0) {
            kept.push(rest);
        }
    }
    if (lifted.length === 0) {
        return { changes, replace, isLifted: false };
    }
    return {
        changes: kept,
        replace: [...(toPairList(replace) ?? []), ...lifted],
        isLifted: true,
    };
}

// Words as a line is compared by: one case, one form of each letter, one
// space between words, no quote marks round them.
function toComparedWords(text: string) {
    return text
        .normalize('NFC')
        .toLowerCase()
        .replace(/["'“”‘’«»「」]/gu, ' ')
        .replace(/\s+/gu, ' ')
        .trim();
}

/**
 * The words of the first change sent with `everywhere: true` that the
 * person's own line does not write, or null (2026-11-21, `EC-786`). Asked
 * in Khmer for _the church name at the bottom of each slide_ green and
 * bold, the model sent "Grace Church" -- read off the deck -- to every
 * place, the slide that says _Welcome to Grace Church_ too, two times in
 * three, with the tool's refusal naming the test. A place named by where
 * or what it is is the box on every slide alone. Null with no words typed.
 */
export function findOfficeUnwrittenEverywhere(
    changes: unknown,
    askedText: string,
): string | null {
    const asked = toComparedWords(askedText);
    if (asked === '' || !Array.isArray(changes)) {
        return null;
    }
    for (const change of changes) {
        const { everywhere, words } = (change ?? {}) as Record<string, unknown>;
        const compared =
            typeof words === 'string' ? toComparedWords(words) : '';
        if (
            everywhere === true &&
            compared !== '' &&
            !asked.includes(compared)
        ) {
            return words as string;
        }
    }
    return null;
}

// The words a person places a SmartArt box with, by the key that does it
const SMARTART_PLACE_WORD_MAP = {
    afterBox: /\b(?:after|behind|following|next to)\b/,
    beforeBox: /\b(?:before|ahead of|in front of)\b/,
    underBox: /\b(?:under|below|beneath|inside|child of|reports? to)\b/,
} as const;

/**
 * A SmartArt box placed by a key whose words their question never says
 * while it says another's -- _move Go before Plan_ sent with `underBox`
 * (2026-11-21, EC-787, gemma4:cloud, the answer then saying "before"):
 * the change and the key it should have used, or null.
 */
export function findOfficeMisplacedBox(changes: unknown, askedText: string) {
    const asked = askedText.toLowerCase();
    if (!Array.isArray(changes)) {
        return null;
    }
    const keyList = Object.keys(
        SMARTART_PLACE_WORD_MAP,
    ) as (keyof typeof SMARTART_PLACE_WORD_MAP)[];
    for (const change of changes) {
        const record = (change ?? {}) as Record<string, unknown>;
        const sent = keyList.find((key) => {
            return typeof record[key] === 'string';
        });
        if (sent === undefined || SMARTART_PLACE_WORD_MAP[sent].test(asked)) {
            continue;
        }
        const said = keyList.filter((key) => {
            return SMARTART_PLACE_WORD_MAP[key].test(asked);
        });
        if (said.length === 1) {
            return { sent, said: said[0], target: String(record[sent]) };
        }
    }
    return null;
}

/** Why a SmartArt box's place went back, once. */
export function genOfficeMisplacedBoxReason(
    misplaced: NonNullable<ReturnType<typeof findOfficeMisplacedBox>>,
) {
    const target = JSON.stringify(misplaced.target);
    return (
        `their question puts it ${misplaced.said.replace('Box', '')} ` +
        `${target}, not ${misplaced.sent.replace('Box', '')} it: send ` +
        `\`${misplaced.said}\`: ${target} in place of \`${misplaced.sent}\` ` +
        '(underBox puts it a level down, under that box). Say then what the ' +
        "tool's answer says was done."
    );
}

/** Why a change sent to every place went back, once. */
export function genOfficeUnwrittenEverywhereReason(words: string) {
    const shown = JSON.stringify(words);
    return (
        `their question does not write ${shown}: they named it by where or ` +
        'what it is, which is the box on every slide alone, not every place ' +
        `the words are written. Send {words: ${shown}, …the look} without ` +
        '`everywhere` -- or the master box the tool named -- and say only ' +
        'that box changed. Only if they chose every place when you asked, ' +
        'send this change again as it was.'
    );
}

/**
 * What a model's `file` turns into: the attached file's own path -- named
 * with its extension or without -- another file of the Documents folder by
 * its full name, or a `reason`.
 */
export function resolveOfficeEditFile(
    file: unknown,
    files: readonly OfficeAskFileType[],
) {
    const text = typeof file === 'string' ? file.trim() : '';
    const toStem = (value: string) => {
        return toBaseName(value)
            .replace(OFFICE_FILE_PATTERN, '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    };
    if (text !== '' && !/[\\/]/.test(text)) {
        const attached = files.filter((one) => {
            return toStem(one.name) === toStem(text);
        });
        if (attached.length === 1) {
            return { filePath: attached[0].filePath };
        }
    }
    return resolveAttachedDocumentFile(
        file,
        files,
        toBaseName,
        'PowerPoint or Word file',
    );
}

function toQuotedText(value: unknown) {
    return JSON.stringify(String(value ?? ''));
}

/**
 * One file as the model reads it, from an `owa_office_edit read`: a line a
 * line, its id first, the box it is in when that changes (a slide) or its
 * style (Word), its words as a JSON string so a line break shows as `\n`.
 * Plain lines, never the file's XML. Null when the read is not one.
 */
export function toOfficeDocumentText(described: any) {
    if (described === null || typeof described !== 'object') {
        return null;
    }
    const lines: string[] = [];
    if (described.kind === 'PowerPoint' && Array.isArray(described.slides)) {
        lines.push(
            `PowerPoint · ${described.slideCount ?? '?'} slides` +
                " (a box's place: at [x, y, width, height] in % of the slide)",
        );
        if (Array.isArray(described.layouts)) {
            lines.push(
                `layouts: ${described.layouts.map(toQuotedText).join(', ')}`,
            );
        }
        for (const slide of described.slides) {
            lines.push(
                '',
                `Slide ${slide?.slide ?? '?'}` +
                    (slide?.hidden === true ? ' (hidden in the show)' : ''),
            );
            const slideLines: any[] = Array.isArray(slide?.lines)
                ? slide.lines
                : [];
            if (slideLines.length === 0) {
                lines.push('  (no words)');
            }
            for (const line of slideLines) {
                lines.push(
                    `  ${line?.id}` +
                        (typeof line?.box === 'string'
                            ? ` [${line.box}]`
                            : '') +
                        ` ${toQuotedText(line?.text)}`,
                );
            }
            // its boxes, where each is (x, y, width, height in % of the
            // slide) and the lines it holds: what a move, a size or a
            // picture taken off names
            const boxes: any[] = Array.isArray(slide?.boxes) ? slide.boxes : [];
            for (const box of boxes) {
                const kind = typeof box?.kind === 'string' ? box.kind : null;
                lines.push(
                    `  box ${toQuotedText(box?.name)}` +
                        (kind === null && box?.fills !== true
                            ? ''
                            : ` (${[
                                  ...(kind === null ? [] : [kind]),
                                  ...(box?.fills === true
                                      ? [
                                            'fills the slide, in front of ' +
                                                'its background',
                                        ]
                                      : []),
                              ].join('; ')})`) +
                        (Array.isArray(box?.at)
                            ? ` at [${box.at.join(', ')}]`
                            : '') +
                        (typeof box?.lines === 'string'
                            ? ` holds ${box.lines}`
                            : '') +
                        (typeof box?.rows === 'number'
                            ? `, ${box.rows} rows x ${box.columns} columns`
                            : '') +
                        (typeof box?.animation === 'string'
                            ? `, comes in: ${box.animation}`
                            : ''),
                );
                if (Array.isArray(box?.words) && box.words.length > 0) {
                    lines.push(
                        `    its words ${JSON.stringify(box.words.slice(0, 40))}`,
                    );
                }
                const chart = box?.chart;
                if (chart !== null && typeof chart === 'object') {
                    lines.push(
                        `    chart ${chart.kind}` +
                            (typeof chart.title === 'string'
                                ? `, title ${toQuotedText(chart.title)}`
                                : '') +
                            `, categories ${JSON.stringify(chart.categories)}` +
                            (Array.isArray(chart.series)
                                ? chart.series
                                      .map((series: any, index: number) => {
                                          return (
                                              `; series ${index} ` +
                                              `${toQuotedText(series?.name ?? '')} ` +
                                              JSON.stringify(series?.values)
                                          );
                                      })
                                      .join('')
                                : ''),
                    );
                }
            }
            const transition = slide?.transition;
            if (transition !== null && typeof transition === 'object') {
                lines.push(
                    '  transition ' +
                        [
                            ...(typeof transition.kind === 'string'
                                ? [transition.kind]
                                : []),
                            ...(typeof transition.advance === 'number'
                                ? [
                                      `goes on by itself after ${transition.advance} s`,
                                  ]
                                : []),
                        ].join(', '),
                );
            }
            if (typeof slide?.note === 'string') {
                lines.push(`  speaker notes: ${toQuotedText(slide.note)}`);
            }
        }
    } else if (described.kind === 'Word' && Array.isArray(described.lines)) {
        lines.push(
            `Word · ${described.lineCount ?? '?'} lines` +
                (typeof described.pageColor === 'string'
                    ? ` · page colour ${described.pageColor}`
                    : ''),
        );
        for (const line of described.lines) {
            lines.push(
                `${line?.id}` +
                    (typeof line?.style === 'string'
                        ? ` [${line.style}]`
                        : '') +
                    (line?.table === true ? ' [table]' : '') +
                    (line?.picture === true ? ' [picture]' : '') +
                    ` ${toQuotedText(line?.text)}`,
            );
        }
    } else {
        return null;
    }
    const more =
        typeof described.nextStart === 'number'
            ? `\n[... the rest was not included; ${OFFICE_EDIT_TOOL_NAME} ` +
              `"read" with start ${described.nextStart} reads on]`
            : '';
    const text = lines.join('\n').trim();
    return text.length > MAX_OFFICE_DOC_TEXT_CHARS
        ? `${text.slice(0, MAX_OFFICE_DOC_TEXT_CHARS)}\n[... the rest was ` +
              `not included; ${OFFICE_EDIT_TOOL_NAME} "read" with \`start\` ` +
              'reads on from a slide or a line]'
        : text + more;
}

// Said to the model under a pressed translate button, so which way is never
// its guess -- the song's two ways, said for a PowerPoint or Word file.
const OFFICE_TRANSLATE_HINT_MAP: Record<LyricTranslateModeType, string> = {
    replace:
        '(They chose to REPLACE the words with the translation: ONE edit ' +
        'call giving every line with words its translated text, a {id, ' +
        'text} each, its line breaks kept. When no language is named, ask ' +
        'which first, with OPTIONS naming two or three languages -- never ' +
        'the two ways again.)',
    under:
        '(They chose to KEEP the words and add the translation under them: ' +
        'ONE edit call where each line with words gets {id, text} with its ' +
        'own words, then a line break (\\n), then their translation -- the ' +
        'translation of each line break-separated part under that part. ' +
        'When no language is named, ask which first, with OPTIONS naming ' +
        'two or three languages -- never the two ways again.)',
};

// Sent with nothing typed: say what can be done, with buttons.
export const OFFICE_WORDLESS_HINT =
    '(They sent this with no words of their own. Say in a sentence what ' +
    'you can change in it and end with OPTIONS.)';

/**
 * The question as the model is asked it: what they typed, then each attached
 * file as it reads now, named as `file` takes it. `otherNames`: files of
 * the chat's earlier questions this one did not come with -- a model had
 * changed one of them too (2026-11-21, EC-787: a deck handed over with
 * _add a box Serve after Pray_, and the deck the chat had been about
 * before got the box as well).
 */
export function toOfficeAsk(
    asked: string,
    docs: readonly { name: string; text: string | null }[],
    translateMode: LyricTranslateModeType | null = null,
    isWordless = false,
    pictureNames: readonly string[] = [],
    otherNames: readonly string[] = [],
) {
    const language =
        translateMode === null ? null : readTranslateLanguageName(asked);
    const placement = translateMode === null ? readSlidePlacement(asked) : null;
    const mediaNames = pictureNames.filter((name) => {
        return OFFICE_MEDIA_PATTERN.test(name);
    });
    const stillNames = pictureNames.filter((name) => {
        return !OFFICE_MEDIA_PATTERN.test(name);
    });
    const shown = docs.map((doc) => {
        return (
            `(The file "${doc.name}" is attached. Change it with ` +
            `${OFFICE_EDIT_TOOL_NAME}, file "${doc.name}". It reads now:\n` +
            `${doc.text ?? `(it could not be read just now; call ${OFFICE_EDIT_TOOL_NAME} with action "read")`})`
        );
    });
    return [
        ...(isWordless ? [OFFICE_WORDLESS_HINT] : []),
        asked,
        ...(translateMode === null
            ? []
            : [OFFICE_TRANSLATE_HINT_MAP[translateMode]]),
        ...(placement === null ? [] : [SLIDE_PLACEMENT_HINT_MAP[placement]]),
        ...(language === null
            ? []
            : [
                  `(The language is ${language}: translate into it now, in ` +
                      'one call -- do not ask which language.)',
              ]),
        ...(stillNames.length === 0
            ? []
            : [
                  '(Pictures attached to this chat, to put on a slide with ' +
                      "{slide, picture: name, at} or in a picture box's " +
                      'place with {box, picture: name}: ' +
                      stillNames
                          .map((name) => {
                              return JSON.stringify(name);
                          })
                          .join(', ') +
                      '.)',
              ]),
        ...(mediaNames.length === 0
            ? []
            : [
                  '(Videos and sounds attached to this chat, to play on a ' +
                      'slide with {slide, media: name, at, play: "click" | ' +
                      '"auto"}: ' +
                      mediaNames
                          .map((name) => {
                              return JSON.stringify(name);
                          })
                          .join(', ') +
                      '.)',
              ]),
        ...(otherNames.length === 0
            ? []
            : [
                  `(This message came with ${docs
                      .map((doc) => {
                          return JSON.stringify(doc.name);
                      })
                      .join(', ')}: change ` +
                      `${docs.length === 1 ? 'it' : 'them'} alone. ` +
                      otherNames
                          .map((name) => {
                              return JSON.stringify(name);
                          })
                          .join(', ') +
                      ', from earlier in the chat, only when they name it.)',
              ]),
        ...shown,
    ].join('\n\n');
}

/**
 * The system prompt of such a conversation: what the tool takes, one call
 * for many changes, and what it cannot do.
 */
export const OFFICE_SYSTEM_PROMPT =
    'You are the help assistant inside Open Worship app, a church ' +
    'presentation program, helping a volunteer change a PowerPoint (.pptx) ' +
    'or Word (.docx) file they attached. Each attached file is given under ' +
    'their message as it reads now: every line with its id (slide.line in ' +
    'a PowerPoint, "2.3" is slide 2 line 3; a number in Word), the box it ' +
    'is in or its style in [brackets], its words as a JSON string (\\n is a ' +
    "line break inside the line), a slide's speaker notes, its BOXES " +
    '(name, kind, at [x, y, width, height] in % of the slide, the lines ' +
    "it holds, a table's rows x columns, a chart's data, how it comes in) " +
    "and its transition, and the deck's layouts. Change it " +
    `with ${OFFICE_EDIT_TOOL_NAME} action "edit", naming the file in ` +
    '`file` exactly as it is given, and make the change asked for, ALL of ' +
    'it in ONE call. Ids are always as READ: never renumber for lines ' +
    'added or taken out in the same call. `slide` is a number, or, when ' +
    'they name a slide by words on it ("the prayers slide"), those words ' +
    '(slide: "prayers"): when no slide or several say them the tool lists ' +
    'the slides, and you ask which, the slides as OPTIONS -- never a slide ' +
    'of your own choosing. The ways: `replace` [{from, to}] ' +
    'changes words everywhere, `from` written exactly as the file writes ' +
    'it (its capital letters too) -- the best way to change a word or a ' +
    'name throughout; `changes` [{id, text}] gives a line its whole new ' +
    'words; {id, remove: true} takes a line out; {after: id, text} or ' +
    '{before: id, text} adds a line beside one, in its look; {slide, note} ' +
    "sets a slide's speaker notes; {slide, to} moves a slide to that " +
    'place; {slide, duplicate: true} copies it right after itself, and ' +
    'with `to` puts the copy at that place (the end is the slide count ' +
    'plus one) in the same change; {slide, ' +
    'removeSlide: true} takes it out; {slide, hidden: true | false} skips ' +
    'it in the show or shows it again; {slide, transition: "fade"} (push, ' +
    'wipe, cover, uncover, split, dissolve, zoom, wheel, random, cut; ' +
    '"none" takes it off) and {slide, advance: seconds} (0: on a click) -- ' +
    'with no slide, every slide; {slideSize: "4:3" | "16:9" | "16:10"} ' +
    "resizes the deck. THE THEME (the slide master's colours and fonts, " +
    "as PowerPoint's Design tab sets them): {theme: {colors: {accent1: " +
    '"navy", …}, headingFont, bodyFont}} -- slots accent1 to accent6, ' +
    'dark1 (text), light1 (background), dark2, light2, link; whatever takes ' +
    'the theme follows, words with a colour or font of their own keep it ' +
    '(give those a look with no slide too when asked for every word). ' +
    'THE MASTER: a logo, words or a line on EVERY slide is the slide ' +
    "master's or a layout's own box, read under `masters` -- never made " +
    'again as a `footer` or a new box; change it like ' +
    'a slide\'s box with slide: "master" or "layout: <name>" (its words by ' +
    'id, a look, `at`, removeBox, a picture in its place), add a text box, ' +
    'shape or picture there to put one on every slide, and {slide: ' +
    '"master", background} colours every slide with no background of its ' +
    'own. Words asked for by WHERE they are on every slide (the name at ' +
    'the bottom of each slide) are that box: {slide: "master", box, …}, ' +
    'never `words`, which also reaches a slide that says them; every ' +
    'one of them, in the whole file, is {words, everywhere: true, …}. ' +
    'BOXES: {slide, box: its name, at: [x, y, width, ' +
    'height]} moves or sizes a box -- null keeps one, so to the bottom is ' +
    '[null, 100 minus its height, null, null] and wider is a bigger width ' +
    '(x less by half the growth to stay centred); no slide: that box on ' +
    'every slide. Move the BOX, never its words into another box. {slide, ' +
    'textBox: "words", at, ...a look} adds a text box in the slide\'s ' +
    'look. PICTURES attached to the chat are named under their message: ' +
    '{slide, picture: its name, at} puts one on a slide (null in `at` ' +
    'keeps its own shape and centres it; a width and a height fit it ' +
    'inside them, its shape kept; [0, 0, 100, 100] fills the slide ' +
    'BEHIND the words, as a background picture), no slide: every slide; ' +
    "{box: a picture box's name, picture} puts it in that picture's " +
    'place, its size kept and cropped to it -- a picture that fills the ' +
    'slide already is replaced that way, never covered by another. A ' +
    'VIDEO or a SOUND attached is put on one slide to play there: ' +
    '{slide, media: its name, at, play: "click" (the default) or "auto"} ' +
    '(null in `at`: a video centred, a sound a small icon in a corner); ' +
    '{slide, removeBox: its name} takes it off. A picture, video or ' +
    'sound at a LINK they typed (https://...) is given as that link, ' +
    'exactly as typed, in `picture` or `media`: the window downloads it ' +
    '(a link meant for a title is `link`). None attached and no link of ' +
    'theirs: ask them to attach it or give its link. A NEW SLIDE: when the ' +
    "deck's slides have a box that fills the slide (a picture behind " +
    'their words), copy one of them instead (below) -- a layout has none ' +
    'of it; otherwise, or when they name a layout or "blank": {newSlide: ' +
    "true, layout: one of the deck's layouts by name (none: Title and " +
    'Content), title, lines: [...], to: its place (none: the end)}. ' +
    'Words they give go on it once: a slide that "says Amen" has the ' +
    'title Amen and no lines. ' +
    'ANIMATION: {slide, box, animation: "appear" | "fade" | "fly" | ' +
    '"wipe" | "zoom" ("none" takes it off), byLine: true for one line at ' +
    'a time, ' +
    'when: "click" | "with" | "after", seconds} -- no box: every box of ' +
    'words on that slide; no slide: every slide. TABLES: {slide, table: ' +
    'its name, addRow: n} adds a row that becomes row n (rows + 1: the ' +
    'end), its words in `cells`; removeRow, addColumn, removeColumn the ' +
    'same, ONE of them a change; {slide, table, tableLook: {fill, rows: ' +
    '[n], columns: [n], header, banded, borders}} colours its cells (only ' +
    'those rows or columns when named, counted from 1: the header row is ' +
    '1; null takes a colour off) and turns ' +
    "the style's header row and bands on or off. CHARTS: {slide, chart: " +
    'its name, chartKind: column | bar | line | pie | doughnut | area, ' +
    'chartTitle, categories: [...], series: [{index, name, values: ' +
    '[numbers]}]} changes its kind, words and numbers, everything not ' +
    'named kept (a pie shows one series). SMARTART: its words (under the ' +
    'box) change with `replace`, written exactly as read. Its colours, ' +
    'shapes or places: {slide, box: its name, toShapes: true} first turns ' +
    "it into the slide's own shapes, as PowerPoint's Convert to Shapes -- " +
    'ask before, saying it then stops being a SmartArt; on their yes, ' +
    'ONE change turns it and colours its boxes as asked: {slide, box, ' +
    'toShapes: true, fill?, outline?, transparency?}; anything else goes ' +
    'next, to the shapes it names, in the same answer. Another layout -- ' +
    'a process made a cycle -- keeps it a SmartArt, no question: {slide, ' +
    'box, smartArtLayout: cycle | process (a row) | pyramid | venn | ' +
    'hierarchy (boxes under boxes), at?}, or the `layout` read on another ' +
    'SmartArt of the deck ("like the one on slide 5"). A BOX of it, in ' +
    'any layout, added, taken out or moved, still a SmartArt: {slide, ' +
    'box, smartArtAdd: "Pray", afterBox | beforeBox | underBox?: the ' +
    "words of the box it goes by}, {slide, box, smartArtRemove: a box's " +
    'words} (its bullet lines go with it, boxes under it move up), ' +
    '{slide, box, smartArtMove, ' +
    'afterBox | beforeBox | underBox}. A column, or a row ' +
    'or a cycle ' +
    'of plain shapes, is the toShapes yes: {slide, box, toShapes: true, ' +
    'arrange: "cycle" | "row" | "column", at?}; any other SmartArt ' +
    "layout no SmartArt of the deck has is PowerPoint's. WORD: " +
    '{pageColor} colours the ' +
    'page ("none" off); an attached picture goes in as a line of its own, ' +
    '{after | before: id, picture: its name, width?: % of the page, only ' +
    'a size they named -- none keeps its own size}. ' +
    'LOOK: a change may give the words a look -- color, highlight ' +
    '("none" takes it off), size in points (a title is about 40, a body ' +
    'about 28) or, for BIGGER or SMALLER, "+20%" / "-20%" from each ' +
    "word's own size (never one number for words of different sizes), " +
    'bold, italic, underline, strike (a line through), font, link (a ' +
    'web address, or "slide 3" to jump there in the show; "none" off; a ' +
    "deck's), shadow (true: a soft shadow, words " +
    'read over a picture), align (left, center, right, justify), ' +
    "lineSpacing (1, 1.5, 2) and bullets (true / false, a deck's lines) " +
    "-- on one line {id, ...}, on a box's lines {box, ...} (no slide: " +
    "every slide's, e.g. every title), on every line of a slide {slide, " +
    '...}, or on every line of the file with none {color: "green"}; add ' +
    '`words` to give it to those words alone ("make Jesus red": {words: ' +
    '"Jesus", color: "red"}, with the slide or line named); and {slide, ' +
    'background} colours a slide ' +
    'behind its words (no slide: every slide; "none": the layout\'s own ' +
    'again; colours joined by "to" are a gradient: "dark blue to purple", ' +
    '"black to navy, left to right"; a pattern is its colours and its ' +
    'kind: "navy stripes on white", "red and white checks", "gold dots"). ' +
    "A BOX'S OWN LOOK, on {slide, box} (no slide: every slide " +
    'that has it) or IN the change that adds a new textBox or picture (a ' +
    'new one has no name yet: {slide, picture, at: [0, 0, 100, 100], ' +
    'brightness: -30}): fill (a colour, a gradient or a pattern; ' +
    '"none"), outline, transparency (0-100: how see-through its fill or a ' +
    "picture is), brightness (a picture's, -100 to 100: -30 is darker), " +
    'rotate (degrees), flip (horizontal, vertical, both, none), valign ' +
    '(top, middle, bottom: where its words sit) ' +
    'and order (front, back, forward, backward: in front of or behind ' +
    'the other boxes). Words hard to read over a picture: a dark ' +
    'see-through fill on their box ({box, fill: "black", transparency: ' +
    '40}), a shadow, or the picture darker ({box: its name, brightness: ' +
    '-30}) -- do what they asked, offer the others. A NEW SHAPE: {slide, ' +
    'shape: rectangle, rounded rectangle, oval (a circle), triangle, ' +
    'diamond, star, heart, right / left / up / down arrow, cross, speech ' +
    'bubble, cloud, chevron, pentagon, hexagon, sun or line, at, textBox: ' +
    'its words} with any box look in the same change; {slide, box, ' +
    'shape} gives a box of words, a shape or a picture (cut to it) one of ' +
    'those shapes instead, its words and place kept. Slide numbers and a ' +
    'footer: {slideNumbers: true, footer: "Grace Church"} -- no slide: ' +
    'every slide but a title slide ("none" / false takes them off). ' +
    'Colours are #RRGGBB or an English name. "Change the colour ' +
    'to green" with nothing more named is the words of every line, one ' +
    'change {color}: do it, and offer the background as an OPTION. A ' +
    'slide\'s picture that "fills the slide" ' +
    'hides its background, so a background colour does not show there: ' +
    'say so (the answer says so too), never claim the colour shows, and ' +
    'say in a sentence that you can take that picture off so the colour ' +
    'shows, if they ask for it -- an offer in words, never an option ' +
    'button (a removal is asked for in words). Taken off is {removeBox: ' +
    'its name} (no slide: off every slide that has it), one change for ' +
    'each name. Take a picture or a box off only when they asked. A look ' +
    'not asked for is KEPT by the tool for every word that stays and given ' +
    'to new words from the line they replace: never ask about it. ' +
    "Change only what was asked. WORDS: keep each line's line breaks; " +
    'when asked to check the spelling, change only what is wrong and say ' +
    'what you fixed. A translation, words fixed, shortened or split, a ' +
    'title made from the words -- all come from the file: do it, never ask ' +
    'them for the words. When a request has one sensible reading, do it ' +
    'rather than ask: every change can be undone. A slide they name by ' +
    'words no slide has is not there: say so and ask which, with OPTIONS ' +
    'naming slides it has -- never pick another. A file is named as it is ' +
    'given, never translated, and words of the file you quote are ' +
    "written as the file has them, in the file's language. TRANSLATING " +
    'has two ways ' +
    'and the person chooses: REPLACE the words with the translation, or ' +
    'ADD the translation under each line (in the same line, after a \\n). ' +
    'Unless their words already say which ("replace", "instead of" is ' +
    'replace; "under each line", "bilingual", "keep the English" is add), ' +
    'ask which way first and end with OPTIONS: Replace the words | Add it ' +
    'under each line. Once the way is known and the language is not, ask ' +
    'which language, with OPTIONS naming two or three languages. Write ' +
    "natural lines in the target language's own script, and Bible names " +
    'the way that language says them. A NEW SLIDE like another, or in a ' +
    'deck whose slides have a picture behind their words: copy that ' +
    'slide (duplicate, `to` for its place) in a call of its own -- its ' +
    "answer gives the copy's lines by their new ids in `copies` -- then " +
    "change the copy's lines by those ids. After lines or slides move, " +
    'read the file again before a change by id. A Bible verse they name ' +
    'is read with owa_find_verse `refs` and ' +
    'written as it reads there. Never make up the words of a song, a ' +
    'sermon or a Bible verse. What this cannot do -- a picture, a video ' +
    'or a sound neither attached nor at a link they typed (a video ' +
    "site's page is no file), " +
    'a SmartArt layout no SmartArt of the file has, a Word table, list, link ' +
    'or page numbers, the layout of a Word page -- say plainly is done ' +
    'in PowerPoint or Word. Remove at most ' +
    'one slide in an answer, and only one they named. When the tool ' +
    'refuses, read its reason, fix the call and try once more; then say ' +
    'plainly what went wrong. After a change, say in a sentence or two ' +
    'what changed, that it is kept in the file at once (there is no Save), ' +
    'that Undo this change puts it back, and that if the file is open in ' +
    'PowerPoint or Word they close it there without saving and open it ' +
    'again to see the change -- and pass on what the tool says is off the ' +
    'slide, hidden or over words. Never write the lines or any XML out in your ' +
    'answer. End with OPTIONS: two or three next changes they might want.';

/**
 * The card a PowerPoint or Word file opens its tab with, written by the
 * window with no model: that it is attached, what can be done to it, and
 * the changes asked for most as buttons -- the song card's two translate
 * buttons among them, and the song made of it, which the window does.
 */
export function genOfficeOpeningAnswer(
    fileName: string,
    appLanguage: AssistantLanguageType,
    languages: readonly AssistantLanguageType[],
) {
    const name = toBaseName(fileName);
    const isWord = /\.docx$/i.test(name);
    const target = pickTranslateLanguage(
        name.replace(OFFICE_FILE_PATTERN, ''),
        appLanguage,
        languages,
    );
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
            isWord
                ? tran(
                      '“{name}” is attached below. I can change this Word ' +
                          'file for you: change, fix or translate its ' +
                          'words, change their color, size and font, ' +
                          'replace a word everywhere, add or remove ' +
                          'paragraphs, color the page and put in pictures ' +
                          'you attach. Every change can be undone. Press ' +
                          'one, or say what you want.',
                  )
                : tran(
                      '“{name}” is attached below. I can change almost ' +
                          'anything in this PowerPoint for you: fix, ' +
                          'translate or replace its words and change their ' +
                          'color, size and font; add, copy, move, hide or ' +
                          'remove slides; change backgrounds, transitions, ' +
                          'animations and the slide size; move or resize ' +
                          'boxes; change tables and charts; and put in ' +
                          'pictures, videos and sounds you attach. Every ' +
                          'change can be undone. Press one, or say what you ' +
                          'want.',
                  ),
            { name },
        ),
        replies: [
            ...genLyricTranslateReplies(targetName),
            tran('Check the spelling'),
            // Its words made a song with no model (EC-590).
            tran('Make a song from it'),
            tran('What is this file about?'),
        ],
        translateLanguage: target,
    };
}
