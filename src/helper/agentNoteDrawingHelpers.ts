/**
 * The note editor's **Insert › Excalidraw**, as a drawing the chatbot makes
 * from words (2026-11-08, the user: _make chatbot able to use all toolbar
 * operations_). A person draws on the board with the mouse; a model cannot,
 * so it says what the drawing is in a few lines and this lays it out:
 *
 *     God
 *     God -> Man
 *     Man -> Sin -> Death
 *
 * A line with an arrow (`->` or `→`) joins boxes by their words, top to
 * bottom; any other line is a box of its own. Each box is a rounded
 * rectangle with its words in it, an arrow runs from the bottom of one box
 * to the top of the next row's (or side to side within a row), and the
 * whole is an `excalidraw` node as the board saves one: its `data` the
 * board's own scene -- elements, a light app state, no files.
 *
 * Pure: the clock and the ids are handed in, so a test can fix both. The
 * board itself (and its fonts) is never loaded here.
 *
 * A first line `layout: across` lays the boxes out left to right instead,
 * `layout: circle` round a ring in the order written, `layout: center` the
 * first box in the middle and the rest round it; the boxes take a fill and
 * the lines a colour. A drawing made here reads back as its own lines, so it
 * can be drawn again with words changed, coloured or made larger
 * (`changeNoteDrawingNode`); one a person drew by hand is coloured or sized,
 * never redrawn (2026-11-09, BN-51: the user, _make sure chatbot can help
 * drawing_ -- asked to make a drawing larger, the model sent `size` on its
 * block, nothing changed, and the answer said it was larger).
 */

type NodeType = Record<string, any>;

export const NOTE_DRAWING_LAYOUT_LIST = [
    'down',
    'across',
    'circle',
    'center',
] as const;
export type NoteDrawingLayoutType = (typeof NOTE_DRAWING_LAYOUT_LIST)[number];

export type NoteDrawingContextType = {
    now?: Date;
    genId?: () => string;
    genSeed?: () => number;
    // The boxes' fill and the lines' colour: a change's `background` and
    // `color`, already checked as CSS colours.
    fill?: string;
    stroke?: string;
    // The layout when the words name none (a drawing drawn again keeps its
    // own).
    layout?: NoteDrawingLayoutType;
};

// The words a person (or a model) says a layout with.
const LAYOUT_WORD_MAP: Record<string, NoteDrawingLayoutType> = {
    down: 'down',
    'top to bottom': 'down',
    vertical: 'down',
    across: 'across',
    'left to right': 'across',
    horizontal: 'across',
    sideways: 'across',
    row: 'across',
    circle: 'circle',
    cycle: 'circle',
    round: 'circle',
    ring: 'circle',
    center: 'center',
    centre: 'center',
    hub: 'center',
    'mind map': 'center',
    star: 'center',
    around: 'center',
};
const LAYOUT_LINE_PATTERN = /^\s*layout\s*[:=]\s*(.+?)\s*$/i;
const DRAWING_SCALE_FACTOR = 1.25;
const DRAWING_MIN_WIDTH = 120;
const DRAWING_MAX_WIDTH = 1600;

const MAX_DRAWING_LINES = 40;
const MAX_DRAWING_BOXES = 30;
const MAX_BOX_WORDS = 80;
const FONT_SIZE = 20;
const LINE_HEIGHT = 1.25;
// Excalifont, the board's own hand-drawn face.
const FONT_FAMILY = 5;
const BOX_PADDING_X = 24;
const BOX_PADDING_Y = 18;
const BOX_MIN_WIDTH = 140;
const ROW_GAP = 80;
const COLUMN_GAP = 40;
const ARROW_GAP = 6;
// Lines a dark and a light note window both show: the board draws a
// drawing on the window's own ground, and near-black arrows vanished on a
// dark one (seen live 2026-11-08). Words stay dark, on the boxes' fill.
const STROKE_COLOR = '#1971c2';
const TEXT_COLOR = '#1e1e1e';
const LIGHT_TEXT_COLOR = '#ffffff';
// `layout: across`: columns farther apart than rows, room for an arrow.
const ACROSS_COLUMN_GAP = 80;
const ACROSS_ROW_GAP = 30;
const BOX_BACKGROUND = '#a5d8ff';
const ARROW_PATTERN = /\s*(?:->|→)\s*/;

