/**
 * A tool call a model wrote as WORDS instead of as a tool call.
 *
 * Measured 2026-10-10 on the user's LM Studio (qwen3.5-9b at 16k, the
 * follow-up "How do I put John 3:16 on it?", round 5): the model answered
 *
 *     <tool_call>
 *     <function=owa_help_search>
 *     <parameter=query>Bible Lookup button function presenter</parameter>
 *     ...
 *     </function>
 *     </tool_call>
 *
 * in `content`, with `tool_calls` empty, and the window printed it as the
 * answer. A small open-weight model drifts into whichever tool-call grammar
 * it was trained on once the context fills -- Qwen's `<tool_call>` JSON,
 * Qwen-Coder's and Llama 4's `<function=…><parameter=…>` XML, Mistral's
 * `[TOOL_CALLS]` array, a bare JSON object -- and the server's own parser
 * only knows the one its template declares, so the call reaches the app as
 * prose. The user's words for it: "got an error rendering".
 *
 * The loop reads such an answer as the tool call it is: the calls here go
 * out as proper `tool_calls` (the tool runs, its result goes back as a
 * `tool` message the server's template renders normally) and the words
 * around them stay as the assistant's text. Only a NAME THE REQUEST OFFERED
 * is accepted -- a story that happens to contain `<function=…>` runs
 * nothing -- and the argument values are read by the tool's own schema
 * ("4" is the number 4 for a number, the words "4" for a string).
 */

export type TextToolCallType = {
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
};

export type ParsedTextToolCallsType = {
    calls: TextToolCallType[];
    /** What the model wrote around the calls, trimmed; '' when nothing. */
    text: string;
};

type ToolShapeType = { name: string; inputSchema?: any };

type CandidateType = { name: string; args: Record<string, unknown> };

