/**
 * The words a reader SEES in a study's mermaid diagram, by its kind: what
 * the window's translator is told to translate, and what is read back to
 * tell a label left as it was (EC-533).
 *
 * Found 2026-11-12 on the user's own John 3 study, its Khmer half
 * translated by the window: the timeline's three periods ("John's
 * Ministry", "Overlap", "Jesus' Supremacy") and the mindmap's four
 * branches ("Spiritual Rebirth" …) were still English, the words beside
 * them translated. The translator had been told "the words after a colon
 * in a timeline or a mindmap" -- a timeline's period stands BEFORE its
 * colon and a mindmap's node has none -- and a diagram that drew was taken
 * whatever it said.
 *
 * Pure: no app module, so the help window's tests read it as it runs.
 */

/** A diagram's kind: the first word of its first line that says one. */
export function readStudyDiagramKind(source: string) {
    for (const line of source.split('\n')) {
        const trimmed = line.trim();
        if (trimmed === '' || trimmed.startsWith('%%')) {
            continue;
        }
        return trimmed.split(/\s+/)[0];
    }
    return '';
}

const SEEN_WORDS_TEXT_MAP: Record<string, string> = {
    flowchart:
        'the words in brackets, braces, parentheses and quotes, the words ' +
        'of an arrow between | marks or in quotes, and the title of a ' +
        'subgraph in brackets or quotes',
    sequenceDiagram:
        'the title, the words after the colon of each message and note, ' +
        'each name after `as` -- never the id before it, which the arrows ' +
        'use -- and the words after loop, alt, else, opt, par, and, ' +
        'critical, option and break',
    timeline:
        'the title, each section name, and every period and event: the ' +
        'words BEFORE each colon as well as after it',
    mindmap:
        'every node: the words inside its brackets when it has them, else ' +
        'the whole line -- but never a line that starts with ::',
    journey:
        'the title, each section name, each task before its first colon ' +
        'and the names after its second',
    pie: 'the title and each label in quotes',
    stateDiagram:
        'the words in quotes, the words after each colon and the words ' +
        'of a note',
    quadrantChart:
        'the title, the words on both ends of each axis, each quadrant ' +
        'name and each point name before its colon',
};
SEEN_WORDS_TEXT_MAP.graph = SEEN_WORDS_TEXT_MAP.flowchart;
SEEN_WORDS_TEXT_MAP['stateDiagram-v2'] = SEEN_WORDS_TEXT_MAP.stateDiagram;

/** What the translator is told to translate in a diagram of this kind. */
export function toStudyDiagramSeenWordsText(source: string) {
    return (
        SEEN_WORDS_TEXT_MAP[readStudyDiagramKind(source)] ??
        'the labels in quotes and brackets, the words after a colon, a title'
    );
}

const QUOTED_PATTERN = /"([^"\n]*)"/g;
const PIPED_PATTERN = /\|([^|\n]*)\|/g;
// The innermost bracket of any kind: a shape (( )) or [[ ]] reads as the
// words inside it.
const INNER_BRACKET_PATTERN = /\[([^[\]\n]*)\]|\(([^()\n]*)\)|\{([^{}\n]*)\}/;

// The words a line carries in quotes, between | marks and in brackets,
// each once, the innermost bracket's words alone.
function readMarkedWords(line: string) {
    const wordList: string[] = [];
    let rest = line.replace(QUOTED_PATTERN, (_whole, words: string) => {
        wordList.push(words);
        return ' ';
    });
    rest = rest.replace(PIPED_PATTERN, (_whole, words: string) => {
        wordList.push(words);
        return ' ';
    });
    for (let count = 0; count < 20; count++) {
        const match = INNER_BRACKET_PATTERN.exec(rest);
        if (match === null) {
            break;
        }
        const inner = match[1] ?? match[2] ?? match[3] ?? '';
        if (inner.trim() !== '') {
            wordList.push(inner);
        }
        rest =
            rest.slice(0, match.index) +
            ' ' +
            rest.slice(match.index + match[0].length);
    }
    return wordList;
}

