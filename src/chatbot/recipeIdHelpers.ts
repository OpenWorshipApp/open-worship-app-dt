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
const RECIPE_ID_PATTERN = /\b[A-Z]{1,3}-\d{1,3}[a-z]?\b/g;
// "(W-08 step 1)", "[see W-28]": an aside built around an id carries nothing
// the volunteer needed, so the whole bracket goes rather than leaving
// "( step 1)" behind.
const RECIPE_ID_ASIDE_PATTERN =
    /[ \t]*[([][^)\]\n]*\b[A-Z]{1,3}-\d{1,3}[a-z]?\b[^)\]\n]*[)\]]/g;

const UNKNOWN_PAGE_TEXT = 'the guide page';
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
    const source = String(text ?? '');
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
                    const title = pageTitles[id];
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

function checkIsNotAnId(id: string) {
    return NOT_AN_ID_SET.has(id.split('-')[0]);
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