// Cheap gate: nothing below runs on an ordinary answer.
const MARKER_PATTERN =
    /<tool_call|<function[=_\s>]|\[TOOL_CALLS\]|"name"\s*:|```json/i;

const TOOL_CALL_BLOCK_PATTERN = /<tool_call>([\s\S]*?)(?:<\/tool_call>|$)/gi;
const FUNCTION_BLOCK_PATTERN =
    /<function(?:=|\s+name=")([^>"\s]+)"?\s*>([\s\S]*?)(?:<\/function>|$)/gi;
const PARAMETER_PATTERN =
    /<parameter(?:=|\s+name=")([^>"\s]+)"?\s*>([\s\S]*?)<\/parameter>/gi;
const TOOL_CALLS_ARRAY_PATTERN = /\[TOOL_CALLS\]\s*(\[[\s\S]*?\])/i;
const FENCED_JSON_PATTERN = /```(?:json)?\s*([\s\S]*?)```/gi;

/**
 * The name the model meant: a leaked channel marker cut off (the harmony
 * format, see `toCleanToolName`), a `functions.` namespace dropped (the
 * OpenAI-style prefix some templates write), whitespace trimmed.
 */
function toMeantName(raw: unknown) {
    return String(raw ?? '')
        .split('<|')[0]
        .trim()
        .replace(/^functions?\./, '');
}

function readSchemaType(schema: any, key: string): string | undefined {
    const type = schema?.properties?.[key]?.type;
    if (Array.isArray(type)) {
        return type.find((one) => one !== 'null');
    }
    return typeof type === 'string' ? type : undefined;
}

function parseJsonLoose(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch (_error) {
        return undefined;
    }
}

/**
 * A parameter value written between XML tags, read by the schema's type.
 * With no schema word for it, a value that parses as JSON (a number, a
 * boolean, an object, a list) is that, and anything else is the words.
 */
function coerceParameter(raw: string, type: string | undefined): unknown {
    const trimmed = raw.trim();
    if (type === 'string') {
        // A model that quotes a string value is read without the quotes.
        return /^".*"$/s.test(trimmed) && trimmed.length >= 2
            ? trimmed.slice(1, -1)
            : trimmed;
    }
    if (type === 'number' || type === 'integer') {
        const number = Number(trimmed);
        return Number.isFinite(number) && trimmed.length > 0 ? number : trimmed;
    }
    if (type === 'boolean') {
        if (/^true$/i.test(trimmed)) {
            return true;
        }
        if (/^false$/i.test(trimmed)) {
            return false;
        }
        return trimmed;
    }
    if (type === 'object' || type === 'array') {
        const parsed = parseJsonLoose(trimmed);
        return parsed === undefined ? trimmed : parsed;
    }
    if (/^(?:[[{"]|-?\d|true$|false$|null$)/.test(trimmed)) {
        const parsed = parseJsonLoose(trimmed);
        return parsed === undefined ? trimmed : parsed;
    }
    return trimmed;
}

function readXmlParameters(body: string, schema: any) {
    const args: Record<string, unknown> = {};
    for (const match of body.matchAll(PARAMETER_PATTERN)) {
        const key = match[1].trim();
        if (key.length === 0) {
            continue;
        }
        args[key] = coerceParameter(match[2], readSchemaType(schema, key));
    }
    return args;
}

/**
 * The calls inside one `<tool_call>` block or one bare `<function=…>`
 * block. An XML block may hold its arguments as parameters or as a JSON
 * object; a JSON block may be one object or a list of them.
 */
function readCandidates(block: string, schemaByName: Map<string, any>) {
    const candidates: CandidateType[] = [];
    const functionMatches = [...block.matchAll(FUNCTION_BLOCK_PATTERN)];
    if (functionMatches.length > 0) {
        for (const match of functionMatches) {
            const name = toMeantName(match[1]);
            const schema = schemaByName.get(name);
            const body = match[2];
            const asJson = parseJsonLoose(body.trim());
            const args =
                asJson !== null &&
                typeof asJson === 'object' &&
                !Array.isArray(asJson)
                    ? (asJson as Record<string, unknown>)
                    : readXmlParameters(body, schema);
            candidates.push({ name, args });
        }
        return candidates;
    }
    const parsed = parseJsonLoose(block.trim());
    for (const one of Array.isArray(parsed) ? parsed : [parsed]) {
        const candidate = toJsonCandidate(one);
        if (candidate !== null) {
            candidates.push(candidate);
        }
    }
    return candidates;
}

function toJsonCandidate(value: unknown): CandidateType | null {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const record = value as Record<string, unknown>;
    // OpenAI's own shape, `{function: {name, arguments}}`, and the four
    // words models use for the arguments.
    const inner =
        record.function !== null && typeof record.function === 'object'
            ? (record.function as Record<string, unknown>)
            : record;
    const name = toMeantName(inner.name);
    if (name.length === 0) {
        return null;
    }
    let args =
        inner.arguments ?? inner.parameters ?? inner.input ?? inner.args ?? {};
    if (typeof args === 'string') {
        args = parseJsonLoose(args) ?? {};
    }
    if (args === null || typeof args !== 'object' || Array.isArray(args)) {
        args = {};
    }
    return { name, args: args as Record<string, unknown> };
}

/**
 * The tool calls written as words in `content`, with the words around them,
 * or null when there is none the request offered a tool for.
 */
export function parseTextToolCalls(
    content: string | null | undefined,
    tools: ToolShapeType[],
): ParsedTextToolCallsType | null {
    if (typeof content !== 'string' || !MARKER_PATTERN.test(content)) {
        return null;
    }
    const schemaByName = new Map<string, any>(
        tools.map((tool) => [tool.name, tool.inputSchema]),
    );
    const candidates: CandidateType[] = [];
    let rest = content;
    // A `<tool_call>` wrapper is read by what is INSIDE it (JSON or XML); a
    // bare `<function=…>` block is read whole, its name being on the tag.
    rest = rest.replace(
        TOOL_CALL_BLOCK_PATTERN,
        (_block: string, inner: string) => {
            candidates.push(...readCandidates(inner, schemaByName));
            return '';
        },
    );
    rest = rest.replace(FUNCTION_BLOCK_PATTERN, (block: string) => {
        candidates.push(...readCandidates(block, schemaByName));
        return '';
    });
    const arrayMatch = TOOL_CALLS_ARRAY_PATTERN.exec(rest);
    if (arrayMatch !== null) {
        candidates.push(...readCandidates(arrayMatch[1], schemaByName));
        rest = rest.replace(arrayMatch[0], '');
    }
    rest = rest.replace(FENCED_JSON_PATTERN, (block: string, inner: string) => {
        const found = readCandidates(inner, schemaByName);
        if (found.length === 0) {
            return block;
        }
        candidates.push(...found);
        return '';
    });
    // The whole answer as one JSON object (or list of them), nothing else.
    const bare = rest.trim();
    if (candidates.length === 0 && /^[[{][\s\S]*[\]}]$/.test(bare)) {
        const found = readCandidates(bare, schemaByName);
        if (found.length > 0) {
            candidates.push(...found);
            rest = '';
        }
    }
    const calls = candidates
        .filter((candidate) => schemaByName.has(candidate.name))
        .map((candidate, index): TextToolCallType => {
            return {
                id: `text_call_${index + 1}`,
                type: 'function',
                function: {
                    name: candidate.name,
                    arguments: JSON.stringify(candidate.args),
                },
            };
        });
    if (calls.length === 0) {
        return null;
    }
    return {
        calls,
        text: rest.replace(/\n{3,}/g, '\n\n').trim(),
    };
}