// The words after a keyword that leads its line (`title …`).
function readAfterKeyword(line: string, keyword: string) {
    const pattern = new RegExp(`^${keyword}\\s+(.+)$`);
    const match = pattern.exec(line);
    return match === null ? null : match[1];
}

const FLOW_SKIP_PATTERN =
    /^(?:classDef|class|style|linkStyle|click|direction|end)\b/;

// A bare `subgraph Name` is its id as well as its title, and the arrows
// name it: only a title in brackets or quotes is words to translate.
function readFlowchartLine(line: string) {
    if (FLOW_SKIP_PATTERN.test(line)) {
        return [];
    }
    return readMarkedWords(line);
}

const SEQUENCE_BLOCK_PATTERN =
    /^(?:loop|alt|else|opt|par|and|critical|option|break)\s+(.+)$/;

// A participant declared -- `participant Id`, `actor Id as Name`, or made
// on the way with `create` -- its keywords in any case, as mermaid reads
// them. An id may hold spaces; a name runs to the end of its line.
const SEQUENCE_DECLARE_PATTERN =
    /^((?:create\s+)?(?:participant|actor)\s+)(.+?)(?:\s+as\s+(.+))?$/i;
// One given a kind of box (`participant Db@{ "type": "database" }`).
const SEQUENCE_TYPED_PATTERN =
    /^((?:create\s+)?(?:participant|actor)\s+)(.+?)\s*@\{/i;

type SequenceDeclareType = {
    head: string;
    id: string;
    name: string | null;
    /** Given a kind of box: left as written, never named here. */
    isTyped: boolean;
};

function readSequenceDeclare(line: string): SequenceDeclareType | null {
    const typed = SEQUENCE_TYPED_PATTERN.exec(line);
    if (typed !== null) {
        return { head: typed[1], id: typed[2], name: null, isTyped: true };
    }
    const match = SEQUENCE_DECLARE_PATTERN.exec(line);
    if (match === null) {
        return null;
    }
    return {
        head: match[1],
        id: match[2].trim(),
        name: match[3]?.trim() ?? null,
        isTyped: false,
    };
}

// A message's arrow, of two at one place the longer first: a line or a
// dotted line, with a head, a cross or an open end, and both ways.
const SEQUENCE_ARROW_PATTERN = /<<-->>|<<->>|-->>|->>|-->|->|--x|-x|--\)|-\)/;
// A line led by a keyword is no message, whatever arrow its words hold.
const SEQUENCE_KEYWORD_PATTERN =
    /^(?:title|acc\w*|autonumber|activate|deactivate|destroy|create|participant|actor|rect|box|end|links?|properties|details|loop|alt|else|opt|par(?:_over)?|and|critical|option|break|note)\b/i;
const SEQUENCE_NOTE_PATTERN =
    /^note\s+(?:(?:left|right)\s+of|over)\s+([^:]+?)\s*:/i;

// The sender and the receiver of a message, a receiver's `+` or `-` (its
// bar of activity) aside.
function readSequenceMessage(line: string) {
    if (SEQUENCE_KEYWORD_PATTERN.test(line)) {
        return null;
    }
    const arrow = SEQUENCE_ARROW_PATTERN.exec(line);
    if (arrow === null) {
        return null;
    }
    const from = line.slice(0, arrow.index).trim();
    const after = line.slice(arrow.index + arrow[0].length);
    const colon = after.indexOf(':');
    const to = (colon < 0 ? after : after.slice(0, colon))
        .trim()
        .replace(/^[+-]\s*/, '');
    if (from === '' || to === '' || from.includes(':')) {
        return null;
    }
    return { from, to };
}

// The participants a line names, in the order mermaid meets them: one
// declared, a message's sender then its receiver, those a note stands by.
function readSequenceLineIds(line: string) {
    const declared = readSequenceDeclare(line);
    if (declared !== null) {
        return [declared.id];
    }
    const message = readSequenceMessage(line);
    if (message !== null) {
        return [message.from, message.to];
    }
    const note = SEQUENCE_NOTE_PATTERN.exec(line);
    if (note === null) {
        return [];
    }
    return note[1]
        .split(',')
        .map((id) => {
            return id.trim();
        })
        .filter((id) => {
            return id !== '';
        });
}