function genDefaultId() {
    return Math.random().toString(36).slice(2, 12).padEnd(10, '0');
}

function genDefaultSeed() {
    return Math.floor(Math.random() * 2 ** 31);
}

/** A rough width of a line of the board's face, as it measures words. */
function measureLine(text: string) {
    let width = 0;
    for (const char of text) {
        width += /[\p{Lu}\p{N}]/u.test(char)
            ? FONT_SIZE * 0.62
            : /\s/.test(char)
              ? FONT_SIZE * 0.3
              : FONT_SIZE * 0.55;
    }
    return Math.ceil(width);
}

type BoxType = {
    name: string;
    level: number;
    column: number;
    x: number;
    y: number;
    width: number;
    height: number;
    id: string;
    textId: string;
    arrowIds: string[];
};

/** The layout a `layout:` line names, null for none, or why not. */
function readLayoutLine(
    line: string,
): NoteDrawingLayoutType | { reason: string } | null {
    const match = LAYOUT_LINE_PATTERN.exec(line);
    if (match === null) {
        return null;
    }
    const layout =
        LAYOUT_WORD_MAP[match[1].toLowerCase().replace(/[\s-]+/g, ' ')];
    return (
        layout ?? {
            reason:
                'A drawing\'s layout line is "layout: down", "across", ' +
                '"circle" or "center".',
        }
    );
}

/** The boxes and arrows a drawing's lines describe, or why not. */
export function readNoteDrawingLines(text: string): {
    names?: string[];
    arrows?: [string, string][];
    layout?: NoteDrawingLayoutType;
    reason?: string;
} {
    let layout: NoteDrawingLayoutType | undefined;
    const wordLines: string[] = [];
    for (const line of text.split(/\n|;/)) {
        const read = readLayoutLine(line);
        if (read === null) {
            wordLines.push(line);
        } else if (typeof read === 'string') {
            layout = read;
        } else {
            return read;
        }
    }
    const lines = wordLines
        // Arrows written on one line between commas are arrows each -- seen
        // live 2026-11-08: "God -> Man, Man -> Sin, Sin -> Death" -- while
        // a comma in a box's own words ("Grace, Mercy -> Peace") stays.
        .flatMap((line) => {
            const pieces = line.split(',');
            return pieces.length > 1 &&
                pieces.every((piece) => ARROW_PATTERN.test(piece))
                ? pieces
                : [line];
        })
        .map((line) => {
            return (
                line
                    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')
                    // A verse token in a box is its reference, in words: the
                    // board shows no chip (BN-53, the elder run: boxes read
                    // "[Psalm 23:1]").
                    .replace(
                        /\[\^?(?:\([^)\]]*\)\s*)?([^\]]+)\]/g,
                        (_token, words: string) => words.trim(),
                    )
                    .trim()
            );
        })
        .filter((line) => {
            return line !== '';
        });
    if (lines.length === 0 || lines.length > MAX_DRAWING_LINES) {
        return {
            reason:
                'A drawing needs its boxes in `text`: a line a box, or "A -> B" ' +
                `for an arrow from box A to box B; ${MAX_DRAWING_LINES} lines at ` +
                'most.',
        };
    }
    const names: string[] = [];
    const arrows: [string, string][] = [];
    const addName = (name: string) => {
        const words = name.slice(0, MAX_BOX_WORDS);
        if (!names.includes(words)) {
            names.push(words);
        }
        return words;
    };
    for (const line of lines) {
        const parts = line.split(ARROW_PATTERN).filter((part) => {
            return part.trim() !== '';
        });
        if (parts.length === 1) {
            addName(parts[0]);
            continue;
        }
        for (let index = 0; index + 1 < parts.length; index++) {
            arrows.push([addName(parts[index]), addName(parts[index + 1])]);
        }
    }
    if (names.length > MAX_DRAWING_BOXES) {
        return {
            reason: `A drawing is ${MAX_DRAWING_BOXES} boxes at most.`,
        };
    }
    return layout === undefined ? { names, arrows } : { names, arrows, layout };
}

