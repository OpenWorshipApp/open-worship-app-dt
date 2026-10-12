// What the ask box suggests while the user types.
//
// The corpus is `tools/owa-devtools-mcp/questions/*.json` -- the same files
// `owa_list_questions` serves the model -- and the ranking is that package's
// `questionMatch.mjs`, imported rather than reimplemented: a second matcher in
// the window is how the suggestion list and the tool start disagreeing about
// what this app supports.
//
// Loaded ONCE per chatbot window, on the first keystroke, and held for the life
// of that window. That is a deliberate exception to "cache nothing": the whole
// corpus is well under 100 KB of JSON that never changes while the app runs,
// the window is short-lived, and the alternative -- a tool round trip per
// keystroke -- is the one thing a help box on a slow machine must not do. It is
// a separate chunk, so a window nobody types in never pays for it.

import type {
    MatchOptionsType,
    QuestionPageType,
    QuestionRowType,
} from '../../tools/owa-devtools-mcp/questionMatch.d.mts';

import { BOT_FOCUS_LIST } from '../../tools/owa-devtools-mcp/botFocus.mjs';
import type { BotFocusType } from './helpBotHelpers';

export type { QuestionRowType };

/**
 * A chip in the empty window.
 *
 * `isTemplate` is a chip that cannot be ASKED as it stands, because it carries
 * something the user has to replace first -- an address, a name. Pressing one
 * is the start of typing, not the end of it, so it fills the box instead of
 * sending. Without the distinction the window would cheerfully go and read
 * `example.com` and report what it found there.
 */
export type StarterQuestionType = {
    text: string;
    isTemplate: boolean;
};

/** The hand-written copy's terse form: a bare string is not a template. */
type StarterSourceType = string | { text: string; isTemplate: true };

export function toStarterQuestion(one: StarterSourceType): StarterQuestionType {
    return typeof one === 'string' ? { text: one, isTemplate: false } : one;
}

type CorpusType = {
    pages: QuestionPageType[];
    match: (query: string, options: MatchOptionsType) => QuestionRowType[];
};

/**
 * What the empty window shows if the corpus never arrives -- a help window
 * whose first screen is blank because a JSON import failed is worse than one
 * offering four questions it can definitely answer.
 *
 * A hand-written copy of what `getStarterQuestions` would have returned, so it
 * has to be held to it: `questionHelpers.test.ts` fails when the two drift, and
 * they had already drifted once (a lower-case "bible verse", a shortened "Is
 * any screen showing?") with nothing to notice.
 */
export const FALLBACK_STARTERS: Record<BotFocusType, StarterSourceType[]> = {
    presenter: [
        'How do I present a Bible verse?',
        'How do I add a background?',
        'Can you make a song from words I paste in?',
        {
            text: 'Create a lyric file for song "Amazing Grace"',
            isTemplate: true,
        },
    ],
    reader: [
        'Where do I type John 3:16?',
        'The words are too small. Can you help me?',
        'I lost the passage I was reading. How do I get it back?',
        'How do I put two Bible versions side by side?',
    ],
    appDocumentEditor: [
        'How do I add text to a slide?',
        'How do I add a slide?',
        'How do I put a picture or video on a slide?',
        'How do I save my changes?',
    ],
    bibleNote: [
        'What is this Bible Note window for?',
        'How do I save the note I am writing?',
        'How do I share a page of Bible notes with another machine?',
        'Can I put a password on the notes I send?',
    ],
    setting: [
        'Nothing is showing on the projector — what do I check?',
        "How do I change the app's language?",
        'How do I download another Bible version?',
        'How do I change where my documents and songs are stored?',
    ],
    webEditor: [
        'How do I change the address of a web background?',
        'How do I give a web background a name?',
        'How do I save the web background I am editing?',
        'How do I show this web page as the background?',
    ],
    lyricEditor: [
        'How do I mark verses and choruses in a song?',
        'How do I save the song I am editing?',
        'How do I see what a song will look like on screen?',
        'Can I change the words while the song is on the screen?',
    ],
    lwShare: [
        'Nothing is showing on the projector — what do I check?',
        "How do I change the app's language?",
        'How do I download another Bible version?',
        'How do I change where my documents and songs are stored?',
    ],
};

let corpusPromise: Promise<CorpusType | null> | null = null;