function readSequenceLine(line: string) {
    const declared = readSequenceDeclare(line);
    if (declared !== null) {
        return declared.name === null ? [] : [declared.name];
    }
    const titled = readAfterKeyword(line, 'title');
    if (titled !== null) {
        return [titled];
    }
    const block = SEQUENCE_BLOCK_PATTERN.exec(line);
    if (block !== null) {
        return [block[1]];
    }
    // A message or a note: its words after the first colon.
    if (
        SEQUENCE_NOTE_PATTERN.test(line) ||
        readSequenceMessage(line) !== null
    ) {
        const colon = line.indexOf(':');
        return colon < 0 ? [] : [line.slice(colon + 1)];
    }
    return [];
}

// A diagram's lines after the one naming its kind, with no blank line or
// comment.
function listBodyLines(source: string) {
    const lineList = source.split('\n').map((line) => {
        return line.trim();
    });
    const kindAt = lineList.findIndex((line) => {
        return line !== '' && !line.startsWith('%%');
    });
    return lineList.slice(kindAt + 1).filter((line) => {
        return line !== '' && !line.startsWith('%%');
    });
}

// The participants drawn by a name of their own: given one after `as`
// somewhere, or a kind of box, which is left as written.
function listNamedSequenceIds(source: string) {
    const idSet = new Set<string>();
    for (const line of listBodyLines(source)) {
        const declared = readSequenceDeclare(line);
        if (declared !== null && (declared.name !== null || declared.isTyped)) {
            idSet.add(declared.id);
        }
    }
    return idSet;
}

// A sequence diagram's line reader: a participant with no name of its own
// is drawn by its id, so that id is a label the first time a line names
// it (EC-582).
function genSequenceLineReader(source: string) {
    const namedSet = listNamedSequenceIds(source);
    return (line: string) => {
        return [
            ...readSequenceLineIds(line).filter((id) => {
                return !namedSet.has(id);
            }),
            ...readSequenceLine(line),
        ];
    };
}

/**
 * A sequence diagram's participants by their ids, each once, in the order
 * mermaid draws their boxes: where each is first declared or named.
 * Another kind has none.
 */
export function listStudySequenceIds(source: string) {
    if (readStudyDiagramKind(source) !== 'sequenceDiagram') {
        return [];
    }
    const idSet = new Set<string>();
    for (const line of listBodyLines(source)) {
        for (const id of readSequenceLineIds(line)) {
            idSet.add(id);
        }
    }
    return [...idSet];
}

// A line's indent and its end, as written.
function readLineEdges(rawLine: string) {
    const ending = rawLine.endsWith('\r') ? '\r' : '';
    const indent = rawLine.slice(
        0,
        rawLine.length - rawLine.trimStart().length,
    );
    return { indent, ending };
}

/**
 * A sequence diagram with every participant that is drawn by its id given
 * that id as its name after `as`, for the translator (EC-582). Found
 * 2026-11-13 on the user's own Genesis 4 study, its words put into Khmer
 * by the window: the messages were Khmer and the three boxes above and
 * below them still read "God", "Cain" and "Abel". Those were ids written
 * straight into the messages (`God->>Cain: …`), which the translator is
 * told to keep -- the arrows name them -- and no check read them.
 *
 * A bare `participant Id` becomes `participant Id as Id`; one only named
 * by a message or a note is declared so right before the line that first
 * names it, the sender before the receiver, so every box keeps its place.
 * Ids, arrows and a participant given a name or a kind of box are left as
 * written; another kind of diagram is given back as it is.
 */
