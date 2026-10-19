// Ranking a half-typed question against the corpus.
//
// Deliberately free of `node:fs` and of every other node built-in: the MCP
// server reads the files off disk and passes them in (`questions.mjs`), while
// the chatbot window bundles the same JSON and calls the same functions in the
// renderer. One ranking, two callers -- a second implementation in the window
// is how the suggestion list and the tool start disagreeing about what the app
// supports.
//
// Nothing here holds state. The caller owns the corpus and decides how long to
// keep it.

// A page file whose `focus` is null belongs to EVERY window of the app --
// settings and the find bar read the same wherever they are asked from. A page
// may also name SEVERAL windows: the slide editor is a tab of the main window,
// so its questions have to answer from the Presenter as well as from the editor
// itself, and demoting them out of one to serve the other would be a
// regression. One string is the same thing written shorter.
function checkMatchesFocus(page, focus) {
    if (!focus || !page.focus) {
        return true;
    }
    if (Array.isArray(page.focus)) {
        return page.focus.includes(focus);
    }
    return page.focus === focus;
}

/**
 * The corpus in a language of the app's: `overlay` is one
 * `questions/i18n/<code>.json`, `{ sections: { "<page>.<section>": { en, text
 * } }, questions: { "<page>.<section>.<id>": { en, text } } }`. A row reads
 * its translation in `text` and keeps its English in `textEn` (a section the
 * same in `label` / `labelEn`), so everything that SHOWS a question shows the
 * language and whatever needs the English -- what is typed in English, the
 * guide's passages, the model -- still has it.
 *
 * A translation counts only while its `en` still IS the row's words: a
 * reworded question shows its new English until its translation is redone,
 * never a translation of words it no longer says.
 */
export function applyQuestionOverlay(pages, overlay) {
    if (!overlay) {
        return pages;
    }
    const sectionMap = overlay.sections ?? {};
    const questionMap = overlay.questions ?? {};
    return pages.map((page) => {
        return {
            ...page,
            sections: page.sections.map((section) => {
                const sectionKey = `${page.page}.${section.id}`;
                const sectionWords = sectionMap[sectionKey];
                return {
                    ...section,
                    ...(sectionWords?.en === section.label &&
                    typeof sectionWords.text === 'string'
                        ? { label: sectionWords.text, labelEn: section.label }
                        : {}),
                    questions: (section.questions ?? []).map((question) => {
                        const words = questionMap[`${sectionKey}.${question.id}`];
                        return words?.en === question.text &&
                            typeof words.text === 'string'
                            ? { ...question, text: words.text, textEn: question.text }
                            : question;
                    }),
                };
            }),
        };
    });
}

