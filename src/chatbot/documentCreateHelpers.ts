/**
 * A NEW presenting flow or slide document asked for in an ordinary chat
 * (2026-11-12, EC-468 and EC-514; the user's goal: _chatbot will be very
 * smart to help user create presenter documents, background resources,
 * presenting flow, bible item_). On Auto the shared server gets the lean
 * tool list, which holds no tool that makes a file, so _Make a new
 * presenting flow for Sunday with Amazing Grace, John 3:16 and a 5 minute
 * countdown_ was answered with steps to do it by hand, and _Make a new slide
 * document called Sunday Welcome …_ with "could not settle on an answer".
 *
 * The window does what the conversation on an attached file cannot: it
 * makes the EMPTY file itself (`owa_presenting_flow create`,
 * `owa_slide_file create`), attaches it to the question, and the question
 * goes on as that file's own conversation (`flowChatHelpers.ts`,
 * `slideChatHelpers.ts`), whose tool and prompt already build a running
 * order or slides from words -- with `genDocumentCreateHint` said to the
 * model beside it. Asked for the file and nothing in it, the window answers
 * alone: the file made, then its card. **Undo this change** under the answer
 * takes the file away again with whatever was put in it
 * (`withCreatedUndoAction`).
 *
 * English in code; another language's words are filed as EC-516. Pure,
 * every rule a test: no store, no tool call, no model.
 */
import type { BotActionType } from './helpBotHelpers';
import { LYRIC_UNDO_LABEL, LYRIC_UNDO_TOOL_NAME } from './lyricChatHelpers';

export type DocumentCreateKindType = 'flow' | 'slide';

export type DocumentCreateAskType = {
    kind: DocumentCreateKindType;
    /** The name they gave ("called Evening Service"), else null. */
    name: string | null;
    /** A day or a feast it is for ("for Sunday"), a name when none is given. */
    dayName: string | null;
    /** Whether they asked for anything IN it, beyond the file itself. */
    hasContent: boolean;
};

/** The file the window made for a question, as the answer's Undo takes it. */
export type CreatedDocumentType = {
    kind: DocumentCreateKindType;
    name: string;
    filePath: string;
    undoId: string | null;
};

/** The tool that makes an empty file of each kind, and what it is given. */
export const DOCUMENT_CREATE_TOOL_MAP: Record<
    DocumentCreateKindType,
    { toolName: string; genArgs: (name: string) => Record<string, string> }
> = {
    flow: {
        toolName: 'owa_presenting_flow',
        genArgs: (name) => {
            return { action: 'create', name };
        },
    },
    slide: {
        toolName: 'owa_slide_file',
        genArgs: (name) => {
            return { action: 'create', name, content: '{"items":[]}' };
        },
    },
};

/** The panel each kind's row is in, by its English name (a dictionary key). */
export const DOCUMENT_CREATE_LIST_LABEL_MAP: Record<
    DocumentCreateKindType,
    string
> = {
    flow: 'Presenting Flows',
    slide: 'Documents',
};

const MAX_ASK_LENGTH = 2000;
const MAX_NAME_LENGTH = 60;

// A how-to is the guide's: "How do I make a new slide document?" is a
// supported question, and "can I" asks whether, not for one.
const HOW_TO_PATTERN =
    /^\s*(?:how|where|what|why|when|which|who|is there|are there|is it|does|do i|can i|could i|should i|may i|will it|would it)\b/i;
const REQUEST_VERB = String.raw`(?:make|create|start|build|set\s+up|prepare|draft|put\s+together|generate|write|need|want|give\s+me|give\s+us|get\s+me)`;
const COUNT_WORD = String.raw`(?:a|an|one|some|\d{1,2}|two|three|four|five|six|seven|eight|nine|ten|a\s+few|a\s+couple\s+of)`;
const NEW_WORD = String.raw`(?:new|another|fresh|blank|empty|separate|second)`;
const FLOW_NOUN = String.raw`(?:presenting[\s-]+flows?|running[\s-]+orders?|run[\s-]*sheets?|orders?\s+of\s+service|service\s+orders?)`;
const SLIDE_DOCUMENT_NOUN = String.raw`(?:slides?[\s-]*(?:documents?|docs?|decks?|shows?|files?)|slideshows?|presentations?)`;
const SLIDE_NOUN = String.raw`(?:slides?)`;
// Up to two words between the count and the noun: "a short welcome slide".
const BETWEEN = String.raw`(?:[\p{L}\p{N}'’-]+\s+){0,2}?`;