export function withStudySequenceNames(source: string) {
    if (readStudyDiagramKind(source) !== 'sequenceDiagram') {
        return source;
    }
    const namedSet = listNamedSequenceIds(source);
    // Declared anywhere: declared there, never again here.
    const seenSet = new Set<string>();
    for (const line of listBodyLines(source)) {
        const declared = readSequenceDeclare(line);
        if (declared !== null) {
            seenSet.add(declared.id);
        }
    }
    const outList: string[] = [];
    let isPastKind = false;
    for (const rawLine of source.split('\n')) {
        const line = rawLine.trim();
        if (line === '' || line.startsWith('%%') || !isPastKind) {
            isPastKind = isPastKind || (line !== '' && !line.startsWith('%%'));
            outList.push(rawLine);
            continue;
        }
        const { indent, ending } = readLineEdges(rawLine);
        const declared = readSequenceDeclare(line);
        if (declared !== null) {
            outList.push(
                declared.isTyped || namedSet.has(declared.id)
                    ? rawLine
                    : `${indent}${line} as ${declared.id}${ending}`,
            );
            continue;
        }
        for (const id of readSequenceLineIds(line)) {
            if (!seenSet.has(id)) {
                seenSet.add(id);
                outList.push(`${indent}participant ${id} as ${id}${ending}`);
            }
        }
        outList.push(rawLine);
    }
    return outList.join('\n');
}

/**
 * A translated sequence diagram with each declared participant's id put
 * back as `source` wrote it, by their order (EC-582): asked for the name
 * after `as`, a translator may write the id before it in the language too
 * -- and an arrow still naming the old id would draw a second box. An id
 * translated with no name after it is that name. Given back as it is when
 * the two declare a different number of participants.
 */
export function keepStudySequenceIds(source: string, translated: string) {
    if (readStudyDiagramKind(source) !== 'sequenceDiagram') {
        return translated;
    }
    const idList = listBodyLines(source).flatMap((line) => {
        const declared = readSequenceDeclare(line);
        return declared === null ? [] : [declared.id];
    });
    const lineList = translated.split('\n');
    const atList = lineList.flatMap((rawLine, index) => {
        return readSequenceDeclare(rawLine.trim()) === null ? [] : [index];
    });
    if (atList.length !== idList.length) {
        return translated;
    }
    atList.forEach((lineIndex, order) => {
        const rawLine = lineList[lineIndex];
        const declared = readSequenceDeclare(rawLine.trim());
        const id = idList[order];
        if (declared === null || declared.isTyped || declared.id === id) {
            return;
        }
        const { indent, ending } = readLineEdges(rawLine);
        lineList[lineIndex] =
            `${indent}${declared.head}${id} as ` +
            `${declared.name ?? declared.id}${ending}`;
    });
    return lineList.join('\n');
}

function readTimelineLine(line: string) {
    const titled =
        readAfterKeyword(line, 'title') ?? readAfterKeyword(line, 'section');
    if (titled !== null) {
        return [titled];
    }
    return line.split(':');
}

function readMindmapLine(line: string) {
    if (line.startsWith('::')) {
        return [];
    }
    const node = line.replace(/:::.*$/, '');
    const marked = readMarkedWords(node);
    return marked.length > 0 ? marked : [node];
}

function readJourneyLine(line: string) {
    const titled =
        readAfterKeyword(line, 'title') ?? readAfterKeyword(line, 'section');
    if (titled !== null) {
        return [titled];
    }
    const [task = '', _score, names = ''] = line.split(':');
    return [task, ...names.split(',')];
}

function readPieLine(line: string) {
    const titled = readAfterKeyword(line, 'title');
    if (titled !== null) {
        return [titled];
    }
    return [...line.matchAll(QUOTED_PATTERN)].map((match) => {
        return match[1];
    });
}

function readStateLine(line: string) {
    const wordList = [...line.matchAll(QUOTED_PATTERN)].map((match) => {
        return match[1];
    });
    const rest = line.replace(QUOTED_PATTERN, ' ');
    const colon = rest.indexOf(':');
    if (colon >= 0) {
        wordList.push(rest.slice(colon + 1));
    }
    return wordList;
}