// Every page file in that folder, not a list of five names: the corpus grows a
// file whenever a subject outgrows being one section of another, and a page the
// window does not import is a page the ask box cannot suggest. Vite resolves
// the glob at build time and leaves a loader per file, so this is still one
// lazy chunk, still paid for only by a window somebody types in.
//
// `schema.json` is excluded IN THE PATTERN, not just skipped below. It
// documents the shape and is not a page of questions, but a glob that matches
// it makes Vite emit it as its own chunk — 5 KB of JSON Schema shipped in
// `dist/` and then never fetched, because the runtime filter drops the key
// before its loader is ever called.
const PAGE_LOADER_MAP = import.meta.glob([
    '../../tools/owa-devtools-mcp/questions/*.json',
    '!../../tools/owa-devtools-mcp/questions/schema.json',
]);

async function loadCorpus(): Promise<CorpusType | null> {
    try {
        const pagePathList = Object.keys(PAGE_LOADER_MAP)
            // Belt and braces: the glob above already excludes `schema.json`,
            // and this costs one pass over ten keys, once per window.
            .filter((path) => {
                return !path.endsWith('/schema.json');
            })
            .sort();
        const [match, ...pageModules] = await Promise.all([
            import('../../tools/owa-devtools-mcp/questionMatch.mjs'),
            ...pagePathList.map((path) => {
                return PAGE_LOADER_MAP[path]();
            }),
        ]);
        return {
            pages: (pageModules as any[]).map((item) => {
                return (item.default ?? item) as QuestionPageType;
            }),
            match: match.matchQuestions,
        };
    } catch (_error) {
        // A help window with no suggestions still answers questions. This is
        // the one thing in it that must never be the reason it fails to open.
        return null;
    }
}

function getCorpus() {
    if (corpusPromise === null) {
        corpusPromise = loadCorpus();
    }
    return corpusPromise;
}

/**
 * The questions to offer for what has been typed so far. An empty `query` gives
 * the starters -- which is exactly what the empty window shows, so the chips
 * and the suggestion list can never drift apart.
 */
export async function suggestQuestions(
    query: string,
    focus: BotFocusType,
    limit = 6,
): Promise<QuestionRowType[]> {
    const corpus = await getCorpus();
    if (corpus === null) {
        return [];
    }
    return corpus.match(query, { pages: corpus.pages, focus, limit });
}

/**
 * Whether the box already says what a suggestion would put in it -- the whole
 * of it, with or without more words typed after. Such a row has nothing left
 * to offer: taking it would change nothing, or would throw away what was added
 * to it (2026-10-10, the user's ask: _should close suggestion when user type
 * more extra, or already in input text_). The command rows answer the same
 * question in `matchBuiltinActions`, which knows where a command's name ends.
 */
export function checkIsAlreadyTyped(typed: string, suggestion: string) {
    const offered = suggestion.trim().toLowerCase();
    return offered.length > 0 && typed.trim().toLowerCase().startsWith(offered);
}

/**
 * A heading and the questions under it, for the window's "everything it can
 * answer" list.
 */
export type QuestionGroupType = {
    label: string;
    questions: StarterQuestionType[];
};

/**
 * EVERYTHING this assistant is prepared to be asked in this window, grouped
 * the way the corpus groups it.
 *
 * The four starter chips answer "what do I type first?" and nothing else. They
 * do not answer the question a volunteer actually has, which is what this
 * window is FOR -- and a help window whose scope you have to guess at gets
 * used for the one thing somebody once saw it do. This is the list behind the
 * chips: around 300 questions for the presenter, every one of which has a
 * manual page or a tool behind it, so nothing here can be pressed and come
 * back with a shrug.
 *
 * Grouped by SECTION rather than by page: a section is a panel of the app, so
 * the headings read as places the user recognises ("Bible", "Backgrounds")
 * rather than as the corpus's own filing. Sections with the same label are
 * merged for the same reason -- two "Screens" headings is the filing showing
 * through.
 *
 * Loaded from the corpus already in memory; a window that never presses More
 * pays nothing for this.
 */
