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
            text: 'Create a lyric file from https://example.com/lyric/amazing_grace',
            isTemplate: true,
        },
    ],
    reader: [
        'How do I look up a verse?',
        'How do I compare Bible versions?',
        'What are verse marks?',
        'Where is the search button?',
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
 * chips: around 180 questions for the presenter, every one of which has a
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
    return (
        rows.find((row) => {
            return toFollowUpKey(row.text) === key;
        }) ?? null
    );
}

/**
 * What the MODEL is told about a question the corpus has already filed --
 * the page that answers it, and the live tool when there is one. Measured
 * 2026-09-02: left to search, the model rewrote every picked question in its
 * own words and the search put the filed recipe first 57% of the time. Told
 * the page, it opens it, one round earlier and right by construction. Goes on
 * the ask only, never the transcript: the words shown are the user's own.
 */
export function genKnownQuestionHint(row: QuestionRowType): string | null {
    const recipe = row.resources?.recipe ?? null;
    const tools = row.resources?.tools ?? [];
    if (recipe === null && tools.length === 0) {
        return null;
    }
    const parts: string[] = [];
    if (recipe !== null) {
        parts.push(
            `the guide page that answers it is ${recipe} -- open it with ` +
                'owa_help_page rather than searching',
        );
    }
    if (tools.length > 0) {
        parts.push(
            `the live tool${tools.length > 1 ? 's' : ''} for it: ` +
                tools.join(', '),
        );
    }
    return `(This is one of the app's own supported questions; ${parts.join('; ')}.)`;
}
