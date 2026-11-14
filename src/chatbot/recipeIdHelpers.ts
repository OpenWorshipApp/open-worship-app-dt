/**
 * The last line against a recipe id reaching a volunteer.
 *
 * The prompt forbids "W-06" by name and the tools scrub the ids out of every
 * page body and search excerpt (`scrubRecipeIds` in help.mjs) -- and a model
 * still opened an answer with "W-08 has exactly what you need" on 2026-09-08,
 * because the `id` FIELD of a search hit cannot go: it is the handle
 * `owa_help_page` and `owa_guide_start` take. So whatever the model writes is
 * read once more here, at the same seam the `OPTIONS:` frame is taken off,
 * and an id becomes the page's own title -- the tool results in that ask
 * carried it -- or, failing that, "the guide page". A rule the model can
 * ignore is not a rule; a replace it never sees is.
 */

// `W-01b` is a real id: the optional letter is load-bearing, without it the
// letter is left behind on its own.
// The hyphen is any a model types: a plain one, or the non-breaking one
// (U+2011) qwen3.5-9b wrote "W‑42" with on 2026-10-10, which walked past the
// scrub and reached the user; the figure dash, en dash and minus beside it.
const RECIPE_ID_PATTERN = /\b[A-Z]{1,3}[-‐-–−]\d{1,3}[a-z]?\b/g;
// "(W-08 step 1)", "[see W-28]": an aside built around an id carries nothing
// the volunteer needed, so the whole bracket goes rather than leaving
// "( step 1)" behind.
const RECIPE_ID_ASIDE_PATTERN =
    /[ \t]*[([][^)\]\n]*\b[A-Z]{1,3}[-‐-–−]\d{1,3}[a-z]?\b[^)\]\n]*[)\]]/g;

const UNKNOWN_PAGE_TEXT = 'the guide page';
// A page of the Bible Note editor's own guide, by its id
// (`bible-note:ui/sticky-notes/add-a-sticky-note`, `help.mjs`): the same
// handle, and the same rule. Unknown, it reads as what its last part says.
const BIBLE_NOTE_GUIDE_ID_PATTERN =
    /\bbible-note:ui\/(?:[a-z0-9-]+\/)*([a-z0-9-]+)/gi;
// The shape also fits a few real-world tokens an answer may legitimately
// carry -- "UTF-8", "USB-3", "COM-1" -- which are not ids of anything and
// must be left alone. The knowledge's own families are all letters that
// name nothing else (W, PL, EC, RD, PM, ST, CB, ...).
const NOT_AN_ID_SET = new Set([
    'UTF',
    'ISO',
    'USB',
    'DVI',
    'VGA',
    'COM',
    'RS',
    'MP',
    'PS',
    'H',
    'X',
    'Y',
]);

/**
 * Every recipe id in `text`, replaced. A known id becomes `the guide page
 * "<title>"`; an unknown one becomes plain `the guide page`. Capitalised when
 * it opens a sentence, since the id it replaces usually did.
 */
export function scrubAnswerRecipeIds(
    text: string,
    pageTitles: Record<string, string> = {},
): string {
    const source = scrubGuideIds(String(text ?? ''), pageTitles);
    if (source.search(RECIPE_ID_PATTERN) === -1) {
        return source;
    }
    return (
        source
            .replace(RECIPE_ID_ASIDE_PATTERN, (aside: string) => {
                const ids = aside.match(RECIPE_ID_PATTERN) ?? [];
                return ids.every(checkIsNotAnId) ? aside : '';
            })
            .replace(
                new RegExp(RECIPE_ID_PATTERN.source, 'g'),
                (id, offset: number, whole: string) => {
                    if (checkIsNotAnId(id)) {
                        return id;
                    }
                    // The titles are keyed by the id as the manual writes
                    // it, plain hyphen; the model's dash is read as one.
                    const title = pageTitles[id.replace(/[‐-–−]/g, '-')];
                    const phrase =
                        title === undefined
                            ? UNKNOWN_PAGE_TEXT
                            : `${UNKNOWN_PAGE_TEXT} “${title}”`;
                    return checkIsSentenceStart(whole, offset)
                        ? phrase[0].toUpperCase() + phrase.slice(1)
                        : phrase;
                },
            )
            // "see the guide page." is fine; "see ." is not, and a scrubbed
            // aside can leave a space in front of the full stop.
            .replace(/[ \t]+([.,;:])/g, '$1')
            .replace(/(?<=\S)[ \t]{2,}/g, ' ')
    );
}

function scrubGuideIds(text: string, pageTitles: Record<string, string>) {
    if (text.search(BIBLE_NOTE_GUIDE_ID_PATTERN) === -1) {
        return text;
    }
    return text.replace(
        new RegExp(BIBLE_NOTE_GUIDE_ID_PATTERN.source, 'gi'),
        (id: string, lastPart: string, offset: number, whole: string) => {
            const title =
                pageTitles[id] ??
                pageTitles[id.toLowerCase()] ??
                lastPart.replace(/-+/g, ' ');
            const phrase = `${UNKNOWN_PAGE_TEXT} “${title}”`;
            return checkIsSentenceStart(whole, offset)
                ? phrase[0].toUpperCase() + phrase.slice(1)
                : phrase;
        },
    );
}

