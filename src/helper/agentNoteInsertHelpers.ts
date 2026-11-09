/**
 * The Bible Note editor's **Insert** menu as new blocks a model can add
 * (2026-11-08, the user, with a picture of the toolbar: _make chatbot able
 * to use all toolbar operations_). Each one is the node the editor's own
 * menu item makes, its shape copied from the editor and from notes it saved:
 *
 * - **Table**: rows of cells, the first row the headings -- `text` a line a
 *   row, the cells of a row between `|`;
 * - **Columns Layout**: two to four columns side by side -- `text` the
 *   columns between `|`, a column's lines by `\n`;
 * - **Collapsible container**: a title that folds what is under it --
 *   `text` the title, then its lines;
 * - **Page Break**, **Horizontal Rule** (the block list's `rule`);
 * - **Equation**: KaTeX, as typed into the editor's equation box;
 * - **Sticky Note**: a small note over the page in one of its seven colours;
 * - **Date**: a date (and a time) as the editor's date chip;
 * - **Poll**: a question and its choices, nobody's votes;
 * - **Youtube Video** and **Embed Website**: by their link;
 * - **Media**: a picture, video, PDF or audio by its link or its path on
 *   this computer, as the editor's Media dialog takes one;
 * - **Excalidraw**: a drawing of boxes and arrows described in lines
 *   (`agentNoteDrawingHelpers.ts`);
 * - **Default Example**: the editor's own sample study note, its nodes as
 *   the editor itself writes them (`agentNoteDefaultExample.json`, read only
 *   when asked for).
 *
 * Words inside them take the same mark-up as a block's
 * (`genInline`, handed in by `agentNoteBlockHelpers.ts`).
 *
 * Pure: a clock and an id maker are handed in, so a test can fix both.
 */

import {
    genNoteDrawingNode,
    toNoteDrawingText,
} from './agentNoteDrawingHelpers';

type NodeType = Record<string, any>;

export const NOTE_INSERT_KIND_LIST = [
    'table',
    'columns',
    'collapsible',
    'page-break',
    'equation',
    'sticky',
    'date',
    'poll',
    'video',
    'website',
    'media',
    'drawing',
    'example',
] as const;
export type NoteInsertKindType = (typeof NOTE_INSERT_KIND_LIST)[number];

/** The sticky note's own colours, the first its default. */
export const NOTE_STICKY_COLOR_LIST = [
    'yellow',
    'pink',
    'blue',
    'mint',
    'lavender',
    'peach',
    'sage',
];

const MAX_TABLE_ROWS = 50;
const MAX_TABLE_COLUMNS = 20;
const MAX_LAYOUT_COLUMNS = 4;
const MAX_POLL_OPTIONS = 20;
const MAX_EQUATION_CHARS = 2000;
// The editor's own: a new table column is 92px wide, a picture at most 500.
const TABLE_COLUMN_WIDTH = 92;
// A new sticky note's place: the right of a note window opened at its
// usual 870px, below the toolbar.
const STICKY_RIGHT_X = 560;
const STICKY_TOP_Y = 24;
const MEDIA_MAX_WIDTH = 500;

// The editor's own YouTube link reader.
const YOUTUBE_URL_PATTERN =
    /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
const YOUTUBE_ID_PATTERN = /^[\w-]{11}$/;
const VIDEO_EXTENSION_LIST = [
    '.3gp',
    '.avi',
    '.m4v',
    '.mkv',
    '.mov',
    '.mp4',
    '.mpeg',
    '.mpg',
    '.ogv',
    '.webm',
    '.wmv',
];
const AUDIO_EXTENSION_LIST = [
    '.aac',
    '.flac',
    '.m4a',
    '.mp3',
    '.oga',
    '.ogg',
    '.opus',
    '.wav',
    '.weba',
];