function layOut(names: string[], arrows: [string, string][]) {
    // A box's row: one below the lowest box an arrow comes from. Boxes no
    // arrow joins take a row each, in the order written.
    const levelMap = new Map<string, number>();
    const joined = new Set(arrows.flat());
    let looseRow = 0;
    for (const name of names) {
        if (!joined.has(name)) {
            levelMap.set(name, looseRow++);
        } else {
            levelMap.set(name, 0);
        }
    }
    for (let pass = 0; pass < names.length; pass++) {
        let isMoved = false;
        for (const [from, to] of arrows) {
            const wanted = (levelMap.get(from) ?? 0) + 1;
            if (from !== to && (levelMap.get(to) ?? 0) < wanted) {
                levelMap.set(to, wanted);
                isMoved = true;
            }
        }
        if (!isMoved) {
            break;
        }
    }
    if (joined.size > 0 && looseRow > 0) {
        // Loose boxes below the joined drawing.
        const top = Math.max(
            ...[...joined].map((name) => {
                return levelMap.get(name) ?? 0;
            }),
        );
        let row = top + 1;
        for (const name of names) {
            if (!joined.has(name)) {
                levelMap.set(name, row++);
            }
        }
    }
    return levelMap;
}

function rowWidthOf(row: BoxType[]) {
    return (
        row.reduce((sum, box) => sum + box.width, 0) +
        COLUMN_GAP * (row.length - 1)
    );
}

/** Rows centred on the widest; each row below the one above it. */
function placeDown(rowMap: Map<number, BoxType[]>) {
    const levels = [...rowMap.keys()].sort((one, other) => one - other);
    const totalWidth = Math.max(
        ...levels.map((level) => rowWidthOf(rowMap.get(level)!)),
    );
    let y = 0;
    for (const level of levels) {
        const row = rowMap.get(level)!;
        let x = (totalWidth - rowWidthOf(row)) / 2;
        const rowHeight = Math.max(...row.map((box) => box.height));
        for (const box of row) {
            box.x = Math.round(x);
            box.y = y + Math.round((rowHeight - box.height) / 2);
            x += box.width + COLUMN_GAP;
        }
        y += rowHeight + ROW_GAP;
    }
    return { totalWidth, totalHeight: y - ROW_GAP };
}

/** `layout: across` -- the rows as columns, left to right. */
function placeAcross(rowMap: Map<number, BoxType[]>) {
    const levels = [...rowMap.keys()].sort((one, other) => one - other);
    const columnHeight = (column: BoxType[]) => {
        return (
            column.reduce((sum, box) => sum + box.height, 0) +
            ACROSS_ROW_GAP * (column.length - 1)
        );
    };
    const totalHeight = Math.max(
        ...levels.map((level) => columnHeight(rowMap.get(level)!)),
    );
    let x = 0;
    for (const level of levels) {
        const column = rowMap.get(level)!;
        const columnWidth = Math.max(...column.map((box) => box.width));
        let y = (totalHeight - columnHeight(column)) / 2;
        for (const box of column) {
            box.x = Math.round(x + (columnWidth - box.width) / 2);
            box.y = Math.round(y);
            y += box.height + ACROSS_ROW_GAP;
        }
        x += columnWidth + ACROSS_COLUMN_GAP;
    }
    return { totalWidth: x - ACROSS_COLUMN_GAP, totalHeight };
}

/**
 * `layout: circle` -- round a ring in the order written, the first at the
 * top; `layout: center` -- the first in the middle and the rest round it.
 * The ring is wide enough that no two neighbours touch.
 */