function genNounPattern(noun: string, isNewRequired: boolean) {
    const lead = isNewRequired
        ? String.raw`(?:${COUNT_WORD}\s+)?${NEW_WORD}\s+${BETWEEN}`
        : String.raw`(?:${COUNT_WORD}\s+(?:${NEW_WORD}\s+)?|${NEW_WORD}\s+)${BETWEEN}`;
    return new RegExp(
        String.raw`\b${REQUEST_VERB}\s+(?:(?:me|us|them)\s+)?(?:up\s+)?${lead}(${noun})\b`,
        'iu',
    );
}

const NAME_MARKER_PATTERN =
    /\b(?:called|named|titled|entitled|with\s+the\s+(?:name|title)|(?:name|call|title)\s+it)\s*:?\s*/iu;
const QUOTED_NAME_PATTERN = /^\s*["“'‘«]([^"”'’»\n]{1,80})["”'’»]/u;
// Where an unquoted name stops: the words that go on to say what is in it.
const NAME_STOP_PATTERN =
    /\s+(?:with|for|that|which|showing|saying|containing|including|having|from|using|and\s+(?:add|put|include|then|make|give)|then)\b|\s*[,;:!?\n]|\.(?:\s|$)/iu;
const DAY_PATTERN =
    /\bfor\s+(?:(?:this|next|the|our)\s+(?:coming\s+)?)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|easter(?:\s+sunday)?|good\s+friday|palm\s+sunday|christmas(?:\s+(?:eve|day))?|pentecost|new\s+year'?s?(?:\s+(?:eve|day))?|thanksgiving)(?:\s+(morning|evening|night|service|worship))?\b/iu;
// Words that leave nothing asked for when they are all that is left.
const EMPTY_WORD_SET = new Set([
    'a',
    'an',
    'the',
    'me',
    'us',
    'please',
    'pls',
    'now',
    'for',
    'you',
    'can',
    'could',
    'would',
    'will',
    'thanks',
    'thank',
    'new',
    'one',
    'and',
    'it',
    'just',
    'i',
    'we',
    'need',
    'want',
    'hi',
    'hello',
    'ok',
    'okay',
    'today',
]);

function toAskLine(text: string) {
    return String(text ?? '')
        .normalize('NFC')
        .replace(/\p{Cf}/gu, '')
        .replace(/[‘’ʼ]/g, "'")
        .trim();
}

