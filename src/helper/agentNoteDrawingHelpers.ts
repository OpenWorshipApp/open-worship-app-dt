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
 */

type NodeType = Record<string, any>;

export type NoteDrawingContextType = {
    now?: Date;
    genId?: () => string;
    genSeed?: () => number;
};

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

/** The boxes and arrows a drawing's lines describe, or why not. */
export function readNoteDrawingLines(text: string) {
    const lines = text
        .split(/\n|;/)
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
            return line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim();
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
    return { names, arrows };
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

/**
 * An `excalidraw` node for a drawing described in lines, or why not.
 */
export function genNoteDrawingNode(
    text: string,
    context: NoteDrawingContextType = {},
): { node: NodeType } | { reason: string } {
    const read = readNoteDrawingLines(text);
    if (read.reason !== undefined) {
        return { reason: read.reason };
    }
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
    // Rows centred on the widest; each row below the one above it.
    const levels = [...rowMap.keys()].sort((one, other) => one - other);
    const rowWidth = (row: BoxType[]) => {
        return (
            row.reduce((sum, box) => sum + box.width, 0) +
            COLUMN_GAP * (row.length - 1)
        );
    };
    const totalWidth = Math.max(
        ...levels.map((level) => rowWidth(rowMap.get(level)!)),
    );
    let y = 0;
    for (const level of levels) {
        const row = rowMap.get(level)!;
        let x = (totalWidth - rowWidth(row)) / 2;
        const rowHeight = Math.max(...row.map((box) => box.height));
        for (const box of row) {
            box.x = Math.round(x);
            box.y = y + Math.round((rowHeight - box.height) / 2);
            x += box.width + COLUMN_GAP;
        }
        y += rowHeight + ROW_GAP;
    }
    const totalHeight = y - ROW_GAP;
    const elements: NodeType[] = [];
    const base = () => {
        return {
            angle: 0,
            strokeColor: STROKE_COLOR,
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
        const isDown = end.level > start.level;
        const startX = isDown
            ? start.x + start.width / 2
            : start.x + start.width;
        const startY = isDown
            ? start.y + start.height + ARROW_GAP
            : start.y + start.height / 2;
        const endX = isDown
            ? end.x + end.width / 2
            : end.x >= start.x
              ? end.x - ARROW_GAP
              : end.x + end.width + ARROW_GAP;
        const endY = isDown ? end.y - ARROW_GAP : end.y + end.height / 2;
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
            backgroundColor: BOX_BACKGROUND,
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
            strokeColor: TEXT_COLOR,
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

/** The words a read shows for a drawing: its boxes, and its arrows. */
export function toNoteDrawingText(node: NodeType): string {
    let data: any;
    try {
        data = JSON.parse(String(node.data ?? ''));
    } catch (_error) {
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