function readQuadrantLine(line: string) {
    const titled = readAfterKeyword(line, 'title');
    if (titled !== null) {
        return [titled];
    }
    const axis = /^[xy]-axis\s+(.+)$/.exec(line);
    if (axis !== null) {
        return axis[1].split('-->');
    }
    const quadrant = /^quadrant-\d\s+(.+)$/.exec(line);
    if (quadrant !== null) {
        return [quadrant[1]];
    }
    const point = /^([^:]+):\s*\[/.exec(line);
    return point === null ? [] : [point[1]];
}

const LINE_READER_MAP: Record<string, (line: string) => string[]> = {
    flowchart: readFlowchartLine,
    graph: readFlowchartLine,
    timeline: readTimelineLine,
    mindmap: readMindmapLine,
    journey: readJourneyLine,
    pie: readPieLine,
    stateDiagram: readStateLine,
    'stateDiagram-v2': readStateLine,
    quadrantChart: readQuadrantLine,
};

// A label as it is compared: no quote marks or shape edges round it -- a
// cylinder's `[(…)]` reads as its words.
function toCleanLabel(words: string) {
    return words.replace(/^[\s"'`([{]+|[\s"'`)\]}]+$/g, '');
}

/**
 * Every label a reader sees in a diagram, by its kind, each once, in the
 * order written: the words this module tells the translator to translate.
 * A kind it does not know has none -- nothing is judged that is not read.
 */
export function listStudyDiagramLabels(source: string) {
    const kind = readStudyDiagramKind(source);
    const readLine =
        kind === 'sequenceDiagram'
            ? genSequenceLineReader(source)
            : LINE_READER_MAP[kind];
    if (readLine === undefined) {
        return [];
    }
    const labelSet = new Set<string>();
    let isPastKind = false;
    for (const rawLine of source.split('\n')) {
        const line = rawLine.trim();
        if (line === '' || line.startsWith('%%')) {
            continue;
        }
        if (!isPastKind) {
            isPastKind = true;
            // `pie title …` names its title on the kind's own line.
            const titled = /^pie\b.*?\btitle\s+(.+)$/.exec(line);
            if (titled !== null) {
                labelSet.add(toCleanLabel(titled[1]));
            }
            continue;
        }
        for (const words of readLine(line)) {
            const label = toCleanLabel(words);
            if (/\p{L}/u.test(label)) {
                labelSet.add(label);
            }
        }
    }
    return [...labelSet];
}

// An all-capital word of up to five letters: a Bible's key or an
// abbreviation (KJV, AMP), written so in any language.
const ABBREVIATION_PATTERN = /\b[A-Z]{2,5}\b/g;
const LATIN_WORD_PATTERN = /\p{Script=Latin}{2,}/u;
const LABEL_WORD_PATTERN = /\p{L}{3,}/gu;

function toCompareKey(label: string) {
    return label.toLowerCase().replace(/\s+/g, ' ');
}

/**
 * The labels of a translated diagram left as they were, each once. Into a
 * language with a script of its own (`scriptPattern`): a label written in
 * Latin letters with none of that script -- a person's name too, since
 * such a language writes names in its own letters -- an abbreviation
 * aside. Into one written in Latin letters: a label of two words or more
 * that is word for word one of the diagram's own (a single word may fairly
 * be the same in both).
 */
export function listStudyDiagramLeftLabels(
    source: string,
    translated: string,
    scriptPattern: RegExp | null,
) {
    const labelList = listStudyDiagramLabels(translated);
    if (scriptPattern !== null) {
        const pattern = new RegExp(scriptPattern.source, 'u');
        return labelList.filter((label) => {
            return (
                !pattern.test(label) &&
                LATIN_WORD_PATTERN.test(
                    label.replace(ABBREVIATION_PATTERN, ' '),
                )
            );
        });
    }
    const sourceKeySet = new Set(
        listStudyDiagramLabels(source).map(toCompareKey),
    );
    return labelList.filter((label) => {
        return (
            sourceKeySet.has(toCompareKey(label)) &&
            (label.match(LABEL_WORD_PATTERN) ?? []).length >= 2
        );
    });
}