function checkIsNotAnId(id: string) {
    return NOT_AN_ID_SET.has(id.split(/[-‐-–−]/)[0]);
}

// "(isAnyShowing is false)", "(didChange: true)": a model citing a tool's
// answer back at the user by its FIELD name, in a bracket, as evidence. Seen
// twice in two asks on 2026-09-08 the moment the symptom rule asked it to say
// which fault it found. The bracket is only ever a statement about a camel
// -cased name -- a name followed by "is", "was", ":" or "=" -- so a real
// aside ("(iPad)", "(or F5)", "(e.g. Joh)") never fits it, and the whole
// bracket goes: nothing a volunteer needs is ever in there.
const TOOL_FIELD_ASIDE_PATTERN =
    /[ \t]*\(\s*[a-z]+(?:[A-Z][a-z0-9]+)+\s*(?:is|was|=|:)\s[^()\n]*\)/g;

/**
 * Every bracketed aside quoting a tool result field, removed. The rest of the
 * sentence stands: "no screen is showing (isAnyShowing is false), which is
 * why" becomes "no screen is showing, which is why".
 */
export function scrubAnswerToolFields(text: string): string {
    const source = String(text ?? '');
    if (source.search(TOOL_FIELD_ASIDE_PATTERN) === -1) {
        return source;
    }
    return source
        .replace(TOOL_FIELD_ASIDE_PATTERN, '')
        .replace(/[ \t]+([.,;:])/g, '$1')
        .replace(/(?<=\S)[ \t]{2,}/g, ' ');
}

// A change's undo id (`20261113-034803869-schh`, `genAgentBackupId`), the
// handle **Undo this change** presses -- never words for a person. Taken
// with what introduces it: a colon or dash before it, or the bracket round it.
const UNDO_ID_TEXT = String.raw`\b\d{8}-\d{9}-[a-z0-9]{2,8}\b`;
const UNDO_ID_ASIDE_PATTERN = new RegExp(
    String.raw`[ \t]*\([^()\n]{0,24}?` +
        UNDO_ID_TEXT +
        String.raw`[^()\n]{0,4}\)`,
    'g',
);
// The quotes a model wraps the id in go with it: `"20261113-…"` left `""`
// behind (2026-11-13).
const UNDO_ID_QUOTE = '["\'“”‘’`]?';
const UNDO_ID_PATTERN = new RegExp(
    String.raw`[ \t]*[:\-–—]?[ \t]*` +
        UNDO_ID_QUOTE +
        UNDO_ID_TEXT +
        UNDO_ID_QUOTE,
    'g',
);
// The call the tool result spells the id in -- `owa_undo with id "…" puts
// this back` (`genUndoField`) -- copied into the answer as it stood:
// _Undo this countdown change puts it back: owa_undo with id ""._ (2026-11-13,
// EC-540's live pass). The tool's name and its "with id" go with the id.
const UNDO_TOOL_PATTERN =
    /[ \t]*[:\-–—]?[ \t]*\(?`?owa_undo`?(?:[ \t]+with)?(?:[ \t]+(?:the[ \t]+)?(?:undo[ \t]+)?id)?(?:[ \t]*["'“”‘’`]{2})?\)?/g;

/**
 * Every undo id a model wrote into its answer, removed (2026-11-12, EC-539:
 * _Undo this change puts the countdown back: 20261113-034803869-schh_, one
 * line per change, under the one button that undoes them), and the
 * `owa_undo` call it came in. The sentence around it stands.
 */
export function scrubAnswerUndoIds(text: string): string {
    const source = String(text ?? '');
    if (
        !new RegExp(UNDO_ID_TEXT).test(source) &&
        !source.includes('owa_undo')
    ) {
        return source;
    }
    return source
        .replace(UNDO_ID_ASIDE_PATTERN, '')
        .replace(UNDO_ID_PATTERN, '')
        .replace(UNDO_TOOL_PATTERN, '')
        .replace(/[ \t]+([.,;:])/g, '$1')
        .replace(/(?<=\S)[ \t]{2,}/g, ' ');
}

function checkIsSentenceStart(whole: string, offset: number) {
    const before = whole.slice(0, offset).replace(/[*_`"“'(\s]+$/, '');
    return before.length === 0 || /[.!?:\n]$/.test(before);
}

/**
 * The titles a tool result carried, keyed by id, folded into `pageTitles`.
 * Reads a search result (a JSON list of hits with `id` and `title`) and a
 * page (`# Title` on its first line, keyed by the id it was asked for). Never
 * throws: a tool that answered with prose simply teaches nothing.
 */
export function learnPageTitles(
    pageTitles: Record<string, string>,
    toolName: string,
    args: any,
    resultText: string,
) {
    if (toolName === 'owa_help_search') {
        try {
            const hits = JSON.parse(resultText);
            for (const hit of Array.isArray(hits) ? hits : []) {
                if (
                    typeof hit?.id === 'string' &&
                    typeof hit?.title === 'string'
                ) {
                    pageTitles[hit.id] = hit.title;
                }
            }
        } catch (_error) {
            // Prose ("nothing matches ..."), nothing to learn.
        }
        return;
    }
    if (toolName === 'owa_help_page' && typeof args?.id === 'string') {
        const heading = /^#\s+(.+?)\s*$/m.exec(resultText ?? '');
        if (heading !== null) {
            pageTitles[args.id] = heading[1];
        }
    }
}
