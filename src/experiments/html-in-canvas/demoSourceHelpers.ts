/**
 * Pulls the real source of a demo out of its own file so every section can
 * show the code that produced the preview it sits under.
 *
 * Reading the source rather than keeping a hand-written copy means the listing
 * can never drift from what actually runs. The raw text is loaded lazily — one
 * file at a time, only when a section that needs it is opened — so a visitor
 * who never leaves the first demo never pays for the other eleven files.
 */

const SOURCE_LOADER_MAP = import.meta.glob('./*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
}) as Record<string, () => Promise<string>>;

export type SourceBlockType = {
    fileName: string;
    symbol: string;
    code: string;
};

/**
 * A source reference is `<fileName>#<symbol>`, e.g.
 * `basicsDemos.tsx#BasicDrawComp`.
 */
function parseReference(reference: string) {
    const [fileName, symbol] = reference.split('#');
    return { fileName, symbol };
}

function toStartPattern(symbol: string) {
    return new RegExp(
        `^(?:export\\s+)?(?:async\\s+)?` +
            `(?:function|const|let|type|class)\\s+${symbol}\\b`,
    );
}

/**
 * Bracket depth added by one line, ignoring quoted text and line comments.
 * Template literals are counted as ordinary code: their `${...}` holes are
 * balanced, so the running depth still returns to zero in the right place.
 */
function getDepthDelta(line: string) {
    let delta = 0;
    let quote = '';
    for (let index = 0; index < line.length; index += 1) {
        const character = line[index];
        if (quote !== '') {
            if (character === '\\') {
                index += 1;
            } else if (character === quote) {
                quote = '';
            }
            continue;
        }
        if (character === "'" || character === '"') {
            quote = character;
        } else if (character === '/' && line[index + 1] === '/') {
            break;
        } else if ('{[('.includes(character)) {
            delta += 1;
        } else if ('}])'.includes(character)) {
            delta -= 1;
        }
    }
    return delta;
}

/** Include a doc comment that sits directly on top of the declaration. */
function extendToLeadingComment(lineList: string[], startIndex: number) {
    let index = startIndex;
    while (index > 0) {
        const previous = lineList[index - 1].trim();
        if (previous.startsWith('//')) {
            index -= 1;
            continue;
        }
        if (previous.endsWith('*/')) {
            let commentIndex = index - 1;
            while (
                commentIndex > 0 &&
                !lineList[commentIndex].trim().startsWith('/*')
            ) {
                commentIndex -= 1;
            }
            index = commentIndex;
            continue;
        }
        break;
    }
    return index;
}

export function extractSymbol(source: string, symbol: string) {
    const lineList = source.split('\n');
    const startPattern = toStartPattern(symbol);
    const startIndex = lineList.findIndex((line) => {
        return startPattern.test(line);
    });
    if (startIndex === -1) {
        return null;
    }
    let depth = 0;
    let endIndex = -1;
    for (let index = startIndex; index < lineList.length; index += 1) {
        depth += getDepthDelta(lineList[index]);
        if (depth <= 0) {
            endIndex = index;
            break;
        }
    }
    if (endIndex === -1) {
        return null;
    }
    const firstIndex = extendToLeadingComment(lineList, startIndex);
    return lineList.slice(firstIndex, endIndex + 1).join('\n');
}

async function loadSourceBlock(reference: string): Promise<SourceBlockType> {
    const { fileName, symbol } = parseReference(reference);
    const loadSource = SOURCE_LOADER_MAP[`./${fileName}`];
    if (loadSource === undefined) {
        return {
            fileName,
            symbol,
            code: `// missing source file: ${fileName}`,
        };
    }
    const source = await loadSource();
    const code = extractSymbol(source, symbol);
    return {
        fileName,
        symbol,
        code: code ?? `// "${symbol}" not found in ${fileName}`,
    };
}

export function loadSourceBlockList(referenceList: string[]) {
    return Promise.all(referenceList.map(loadSourceBlock));
}

/** Shown collapsed under every demo — the pieces every snippet leans on. */
export const SHARED_SOURCE_LIST = [
    'htmlInCanvasHelpers.ts#getHicContext',
    'htmlInCanvasHelpers.ts#runDrawGuarded',
    'htmlInCanvasHelpers.ts#withSlideSpace',
    'htmlInCanvasHooks.ts#useHicCanvas',
    'htmlInCanvasHooks.ts#useAfterRenderingUpdate',
    'htmlInCanvasHooks.ts#useAnimationLoop',
];