function placeRound(boxes: BoxType[], isCentered: boolean) {
    const middle = isCentered ? boxes[0] : null;
    const ring = isCentered ? boxes.slice(1) : boxes;
    const widest = Math.max(...boxes.map((box) => box.width));
    const tallest = Math.max(...boxes.map((box) => box.height));
    const radius =
        ring.length === 0
            ? 0
            : Math.max(
                  ring.length < 2
                      ? 0
                      : (widest + COLUMN_GAP) /
                            (2 * Math.sin(Math.PI / ring.length)),
                  middle === null ? 0 : widest + COLUMN_GAP,
                  tallest * 2,
              );
    if (middle !== null) {
        middle.x = -middle.width / 2;
        middle.y = -middle.height / 2;
    }
    ring.forEach((box, index) => {
        const angle = (2 * Math.PI * index) / ring.length;
        box.x = radius * Math.sin(angle) - box.width / 2;
        box.y = -radius * Math.cos(angle) - box.height / 2;
    });
    const left = Math.min(...boxes.map((box) => box.x));
    const top = Math.min(...boxes.map((box) => box.y));
    for (const box of boxes) {
        box.x = Math.round(box.x - left);
        box.y = Math.round(box.y - top);
    }
    return {
        totalWidth: Math.max(...boxes.map((box) => box.x + box.width)),
        totalHeight: Math.max(...boxes.map((box) => box.y + box.height)),
    };
}

/** A down drawing's arrow: bottom to top between rows, side to side in one. */
function toDownArrowEnds(start: BoxType, end: BoxType) {
    const isDown = end.level > start.level;
    const startX = isDown ? start.x + start.width / 2 : start.x + start.width;
    const startY = isDown
        ? start.y + start.height + ARROW_GAP
        : start.y + start.height / 2;
    const endX = isDown
        ? end.x + end.width / 2
        : end.x >= start.x
          ? end.x - ARROW_GAP
          : end.x + end.width + ARROW_GAP;
    const endY = isDown ? end.y - ARROW_GAP : end.y + end.height / 2;
    return [startX, startY, endX, endY];
}

/** Where the line between two boxes' middles leaves `box`, a gap out. */
function toEdgePoint(box: BoxType, towardX: number, towardY: number) {
    const middleX = box.x + box.width / 2;
    const middleY = box.y + box.height / 2;
    const dx = towardX - middleX;
    const dy = towardY - middleY;
    const length = Math.hypot(dx, dy);
    if (length === 0) {
        return [middleX, middleY];
    }
    const scale = Math.min(
        dx === 0 ? Infinity : box.width / 2 / Math.abs(dx),
        dy === 0 ? Infinity : box.height / 2 / Math.abs(dy),
    );
    return [
        middleX + dx * scale + (dx / length) * ARROW_GAP,
        middleY + dy * scale + (dy / length) * ARROW_GAP,
    ];
}

/** Any other layout's arrow: straight from one box's edge to the other's. */
function toArrowEnds(start: BoxType, end: BoxType) {
    const [startX, startY] = toEdgePoint(
        start,
        end.x + end.width / 2,
        end.y + end.height / 2,
    );
    const [endX, endY] = toEdgePoint(
        end,
        start.x + start.width / 2,
        start.y + start.height / 2,
    );
    return [startX, startY, endX, endY];
}

const DARK_COLOR_NAME_SET = new Set([
    'black',
    'navy',
    'darkblue',
    'darkgreen',
    'darkred',
    'maroon',
    'purple',
    'indigo',
    'brown',
    'teal',
    'green',
    'blue',
    'red',
    'crimson',
    'firebrick',
    'darkslategray',
    'darkslategrey',
    'midnightblue',
    'darkviolet',
    'darkmagenta',
    'darkcyan',
    'darkolivegreen',
    'saddlebrown',
    'dimgray',
    'dimgrey',
    'gray',
    'grey',
    'olive',
    'rebeccapurple',
]);