export async function getAllQuestions(
    focus: BotFocusType,
): Promise<QuestionGroupType[]> {
    const corpus = await getCorpus();
    if (corpus === null) {
        return [];
    }
    const { flattenQuestions } =
        await import('../../tools/owa-devtools-mcp/questionMatch.mjs');
    const groupMap = new Map<string, QuestionGroupType>();
    for (const row of flattenQuestions(corpus.pages) as QuestionRowType[]) {
        // A page with no focus (the ones true everywhere) belongs in every
        // window; a page naming windows belongs only in those.
        const rowFocus = row.focus;
        if (
            rowFocus !== null &&
            rowFocus !== undefined &&
            (Array.isArray(rowFocus)
                ? !rowFocus.includes(focus)
                : rowFocus !== focus)
        ) {
            continue;
        }
        const label = row.sectionLabel || row.pageLabel;
        const group = groupMap.get(label) ?? { label, questions: [] };
        group.questions.push({
            text: row.text,
            isTemplate: row.isTemplate === true,
        });
        groupMap.set(label, group);
    }
    return [...groupMap.values()];
}

function toFollowUpKey(text: string) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

/** The starter chips for a window nobody has typed in yet. */
export async function getStarterQuestions(
    focus: BotFocusType,
    limit = 4,
): Promise<StarterQuestionType[]> {
    const rows = await suggestQuestions('', focus, limit);
    if (rows.length === 0) {
        // The corpus failed to load. Answering with nothing would leave the
        // window's first screen empty, so the copy above stands in.
        return FALLBACK_STARTERS[focus].slice(0, limit).map(toStarterQuestion);
    }
    return rows.map((row) => {
        return { text: row.text, isTemplate: row.isTemplate === true };
    });
}

/**
 * What to offer under an answer when nothing better presents itself: the
 * nearest questions this assistant is PREPARED to be asked, so the
 * conversation has somewhere to go.
 *
 * Ranked against what the user just asked rather than against the answer: the
 * answer is the model's prose and full of the app's own vocabulary, which
 * ranks the page it was written from straight back to the top -- the one
 * question the user demonstrably does not need next.
 *
 * Spread across sections AND recipes, for the same reason. Measured live, the
 * first version offered "How do I add a web page to the Background panel?"
 * and "How do I show a web page as the background?" side by side: two ways of
 * asking one thing, which is one option and one wasted button.
 */
export async function genFollowUpQuestions(
    asked: string,
    focus: BotFocusType,
    limit = 2,
): Promise<string[]> {
    const rows = await suggestQuestions(asked, focus, limit + 6);
    const askedKey = toFollowUpKey(asked);
    const candidates = rows.filter((row) => {
        return toFollowUpKey(row.text) !== askedKey;
    });
    const picked: QuestionRowType[] = [];
    const taken = new Set<string>();
    for (const row of candidates) {
        const recipe = row.resources?.recipe ?? '';
        if (taken.has(row.section) || (recipe !== '' && taken.has(recipe))) {
            continue;
        }
        taken.add(row.section);
        if (recipe !== '') {
            taken.add(recipe);
        }
        picked.push(row);
        if (picked.length >= limit) {
            break;
        }
    }
    for (const row of candidates) {
        if (picked.length >= limit) {
            break;
        }
        if (!picked.includes(row)) {
            picked.push(row);
        }
    }
    return picked.map((row) => {
        return row.text;
    });
}

/**
 * The corpus row a question IS -- the same words, as a chip or a suggestion
 * hands them over -- or null for anything typed freely. Compared by the same
 * key the follow-ups use, so punctuation and case do not matter.
 */