function toTitleCase(words: string) {
    return words
        .toLowerCase()
        .split(/\s+/)
        .map((word) => {
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
}

/**
 * The name given in the words after what is asked for: `called Evening
 * Service`, `named "Youth Night"`, `call it Baptism`, or quoted right after
 * it. Where it starts and ends in those words too, so the rest can be read
 * without it. Shared with the Bibles list's asks (`bibleListAskHelpers.ts`).
 */
export function readAskedName(afterNoun: string): {
    name: string | null;
    start: number;
    end: number;
} {
    const marker = NAME_MARKER_PATTERN.exec(afterNoun);
    const quotedAtStart = QUOTED_NAME_PATTERN.exec(afterNoun);
    if (marker === null) {
        // `a new running order "Easter Sunday"`: quoted right after the noun.
        if (quotedAtStart !== null) {
            return {
                name: quotedAtStart[1].trim() || null,
                start: 0,
                end: quotedAtStart[0].length,
            };
        }
        return { name: null, start: -1, end: -1 };
    }
    const nameStart = marker.index + marker[0].length;
    const rest = afterNoun.slice(nameStart);
    const quoted = QUOTED_NAME_PATTERN.exec(rest);
    if (quoted !== null) {
        return {
            name: quoted[1].trim() || null,
            start: marker.index,
            end: nameStart + quoted[0].length,
        };
    }
    const stop = NAME_STOP_PATTERN.exec(rest);
    const raw = (stop === null ? rest : rest.slice(0, stop.index))
        .replace(/\s+please$/i, '')
        .replace(/[.\s]+$/, '')
        .trim();
    return {
        name: raw.length > 0 ? raw : null,
        start: marker.index,
        end: nameStart + (stop === null ? rest.length : stop.index),
    };
}

/** The day or feast a match of `DAY_PATTERN` names, as a name: "Easter Sunday". */
function toAskedDayName(day: RegExpExecArray | null) {
    return day === null
        ? null
        : toTitleCase([day[1], day[2]].filter(Boolean).join(' '));
}

/** "for Sunday", "for this Easter" in the words: the day as a name, or null. */
export function readAskedDayName(words: string) {
    return toAskedDayName(DAY_PATTERN.exec(words));
}

/**
 * Whether a line asks for a NEW presenting flow or slide document, and what
 * it is to be called. `openKinds`: the kinds of document already open in the
 * tab -- there, "make a slide …" is a slide for THAT document, so only "a
 * NEW slide document" (or another) makes one.
 */
export function readDocumentCreateAsk(
    text: string,
    openKinds: readonly DocumentCreateKindType[] = [],
): DocumentCreateAskType | null {
    const all = toAskLine(text);
    if (all === '' || all.startsWith('/') || all.length > MAX_ASK_LENGTH) {
        return null;
    }
    const [firstLine, ...moreLines] = all.split(/\r?\n/);
    const line = firstLine.trim();
    if (HOW_TO_PATTERN.test(line)) {
        return null;
    }
    const candidates: {
        kind: DocumentCreateKindType;
        match: RegExpExecArray;
    }[] = [];
    const tryNoun = (
        kind: DocumentCreateKindType,
        noun: string,
        isNewRequired: boolean,
    ) => {
        const match = genNounPattern(noun, isNewRequired).exec(line);
        if (match !== null) {
            candidates.push({ kind, match });
        }
    };
    const isFlowOpen = openKinds.includes('flow');
    const isSlideOpen = openKinds.includes('slide');
    tryNoun('flow', FLOW_NOUN, isFlowOpen);
    tryNoun('slide', SLIDE_DOCUMENT_NOUN, isSlideOpen);
    // Plain "slides" is a document only where none is open, and only when
    // no running order is asked for in the same breath ("a running order
    // with a welcome slide").
    if (!isSlideOpen) {
        tryNoun('slide', SLIDE_NOUN, false);
    }
    if (candidates.length === 0) {
        return null;
    }
    // The noun named first is what is made; a running order over a plain
    // slide named in it.
    candidates.sort((one, other) => {
        return one.match.index - other.match.index;
    });
    const flowCandidate = candidates.find((one) => {
        return one.kind === 'flow';
    });
    const picked =
        flowCandidate !== undefined &&
        candidates[0].kind === 'slide' &&
        /^slides?$/i.test(candidates[0].match[1])
            ? flowCandidate
            : candidates[0];
    const nounEnd = picked.match.index + picked.match[0].length;
    const afterNoun = line.slice(nounEnd);
    const named = readAskedName(afterNoun);
    const name =
        named.name !== null && named.name.length <= MAX_NAME_LENGTH
            ? named.name
            : null;
    const day = DAY_PATTERN.exec(afterNoun);
    const dayName = toAskedDayName(day);
    // What is left once the ask for the file, its name and its day are
    // taken out: anything more is something to put IN it.
    let leftAfter = afterNoun;
    const cuts: [number, number][] = [];
    if (named.start >= 0) {
        cuts.push([named.start, named.end]);
    }
    if (day !== null) {
        cuts.push([day.index, day.index + day[0].length]);
    }
    cuts.sort((one, other) => {
        return other[0] - one[0];
    });
    for (const [start, end] of cuts) {
        leftAfter = leftAfter.slice(0, start) + ' ' + leftAfter.slice(end);
    }
    const left = [
        line.slice(0, picked.match.index),
        leftAfter,
        ...moreLines,
    ].join(' ');
    const leftWords = left
        .toLowerCase()
        .split(/[^\p{L}\p{N}:]+/u)
        .filter((word) => {
            return word.length > 0 && !EMPTY_WORD_SET.has(word);
        });
    return {
        kind: picked.kind,
        name,
        dayName,
        hasContent: leftWords.length > 0,
    };
}

/** "2026-11-12", the day a file is made, as its default name carries it. */
export function toDocumentDayText(date: Date) {
    const pad = (value: number) => {
        return String(value).padStart(2, '0');
    };
    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-` +
        pad(date.getDate())
    );
}

/** The name a new file is given when the ask names none. */
export function genDefaultDocumentName(
    kind: DocumentCreateKindType,
    date: Date,
) {
    return `${kind === 'flow' ? 'Presenting Flow' : 'Slides'} ${toDocumentDayText(date)}`;
}

/**
 * `name`, or `name (2)`, `name (3)` … -- the first no file of the list has,
 * letter case aside (the tool never writes over a file, and two names a
 * case apart are one file on Windows and macOS).
 */
export function pickFreeDocumentName(
    name: string,
    takenNames: readonly string[],
) {
    const taken = new Set(
        takenNames.map((one) => {
            return String(one ?? '').toLowerCase();
        }),
    );
    if (!taken.has(name.toLowerCase())) {
        return name;
    }
    for (let count = 2; count < 100; count += 1) {
        const candidate = `${name} (${count})`;
        if (!taken.has(candidate.toLowerCase())) {
            return candidate;
        }
    }
    return `${name} (${Date.now()})`;
}

/**
 * What the model is told beside their words when the window made the file
 * for them: it is new and empty, so build into it -- never make another or
 * say how to make one by hand.
 */
export function genDocumentCreateHint(
    kind: DocumentCreateKindType,
    name: string,
) {
    if (kind === 'flow') {
        return (
            `(They asked for a NEW running order, and the window has just ` +
            `made it for them: the presenting flow "${name}", empty, ` +
            'attached below. Do not make another and do not tell them how ' +
            `to make one: build what they asked for into "${name}" now, in ` +
            'ONE update-lines call, in the order they gave. Say in your ' +
            'answer what you put in it and which items had no document to ' +
            'match. When they named nothing to put in it, ask what goes in ' +
            'it and end with OPTIONS.)'
        );
    }
    return (
        `(They asked for a NEW slide document, and the window has just made ` +
        `it for them: "${name}", empty, attached below. Do not make another ` +
        'and do not tell them how to make one: add the slides they asked ' +
        `for to "${name}" now, in ONE add-slides call, each slide with its ` +
        'words in its text box. A Bible verse they name is read with ' +
        'owa_find_verse `refs` and written as it reads there, its ' +
        'reference under it -- never from memory. Say in your answer which ' +
        'slides you made. When they named nothing to put on it, ask what ' +
        'goes on it and end with OPTIONS.)'
    );
}

/**
 * The answer's buttons with the file's own making folded into its **Undo
 * this change**: the made file is the oldest change, so the press takes back
 * what was put in it and then the file. With no change made in it, the
 * button takes the file away alone. `madeId` tells the press to say the file
 * is gone, not "back as it was", and `madePath` which file to take out of
 * the box, where a file asked for with nothing in it waits.
 */
export function withCreatedUndoAction(
    actions: readonly BotActionType[],
    created: CreatedDocumentType,
): BotActionType[] {
    if (created.undoId === null) {
        return [...actions];
    }
    let isFolded = false;
    const folded = actions.map((action) => {
        if (
            isFolded ||
            action.toolName !== LYRIC_UNDO_TOOL_NAME ||
            String(action.args?.name ?? '') !== created.name
        ) {
            return action;
        }
        isFolded = true;
        const ids: string[] = Array.isArray(action.args?.ids)
            ? action.args.ids.filter((one: unknown) => {
                  return typeof one === 'string' && one !== '';
              })
            : typeof action.args?.id === 'string' && action.args.id !== ''
              ? [action.args.id]
              : [];
        return {
            ...action,
            args: {
                ...action.args,
                ids: [created.undoId, ...ids],
                madeId: created.undoId,
                madePath: created.filePath,
            },
        };
    });
    if (isFolded) {
        return folded;
    }
    return [
        ...folded,
        {
            label: LYRIC_UNDO_LABEL,
            toolName: LYRIC_UNDO_TOOL_NAME,
            args: {
                id: created.undoId,
                name: created.name,
                madeId: created.undoId,
                madePath: created.filePath,
            },
        },
    ];
}

/**
 * **Undo this change** under what the window made or saved with no model
 * (a Bibles list, EC-515; a web page, EC-518): every change, oldest first --
 * the thing made, when this made it, then each change in it -- under its
 * name. No change, no button.
 */
export function genMadeUndoAction(
    madeName: string,
    changeIds: string[],
    madeId: string | null,
) {
    const ids = [...(madeId === null ? [] : [madeId]), ...changeIds].filter(
        (id) => {
            return id !== '';
        },
    );
    if (ids.length === 0) {
        return null;
    }
    return {
        label: LYRIC_UNDO_LABEL,
        toolName: LYRIC_UNDO_TOOL_NAME,
        args: {
            id: ids[ids.length - 1],
            name: madeName,
            ...(ids.length > 1 ? { ids } : {}),
            ...(madeId === null ? {} : { madeId }),
        },
    };
}