export type NoteInsertContextType = {
    // A line of words in the block mark-up, as nodes.
    genInline: (text: string) => NodeType[];
    // The style new words get (a Khmer note's font).
    style: string;
    // The note's root: a new sticky note goes over the ones there.
    root: NodeType;
    now?: Date;
    genId?: () => string;
    // The editor's Default Example, read by the app only when asked for.
    exampleNodes?: NodeType[];
    // A new drawing's box fill and line colour (BN-51).
    drawing?: { fill?: string; stroke?: string };
};

export type NoteInsertResultType =
    | { node: NodeType }
    // The Default Example: several blocks, in order.
    | { nodes: NodeType[] }
    | { reason: string };

function genParagraph(children: NodeType[], style: string): NodeType {
    return {
        children,
        direction: null,
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
        textFormat: 0,
        textStyle: style,
    };
}

function genLineParagraphs(text: string, context: NoteInsertContextType) {
    const lines = text.split('\n');
    return lines.map((line) => {
        return genParagraph(
            line.trim() === '' ? [] : context.genInline(line.trim()),
            context.style,
        );
    });
}

function genEmptyRootState(children: NodeType[] = []) {
    return {
        editorState: {
            root: {
                children,
                direction: null,
                format: '',
                indent: 0,
                type: 'root',
                version: 1,
            },
        },
    };
}

// `|` divides cells and columns; `\|` is a bar in the words.
function splitOnBars(text: string) {
    return text.split(/(?<!\\)\|/).map((part) => {
        return part.replace(/\\\|/g, '|');
    });
}

function genTable(text: string, context: NoteInsertContextType) {
    const rows = text
        .split('\n')
        .map((line) => {
            return line.trim().replace(/^\||\|$/g, '');
        })
        .filter((line) => {
            // A Markdown table's ruler line under its headings.
            return line.trim() !== '' && !/^[\s|:-]+$/.test(line);
        })
        .map((line) => {
            return splitOnBars(line).map((cell) => {
                return cell.trim();
            });
        });
    const columnCount = Math.max(0, ...rows.map((row) => row.length));
    if (rows.length === 0 || columnCount === 0) {
        return {
            reason:
                'A table needs its words in `text`: a line a row, the cells of ' +
                'a row between "|", the first row the headings.',
        };
    }
    if (rows.length > MAX_TABLE_ROWS || columnCount > MAX_TABLE_COLUMNS) {
        return {
            reason:
                `A table is ${MAX_TABLE_ROWS} rows and ${MAX_TABLE_COLUMNS} ` +
                'columns at most.',
        };
    }
    return {
        node: {
            children: rows.map((row, rowIndex) => {
                return {
                    children: Array.from({ length: columnCount }, (_, i) => {
                        const words = row[i] ?? '';
                        return {
                            children: [
                                genParagraph(
                                    words === ''
                                        ? []
                                        : context.genInline(words),
                                    context.style,
                                ),
                            ],
                            direction: null,
                            format: '',
                            indent: 0,
                            type: 'tablecell',
                            version: 1,
                            backgroundColor: null,
                            colSpan: 1,
                            // The first row is the headings.
                            headerState: rowIndex === 0 ? 1 : 0,
                            rowSpan: 1,
                        };
                    }),
                    direction: null,
                    format: '',
                    indent: 0,
                    type: 'tablerow',
                    version: 1,
                };
            }),
            direction: null,
            format: '',
            indent: 0,
            type: 'table',
            version: 1,
            colWidths: Array.from({ length: columnCount }, () => {
                return TABLE_COLUMN_WIDTH;
            }),
        },
    };
}

function genColumns(text: string, context: NoteInsertContextType) {
    const columns = splitOnBars(text).map((column) => {
        return column.replace(/^\s*\n|\n\s*$/g, '').trim();
    });
    if (columns.length < 2 || columns.length > MAX_LAYOUT_COLUMNS) {
        return {
            reason:
                `Columns are 2 to ${MAX_LAYOUT_COLUMNS} side by side: give each ` +
                'column\'s words in `text`, the columns between "|", a ' +
                "column's lines by \\n.",
        };
    }
    return {
        node: {
            children: columns.map((column) => {
                return {
                    children: genLineParagraphs(column, context),
                    direction: null,
                    format: '',
                    indent: 0,
                    type: 'layout-item',
                    version: 1,
                };
            }),
            direction: null,
            format: '',
            indent: 0,
            type: 'layout-container',
            version: 1,
            templateColumns: columns
                .map(() => {
                    return '1fr';
                })
                .join(' '),
        },
    };
}