export async function findKnownQuestion(
    asked: string,
    focus: BotFocusType,
): Promise<QuestionRowType | null> {
    const key = toFollowUpKey(asked);
    if (key.length === 0) {
        return null;
    }
    // Ranked, so the exact row is at the top when it exists at all; eight is
    // room for the near-duplicates that share every word with it.
    const rows = await suggestQuestions(asked, focus, 8);
    const own = rows.find((row) => {
        return toFollowUpKey(row.text) === key;
    });
    if (own !== undefined) {
        return own;
    }
    // Filed under ANOTHER window: still a known question, and the hint says
    // where it is filed (`genKnownQuestionHint`). Measured 2026-10-10 on the
    // user's LM Studio (gemma-4-e4b): "Where do I type John 3:16?" -- the
    // Reader's own starter chip -- typed under the Presenter matched nothing
    // here, so the model got no hint, searched, opened the Bible-XML import
    // page, said it had no instructions, and invented a "Reference box" and a
    // "Go" button, over 63k tokens.
    const corpus = await getCorpus();
    if (corpus === null) {
        return null;
    }
    const elsewhere =
        corpus
            .match(asked, { pages: corpus.pages, focus: null, limit: 8 })
            .find((row) => {
                return toFollowUpKey(row.text) === key;
            }) ?? null;
    if (elsewhere !== null) {
        return elsewhere;
    }
    // Typed in the person's own words, but carrying a row's own PHRASE whole
    // -- "make computer stay awake" holds the stay-awake row's keyword "stay
    // awake" -- is that row (2026-10-10, EC-215: the Free model answered
    // Windows power settings, nothing about the app, because nothing had
    // told it the app has a Stay Awake cup; the ranking alone put "make a
    // song" first on the word "make"). The same chunk the corpus came from.
    const { flattenQuestions } =
        await import('../../tools/owa-devtools-mcp/questionMatch.mjs');
    return findRowByKeywordPhrase(key, flattenQuestions(corpus.pages));
}

/**
 * The one row whose keyword PHRASE the typed words carry whole. A phrase is
 * two words or more -- one word ("sleep", "cast") is on too many rows -- and
 * rows that answer with different pages are nobody's question: a hint that
 * names the wrong page is worse than none. Several rows on ONE page (the
 * virtual-display rows all answer from W-51) are that page.
 */
export function findRowByKeywordPhrase(
    key: string,
    rows: QuestionRowType[],
): QuestionRowType | null {
    const padded = ` ${key} `;
    const hits = rows.filter((row) => {
        return (row.keywords ?? []).some((keyword) => {
            const phrase = toFollowUpKey(keyword);
            return phrase.includes(' ') && padded.includes(` ${phrase} `);
        });
    });
    const answers = new Set(
        hits.map((row) => {
            return row.resources?.recipe ?? row.id;
        }),
    );
    return answers.size === 1 ? hits[0] : null;
}

/** Whether a page's focus (one, several or every window) takes in this one. */
function checkFocusTakesIn(
    pageFocus: QuestionRowType['focus'],
    focus: BotFocusType,
) {
    if (pageFocus === null) {
        return true;
    }
    return Array.isArray(pageFocus)
        ? pageFocus.includes(focus)
        : pageFocus === focus;
}

function toFocusLabel(focus: BotFocusType) {
    return (
        BOT_FOCUS_LIST.find((one) => {
            return one.key === focus;
        })?.label ?? focus
    );
}

// How much of the guide page rides on the ask. Most recipes are 2-6 KB; the
// help window's own page runs past 30 KB and must not.
const KNOWN_PAGE_CHAR_LIMIT = 6000;
// Of that, what the page's opening keeps when the question names a control
// deep in it: the intro and step 1 (how to get there) still ride, and the
// step that names the control takes the rest.
const KNOWN_PAGE_HEAD_LIMIT = 2000;
const KNOWN_PAGE_TAIL_NOTE =
    '\n…(the page goes on: open it with owa_help_page for the rest)';
const STEP_START_PATTERN = /^\s*\d+\.\s/gm;

/**
 * The part of the page that rides on the ask: all of it when it fits, else
 * its opening -- and, when the question names a control (`find`), the STEP
 * that names that control, because a deep step is why the question was
 * filed under the page at all. The first 6 000 characters of W-51 never
 * reach step 8, Cast to a TV: measured 2026-10-10 on the laptop's 0.6B
 * model, the cast question got steps 1-2 and stopped, which was all it had
 * been shown. A `find` the page does not carry (a Khmer page under an
 * English `find`) leaves the opening alone.
 */
export function clipKnownPage(
    pageText: string,
    find: string | null = null,
): string {
    const text = pageText.trim();
    if (text.length <= KNOWN_PAGE_CHAR_LIMIT) {
        return text;
    }
    const head = text.slice(0, KNOWN_PAGE_CHAR_LIMIT).trimEnd();
    const wanted = (find ?? '').trim();
    const at = wanted.length === 0 ? -1 : text.indexOf(wanted);
    if (at === -1 || at < head.length) {
        return head + KNOWN_PAGE_TAIL_NOTE;
    }
    // The step the control is named in: the last numbered line before it,
    // or a window in front of it on a page with no numbered steps.
    let stepStart = Math.max(0, at - 800);
    for (const match of text.matchAll(STEP_START_PATTERN)) {
        if (match.index === undefined || match.index > at) {
            break;
        }
        stepStart = match.index;
    }
    const opening = text.slice(0, KNOWN_PAGE_HEAD_LIMIT).trimEnd();
    const stepBudget = KNOWN_PAGE_CHAR_LIMIT - opening.length;
    const stepEnd = Math.min(text.length, stepStart + stepBudget);
    const step = text.slice(stepStart, stepEnd).trim();
    return (
        opening +
        '\n…\n' +
        step +
        (stepEnd < text.length ? KNOWN_PAGE_TAIL_NOTE : '')
    );
}

