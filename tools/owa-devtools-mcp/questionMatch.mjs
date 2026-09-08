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
                    kind: question.kind ?? 'howto',
                    page: page.page,
                    pageLabel: page.label,
                    focus: page.focus ?? null,
                    section: section.id,
                    sectionLabel: section.label,
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

function normalize(text) {
    return String(text ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
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
            return { row, score: scoreRow(row, groups) };
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