function genCollapsible(text: string, context: NoteInsertContextType) {
    const [title = '', ...lines] = text.split('\n');
    if (title.trim() === '') {
        return {
            reason:
                'A collapsible block needs its title as the first line of ' +
                '`text`, then the lines it folds.',
        };
    }
    return {
        node: {
            children: [
                {
                    children: [
                        genParagraph(
                            context.genInline(title.trim()),
                            context.style,
                        ),
                    ],
                    direction: null,
                    format: '',
                    indent: 0,
                    type: 'collapsible-title',
                    version: 1,
                    textStyle: context.style,
                },
                {
                    children: genLineParagraphs(
                        lines.length === 0 ? '' : lines.join('\n'),
                        context,
                    ),
                    direction: null,
                    format: '',
                    indent: 0,
                    type: 'collapsible-content',
                    version: 1,
                },
            ],
            direction: null,
            format: '',
            indent: 0,
            type: 'collapsible-container',
            version: 1,
            open: true,
        },
    };
}

/** "today", "2026-11-08", "2026-11-08 14:30" -- a time in this computer's day. */
export function readNoteDate(text: string, now: Date): Date | null {
    const words = text.trim().toLowerCase();
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (words === '' || words === 'today') {
        return day;
    }
    if (words === 'tomorrow') {
        return new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    }
    if (words === 'yesterday') {
        return new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1);
    }
    const match =
        /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ t](\d{1,2}):(\d{2}))?$/.exec(words);
    if (match === null) {
        return null;
    }
    const [, year, month, date, hour = '0', minute = '0'] = match;
    const value = new Date(
        Number(year),
        Number(month) - 1,
        Number(date),
        Number(hour),
        Number(minute),
    );
    return value.getMonth() === Number(month) - 1 &&
        Number(hour) < 24 &&
        Number(minute) < 60
        ? value
        : null;
}

function genPollId() {
    return Math.random()
        .toString(36)
        .replace(/[^a-z]+/g, '')
        .slice(0, 5);
}

function genPoll(text: string, context: NoteInsertContextType) {
    const [question = '', ...options] = text
        .split('\n')
        .map((line) => {
            return line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim();
        })
        .filter((line) => {
            return line !== '';
        });
    if (question === '' || options.length < 2) {
        return {
            reason:
                'A poll needs its question as the first line of `text`, then ' +
                'a line for each of at least two choices.',
        };
    }
    if (options.length > MAX_POLL_OPTIONS) {
        return { reason: `A poll has ${MAX_POLL_OPTIONS} choices at most.` };
    }
    const genId = context.genId ?? genPollId;
    return {
        node: genParagraph(
            [
                {
                    type: 'poll',
                    version: 1,
                    question,
                    options: options.map((option) => {
                        return { text: option, uid: genId(), votes: [] };
                    }),
                },
            ],
            context.style,
        ),
    };
}

function toYoutubeId(text: string) {
    const words = text.trim();
    if (YOUTUBE_ID_PATTERN.test(words)) {
        return words;
    }
    const match = YOUTUBE_URL_PATTERN.exec(words);
    const id = match?.[2] ?? '';
    return id.length === 11 ? id : null;
}

function toWebUrl(text: string) {
    try {
        const url = new URL(text.trim());
        return url.protocol === 'http:' || url.protocol === 'https:'
            ? url
            : null;
    } catch (_error) {
        return null;
    }
}