// The part of a fill-in row the person replaces: its three dots, the
// address, the quoted name or the reference it gives as an example. In that
// order, because a row may carry two (`Import bible from xml url https://…`).
const TEMPLATE_SAMPLE_PATTERN_LIST = [
    /\.{3}|…/,
    /https?:\/\/\S+/,
    /["“][^"“”]+["”]/,
    /\b(?:[1-3] )?\p{Lu}\p{Ll}+ \d+:\d+(?:-\d+)?\b/u,
];

/**
 * Where a fill-in row's example is, or null: `{ at, sample, kind }`. A
 * row's translation (`questions/i18n/<code>.json`) carries an example of
 * the same KIND -- the dots, an address, a quoted name, a reference -- so
 * the two can be told apart around it; a quoted name may be the reader's
 * own (`"French"` in a French window, the user's ask 2026-10-17: _question
 * should change to French if in french language_).
 */
export function findTemplateSample(text) {
    for (const [kind, pattern] of TEMPLATE_SAMPLE_PATTERN_LIST.entries()) {
        const match = pattern.exec(String(text ?? ''));
        if (match !== null) {
            return { at: match.index, sample: match[0], kind };
        }
    }
    return null;
}

/**
 * A finished fill-in row typed in the app's language, as the row's ENGLISH
 * sentence with the person's own part in it -- or null. The window asks
 * that (and shows what was typed): every reader of the words -- a song's
 * link, a Bible to import, a button asked for, the known-question hint --
 * reads the corpus's English, and the part they filled in is theirs either
 * way (2026-10-17: the fill-in rows were the last English left in a Khmer
 * window's question list, kept so because code reads their gap).
 */
export function toEnglishTemplateAsk(typed, rows) {
    const said = String(typed ?? '').trim();
    for (const row of rows) {
        if (row.isTemplate !== true || typeof row.textEn !== 'string') {
            continue;
        }
        const local = findTemplateSample(row.text);
        const english = findTemplateSample(row.textEn);
        if (local === null || english === null || local.kind !== english.kind) {
            continue;
        }
        const before = row.text.slice(0, local.at).trim();
        const after = row.text.slice(local.at + local.sample.length).trim();
        if (
            before.length === 0 ||
            !said.startsWith(before) ||
            !said.endsWith(after) ||
            said.length <= before.length + after.length
        ) {
            continue;
        }
        const filled = said
            .slice(before.length, said.length - after.length)
            .trim();
        if (filled.length === 0) {
            continue;
        }
        return (
            row.textEn.slice(0, english.at) +
            filled +
            row.textEn.slice(english.at + english.sample.length)
        ).trim();
    }
    return null;
}

/**
 * The corpus as one flat list, each entry carrying where it came from. This is
 * what both the matcher and the tool hand out -- a caller never has to walk the
 * page/section nesting itself.
 */
export function flattenQuestions(pages) {
    const rows = [];
    for (const page of pages) {
        for (const section of page.sections) {
            for (const question of section.questions ?? []) {
                rows.push({
                    id: `${page.page}.${section.id}.${question.id}`,
                    text: question.text,
                    textEn: question.textEn ?? question.text,
                    kind: question.kind ?? 'howto',
                    page: page.page,
                    pageLabel: page.label,
                    focus: page.focus ?? null,
                    section: section.id,
                    sectionLabel: section.label,
                    sectionLabelEn: section.labelEn ?? section.label,
                    panel: section.panel ?? null,
                    keywords: question.keywords ?? [],
                    starter: question.starter === true,
                    starterRank: question.starterRank ?? null,
                    isTemplate: question.template === true,
                    resources: question.resources ?? {},
                });
            }
        }
    }
    return rows;
}

// Volunteers type what they see and what they fear, not what the manual calls
// things. Folding the obvious synonyms here means every entry does not have to
// list them: "projector" reaches the screen questions whoever wrote them.
const QUERY_ALIASES = {
    projector: ['screen', 'display'],
    monitor: ['screen', 'display'],
    tv: ['screen', 'display'],
    words: ['lyrics', 'text'],
    song: ['lyrics'],
    hymn: ['lyrics', 'song'],
    scripture: ['bible', 'verse'],
    passage: ['bible', 'verse'],
    picture: ['image', 'background'],
    photo: ['image', 'background'],
    blank: ['clear', 'hide'],
    black: ['clear', 'hide'],
    frozen: ['stuck', 'hide'],
    broken: ['not working', 'fix'],
    stuck: ['fix'],
};

// Letters of every alphabet, not `[a-z]` alone: a French row read in French
// (`é`) must keep its words whole.
function normalize(text) {
    return String(text ?? '')
        .toLowerCase()
        .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
        .trim();
}

// A letter of a script that is not Latin: a question typed in Khmer, which is
// written with no spaces between its words.
const NON_LATIN_LETTER_PATTERN = /(?=\p{L})\P{Script=Latin}/u;

function toCompact(text) {
    return String(text ?? '')
        .toLowerCase()
        .replace(/[^\p{L}\p{M}\p{N}]+/gu, '');
}

function toBigramCounts(text) {
    const characters = [...text];
    const counts = new Map();
    for (let at = 0; at < characters.length - 1; at += 1) {
        const pair = characters[at] + characters[at + 1];
        counts.set(pair, (counts.get(pair) ?? 0) + 1);
    }
    return counts;
}

// How much of one text's letter pairs the other shares, 0 to 1 (Dice). Words
// cannot be told apart in a script without spaces, but pairs of letters can
// be counted in any script, so a half-typed Khmer question still finds the
// row it is the start of, and one typed in other words the row it is like.
function toPairOverlap(left, right) {
    const leftCounts = toBigramCounts(left);
    const rightCounts = toBigramCounts(right);
    let shared = 0;
    let total = 0;
    for (const [pair, count] of leftCounts) {
        shared += Math.min(count, rightCounts.get(pair) ?? 0);
        total += count;
    }
    for (const count of rightCounts.values()) {
        total += count;
    }
    return total === 0 ? 0 : (2 * shared) / total;
}

const MIN_PAIR_OVERLAP = 0.3;

/**
 * A row against a question typed in a script without spaces: the whole of it,
 * the start of it, inside it, then letter pairs in common -- the row's SHOWN
 * words, which are that language's once its translation is in.
 */
function scoreScriptRow(row, compactQuery) {
    const compact = toCompact(row.text);
    if (compact.length === 0 || compactQuery.length === 0) {
        return 0;
    }
    if (compact === compactQuery) {
        return SCORE.exact;
    }
    let score = 0;
    if (compact.startsWith(compactQuery)) {
        score += SCORE.prefix;
    } else if (compact.includes(compactQuery)) {
        score += SCORE.textToken * 2;
    }
    const overlap = toPairOverlap(compact, compactQuery);
    if (overlap >= MIN_PAIR_OVERLAP) {
        score += Math.round(overlap * 100);
    }
    if (row.starter && score > 0) {
        score += SCORE.starter;
    }
    return score;
}

// One GROUP per word the user typed, holding that word and the words it is
// allowed to stand in for. Grouping is what lets "did every word they typed
// land somewhere?" stay answerable -- flattening the aliases into one list
// makes an alias of one word paper over another word that matched nothing.
function toQueryGroups(query) {
    const tokens = normalize(query).split(' ').filter(Boolean);
    return tokens.map((token) => {
        const variants = new Set([token]);
        for (const alias of QUERY_ALIASES[token] ?? []) {
            for (const part of alias.split(' ')) {
                variants.add(part);
            }
        }
        return { token, variants: [...variants] };
    });
}

// Weights, not a formula anyone should tune by feel: the words of the question
// itself outrank its keywords, which outrank the section it sits in, because a
// user typing "clear" means the question that says "clear", not every question
// in a section that happens to mention it.
// A whole word outranks a word that merely CONTAINS the query: typing "song"
// means the song questions, not "SongSelect will not connect", which is what a
// plain `includes` ranks first.
const SCORE = {
    exact: 1000,
    prefix: 400,
    prefixMidWord: 60,
    textToken: 60,
    textPrefix: 35,
    textPartial: 15,
    keywordToken: 30,
    keywordPrefix: 18,
    keywordPartial: 8,
    sectionToken: 12,
    pageToken: 6,
    // A starter is the CANONICAL question for its topic -- the one the empty
    // window offers. Big enough to win a tie against a near-duplicate that
    // happens to repeat the word twice, small enough never to outrank a
    // question the user actually typed the words of.
    starter: 25,
};

function toWordSet(text) {
    return new Set(text.split(' ').filter(Boolean));
}

// A word the user has not finished typing still counts -- "backg" must reach
// "background" -- but less than one they did, or every unfinished word drags
// in the longer word that merely starts the same way.
function checkWordPrefix(words, token) {
    for (const word of words) {
        if (word.length > token.length && word.startsWith(token)) {
            return true;
        }
    }
    return false;
}

function scoreRow(row, groups) {
    const text = normalize(row.text);
    const query = groups
        .map((group) => {
            return group.token;
        })
        .join(' ');
    if (query && text === query) {
        return SCORE.exact;
    }
    let score = 0;
    if (query && text.startsWith(query)) {
        // Landing mid-word is a much weaker signal than completing one: "song"
        // is a prefix of "SongSelect will not connect", and without this split
        // that outranks every question actually about songs.
        const next = text.charAt(query.length);
        score += next === '' || next === ' ' ? SCORE.prefix : SCORE.prefixMidWord;
    }
    const keywords = normalize(row.keywords.join(' '));
    const textWords = toWordSet(text);
    const keywordWords = toWordSet(keywords);
    const section = normalize(`${row.sectionLabel} ${row.panel ?? ''}`);
    const page = normalize(row.pageLabel);
    let hitCount = 0;
    for (const group of groups) {
        // A group scores once per PLACE it can land (the question's words, its
        // keywords, its section, its page) and, in each place, on its best
        // variant. Summing the places is what makes a question that says the
        // word AND lists it as a keyword beat one that merely contains it;
        // taking the best variant is what stops a word with many stand-ins
        // outranking the word the user actually wrote.
        let textScore = 0;
        let keywordScore = 0;
        let sectionScore = 0;
        let pageScore = 0;
        for (const token of group.variants) {
            if (textWords.has(token)) {
                textScore = Math.max(textScore, SCORE.textToken);
            } else if (checkWordPrefix(textWords, token)) {
                textScore = Math.max(textScore, SCORE.textPrefix);
            } else if (text.includes(token)) {
                textScore = Math.max(textScore, SCORE.textPartial);
            }
            if (keywordWords.has(token)) {
                keywordScore = Math.max(keywordScore, SCORE.keywordToken);
            } else if (checkWordPrefix(keywordWords, token)) {
                keywordScore = Math.max(keywordScore, SCORE.keywordPrefix);
            } else if (keywords.includes(token)) {
                keywordScore = Math.max(keywordScore, SCORE.keywordPartial);
            }
            if (section.includes(token)) {
                sectionScore = SCORE.sectionToken;
            }
            if (page.includes(token)) {
                pageScore = SCORE.pageToken;
            }
        }
        score += textScore + keywordScore + sectionScore + pageScore;
        if (textScore + keywordScore + sectionScore + pageScore > 0) {
            hitCount += 1;
        }
    }
    // Every word the user typed has to land somewhere. Without this a two-word
    // query is answered by whatever matches the commonest of the two, which is
    // how "clear background" comes back as ten unrelated "clear" questions.
    if (groups.length > 1 && hitCount < groups.length) {
        score = Math.round(score / 2);
    }
    // Only ever a TIE-BREAK between rows that matched. Added unconditionally
    // it becomes a floor, and a query matching nothing at all comes back as
    // the starter list -- a wrong answer dressed as a confident one.
    if (row.starter && score > 0) {
        score += SCORE.starter;
    }
    return score;
}

/**
 * Rank the corpus against what the user has typed so far. An empty query is
 * not an error -- it is the ask box before the first keystroke, and it answers
 * with the starters, which is what the window shows there anyway.
 */
export function matchQuestions(
    query = '',
    { focus = null, page = null, section = null, limit = 8, pages } = {},
) {
    const rows = flattenQuestions(pages).filter((row) => {
        if (page !== null && row.page !== page) {
            return false;
        }
        if (section !== null && row.section !== section) {
            return false;
        }
        return checkMatchesFocus(row, focus);
    });
    if (NON_LATIN_LETTER_PATTERN.test(String(query ?? ''))) {
        const compactQuery = toCompact(query);
        return rows
            .map((row) => {
                return { row, score: scoreScriptRow(row, compactQuery) };
            })
            .filter((item) => {
                return item.score > 0;
            })
            .sort((left, right) => {
                return right.score - left.score;
            })
            .slice(0, limit)
            .map((item) => {
                return item.row;
            });
    }
    const groups = toQueryGroups(query);
    if (groups.length === 0) {
        // The empty window only has room for a handful, and which handful
        // matters more than any ranking here: `starterRank` is where a human
        // says "these four, in this order". Everything else keeps corpus
        // order behind them.
        const starters = rows
            .filter((row) => {
                return row.starter;
            })
            .sort((left, right) => {
                return (
                    (left.starterRank ?? Number.MAX_SAFE_INTEGER) -
                    (right.starterRank ?? Number.MAX_SAFE_INTEGER)
                );
            });
        return (starters.length > 0 ? starters : rows).slice(0, limit);
    }
    return rows
        .map((row) => {
            // A translated row answers to its own words and to its English
            // ones: English typed in a Khmer window still finds it.
            const score =
                row.textEn === undefined || row.textEn === row.text
                    ? scoreRow(row, groups)
                    : Math.max(
                          scoreRow(row, groups),
                          scoreRow({ ...row, text: row.textEn }, groups),
                      );
            return { row, score };
        })
        .filter((item) => {
            return item.score > 0;
        })
        .sort((left, right) => {
            return right.score - left.score;
        })
        .slice(0, limit)
        .map((item) => {
            return item.row;
        });
}

/**
 * The corpus as an outline -- pages, sections and how many questions each
 * holds. This is what a model should see when it wants to know what the app
 * can be asked about, without paying for every question in the tool result.
 */
export function outlineQuestions({ focus = null, pages } = {}) {
    return pages
        .filter((page) => {
            return checkMatchesFocus(page, focus);
        })
        .map((page) => {
            return {
                page: page.page,
                label: page.label,
                sections: page.sections.map((section) => {
                    return {
                        id: section.id,
                        label: section.label,
                        count: (section.questions ?? []).length,
                    };
                }),
            };
        });
}
