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
    QuestionOverlayType,
    QuestionPageType,
    QuestionRowType,
} from '../../tools/owa-devtools-mcp/questionMatch.d.mts';

import { BOT_FOCUS_LIST } from '../../tools/owa-devtools-mcp/botFocus.mjs';
// The same reading of a page the server quotes its search hits with: small,
// no node built-in, so it costs this window a few hundred lines and no chunk.
import {
    checkIsBoldLeadLine,
    clipPageToPassages,
    genQuestionAnchors,
    toPassageKey,
    toPassages,
    toQuestionTerms,
} from '../../tools/owa-devtools-mcp/passageMatch.mjs';
import {
    FRESH_PAGE_NOTE_LEAD,
    readPagePartNote,
} from '../../tools/owa-devtools-mcp/manualPage.mjs';
import type { BotFocusType } from './helpBotHelpers';
import { DEFAULT_CHAT_LANG_CODE, getAppLangCode } from './chatLangHelpers';
import { tranLabel } from './chatTranHelpers';
import { NATIVE_MENU_ITEM_MAP } from './answerLanguageHelpers';

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
    // The row's English, when `text` is its translation: what a press
    // ASKS, so every reader of the words (a verse to find, a Bible to
    // import, a song link) and the known-question hint read the corpus's
    // own sentence, while the transcript shows `text`.
    textEn?: string;
};

function toTextEnField(
    row: Pick<QuestionRowType, 'text'> & { textEn?: string },
) {
    return row.textEn === undefined || row.textEn === row.text
        ? {}
        : { textEn: row.textEn };
}

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
        'Why do I need to choose a data folder?',
        "How do I change the app's language?",
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
        'Why do I need to choose a data folder?',
        "How do I change the app's language?",
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

// One file per language the corpus is translated into
// (`questions/i18n/<code>.json`), a loader each, so a window loads its own
// language's file and no other -- and an English one none at all.
const OVERLAY_LOADER_MAP = import.meta.glob<QuestionOverlayType>(
    '../../tools/owa-devtools-mcp/questions/i18n/*.json',
    { import: 'default' },
);

/** The corpus words of the language this window is shown in, or null. */
async function loadOverlay(): Promise<QuestionOverlayType | null> {
    const langCode = getAppLangCode();
    if (langCode === DEFAULT_CHAT_LANG_CODE) {
        return null;
    }
    const loader = Object.entries(OVERLAY_LOADER_MAP).find(([path]) => {
        return path.endsWith(`/i18n/${langCode}.json`);
    })?.[1];
    if (loader === undefined) {
        return null;
    }
    try {
        return await loader();
    } catch (_error) {
        // The English questions still work; a failed translation is no
        // reason for an empty help window.
        return null;
    }
}

async function loadCorpus(): Promise<CorpusType | null> {
    try {
        const pagePathList = Object.keys(PAGE_LOADER_MAP)
            // Belt and braces: the glob above already excludes `schema.json`,
            // and this costs one pass over ten keys, once per window.
            .filter((path) => {
                return !path.endsWith('/schema.json');
            })
            .sort();
        const [match, overlay, ...pageModules] = await Promise.all([
            import('../../tools/owa-devtools-mcp/questionMatch.mjs'),
            loadOverlay(),
            ...pagePathList.map((path) => {
                return PAGE_LOADER_MAP[path]();
            }),
        ]);
        const pages = (pageModules as any[]).map((item) => {
            return (item.default ?? item) as QuestionPageType;
        });
        return {
            // In the app's language where the corpus is translated: every
            // chip, suggestion and heading shows `text`, and keeps its
            // English in `textEn` (`applyQuestionOverlay`).
            pages: match.applyQuestionOverlay(pages, overlay),
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
            ...toTextEnField(row),
        });
        groupMap.set(label, group);
    }
    return [...groupMap.values()];
}

// Letters of every script: keyed on `[a-z0-9]` alone, a question in Khmer
// was an empty key and matched nothing.
function toFollowUpKey(text: string) {
    return text
        .toLowerCase()
        .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
        .trim();
}

// A row is the question asked in its own words or in its English ones.
function checkIsRowAsked(row: QuestionRowType, key: string) {
    return (
        toFollowUpKey(row.text) === key ||
        toFollowUpKey(row.textEn ?? row.text) === key
    );
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
        return {
            text: row.text,
            isTemplate: row.isTemplate === true,
            ...toTextEnField(row),
        };
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
        return !checkIsRowAsked(row, askedKey);
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
        return checkIsRowAsked(row, key);
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
                return checkIsRowAsked(row, key);
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
    const allRows = flattenQuestions(corpus.pages);
    return (
        findFilledTemplateRow(key, allRows) ??
        findRowByKeywordPhrase(key, allRows)
    );
}

/**
 * A finished fill-in row typed in the window's language, as the row's
 * English sentence with the person's part in it (`toEnglishTemplateAsk`),
 * or null -- for an English window always, and for anything else typed.
 */
export async function findTemplateAsk(typed: string): Promise<string | null> {
    if (getAppLangCode() === DEFAULT_CHAT_LANG_CODE || typed.trim() === '') {
        return null;
    }
    const corpus = await getCorpus();
    if (corpus === null) {
        return null;
    }
    const { flattenQuestions, toEnglishTemplateAsk } =
        await import('../../tools/owa-devtools-mcp/questionMatch.mjs');
    return toEnglishTemplateAsk(typed, flattenQuestions(corpus.pages));
}

// A fill-in row's own gap: the three dots its words end on.
const TEMPLATE_GAP_PATTERN = /(\.{3}|…)\s*$/;

/**
 * The fill-in row a FINISHED sentence was started from. A row that ends on
 * three dots fills the box and is asked only once the person has completed
 * it, and from then on it matched nothing: "Add a slide to my document that
 * says Welcome to church" is not the words of "Add a slide to my document
 * that says ...", so no hint rode, and a local model that was never sent the
 * slide tool was not told so -- it searched, opened the page about PRESENTING
 * a slide and answered "look for an Insert button", twice, hours apart
 * (gemma-4-e4b, 2026-10-12; "Save John 3:16 to my Bibles list", a fill-in
 * row asked as it stands, got "I cannot save … from this assistant" in one
 * round the same minute). The row's words up to its gap, then more words,
 * is that row; two rows that open alike are nobody's.
 */