/** What the editor's Media dialog calls a source: picture, video, pdf, audio. */
export function toNoteMediaType(source: string) {
    const lower = source.toLowerCase().split(/[?#]/)[0];
    if (lower.startsWith('data:application/pdf') || lower.endsWith('.pdf')) {
        return 'pdf';
    }
    if (
        lower.startsWith('data:video/') ||
        VIDEO_EXTENSION_LIST.some((extension) => lower.endsWith(extension))
    ) {
        return 'video';
    }
    if (
        lower.startsWith('data:audio/') ||
        AUDIO_EXTENSION_LIST.some((extension) => lower.endsWith(extension))
    ) {
        return 'audio';
    }
    return 'image';
}

/** A path on this computer, as the Media dialog's File Path box takes one. */
export function checkIsNoteMediaPath(source: string) {
    return /^(?:[a-z]:[\\/]|\\\\|\/)/i.test(source.trim());
}

function genMedia(text: string, context: NoteInsertContextType) {
    const [source = '', ...rest] = text.split('\n');
    const src = source.trim();
    if (toWebUrl(src) === null && !checkIsNoteMediaPath(src)) {
        return {
            reason:
                'Media needs a link (https://…) or a whole path on this ' +
                'computer in the first line of `text`; its title may follow ' +
                'on the next line.',
        };
    }
    const altText =
        rest.join(' ').trim() ||
        (src.split(/[\\/]/).pop() ?? '').split(/[?#]/)[0];
    return {
        node: genParagraph(
            [
                {
                    type: 'image',
                    version: 1,
                    altText,
                    caption: genEmptyRootState(),
                    height: 0,
                    maxWidth: MEDIA_MAX_WIDTH,
                    mediaType: toNoteMediaType(src),
                    showCaption: false,
                    src,
                    width: 0,
                },
            ],
            context.style,
        ),
    };
}

function findTopStickyLayer(root: NodeType) {
    let top = -1;
    let count = 0;
    for (const child of Array.isArray(root.children) ? root.children : []) {
        if (child?.type === 'sticky') {
            count++;
            top = Math.max(top, Number(child.layer) || 0);
        }
    }
    return { layer: top + 1, count };
}

function genSticky(
    text: string,
    color: string | undefined,
    context: NoteInsertContextType,
) {
    const stickyColor =
        color === undefined ? NOTE_STICKY_COLOR_LIST[0] : color.toLowerCase();
    if (!NOTE_STICKY_COLOR_LIST.includes(stickyColor)) {
        return {
            reason:
                'A sticky note is one of these colours: ' +
                `${NOTE_STICKY_COLOR_LIST.join(', ')}.`,
        };
    }
    const lines = text.split('\n');
    const { layer, count } = findTopStickyLayer(context.root);
    // At the page's right, off the note's first heading (the toolbar's own
    // puts one at the top left, over it -- BN-06), each next one a little
    // below and left of the last, never on top of it.
    const offset = count * 24;
    return {
        node: {
            type: 'sticky',
            version: 1,
            caption: genEmptyRootState(genLineParagraphs(text, context)),
            color: stickyColor,
            height: Math.max(80, 36 + lines.length * 24),
            layer,
            width: Math.max(
                120,
                Math.min(
                    320,
                    Math.max(...lines.map((line) => line.length)) * 8 + 32,
                ),
            ),
            xOffset: STICKY_RIGHT_X - offset,
            yOffset: STICKY_TOP_Y + offset,
        },
    };
}

/**
 * The node a new block of an Insert-menu kind is, from the change's words,
 * or why it cannot be made.
 */
export function genNoteInsertNode(
    kind: NoteInsertKindType,
    text: string,
    color: string | undefined,
    context: NoteInsertContextType,
): NoteInsertResultType {
    switch (kind) {
        case 'table':
            return genTable(text, context);
        case 'columns':
            return genColumns(text, context);
        case 'collapsible':
            return genCollapsible(text, context);
        case 'page-break':
            return { node: { type: 'page-break', version: 1 } };
        case 'equation': {
            const equation = text.trim();
            if (equation === '' || equation.length > MAX_EQUATION_CHARS) {
                return {
                    reason:
                        'An equation needs its KaTeX in `text` (e.g. ' +
                        '"E = mc^2"), ' +
                        `${MAX_EQUATION_CHARS} characters at most.`,
                };
            }
            return {
                node: genParagraph(
                    [{ type: 'equation', version: 1, equation, inline: false }],
                    context.style,
                ),
            };
        }
        case 'sticky':
            return genSticky(text, color, context);
        case 'date': {
            const date = readNoteDate(text, context.now ?? new Date());
            if (date === null) {
                return {
                    reason:
                        'A date is "today", "tomorrow", "yesterday" or ' +
                        '"YYYY-MM-DD" (a time may follow: "2026-12-25 09:30").',
                };
            }
            return {
                node: genParagraph(
                    [
                        {
                            type: 'datetime',
                            version: 1,
                            dateTime: date.toISOString(),
                        },
                    ],
                    context.style,
                ),
            };
        }
        case 'poll':
            return genPoll(text, context);
        case 'video': {
            const videoID = toYoutubeId(text);
            if (videoID === null) {
                return {
                    reason:
                        'A video is a YouTube link in `text` (e.g. ' +
                        '"https://www.youtube.com/watch?v=…"); a video file is ' +
                        'kind "media".',
                };
            }
            return {
                node: {
                    format: '',
                    type: 'youtube',
                    version: 1,
                    height: 'inherit',
                    videoID,
                    width: 'inherit',
                },
            };
        }
        case 'website': {
            const url = toWebUrl(text);
            if (
                url === null ||
                /(?:^|\.)(?:youtube\.com|youtu\.be)$/i.test(url.hostname)
            ) {
                return {
                    reason:
                        'A website is its link in `text` (https://…); a ' +
                        'YouTube link is kind "video".',
                };
            }
            return {
                node: {
                    format: '',
                    type: 'website',
                    version: 1,
                    height: 'inherit',
                    url: text.trim(),
                    width: 'inherit',
                },
            };
        }
        case 'media':
            return genMedia(text, context);
        case 'drawing': {
            const drawing = genNoteDrawingNode(text, {
                now: context.now,
                genId: context.genId,
                fill: context.drawing?.fill,
                stroke: context.drawing?.stroke,
            });
            // The board's drawing is an INLINE object: the editor keeps it in
            // a paragraph, and one left at the top was wrapped by an open
            // note window as a history step of its own -- the step an "undo"
            // then took back instead of the drawing (seen live 2026-11-08).
            return 'reason' in drawing
                ? drawing
                : { node: genParagraph([drawing.node], context.style) };
        }
        case 'example':
            if (
                !Array.isArray(context.exampleNodes) ||
                context.exampleNodes.length === 0
            ) {
                return { reason: "The editor's example could not be read." };
            }
            return {
                nodes: JSON.parse(JSON.stringify(context.exampleNodes)),
            };
    }
}

/** What a read shows for an object of the Insert menu, or null. */
export function toNoteInsertText(node: NodeType): string | null {
    switch (node.type) {
        case 'excalidraw':
            return toNoteDrawingText(node);
        case 'equation':
            return String(node.equation ?? '');
        case 'datetime': {
            const date = new Date(String(node.dateTime ?? ''));
            return Number.isNaN(date.getTime())
                ? ''
                : date.toISOString().slice(0, 10);
        }
        case 'poll':
            return [
                String(node.question ?? ''),
                ...(Array.isArray(node.options) ? node.options : []).map(
                    (option: NodeType) => {
                        return `- ${String(option?.text ?? '')}`;
                    },
                ),
            ].join(' ');
        case 'youtube':
            return `https://www.youtube.com/watch?v=${String(node.videoID ?? '')}`;
        case 'website':
            return String(node.url ?? '');
        case 'image': {
            const src = String(node.src ?? '');
            const shownSource = src.startsWith('data:')
                ? '(kept inside the note)'
                : src;
            return [String(node.altText ?? '').trim(), shownSource]
                .filter(Boolean)
                .join(' — ');
        }
        default:
            return null;
    }
}