/**
 * The guide page a known question is filed under, read through the app's own
 * `owa_help_page` (handed in, so this module needs no tool client), or null
 * when there is no recipe or the read fails -- the hint then names the page
 * as before and the model opens it.
 */
export async function readKnownQuestionPage(
    row: QuestionRowType,
    readPage: (id: string) => Promise<string>,
): Promise<string | null> {
    const recipe = row.resources?.recipe ?? null;
    if (recipe === null) {
        return null;
    }
    try {
        const text = await readPage(recipe);
        return typeof text === 'string' && text.trim().length > 0 ? text : null;
    } catch (_error) {
        return null;
    }
}

/**
 * What the MODEL is told about a question the corpus has already filed --
 * the page that answers it, and the live tool when there is one. Measured
 * 2026-09-02: left to search, the model rewrote every picked question in its
 * own words and the search put the filed recipe first 57% of the time. Told
 * the page, it opens it, one round earlier and right by construction. Goes on
 * the ask only, never the transcript: the words shown are the user's own.
 */
export function genKnownQuestionHint(
    row: QuestionRowType,
    extra: { focus?: BotFocusType; pageText?: string | null } = {},
): string | null {
    const recipe = row.resources?.recipe ?? null;
    const tools = row.resources?.tools ?? [];
    if (recipe === null && tools.length === 0) {
        return null;
    }
    const { focus, pageText = null } = extra;
    const parts: string[] = [];
    if (recipe !== null) {
        parts.push(
            pageText === null
                ? `the guide page that answers it is ${recipe} -- open it ` +
                      'with owa_help_page rather than searching'
                : `the guide page that answers it, ${recipe}, is quoted ` +
                      'in full below -- write the answer from it and open ' +
                      'nothing else unless it does not answer',
        );
    }
    if (tools.length > 0) {
        parts.push(
            `the live tool${tools.length > 1 ? 's' : ''} for it: ` +
                tools.join(', '),
        );
    }
    // Filed under another window than the one they are asking about: say
    // so, and ask for the answer in THEIR window where it has its own way --
    // the Presenter has a Bible Lookup where the Reader has a reference box.
    const filedUnder =
        focus !== undefined && !checkFocusTakesIn(row.focus, focus)
            ? `, filed under the ${row.pageLabel} window -- they are asking ` +
              `about the ${toFocusLabel(focus)}, so answer for the ` +
              `${toFocusLabel(focus)} where it has its own control for ` +
              'this, and otherwise say which window to switch to'
            : '';
    const head =
        `(This is one of the app's own supported questions${filedUnder}; ` +
        `${parts.join('; ')}.)`;
    if (pageText === null) {
        return head;
    }
    const find = row.resources?.find ?? null;
    const clipped = clipKnownPage(pageText, find);
    // Said when the page had to be cut around the control: a small model
    // handed the opening and the step recited the page from step 1 and ran
    // out of words before the step that answers (the laptop's 0.6B,
    // 2026-10-10, twice).
    const focusText =
        find !== null && clipped.includes('\n…\n')
            ? ` The control this question is about is "${find}", in the ` +
              'step quoted after the opening; the opening only says how to ' +
              'get there, so answer with that step and name the way there ' +
              'in one line.'
            : '';
    // Said to be the APP's doing: a model handed the page under the question
    // read it as something the person had pasted ("what you shared is text
    // from the app's help guide, not a screenshot" -- qwen3.5-9b,
    // 2026-10-10) and answered them about it.
    return (
        `${head}${focusText}\n\nThe guide page, put here by the app itself -- ` +
        `the person did not write or paste it, and never sees it:\n\n${clipped}`
    );
}