/** Whether words on this fill read better in white. */
export function checkIsDarkColor(color: string) {
    const value = color.trim().toLowerCase().replace(/\s+/g, '');
    if (DARK_COLOR_NAME_SET.has(value)) {
        return true;
    }
    let rgb: number[] | null = null;
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(value);
    if (hex !== null) {
        const digits =
            hex[1].length === 3
                ? hex[1]
                      .split('')
                      .map((digit) => digit + digit)
                      .join('')
                : hex[1];
        rgb = [0, 2, 4].map((at) => {
            return Number.parseInt(digits.slice(at, at + 2), 16);
        });
    }
    const call = /^rgba?\((\d+),(\d+),(\d+)/.exec(value);
    if (call !== null) {
        rgb = call.slice(1, 4).map(Number);
    }
    if (rgb === null) {
        return false;
    }
    const [red, green, blue] = rgb;
    return 0.299 * red + 0.587 * green + 0.114 * blue < 140;
}

/**
 * An `excalidraw` node for a drawing described in lines, or why not.
 */
export function genNoteDrawingNode(
    text: string,
    context: NoteDrawingContextType = {},
): { node: NodeType } | { reason: string } {
    const lineRead = readNoteDrawingLines(text);
    if (lineRead.reason !== undefined) {
        return { reason: lineRead.reason };
    }
    const read = {
        names: lineRead.names ?? [],
        arrows: lineRead.arrows ?? [],
        layout: lineRead.layout,
    };
    // Every element of a drawing has an id of its own, whatever the id maker
    // hands out: a box an arrow is bound to is found by it.
    const idSet = new Set<string>();
    const genId = () => {
        let id = (context.genId ?? genDefaultId)();
        while (idSet.has(id)) {
            id = `${id}${idSet.size}`;
        }
        idSet.add(id);
        return id;
    };
    const genSeed = context.genSeed ?? genDefaultSeed;
    const updated = (context.now ?? new Date()).getTime();
    const levelMap = layOut(read.names, read.arrows);
    const rowMap = new Map<number, BoxType[]>();
    const boxMap = new Map<string, BoxType>();
    for (const name of read.names) {
        const level = levelMap.get(name) ?? 0;
        const row = rowMap.get(level) ?? [];
        const box: BoxType = {
            name,
            level,
            column: row.length,
            x: 0,
            y: 0,
            width: Math.max(
                BOX_MIN_WIDTH,
                measureLine(name) + BOX_PADDING_X * 2,
            ),
            height: Math.ceil(FONT_SIZE * LINE_HEIGHT) + BOX_PADDING_Y * 2,
            id: genId(),
            textId: genId(),
            arrowIds: [],
        };
        row.push(box);
        rowMap.set(level, row);
        boxMap.set(name, box);
    }
    const layout = read.layout ?? context.layout ?? 'down';
    const { totalWidth, totalHeight } =
        layout === 'down'
            ? placeDown(rowMap)
            : layout === 'across'
              ? placeAcross(rowMap)
              : placeRound(
                    read.names.map((name) => boxMap.get(name)!),
                    layout === 'center',
                );
    const stroke = context.stroke ?? STROKE_COLOR;
    const fill = context.fill ?? BOX_BACKGROUND;
    const textColor = checkIsDarkColor(fill) ? LIGHT_TEXT_COLOR : TEXT_COLOR;
    const elements: NodeType[] = [];
    const base = () => {
        return {
            angle: 0,
            strokeColor: stroke,
            fillStyle: 'solid',
            strokeWidth: 2,
            strokeStyle: 'solid',
            roughness: 1,
            opacity: 100,
            groupIds: [],
            frameId: null,
            seed: genSeed(),
            version: 1,
            versionNonce: genSeed(),
            isDeleted: false,
            updated,
            link: null,
            locked: false,
        };
    };
    const arrowElements: NodeType[] = [];
    for (const [from, to] of read.arrows) {
        const start = boxMap.get(from)!;
        const end = boxMap.get(to)!;
        if (start === end) {
            continue;
        }
        const id = genId();
        start.arrowIds.push(id);
        end.arrowIds.push(id);
        const [startX, startY, endX, endY] =
            layout === 'down'
                ? toDownArrowEnds(start, end)
                : toArrowEnds(start, end);
        arrowElements.push({
            ...base(),
            id,
            type: 'arrow',
            x: Math.round(startX),
            y: Math.round(startY),
            width: Math.abs(Math.round(endX - startX)),
            height: Math.abs(Math.round(endY - startY)),
            backgroundColor: 'transparent',
            roundness: { type: 2 },
            boundElements: [],
            points: [
                [0, 0],
                [Math.round(endX - startX), Math.round(endY - startY)],
            ],
            lastCommittedPoint: null,
            startBinding: { elementId: start.id, focus: 0, gap: ARROW_GAP },
            endBinding: { elementId: end.id, focus: 0, gap: ARROW_GAP },
            startArrowhead: null,
            endArrowhead: 'arrow',
            elbowed: false,
        });
    }
    for (const box of boxMap.values()) {
        elements.push({
            ...base(),
            id: box.id,
            type: 'rectangle',
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            backgroundColor: fill,
            roundness: { type: 3 },
            boundElements: [
                { type: 'text', id: box.textId },
                ...box.arrowIds.map((id) => {
                    return { type: 'arrow', id };
                }),
            ],
        });
        const textHeight = Math.ceil(FONT_SIZE * LINE_HEIGHT);
        const textWidth = measureLine(box.name);
        elements.push({
            ...base(),
            id: box.textId,
            type: 'text',
            x: Math.round(box.x + (box.width - textWidth) / 2),
            y: Math.round(box.y + (box.height - textHeight) / 2),
            width: textWidth,
            height: textHeight,
            backgroundColor: 'transparent',
            roundness: null,
            boundElements: [],
            strokeColor: textColor,
            text: box.name,
            originalText: box.name,
            fontSize: FONT_SIZE,
            fontFamily: FONT_FAMILY,
            textAlign: 'center',
            verticalAlign: 'middle',
            containerId: box.id,
            autoResize: true,
            lineHeight: LINE_HEIGHT,
        });
    }
    elements.push(...arrowElements);
    elements.forEach((element, index) => {
        // The board's fractional order: a0, a1 … a9, aA …
        element.index = `a${index.toString(36).toUpperCase()}`;
    });
    const data = {
        appState: {
            exportBackground: true,
            exportScale: 1,
            exportWithDarkMode: false,
            isBindingEnabled: true,
            isLoading: false,
            name: 'Drawing',
            theme: 'light',
            viewBackgroundColor: '#ffffff',
            viewModeEnabled: false,
            zenModeEnabled: false,
            zoom: { value: 1 },
        },
        elements,
        files: {},
        // Kept so the drawing drawn again keeps it; the board drops what it
        // does not know when the person saves it by hand -- it is then read
        // as drawn down.
        ...(layout === 'down' ? {} : { layout }),
    };
    return {
        node: {
            type: 'excalidraw',
            version: 1,
            data: JSON.stringify(data),
            height: totalHeight + 40,
            width: totalWidth + 40,
        },
    };
}

function readDrawingData(node: NodeType): NodeType | null {
    try {
        const data = JSON.parse(String(node.data ?? ''));
        return data !== null && typeof data === 'object' ? data : null;
    } catch (_error) {
        return null;
    }
}

const BOX_TYPE_SET = new Set(['rectangle', 'ellipse', 'diamond']);

export type NoteDrawingSceneType = {
    // Boxes with their words and arrows between them, nothing else: a
    // drawing these lines draw again.
    isOwn: boolean;
    lines: string[];
    layout: NoteDrawingLayoutType;
    fill: string | null;
    stroke: string | null;
    // The size its elements span, before the note's width and height.
    sceneWidth: number;
    sceneHeight: number;
};

/**
 * What a drawing in a note is: its boxes and arrows as the lines that draw
 * it, its layout and colours -- and whether it is only that (`isOwn`), or
 * holds something drawn by hand that lines cannot say.
 */
export function readNoteDrawingScene(node: NodeType): NoteDrawingSceneType {
    const data = readDrawingData(node);
    const elements: NodeType[] = Array.isArray(data?.elements)
        ? data.elements.filter((element: NodeType) => {
              return element !== null && !element.isDeleted;
          })
        : [];
    const boxList = elements.filter((element) => {
        return BOX_TYPE_SET.has(element.type);
    });
    const textMap = new Map<string, string>();
    let isOwn = elements.length > 0;
    for (const element of elements) {
        if (element.type === 'text') {
            const owner = boxList.find((box) => box.id === element.containerId);
            if (owner === undefined) {
                isOwn = false;
                continue;
            }
            textMap.set(
                owner.id,
                String(element.text ?? '')
                    .replace(/\s+/g, ' ')
                    .trim(),
            );
        } else if (element.type === 'arrow') {
            const isBound = [element.startBinding, element.endBinding].every(
                (binding) => {
                    return boxList.some((box) => box.id === binding?.elementId);
                },
            );
            isOwn &&= isBound;
        } else if (!BOX_TYPE_SET.has(element.type)) {
            isOwn = false;
        }
    }
    const nameOf = (id: unknown) => {
        return textMap.get(String(id)) ?? '';
    };
    isOwn &&= boxList.every((box) => nameOf(box.id) !== '');
    const arrowList = elements.filter((element) => {
        return element.type === 'arrow';
    });
    // In the boxes' own order: each box's arrows out of it, or the box alone
    // when no arrow touches it -- the order the lines were written in.
    const joinedSet = new Set(
        arrowList.flatMap((arrow) => {
            return [
                String(arrow.startBinding?.elementId),
                String(arrow.endBinding?.elementId),
            ];
        }),
    );
    const lines: string[] = [];
    for (const box of boxList) {
        const name = nameOf(box.id);
        if (name === '') {
            continue;
        }
        if (!joinedSet.has(box.id)) {
            lines.push(name);
            continue;
        }
        for (const arrow of arrowList) {
            const end = nameOf(arrow.endBinding?.elementId);
            if (arrow.startBinding?.elementId === box.id && end !== '') {
                lines.push(`${name} -> ${end}`);
            }
        }
    }
    const layout = (NOTE_DRAWING_LAYOUT_LIST as readonly string[]).includes(
        data?.layout,
    )
        ? (data!.layout as NoteDrawingLayoutType)
        : 'down';
    const xs = elements.flatMap((element) => {
        return [element.x, element.x + Math.abs(element.width ?? 0)];
    });
    const ys = elements.flatMap((element) => {
        return [element.y, element.y + Math.abs(element.height ?? 0)];
    });
    const spanOf = (values: number[]) => {
        const numbers = values.filter(Number.isFinite);
        return numbers.length === 0
            ? 0
            : Math.max(...numbers) - Math.min(...numbers);
    };
    return {
        isOwn,
        lines,
        layout,
        fill:
            typeof boxList[0]?.backgroundColor === 'string'
                ? boxList[0].backgroundColor
                : null,
        stroke:
            typeof boxList[0]?.strokeColor === 'string'
                ? boxList[0].strokeColor
                : null,
        sceneWidth: spanOf(xs),
        sceneHeight: spanOf(ys),
    };
}

/**
 * A drawing in a note changed: drawn again from new lines (only one made of
 * boxes and arrows -- what a person drew by hand would be lost), its boxes
 * filled and its lines coloured, or made larger or smaller. The note's
 * width and height are how large the board draws it, so a size scales
 * those, and a drawing drawn again keeps the scale it had.
 */
export function changeNoteDrawingNode(
    node: NodeType,
    change: {
        text?: string;
        fill?: string;
        stroke?: string;
        size?: 'larger' | 'smaller';
    },
    context: NoteDrawingContextType = {},
): { node: NodeType } | { reason: string } {
    const scene = readNoteDrawingScene(node);
    const naturalWidth = scene.sceneWidth + 40;
    const oldWidth = Number.isFinite(node.width) ? node.width : naturalWidth;
    const oldHeight = Number.isFinite(node.height)
        ? node.height
        : scene.sceneHeight + 40;
    let newNode: NodeType;
    if (change.text !== undefined) {
        if (!scene.isOwn) {
            return {
                reason:
                    'That drawing was drawn by hand: drawing it again from ' +
                    'lines would lose what was drawn. Add a new drawing ' +
                    'instead, colour it, or make it larger or smaller.',
            };
        }
        const drawn = genNoteDrawingNode(change.text, {
            ...context,
            fill: change.fill ?? scene.fill ?? undefined,
            stroke: change.stroke ?? scene.stroke ?? undefined,
            layout: scene.layout,
        });
        if ('reason' in drawn) {
            return drawn;
        }
        newNode = drawn.node;
        const scale = naturalWidth > 0 ? oldWidth / naturalWidth : 1;
        if (Math.abs(scale - 1) > 0.01) {
            newNode.width = Math.round(newNode.width * scale);
            newNode.height = Math.round(newNode.height * scale);
        }
    } else {
        newNode = { ...node, width: oldWidth, height: oldHeight };
        if (change.fill !== undefined || change.stroke !== undefined) {
            const data = readDrawingData(node);
            if (data === null || !Array.isArray(data.elements)) {
                return { reason: 'That drawing could not be read.' };
            }
            const textColor =
                change.fill !== undefined && checkIsDarkColor(change.fill)
                    ? LIGHT_TEXT_COLOR
                    : change.fill !== undefined
                      ? TEXT_COLOR
                      : null;
            data.elements = data.elements.map((element: NodeType) => {
                if (element === null || element.isDeleted) {
                    return element;
                }
                const isBox = BOX_TYPE_SET.has(element.type);
                const isBoxText =
                    element.type === 'text' &&
                    data.elements.some((one: NodeType) => {
                        return (
                            BOX_TYPE_SET.has(one?.type) &&
                            one.id === element.containerId
                        );
                    });
                return {
                    ...element,
                    ...(isBox && change.fill !== undefined
                        ? { backgroundColor: change.fill }
                        : {}),
                    ...(element.type !== 'text' && change.stroke !== undefined
                        ? { strokeColor: change.stroke }
                        : {}),
                    ...(isBoxText && textColor !== null
                        ? { strokeColor: textColor }
                        : {}),
                };
            });
            newNode.data = JSON.stringify(data);
        }
    }
    if (change.size !== undefined) {
        const factor =
            change.size === 'larger'
                ? DRAWING_SCALE_FACTOR
                : 1 / DRAWING_SCALE_FACTOR;
        const width = Math.round(
            Math.min(
                DRAWING_MAX_WIDTH,
                Math.max(DRAWING_MIN_WIDTH, newNode.width * factor),
            ),
        );
        newNode.height = Math.round(newNode.height * (width / newNode.width));
        newNode.width = width;
    }
    return { node: newNode };
}

/**
 * The words a read shows for a drawing: the lines that draw it (its layout
 * first when not down), or -- for one drawn by hand -- how many shapes and
 * their words.
 */
export function toNoteDrawingText(node: NodeType): string {
    const scene = readNoteDrawingScene(node);
    if (scene.isOwn && scene.lines.length > 0) {
        return [
            ...(scene.layout === 'down' ? [] : [`layout: ${scene.layout}`]),
            ...scene.lines,
        ].join('\n');
    }
    const data = readDrawingData(node);
    if (data === null) {
        return '';
    }
    const elements: NodeType[] = Array.isArray(data?.elements)
        ? data.elements.filter((element: NodeType) => !element.isDeleted)
        : [];
    const words = elements
        .filter((element) => {
            return element.type === 'text' && typeof element.text === 'string';
        })
        .map((element) => {
            return String(element.text).replace(/\s+/g, ' ').trim();
        })
        .filter((one) => one !== '');
    const shapeCount = elements.filter((element) => {
        return element.type !== 'text';
    }).length;
    return (
        `${shapeCount} shape${shapeCount === 1 ? '' : 's'}` +
        (words.length > 0 ? `: ${words.join(' | ').slice(0, 400)}` : '')
    );
}