export function findFilledTemplateRow(
    key: string,
    rows: (QuestionRowType & { textEn?: string })[],
): QuestionRowType | null {
    const hits = rows.filter((row) => {
        // The ENGLISH row: a translated fill-in row is asked in English
        // (`findTemplateAsk`).
        const text = row.textEn ?? row.text;
        if (row.isTemplate !== true || !TEMPLATE_GAP_PATTERN.test(text)) {
            return false;
        }
        const opening = toFollowUpKey(text);
        return opening.length > 0 && key.startsWith(`${opening} `);
    });
    return hits.length === 1 ? hits[0] : null;
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

/**
 * Whether the corpus files this question under THIS window -- not merely
 * under every window, which says nothing about where its controls are.
 *
 * The guide-only bot leads an answer with "This is done in the Presenter"
 * when the page it quotes names a Presenter panel
 * (`genBackToPresenterLead`), and the words it goes by are shared: the
 * Bible Reader has a **Bible Lookup** of its own, and every Slide Editor page
 * says **Slide Editor**. Asked with no assistant from the window they belong
 * to (2026-10-12, the whole corpus), 22 of the Reader's 70 questions and 16
 * of the Slide Editor's 21 were sent to the Presenter for something that is
 * in front of the person asking. The corpus knows whose question it is.
 */
export async function checkIsOwnWindowQuestion(
    asked: string,
    focus: BotFocusType,
) {
    const row = await findKnownQuestion(asked, focus);
    return (
        row !== null &&
        row.focus !== null &&
        checkFocusTakesIn(row.focus, focus)
    );
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

// The two pages a session starts in. A question about any other window that
// is asked FROM that window is asked by somebody already in it.
const START_PAGE_FOCUS_SET = new Set<BotFocusType>(['presenter', 'reader']);

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
// The help window's own page. Whatever is filed under it is asked INSIDE
// that window, and the page opens on how to open it.
export const HELP_WINDOW_MANUAL_ID = 'W-42';

/**
 * A page without its first numbered step. For the help window's own page,
 * whose step 1 is how to open the help window: the opening of a page rides
 * on every question filed under it, and a local model wrote that step out as
 * step 1 of its answer -- "Click the 🤖 button in the top-right corner", to
 * somebody typing in the window -- for three questions in twenty-four, and
 * again after it was told in so many words never to (gemma-4-e4b,
 * 2026-10-12). What a model is not handed it cannot recite.
 *
 * Kept when the row NAMES a passage in that step (`keepPassage`): then the
 * question is about the way in itself. "How do I open the help from the
 * taskbar?" names the step's taskbar paragraph, and with the step dropped
 * it was answered "Click the 🤖 button on the taskbar" (Nemotron Lightning,
 * 2026-10-16) -- the right-click on the app's icon was nowhere in what it
 * was handed.
 */
export function dropFirstStep(
    pageText: string,
    keepPassage: string | null = null,
): string {
    // Where the step's number stands: the pattern takes in the blank line
    // and the indent in front of it.
    const toStart = (match: RegExpMatchArray | undefined) => {
        if (match?.index === undefined) {
            return null;
        }
        return match.index + match[0].length - match[0].trimStart().length;
    };
    const steps = [...pageText.matchAll(STEP_START_PATTERN)];
    const first = toStart(steps[0]);
    const second = toStart(steps[1]);
    if (first === null || second === null) {
        return pageText;
    }
    if (
        keepPassage !== null &&
        keepPassage.trim().length > 0 &&
        ` ${toPassageKey(pageText.slice(first, second))} `.includes(
            ` ${toPassageKey(keepPassage)} `,
        )
    ) {
        return pageText;
    }
    return pageText.slice(0, first) + pageText.slice(second);
}

/**
 * How a page came to ride on the ask:
 * - `whole`: all of it;
 * - `step`: its opening and the step that names the question's control;
 * - `matching`: its opening and the passages that match the question;
 * - `head`: its first 6 000 characters, which carry what the question is
 *   about (the control, or the passage that matches best);
 * - `opening`: its first 6 000 characters and nothing better -- no part of
 *   the page matched, so they are a start, not an answer.
 */
export type KnownPageModeType =
    'whole' | 'step' | 'matching' | 'head' | 'opening';

/** What of a known question's row decides the part of its page that rides. */
export type KnownPageRowType = Pick<
    QuestionRowType,
    'text' | 'keywords' | 'resources'
> &
    Partial<Pick<QuestionRowType, 'textEn'>>;

/**
 * The part of the page that rides on the ask: all of it when it fits, else
 * its opening -- and, when the question names a control (`find`), the STEP
 * that names that control, because a deep step is why the question was
 * filed under the page at all. The first 6 000 characters of W-51 never
 * reach step 8, Cast to a TV: measured 2026-10-10 on the laptop's 0.6B
 * model, the cast question got steps 1-2 and stopped, which was all it had
 * been shown. A `find` the page does not carry (a Khmer page under an
 * English `find`) leaves the opening alone.
 *
 * And when no control settles it, the passages that match the QUESTION
 * (`clipPageToPassages`, the row's own words and its keywords). Measured
 * 2026-10-12 on a local model: half the supported questions (199 of 398) are
 * filed under a page longer than what rides, the help window's own page is
 * 41 000 characters, and "What commands can I type instead of asking?" --
 * a question that window offers -- was handed its first 6 000, which say
 * nothing of the commands, and answered "the guide covers this app only;
 * type /btw".
 */
export function clipKnownPageParts(
    pageText: string,
    find: string | null = null,
    row: KnownPageRowType | null = null,
): { text: string; mode: KnownPageModeType } {
    const whole = pageText.trim();
    // The note the page tool writes at a page's foot for a model -- where its
    // newest copy is -- is no part of the page. Measured and cut WITH it
    // (2026-10-12, the whole corpus on a local model): two pages that fit
    // were 400 characters too long, so their 35 questions rode "the first
    // 6 000", the note cut off mid-address, under "the page goes on: open it
    // for the rest" when nothing of the page was missing; and because its
    // address spells the page's own name it ranked as a passage for 173 of
    // the 203 questions on long pages and rode in 20 cuts in place of one.
    //
    // And it does not RIDE either, on a page that fits (2026-10-13). The note
    // says the day of this copy, and a local model asked at temperature 0
    // gives the same answer to the same words: with nothing changed but
    // that day -- a new release of the manual -- not one of 27 answers came
    // back as it had been an hour before. A page's body changes when the
    // page is edited; its date changes with every release, and re-rolled
    // every answer written from every page. The window reads the newest
    // copy by itself under a complaint (`disputeHelpers`), and a model that
    // opens the page with the tool still gets the note.
    const footAt = whole.indexOf(`\n\n${FRESH_PAGE_NOTE_LEAD}`);
    const text = footAt === -1 ? whole : whole.slice(0, footAt).trimEnd();
    if (text.length <= KNOWN_PAGE_CHAR_LIMIT) {
        return { text, mode: 'whole' };
    }
    const head = text.slice(0, KNOWN_PAGE_CHAR_LIMIT).trimEnd();
    // A string or nothing: the corpus is JSON, and a row that carried a list
    // here threw "trim is not a function" at whoever picked it.
    const wanted = typeof find === 'string' ? find.trim() : '';
    // A row that names its passage is cut around THAT, not around the first
    // place its control is written: "Open AI settings" is in three passages
    // of the help window's page, and the one that answers "my API key was
    // refused" is the last of them.
    const passage = row?.resources?.passage;
    const hasPassage = typeof passage === 'string' && passage.trim().length > 0;
    // The page comes in the window's language and the row's control is
    // written in English: in a Khmer window the button is found by its Khmer
    // words.
    const at =
        wanted.length === 0 || hasPassage
            ? -1
            : ([wanted, tranLabel(wanted)]
                  .map((one) => {
                      return text.indexOf(one);
                  })
                  .find((index) => {
                      return index !== -1;
                  }) ?? -1);
    if (at !== -1 && at < head.length) {
        return { text: head + KNOWN_PAGE_TAIL_NOTE, mode: 'head' };
    }
    if (at === -1) {
        const matching =
            row === null
                ? null
                : clipPageToPassages(
                      text,
                      [
                          ...toQuestionTerms(row.textEn ?? row.text),
                          ...(row.keywords ?? []).flatMap(toQuestionTerms),
                      ],
                      genQuestionAnchors(row.resources),
                      KNOWN_PAGE_CHAR_LIMIT,
                      KNOWN_PAGE_HEAD_LIMIT,
                  );
        if (matching === null) {
            return { text: head + KNOWN_PAGE_TAIL_NOTE, mode: 'opening' };
        }
        if (matching.isHead) {
            return { text: head + KNOWN_PAGE_TAIL_NOTE, mode: 'head' };
        }
        return {
            text:
                matching.text + (matching.isEndCut ? KNOWN_PAGE_TAIL_NOTE : ''),
            mode: 'matching',
        };
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
    return {
        text:
            opening +
            '\n…\n' +
            step +
            (stepEnd < text.length ? KNOWN_PAGE_TAIL_NOTE : ''),
        mode: 'step',
    };
}

/** The text alone: what rides, whichever way it was cut. */
export function clipKnownPage(
    pageText: string,
    find: string | null = null,
    row: KnownPageRowType | null = null,
): string {
    return clipKnownPageParts(pageText, find, row).text;
}

/**
 * A page's blocks in its own order -- a numbered step with what hangs under
 * it, or a paragraph -- with the note the page tool writes at its foot left
 * off. A translation is written block for block: measured 2026-10-17, each of
 * the 64 Khmer pages splits into exactly as many blocks as its English page,
 * which is what lets a cut made of the English page be made of the
 * translation (`toLocalizedCut`).
 */
export function splitPageBlocks(pageText: string): string[] {
    const whole = pageText.trim();
    const footAt = whole.indexOf(`\n\n${FRESH_PAGE_NOTE_LEAD}`);
    const lines = (footAt === -1 ? whole : whole.slice(0, footAt)).split('\n');
    const blocks: string[] = [];
    let current: string[] = [];
    const close = () => {
        const block = current.join('\n').trim();
        if (block.length > 0) {
            blocks.push(block);
        }
        current = [];
    };
    lines.forEach((line, index) => {
        if (line.trim().length === 0) {
            close();
            return;
        }
        // A step, and a paragraph opening on a bold lead inside one -- the
        // help window's sixth step holds eleven of them, the commands among
        // them, and pointed at by the step's start the commands never rode.
        // And a bullet: W-09's foreground list -- sessions, blend mode,
        // Effects -- was ONE block opening on the volume paragraph, so the
        // Effects passage was quoted in Khmer as that paragraph, cut before
        // it reached Effects (pass 7, EC-328).
        if (
            /^\s*\d+\.\s/.test(line) ||
            /^\s*[-*+]\s/.test(line) ||
            checkIsBoldLeadLine(line, lines[index + 1])
        ) {
            close();
        }
        current.push(line);
    });
    close();
    return blocks;
}

// How much of a line of a block says it rides in a cut: a cut that carries
// any line of a block carries the block, and then the whole translated block
// rides.
const LINE_LEAD_LENGTH = 60;
// How many of a translated block's first characters point at it.
const PASSAGE_LEAD_LENGTH = 60;
// Where a sentence ends: a full stop, a question or exclamation mark, a colon
// or semicolon -- and the marks of a script that has its own (Khmer's ។ ៕ ៖)
// -- before a space. Read off both sides of a pair of blocks, and believed
// only when they come to the same count.
const SENTENCE_END_PATTERN = /(?<=[.!?:;។៕៖])\s+/u;

function splitSentences(text: string) {
    return text.split(SENTENCE_END_PATTERN).filter((sentence) => {
        return sentence.trim().length > 0;
    });
}
// How much longer than the English cut its translation may run: whole blocks
// ride where the English cut took the start of one (the help window's
// commands, 5 800 Khmer characters under one lead), though the translation
// itself is no longer (W-42: 63 693 Khmer characters to 68 719 English).
const LOCAL_PAGE_ALLOWANCE = 1.5;

// A line as a cut writes it: `toPassages` joins a paragraph's lines with a
// space, trims each and drops a quote's `>`.
function toFlatText(text: string) {
    return text
        .replace(/^[ \t]*>[ \t]?/gm, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// What a block is, in marks every language keeps: its step's number, a
// heading, a quote, a bullet, or a paragraph.
function toBlockShape(block: string) {
    const step = /^(\d+)\.\s/.exec(block);
    if (step !== null) {
        return `step ${step[1]}`;
    }
    if (block.startsWith('#')) {
        return 'heading';
    }
    if (block.startsWith('>')) {
        return 'quote';
    }
    if (/^[-*+]\s/.test(block)) {
        return 'bullet';
    }
    return block.startsWith('**') ? 'lead' : 'paragraph';
}

// The two pages' blocks, only when the translation is written block for
// block -- as many of them and each of the same kind. A page that does not
// line up rides as the English cut rather than as the wrong part of the
// translation.
function listAlignedBlocks(englishPage: string, localPage: string) {
    const englishBlocks = splitPageBlocks(englishPage);
    const localBlocks = splitPageBlocks(localPage);
    if (
        englishBlocks.length === 0 ||
        englishBlocks.length !== localBlocks.length ||
        englishBlocks.some((block, index) => {
            return toBlockShape(block) !== toBlockShape(localBlocks[index]);
        })
    ) {
        return null;
    }
    return { englishBlocks, localBlocks };
}

// A line deep in a block says the block rides only when it is long enough to
// be that line's own words: "Wordproject." ends a line of W-34's step 8 and a
// sentence of its step 6, and a cut of step 6 carried step 8 in with it
// (2026-10-18, gemma4:cloud in Khmer answered with both).
const INNER_LINE_LEAD_LENGTH = 30;

function checkIsBlockInCut(block: string, flatCut: string) {
    return block.split('\n').some((line, index) => {
        const lead = toFlatText(line).slice(0, LINE_LEAD_LENGTH);
        return (
            lead.length >= (index === 0 ? 12 : INNER_LINE_LEAD_LENGTH) &&
            flatCut.includes(lead)
        );
    });
}

/**
 * A cut of the English page (`clipKnownPageParts`) made of the same page in
 * the person's language: the translation's blocks that stand where the
 * English cut's blocks stand, in order, with … where some were left out. The
 * cut is CHOSEN in English, because the row's control, passage and keywords
 * are English words, and READ in their language -- handed the English cut,
 * gemma4:cloud answering in Khmer copied its sentences as they stood: _បើក
 * View on the top menu bar again and click_ (2026-10-17). Null when the two
 * pages do not line up block for block, or no block of the cut was found.
 *
 * Whole blocks ride, so a cut that took the start of a long one takes all of
 * it in the translation -- the help window's commands block is 5 800 Khmer
 * characters -- and the cut has a ceiling of its own: the English one's and
 * half again (`LOCAL_PAGE_ALLOWANCE`), the block that crosses it cut at a
 * line.
 */
export function toLocalizedCut(
    englishPage: string,
    localPage: string,
    englishCut: string,
    limit = Math.round(KNOWN_PAGE_CHAR_LIMIT * LOCAL_PAGE_ALLOWANCE),
): string | null {
    const aligned = listAlignedBlocks(englishPage, localPage);
    if (aligned === null) {
        return null;
    }
    const flatCut = toFlatText(englishCut);
    const kept: string[] = [];
    let lastIndex = -1;
    let length = 0;
    let isCut = englishCut.includes(KNOWN_PAGE_TAIL_NOTE);
    for (const [index, block] of aligned.englishBlocks.entries()) {
        if (!checkIsBlockInCut(block, flatCut)) {
            continue;
        }
        const local = aligned.localBlocks[index];
        const gap = lastIndex !== -1 && index !== lastIndex + 1 ? '…' : null;
        const room = limit - length - (gap === null ? 0 : 3) - 2;
        if (local.length > room) {
            // At the last line that fits, when one does; else nothing more.
            const lineEnd = local.lastIndexOf('\n', room);
            if (lineEnd > 0 && kept.length > 0) {
                if (gap !== null) {
                    kept.push(gap);
                }
                kept.push(local.slice(0, lineEnd).trimEnd());
            } else if (kept.length === 0) {
                kept.push(local.slice(0, Math.max(room, 0)).trimEnd());
            }
            isCut = true;
            break;
        }
        if (gap !== null) {
            kept.push(gap);
        }
        kept.push(local);
        length += local.length + 2 + (gap === null ? 0 : 3);
        lastIndex = index;
    }
    if (kept.length === 0) {
        return null;
    }
    return kept.join('\n\n') + (isCut ? KNOWN_PAGE_TAIL_NOTE : '');
}

/**
 * The opening words, in the person's language, of the block an English
 * `passage` stands in: how the hint points at the part that answers when the
 * page rides in their language. Null when the passage is in no block.
 */
export function findLocalizedPassageLead(
    englishPage: string,
    localPage: string,
    passage: string,
): string | null {
    const aligned = listAlignedBlocks(englishPage, localPage);
    const wantedKey = toPassageKey(passage);
    if (aligned === null || wantedKey.length === 0) {
        return null;
    }
    const index = aligned.englishBlocks.findIndex((block) => {
        return ` ${toPassageKey(block)} `.includes(` ${wantedKey} `);
    });
    if (index === -1) {
        return null;
    }
    // A quote's `>` is no word of it: a passage inside one was pointed at as
    // "> > លុបវា…" (W-34's KJV note, 2026-10-18).
    const toLeadText = (text: string) => {
        return text
            .replace(/^[ \t]*>[ \t]?/gm, '')
            .replace(/^(?:\d+\.\s*|[-*+]\s+)/, '')
            .replaceAll('**', '')
            .replace(/\s+/g, ' ')
            .trim();
    };
    // A passage that starts INSIDE its block is pointed at by the sentence
    // it starts in, when both blocks have as many sentences: pointed at the
    // block's first words, _How do I cast the virtual display to a TV from
    // my phone?_ was answered with the app's own cast button, the step's
    // first sentence, where the passage is its fourth -- the phone's page
    // (gemma4:cloud, the whole corpus asked in Khmer, 2026-10-17, EC-317).
    const englishSentences = splitSentences(
        toLeadText(aligned.englishBlocks[index]),
    );
    const localSentences = splitSentences(
        toLeadText(aligned.localBlocks[index]),
    );
    let sentenceIndex = 0;
    for (let at = englishSentences.length - 1; at > 0; at -= 1) {
        const rest = englishSentences.slice(at).join(' ');
        if (` ${toPassageKey(rest)} `.includes(` ${wantedKey} `)) {
            sentenceIndex = at;
            break;
        }
    }
    // Inside a block whose sentences do not line up, no words of it are the
    // passage's: its first ones had pointed four report questions at the
    // paragraph's opening, the way the Report button is reached, where each
    // asks about sending, keeping or email (Khmer W-42 split one sentence
    // more, at "Report: ", 2026-10-18). The part is then the one quoted.
    if (
        sentenceIndex > 0 &&
        englishSentences.length !== localSentences.length
    ) {
        return null;
    }
    const lead =
        sentenceIndex > 0
            ? localSentences.slice(sentenceIndex).join(' ')
            : toLeadText(aligned.localBlocks[index]);
    if (lead.length <= PASSAGE_LEAD_LENGTH) {
        return lead;
    }
    // At a space: a cut inside a Khmer cluster leaves a vowel sign with no
    // letter to sit on.
    const spaceAt = lead.lastIndexOf(' ', PASSAGE_LEAD_LENGTH);
    // Never ending on the dash of the bullet that comes next.
    return lead
        .slice(
            0,
            spaceAt > PASSAGE_LEAD_LENGTH / 3 ? spaceAt : PASSAGE_LEAD_LENGTH,
        )
        .replace(/\s+[-–—•]+$/u, '');
}

/**
 * Whether what rides on the ask is the page's ANSWER to the question -- the
 * whole page, or a cut that carries what the question is about. The loop is
 * told (`AskExtraType.isKnownPageQuoted`), because steps written from it are
 * written from the page: handed back as "written from a search excerpt, open
 * the page first", the model opened the page it had just been given and wrote
 * the same answer again. Only `opening` says nothing of the kind -- no part
 * of a long page matched, the step that answers may be anywhere in it, and
 * opening the page is then the right thing to ask for.
 */
export function checkIsKnownPageQuoted(
    pageText: string | null,
    row: KnownPageRowType | null = null,
) {
    if (pageText === null) {
        return false;
    }
    const find = row?.resources?.find;
    return (
        clipKnownPageParts(
            pageText,
            typeof find === 'string' ? find : null,
            row,
        ).mode !== 'opening'
    );
}

/**
 * What the loop is told about a known question (`AskExtraType`): the page
 * its walkthrough buttons walk, the control they start at, and whether that
 * page was quoted in the ask.
 *
 * Nothing for a question about what the app is DOING (`kind: 'state'`). Its
 * page is background reading and its answer is read off the live app; seeded
 * with the page, "Which page am I on right now?" was answered correctly and
 * then offered **Show me step by step** through the Presenter overview
 * (2026-10-12: under three of the first forty-seven answers of a corpus run).
 */
export function genKnownAskExtra(
    row: QuestionRowType | null,
    pageText: string | null,
    // The page in the language the model is asked in, when not English: the
    // part's controls are named as that app shows them.
    localPageText: string | null = null,
): {
    knownRecipeId?: string;
    knownFind?: string;
    isKnownPageQuoted?: boolean;
    knownDoTool?: string;
    isKnownPartNamed?: boolean;
    knownPartControls?: string[];
    isKnownWhatAsk?: boolean;
} {
    const doTool = row === null ? null : findDoAskTool(row);
    const doField = doTool === null ? {} : { knownDoTool: doTool };
    const recipe = row?.resources?.recipe;
    if (row === null || recipe === undefined || row.kind === 'state') {
        return doField;
    }
    const find = row.resources?.find;
    return {
        ...doField,
        knownRecipeId: recipe,
        isKnownPageQuoted: checkIsKnownPageQuoted(pageText, row),
        // A string or nothing: the walkthrough card takes it as text.
        ...(typeof find === 'string' ? { knownFind: find } : {}),
        // The hint names the part that answers: an answer written from it
        // is checked once for the steps that finish the job
        // (`ToolWatchType.canCheckCompleteness`).
        ...(typeof find === 'string' ||
        typeof row.resources?.passage === 'string'
            ? { isKnownPartNamed: true }
            : {}),
        // A what-or-why question is checked for its answer, not its steps:
        // asked whether a step was missing, the model padded _Why does the
        // preview show my desktop wallpaper?_ and _Where do the Bibles come
        // from?_ with procedures nobody asked for (pass 17, 2026-10-18).
        ...(row.kind === 'what' ? { isKnownWhatAsk: true } : {}),
        ...toPartControlsField(
            findKnownPartControls(row, pageText, localPageText),
        ),
    };
}

function toPartControlsField(controls: string[]) {
    return controls.length === 0 ? {} : { knownPartControls: controls };
}

// A bold that is a sentence (a lead ending in a stop) or longer than a name
// is not a control.
const PART_CONTROL_LIMIT = 10;

/**
 * The controls the page part a known question is filed with names -- its
 * bold labels, as the window it rides in shows them -- for the completeness
 * check to hold an answer against (`genCompletenessNudge`). Passes 9-10 of
 * the whole list asked in Khmer: the answers still short left out a control
 * that part named -- **Send report**, the Base URL box, the **Properties**
 * fold, **Show it** -- and "is a step missing?" did not find it (EC-333).
 */
export function findKnownPartControls(
    row: Pick<QuestionRowType, 'resources'>,
    pageText: string | null,
    localPageText: string | null = null,
): string[] {
    if (pageText === null) {
        return [];
    }
    const passage = row.resources?.passage;
    const find = row.resources?.find;
    const passages = toPassages(pageText);
    let partText: string | null = null;
    if (typeof passage === 'string' && passage.trim().length > 0) {
        const wantedKey = toPassageKey(passage);
        const part = passages.find((one: { text: string }) => {
            return ` ${toPassageKey(one.text)} `.includes(` ${wantedKey} `);
        });
        partText =
            part === undefined
                ? null
                : withPointedBackPart(pageText, part.text);
    } else if (typeof find === 'string' && find.trim().length > 0) {
        const names = [find, tranLabel(find)];
        const part = passages.find((one: { text: string }) => {
            return names.some((name) => {
                return one.text.includes(`**${name}**`);
            });
        });
        partText = part?.text ?? null;
    }
    // Read off the ENGLISH part as the window has it: its labels come
    // resolved into the window's language (`[en:tran:Padding]` →
    // _ចន្លោះខាងក្នុង_) while emphasis stays English (**every**, **WORDS**),
    // so in a window not in English a bold in its own letters IS a control.
    // In English the two cannot be told apart, and the check stays general.
    if (partText === null || localPageText === null) {
        return [];
    }
    const controls: string[] = [];
    for (const match of partText.matchAll(/\*\*([^*\n]{1,60}?)\*\*/g)) {
        const name = match[1].trim();
        if (
            name.length === 0 ||
            !/[^\p{Script=Latin}\p{N}\p{P}\p{S}\p{Z}]/u.test(name) ||
            /[.:។៖?!]$/u.test(name) ||
            controls.includes(name)
        ) {
            continue;
        }
        controls.push(name);
        if (controls.length >= PART_CONTROL_LIMIT) {
            break;
        }
    }
    return controls;
}

// A page comes in two parts today, the help window's own. More than this is
// a page that should be two pages, and is left saying that it goes on.
const MAX_PAGE_PARTS = 4;

/**
 * A guide page WHOLE, through the app's own `owa_help_page` (handed in, so
 * this module needs no tool client). A page too long for one read comes in
 * parts, each but the last ending with a note that it goes on; they are put
 * back together here, one heading, one foot. Measured 2026-10-12: the help
 * window's page is 57 000 characters and one read stops at 40 000, so its
 * last seven steps reached nobody -- and "Can you walk me through it step by
 * step?", which step 14 answers, was answered with how to open the window it
 * was asked in. A part that cannot be read leaves what came before it, still
 * saying that the page goes on.
 */
export async function readWholePage(
    id: string,
    readPage: (id: string, part?: number) => Promise<string>,
): Promise<string> {
    let text = await readPage(id);
    let note = readPagePartNote(text);
    for (
        let part = 2;
        note !== null && part <= Math.min(note.total, MAX_PAGE_PARTS);
        part++
    ) {
        let next: string;
        try {
            next = await readPage(id, part);
        } catch (_error) {
            break;
        }
        if (typeof next !== 'string' || next.trim().length === 0) {
            break;
        }
        text =
            text.slice(0, note.at) + '\n' + next.replace(/^#\s+.*(\r?\n)+/, '');
        note = readPagePartNote(text);
    }
    return text;
}

/**
 * The guide page a known question is filed under, read through the app's own
 * `owa_help_page` (handed in, so this module needs no tool client), or null
 * when there is no recipe or the read fails -- the hint then names the page
 * as before and the model opens it.
 */
export async function readKnownQuestionPage(
    row: QuestionRowType,
    readPage: (id: string, part?: number) => Promise<string>,
): Promise<string | null> {
    const recipe = row.resources?.recipe ?? null;
    if (recipe === null) {
        return null;
    }
    try {
        const text = await readWholePage(recipe, readPage);
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
// The named part quoted first is a lead and its paragraph, not a second copy
// of a long step: what is cut off is still in the page under it.
const NAMED_PASSAGE_CHAR_LIMIT = 1500;

/**
 * The named part as it is quoted first: whole when it fits, else up to the
 * last line that does, and a … that says it goes on. Cut at the character,
 * the help window's command list ended mid-word, and the model copied it to
 * the same syllable three passes running -- an answer that stopped in the
 * middle of a sentence (2026-10-18, gemma4:cloud in Khmer).
 */
function clipNamedPart(text: string) {
    if (text.length <= NAMED_PASSAGE_CHAR_LIMIT) {
        return text;
    }
    const lineEnd = text.lastIndexOf('\n', NAMED_PASSAGE_CHAR_LIMIT);
    const sentenceEnd = Math.max(
        ...['. ', '។ ', '? ', '! '].map((mark) => {
            return text.lastIndexOf(mark, NAMED_PASSAGE_CHAR_LIMIT);
        }),
    );
    const cutAt =
        lineEnd > NAMED_PASSAGE_CHAR_LIMIT / 2
            ? lineEnd
            : sentenceEnd > NAMED_PASSAGE_CHAR_LIMIT / 2
              ? sentenceEnd + 1
              : NAMED_PASSAGE_CHAR_LIMIT;
    return `${text.slice(0, cutAt).trimEnd()}\n…`;
}
// The tools the system prompt has the model use when asked to put something
// up ("done when asked to go UP", `llmBotHelpers.ts`), and the asks that
// are such a request rather than a question about how.
const DO_ON_ASK_TOOL_SET = new Set(['owa_foreground', 'owa_present_bible']);
const DO_ASK_PATTERN =
    /^(?:(?:can|could|would|will) you\s+)?(?:please\s+)?(?:start|put|show|run|begin|count)\b/i;

/**
 * The tool a known question asks the assistant to put something up with,
 * or null: the hint says to do it, and the loop hands an answer back that
 * says it was done without having called it (`AskExtraType.knownDoTool`).
 */
export function findDoAskTool(
    row: Pick<QuestionRowType, 'text' | 'resources'> & { textEn?: string },
): string | null {
    const tool = (row.resources?.tools ?? []).find((name) => {
        return DO_ON_ASK_TOOL_SET.has(name);
    });
    return tool !== undefined && DO_ASK_PATTERN.test(row.textEn ?? row.text)
        ? tool
        : null;
}
// A part whose first words point BACK at the one before it: _of that line_,
// _in that same row_, _Fold those lists_ -- never the "that" of _a passage
// that runs on_, nor "this", which in this manual is mostly the window in
// front of them. Read off the English page, the one the manual is written in.
const POINTED_BACK_PATTERN =
    /^(?:[^\s]+\s+){0,10}?(?:(?:of|in|on|at|to|from|under|for|into|by|with)\s+that|those)\b/i;

/**
 * The part named to answer a question, with the part before it when it opens
 * by pointing back at that one: _The two small arrows at the end of THAT
 * line walk them in order_, quoted by itself, does not say which line, and
 * _How do I see the other tips above the box?_ was answered with the `/`
 * command list (gemma4:cloud, the whole corpus asked in Khmer, 2026-10-17,
 * EC-317) -- the line is the 💡 one, in the part before it.
 */
function withPointedBackPart(pageText: string, partText: string) {
    const lead = partText.replaceAll('**', '').split(/(?<=[.!?:;])\s/)[0];
    if (!POINTED_BACK_PATTERN.test(lead)) {
        return partText;
    }
    const passages = toPassages(pageText);
    // The cut's last part carries the cut's own note after it.
    const index = passages.findIndex((one: { text: string }) => {
        return partText.startsWith(one.text);
    });
    if (index <= 0) {
        return partText;
    }
    return `${passages[index - 1].text}\n\n${partText}`;
}

// A step or a bullet, or a block of code: what a part ending on a colon
// introduces.
const INTRODUCED_KIND_LIST = [/^\d+\.\s/, /^[-*+]\s/, /^```/];

/**
 * The part named to answer a question, with what it introduces when it ends
 * on a colon -- the steps, the bullets or the example after it, of one kind,
 * as many as fit: _Write it as a list of entries, each with a title to read
 * and a url to open:_ was quoted without the example under it, and the Khmer
 * answer described the file with no example (2026-10-18).
 */
function withIntroducedPart(pageText: string, partText: string) {
    if (!/:$/.test(partText.trimEnd())) {
        return partText;
    }
    const passages = toPassages(pageText);
    const lastLine = partText.split('\n\n').at(-1) ?? partText;
    const index = passages.findIndex((one: { text: string }) => {
        return one.text === lastLine;
    });
    const kind = INTRODUCED_KIND_LIST.find((pattern) => {
        return index !== -1 && pattern.test(passages[index + 1]?.text ?? '');
    });
    if (kind === undefined) {
        return partText;
    }
    let text = `${partText}\n\n${passages[index + 1].text}`;
    for (const one of passages.slice(index + 2)) {
        const next = `${text}\n\n${one.text}`;
        if (!kind.test(one.text) || next.length > NAMED_PASSAGE_CHAR_LIMIT) {
            break;
        }
        text = next;
    }
    return text;
}

export function genKnownQuestionHint(
    row: QuestionRowType,
    extra: {
        focus?: BotFocusType;
        pageText?: string | null;
        // The same page in the language the model is asked in, when that is
        // not English (`W-31@km`): what rides is cut from `pageText` and
        // quoted from this (`toLocalizedCut`), and the controls and menu
        // items are named as that language's app shows them.
        localPageText?: string | null;
        // The row's tools this assistant was NOT sent (a local server gets
        // the essentials only): named as absent, never as "the live tool".
        missingTools?: string[];
    } = {},
): string | null {
    const recipe = row.resources?.recipe ?? null;
    const allTools = row.resources?.tools ?? [];
    if (recipe === null && allTools.length === 0) {
        return null;
    }
    const missingTools = allTools.filter((name) => {
        return (extra.missingTools ?? []).includes(name);
    });
    const tools = allTools.filter((name) => {
        return !missingTools.includes(name);
    });
    const { focus, pageText = null } = extra;
    const localPageText =
        typeof extra.localPageText === 'string' &&
        extra.localPageText.trim().length > 0
            ? extra.localPageText
            : null;
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
        // A question about what the app HAS or is doing right now is
        // answered by the tool, and is told so: of the eight such rows a
        // local model called the tool for seven and answered the eighth --
        // "Which displays does this computer have?" -- with "the guide does
        // not provide information about your computer's physical hardware
        // ... type /btw" (gemma-4-e4b, 2026-10-13, at temperature 0, so
        // every time).
        // A row that asks the assistant to put something UP, with the one
        // tool the prompt lets it do that with when asked: _Can you start a
        // 5 minute countdown on the screen?_ asked in Khmer was answered
        // "I can -- shall I do it now, or would you like the steps?" (the
        // whole list asked in Khmer of gemma4:cloud, 2026-10-17, EC-323).
        const doTool = findDoAskTool(row);
        const isDoAsk = doTool !== null && tools.includes(doTool);
        parts.push(
            (row.kind === 'state'
                ? 'it asks what the app has or is doing RIGHT NOW, which ' +
                  `only the app can say -- call ${tools[0]} first and ` +
                  'answer from what it returns; '
                : '') +
                // Started on a screen that was off, the countdown was
                // followed by "shall I turn the screen on?" -- a press no
                // tool here may make unasked, where the person needed to be
                // told which button is theirs (pass 18, 2026-10-18).
                (isDoAsk
                    ? `it asks you to DO it, now: call ${doTool} and say ` +
                      'what it reports, rather than asking whether to -- ' +
                      'and when it reports a screen is off, tell them to ' +
                      'press that screen’s show button or F5 themselves; '
                    : '') +
                `the live tool${tools.length > 1 ? 's' : ''} for it: ` +
                tools.join(', '),
        );
    }
    // Told what it has NOT got. The window offers the same questions whoever
    // answers, and a local server's model is sent fourteen tools of the
    // twenty-six: named "the live tool for it: owa_undo" with no such tool
    // in its list, gemma-4-e4b answered "Can you put back something the
    // assistant deleted?" with the Bible note's Undo, and "Can you make the
    // words on a slide bigger?" with the Bible verse's font size
    // (2026-10-12). Saying it cannot is the right answer, and a true one.
    if (missingTools.length > 0) {
        parts.push(
            `this assistant has NOT been given ${missingTools.join(', ')} ` +
                `-- the tool${missingTools.length > 1 ? 's' : ''} that ` +
                // Said without a phrase to copy: "from this assistant" came
                // back as it stood inside a Khmer answer (pass 6, EC-321).
                'would do it in the app -- so say plainly, in your own ' +
                'words, that you cannot do that for them here, never write ' +
                'as though it were done, and lead with the way the guide gives ' +
                // "By hand" was read as "no command": _Can you write the
                // notation for words I paste in?_ was answered without the
                // `/lyric` its part names, pass after pass (gemma4:cloud,
                // the whole list in Khmer, 2026-10-18).
                'to do it without them -- by hand, or a / command it names, ' +
                'written out with what to type after it -- when it has one',
        );
        // With no page under the row there is no way by hand to give, and a
        // model told "give one when the guide has one" gave one anyway: "Can
        // you put back something the assistant deleted?" got an automatic
        // undo for background colours, "Can you read a web page for me?" a
        // Web Editor button and a link box (gemma-4-e4b, 2026-10-12, both
        // twice). What is true is who CAN: every assistant in the list but a
        // server of the user's own is sent the whole set.
        if (recipe === null && tools.length === 0) {
            parts.push(
                'the guide has no page for doing this by hand, so describe ' +
                    'no steps, buttons or menus for it: say only that this ' +
                    'assistant cannot, and that another assistant in the ' +
                    'list at the top of this window (Free, or one with a ' +
                    'key) can',
            );
        }
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
    // The row's own key and menu item, said outright. The corpus files a
    // question with them and the hint passed on only the page: over the
    // whole corpus asked of a local model (2026-10-12) nine of the fifteen
    // such answers that were marked down never named theirs -- "How can I
    // learn to prepare several notices in Messages?" was answered twice
    // without Help → All tips, with the passage that says it in front of
    // the model, and "How do I step to the next verse while presenting?"
    // with the slide keys: its key is written in the row and on no page.
    const menu = row.resources?.menu;
    const shortcut = row.resources?.shortcut;
    // Asked in another language, a menu item is named as that app shows it:
    // the menu bar's own names (View, Help) are English in every language,
    // the items a window adds under them are translated (`[en:tran:Reset
    // Widgets Size]` in every page of the Khmer manual). Told "View → Reset
    // Widgets Size, as written here", a model writing Khmer wrote it in
    // English. The menus' own items are English too (Help → AI Chat, Edit →
    // Find: `NATIVE_MENU_ITEM_MAP`).
    const toShownMenu = (path: string) => {
        if (localPageText === null) {
            return path.trim();
        }
        const parts = path.split(/\s*→\s*/);
        const nativeItems = NATIVE_MENU_ITEM_MAP[parts[0].trim()] ?? [];
        return parts
            .map((part, index) => {
                return index === 0 ||
                    (index === 1 && nativeItems.includes(part.trim()))
                    ? part.trim()
                    : tranLabel(part.trim());
            })
            .join(' → ');
    };
    const named = [
        typeof menu === 'string' && menu.trim().length > 0
            ? `the menu item ${toShownMenu(menu)}`
            : null,
        typeof shortcut === 'string' && shortcut.trim().length > 0
            ? `the key ${shortcut.trim()}`
            : null,
    ].filter((one): one is string => {
        return one !== null;
    });
    // Said as a fact about the APP, not about its list: worded "the app's own
    // list files this question with the key Ctrl+B", it came back to the
    // person as "Press Ctrl+B (the app files this under that key)" and "the
    // app's key list for this is Arrow keys / PageDown / Space" -- two of
    // twenty-three answers on the free model, 2026-10-16. What a model is
    // told, it may repeat; this it may repeat.
    const namedText =
        named.length === 0
            ? ''
            : ` For this, the app has ${named.join(' and ')}: name ` +
              `${named.length > 1 ? 'them' : 'it'} in the steps, as ` +
              'written here.';
    // Asked from a window of its own about that very window: its page tells
    // the way in first, and nine of thirty-nine answers given from the Slide
    // Editor, the Lyric Editor, the Bible Note window and the web editor
    // opened on it -- "click the Slide Editor header tab", "right-click the
    // song and click Edit" -- to somebody sitting in it (2026-10-12). Said in
    // so many words; on the help window's own page the same sentence took
    // three such answers in twenty-four down to one, and its first step is
    // not handed over at all (`dropFirstStep`).
    // Not for the Presenter and the Bible Reader: a session starts in one of
    // them, their pages have no way in to recite, and none of their answers
    // was marked down for it.
    // Nor for a row answered from the help window's own page: what that page
    // tells is done in the help window, whichever window the row is filed
    // under. "Can you write the notation for words I paste in?", filed under
    // the Lyric Editor and told they were INSIDE it, came back "paste your
    // song lyrics into the box in the Lyric Editor" -- the box is this
    // window's own (gemma-4-e4b, 2026-10-12).
    const isOwnWindow =
        focus !== undefined &&
        !START_PAGE_FOCUS_SET.has(focus) &&
        recipe !== HELP_WINDOW_MANUAL_ID &&
        row.focus !== null &&
        row.focus !== undefined &&
        checkFocusTakesIn(row.focus, focus);
    const ownWindowText = isOwnWindow
        ? ` They are asking from INSIDE the ${toFocusLabel(focus)}, which ` +
          'is open in front of them: start at what to do there, and never ' +
          'tell them how to open it or get to it.'
        : '';
    // A step that ends "and send it" is written from habit as "press
    // Enter", and in this box Enter starts a new line: two help-window
    // answers in pass 13 left the person typing a second line (gemma4:cloud,
    // the whole list in Khmer, 2026-10-18). The page says it; the hint says
    // it where every help-window answer sees it.
    const sendText =
        recipe === HELP_WINDOW_MANUAL_ID
            ? ' In the help window a question is sent with Ctrl+Enter or ' +
              'the Send button -- plain Enter only starts a new line.'
            : '';
    const head =
        `(This is one of the app's own supported questions${filedUnder}; ` +
        `${parts.join('; ')}.)${namedText}${ownWindowText}${sendText}`;
    if (pageText === null) {
        return head;
    }
    const find =
        typeof row.resources?.find === 'string' ? row.resources.find : null;
    const { text: clipped, mode } = clipKnownPageParts(
        // Asked in the very window the page is about: not how to open it --
        // unless that is what the row asks.
        recipe === HELP_WINDOW_MANUAL_ID
            ? dropFirstStep(
                  pageText,
                  typeof row.resources?.passage === 'string'
                      ? row.resources.passage
                      : null,
              )
            : pageText,
        find,
        row,
    );
    // Asked in the person's language: the very blocks of the page that cut
    // chose, in their words. All or nothing -- a translation that does not
    // line up rides as the English cut, pointed at in English, as before.
    const localClipped =
        localPageText === null
            ? null
            : toLocalizedCut(pageText, localPageText, clipped);
    // Said when the page had to be cut around the control: a small model
    // handed the opening and the step recited the page from step 1 and ran
    // out of words before the step that answers (the laptop's 0.6B,
    // 2026-10-10, twice). And said when it was cut around the question's own
    // words, so the gaps are read as gaps and not as the page's order.
    let focusText = '';
    if (mode === 'step') {
        // In another language the control is named as that app shows it, or
        // not at all: an English name is what gets copied into the answer.
        const shownFind = localClipped === null ? find : tranLabel(find ?? '');
        const findText =
            localClipped !== null && shownFind === find
                ? 'in the step quoted after the opening'
                : `"${shownFind}", in the step quoted after the opening`;
        // And the steps after it: told "answer with that step", gemma4:cloud
        // asked how to use its own LM Studio stopped at Add server, with the
        // name, the address and Test still to come (2026-10-17, EC-310).
        focusText =
            ` The control this question is about is ${findText}; the ` +
            'opening only says how to ' +
            'get there, so answer with that step, name the way there ' +
            'in one line, and give the steps after it that finish the job.';
    } else if (mode === 'matching') {
        focusText =
            ' The page is too long to quote whole: after its opening come ' +
            'the parts of it that match the question, with … where ' +
            'something was left out. Answer from those parts.';
    }
    // And which part, when the row names it. The parts ride in the page's
    // own order, and a small model answers from the first that seems to fit:
    // "Can you walk me through it step by step?" rode with the step that
    // answers it and, earlier in the page, the Reader's guided demos -- and
    // was answered with the demos (gemma-4-e4b, 2026-10-12).
    const passage = row.resources?.passage;
    let namedFirst = '';
    if (
        typeof passage === 'string' &&
        passage.trim().length > 0 &&
        ` ${toPassageKey(clipped)} `.includes(` ${toPassageKey(passage)} `)
    ) {
        // Even on a page short enough to quote whole, the parts ride in the page's
        // own order, its opening first, and a small model answers from the
        // first that seems to fit -- told which part it was, in so many
        // words, gemma-4-e4b still answered "Can you walk me through it
        // step by step?" with the Reader's guided demos, which the help
        // window's page opens on (2026-10-13, at temperature 0, so every
        // time). The same happened on W-11: Add Extra Bible before group
        // scrolling, though splitting already supplies the other version.
        // Quote the named part FIRST on short pages as well as long ones.
        // Found in the PAGE's passages: the cut writes each of its passages
        // on a line of its own, so read as passages, two paragraphs that ride
        // side by side -- or either side of a … -- were one, and W-34's
        // "Later changes … through the pencil" was quoted first as its step 6
        // and the note about where an import came from (2026-10-18).
        const wantedKey = toPassageKey(passage);
        const named = toPassages(pageText).find((one: { text: string }) => {
            return ` ${toPassageKey(one.text)} `.includes(` ${wantedKey} `);
        });
        const namedText =
            named === undefined
                ? null
                : withIntroducedPart(
                      pageText,
                      withPointedBackPart(pageText, named.text),
                  );
        const namedShown =
            namedText === null
                ? null
                : localClipped === null
                  ? namedText
                  : toLocalizedCut(pageText, localPageText!, namedText);
        if (namedShown !== null) {
            namedFirst =
                '\n\nThe part that answers this question, quoted first and ' +
                'by itself:\n\n' +
                clipNamedPart(namedShown);
        }
        // Pointed at by its own words in the language it rides in: the
        // English words of the row were copied, as they stood, into a Khmer
        // answer.
        const pointer =
            localClipped === null
                ? passage.trim()
                : findLocalizedPassageLead(pageText, localPageText!, passage);
        // "In its own words": asked twice with the temperature at 0, a 4B
        // model's answers on the running-order pages were the same both
        // times and two of twenty-seven were still wrong, each by a noun of
        // its own in place of the page's -- "right-click the line" for
        // "the presenting flow itself ... not one of its lines"
        // (2026-10-13). A sentence copied cannot change its noun.
        const whichText =
            pointer === null
                ? namedFirst.length > 0
                    ? 'the one quoted first below'
                    : null
                : `the one with the words "${pointer}"` +
                  (namedFirst.length > 0 ? ', quoted first below' : '');
        // "Take from the others only what it leaves out" was read as "that
        // part only": the whole corpus asked in Khmer of gemma4:cloud
        // (2026-10-17, EC-310) answered _How do I turn the AI features on or
        // off?_ with the part about turning them off "in the same settings
        // section", never naming which, and 27 of 84 answers graded short
        // stopped where their part did. The whole job, still in the page's
        // own sentences and nothing the page does not say.
        //
        // And the step before it is one the part cannot do without: told
        // "a step before it that it takes for granted", five of pass 21's
        // nine short answers opened on a step for something else -- Add
        // Extra Bible before a split, a second screen before Line Sync, a
        // slide clicked onto the projector before "the first card is blank",
        // a countdown shown "to keep it ready" (2026-10-18, EC-342).
        if (whichText !== null) {
            focusText +=
                ` The part that answers THIS question is ${whichText}: ` +
                'answer from that part in ITS OWN WORDS -- ' +
                'copy the sentences you use as they stand, change no name ' +
                'in them and add no step the page does not have -- and ' +
                'from the rest of the page add what the person still needs ' +
                'to get the WHOLE thing done: where that part is (the ' +
                'window, menu or panel), a step before it that it cannot ' +
                'be done without -- never one for something else, such as ' +
                'adding a screen, or putting a slide or an item on the ' +
                'screen when the question does not ask to -- and the steps ' +
                'after it that finish the job.';
            // An example to write is the answer, not decoration: W-37's link
            // list rode first with its example under it, and four passes in
            // a row the Khmer answer described the file and left the example
            // out -- inline in the sentence too (2026-10-18, EC-349).
            if (namedFirst.includes('```')) {
                focusText +=
                    ' That part ends on an example of what to write: copy ' +
                    'the example into your answer as it stands, in a code ' +
                    'block -- it is what the person types.';
            }
        }
    }
    // Said to be the APP's doing: a model handed the page under the question
    // read it as something the person had pasted ("what you shared is text
    // from the app's help guide, not a screenshot" -- qwen3.5-9b,
    // 2026-10-10) and answered them about it.
    return (
        `${head}${focusText}${namedFirst}\n\nThe guide page, put here by the ` +
        'app itself -- ' +
        `the person did not write or paste it, and never sees it:\n\n` +
        (localClipped ?? clipped)
    );
}
