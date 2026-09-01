// What the chatbot is allowed to know.
//
// `extra-work/build-knowledge.mjs` bundles two corpora into
// `electron-build/knowledge/` at build time:
//
//   manual/    the user-facing manual, generated from the live-verified
//              workflow recipes -- every step in it was observed working in
//              the real app, which is why answers are drawn from here first;
//   internal/  `.claude/**`, the notes written for whoever builds the app.
//              Ranked below the manual and labelled, so an answer quoting it
//              is never mistaken for a user instruction.
//
// A query reads ONE index file (~300 KB) rather than opening 120 markdown
// files, and reads a document in full only when it is actually opened. Nothing
// is held between questions: this runs inside the app, on machines where a
// cached corpus would be felt.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// tools/owa-devtools-mcp -> repo root
const REPO_ROOT = path.join(HERE, '..', '..');
const MAX_PAGE_BYTES = 256 * 1024;
// `MAX_PAGE_BYTES` guards the FILE READ. These guard the CONVERSATION, which is
// a different budget: whatever `readHelpPage` returns goes back as one tool
// result and then sits in `messages` for every remaining round of the loop, on
// the volunteer's own API key. The internal corpus is written for builders and
// runs to 208 KB in one file (~52 000 tokens), enough to cost more than the
// whole rest of the question and to push a small model out of its context
// window outright -- and `owa_help_search` hands that very id to the model as a
// top internal hit.
//
// Split by kind because the two corpora are read for different reasons. A
// manual page IS the answer and should arrive whole: the largest today is 37 KB
// and the cap is set above it, so nothing a user needs is cut. An internal note
// is only ever read to UNDERSTAND -- the prompt forbids quoting one -- so it is
// cut hard, and understanding survives the first few KB.
const MAX_MODEL_BYTES = { manual: 40 * 1024, internal: 8 * 1024 };

// Cut on a line boundary and SAY it was cut: a model handed a page that stops
// mid-sentence otherwise reports the steps end there.
function toBoundedBody(body, kind) {
    const limit = MAX_MODEL_BYTES[kind] ?? MAX_MODEL_BYTES.internal;
    if (body.length <= limit) {
        return body;
    }
    const cut = body.slice(0, limit);
    const lastBreak = cut.lastIndexOf('\n');
    return `${lastBreak > limit / 2 ? cut.slice(0, lastBreak) : cut}

[This note is longer than what is shown. You have the part that matters most;
do not tell the user anything was shortened.]`;
}
// The manual answers a user's question; the internal notes answer a builder's.
const KIND_WEIGHT = { manual: 1.5, internal: 1 };

/** The bundled knowledge dir, or null when the app was not built yet. */
export function findKnowledgeDirPath() {
    const candidates = [
        process.env.OWA_KNOWLEDGE_DIR,
        path.join(REPO_ROOT, 'electron-build', 'knowledge'),
    ].filter(Boolean);
    for (const candidate of candidates) {
        if (existsSync(path.join(candidate, 'index.json'))) {
            return candidate;
        }
    }
    return null;
}

function parseFrontMatter(content) {
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
    if (match === null) {
        return {};
    }
    const data = {};
    for (const line of match[1].split(/\r?\n/)) {
        const pair = /^([\w-]+):\s*(.*)$/.exec(line);
        if (pair !== null) {
            data[pair[1]] = pair[2].replace(/^["']|["']$/g, '');
        }
    }
    return data;
}

function toBody(content) {
    return content
        .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
        .replace(/:::\s*details[\s\S]*?:::\s*/g, '')
        .trim();
}

// Fallback for a source checkout with no build yet: the manual only.
function listSourceManualEntries() {
    const manualDirPath = path.join(REPO_ROOT, 'docs', 'manual-sources');
    if (!existsSync(manualDirPath)) {
        return [];
    }
    const filePaths = [];
    const walk = (dirPath) => {
        for (const entryName of readdirSync(dirPath)) {
            const entryPath = path.join(dirPath, entryName);
            if (statSync(entryPath).isDirectory()) {
                walk(entryPath);
            } else if (entryName.endsWith('.md')) {
                filePaths.push(entryPath);
            }
        }
    };
    walk(manualDirPath);
    return filePaths.map((filePath) => {
        const content = readFileSync(filePath, 'utf-8').slice(0, MAX_PAGE_BYTES);
        const frontMatter = parseFrontMatter(content);
        const body = toBody(content);
        return {
            id: frontMatter.id ?? path.basename(filePath, '.md'),
            title: frontMatter.title ?? path.basename(filePath, '.md'),
            section: frontMatter.section ?? '',
            kind: 'manual',
            absolutePath: filePath,
            searchText: body,
        };
    });
}

export function listKnowledgeEntries() {
    const knowledgeDirPath = findKnowledgeDirPath();
    if (knowledgeDirPath === null) {
        return listSourceManualEntries();
    }
    try {
        const index = JSON.parse(
            readFileSync(path.join(knowledgeDirPath, 'index.json'), 'utf-8'),
        );
        return (index.entries ?? []).map((entry) => {
            return {
                ...entry,
                absolutePath: path.join(knowledgeDirPath, entry.file),
            };
        });
    } catch (_error) {
        return listSourceManualEntries();
    }
}

// Counted on word boundaries, not as substrings: "up" used to match "group",
// "setup" and "coverage-expansion", which is how a robot-test note about
// keyboard shortcuts came back as the answer to "How do I look up a verse?".
// Khmer is written without spaces, so a non-ASCII term falls back to a plain
// substring count.
function countTerm(text, term) {
    if (!/^[a-z0-9]+$/.test(term)) {
        return text.split(term).length - 1;
    }
    // From four letters up the word may carry a tail -- "look" is how a user
    // says "lookup", "verse" is how they say "verses" -- and matching the
    // start of the word is all the stemming this corpus needs. Below four,
    // only whole words: "read" must not match "ready".
    const tail = term.length >= 4 ? '' : '(?![\\p{L}\\p{N}])';
    const matches = text.match(
        new RegExp(`(?<![\\p{L}\\p{N}])${term}${tail}`, 'gu'),
    );
    return matches === null ? 0 : matches.length;
}

// A volunteer does not ask in the app's words. They say "projector" for what
// the manual calls the screen, "big screen" for the same thing, and they
// describe a SYMPTOM ("nothing is showing") where the manual describes a
// control ("Show / hide the screen"). Pure lexical matching then hands them
// whichever page happens to contain their words, which is not the same page as
// the one that answers them: "Nothing is showing on the projector" returned the
// page about DRAWING on the app -- the only one of 43 that says "projector" at
// all -- while the page that actually answers it, the one carrying the
// show/hide button, the clear buttons and the display picker, matched one word
// of three and was squared out of contention by the coverage rule below.
//
// Expanding the QUERY rather than the corpus keeps this free: no rebuild, no
// tokens on any round, and nothing cached. Each group still counts as ONE term
// (see `countEntry`), so a question cannot win coverage by being wordy.
const TERM_ALIASES = {
    // What they call the thing they are pointing at. The manual says "screen",
    // "display", "output" and "audience"; it says "projector" once, in a page
    // about something else entirely.
    projector: ['screen', 'display', 'output', 'audience'],
    beamer: ['screen', 'display', 'output', 'audience'],
    monitor: ['screen', 'display', 'output'],
    tv: ['screen', 'display', 'output'],
    congregation: ['audience', 'screen'],
    // What they call the content on it.
    words: ['lyric', 'text', 'slide', 'verse'],
    song: ['lyric'],
    // How they describe it being wrong. These land on the controls that fix it
    // -- show/hide, the clears -- rather than on whatever page shares the
    // adjective.
    nothing: ['show', 'clear', 'blank'],
    blank: ['show', 'clear'],
    black: ['show', 'clear'],
    empty: ['show', 'clear'],
    missing: ['show', 'clear'],
    frozen: ['lock', 'clear'],
    stuck: ['lock', 'clear'],
};

// One pass over the corpus: what each term is worth in each entry. The counts
// are kept because the second pass needs them AND their spread across the
// corpus -- "verse" is in half the manual and settles nothing, "marks" is in
// three pages and settles everything.
//
// `terms` is a list of GROUPS -- the user's own word first, then the app's
// words for the same thing. A group scores as its best variant, so a page
// written in the app's vocabulary is reachable from the volunteer's without
// either one inflating the coverage denominator.
function countEntry(entry, terms) {
    // Three bands, because they are not equally telling. The page's own NAME
    // is the strongest ("Read the Bible" is what that page is); its headings
    // and one-line goal come close behind -- in this corpus they ARE the steps
    // ("Press Ctrl+B", "Clear Bible") and the goal is written in the user's
    // words; the body is weakest, and a long page must not win on length.
    const title = `${entry.id} ${entry.title}`.toLowerCase();
    const headings = `${entry.section} ${entry.headings ?? ''}`.toLowerCase();
    const text = entry.searchText.toLowerCase();
    return terms.map((group) => {
        return group.reduce(
            (best, term) => {
                const textCount = Math.min(countTerm(text, term), 3);
                return {
                    inTitle: best.inTitle || countTerm(title, term) > 0,
                    inHeadings:
                        best.inHeadings || countTerm(headings, term) > 0,
                    textCount: Math.max(best.textCount, textCount),
                };
            },
            { inTitle: false, inHeadings: false, textCount: 0 },
        );
    });
}

function scoreCounts(entry, counts, inverseFrequencies) {
    let score = 0;
    let matchedCount = 0;
    counts.forEach((count, index) => {
        if (!count.inTitle && !count.inHeadings && count.textCount === 0) {
            return;
        }
        matchedCount += 1;
        score +=
            ((count.inTitle ? 14 : 0) +
                (count.inHeadings ? 10 : 0) +
                count.textCount) *
            inverseFrequencies[index];
    });
    if (matchedCount === 0) {
        return 0;
    }
    // Squared coverage: a page carrying every word of the question beats one
    // that carries a single word of it many times over.
    const coverage = matchedCount / counts.length;
    return score * coverage * coverage * (KIND_WEIGHT[entry.kind] ?? 1);
}

// The help window is English-only, and the manual writes app labels with their
// Khmer twin ("Bible Lookup / ស្វែងរកព្រះគម្ពីរ"). Passing that on gives a
// reader who cannot read Khmer a label they cannot match to their screen.
export function toEnglishOnly(text) {
    return (
        text
            // Whatever introduced the twin goes with it -- "(\u17A2\u17B6\u1793)",
            // "Bible Lookup / \u179F\u17D2\u179C\u17C2\u1784\u179A\u1780", "Clear Bible \u2014 \u179F\u1798\u17D2\u17A2\u17B6\u178F" -- or the
            // leftover punctuation reads as a typo: "Bible Lookup / in the
            // header", "(Clear Bible \u2014)".
            .replace(/\s*\(\s*[\u1780-\u17FF][\u1780-\u17FF\u200b \t]*\)/gu, '')
            .replace(/\s*[/\u2013\u2014-]\s*[\u1780-\u17FF][\u1780-\u17FF\u200b \t]*(?=[),.;:]|$)/gmu, '')
            .replace(/\s*[/\u2013\u2014-]\s*[\u1780-\u17FF][\u1780-\u17FF\u200b \t]*/gu, ' ')
            .replace(/[\u1780-\u17FF\u19E0-\u19FF][\u1780-\u17FF\u200b \t]*/gu, '')
            .replace(/\(\s*\)/g, '')
            // A label that was Khmer and nothing else leaves its markers behind.
            .replace(/\*\*\s*\*\*|`\s*`/g, '')
            .replace(/[ \t]{2,}/g, ' ')
            .replace(/[ \t]+([),.;:])/g, '$1')
            .trimEnd()
    );
}

function genExcerpt(text, terms) {
    // Headings are dropped: the top one repeats the title the caller already
    // shows, which made every answer say the same thing twice.
    const lines = text.split(/\r?\n/).filter((line) => {
        return !line.startsWith('#');
    });
    const hitIndex = lines.findIndex((line) => {
        const lowerLine = line.toLowerCase();
        return terms.some((term) => {
            return lowerLine.includes(term);
        });
    });
    if (hitIndex === -1) {
        return lines
            .filter((line) => {
                return line.trim();
            })
            .slice(0, 3)
            .join('\n');
    }
    return lines
        .slice(Math.max(0, hitIndex - 1), hitIndex + 4)
        .join('\n')
        .trim();
}

// A recipe for the other half of the app is worse than no recipe: it names
// buttons that are not on the user's screen. Dropped outright when anything
// else matched, kept when it is all there is.
function applyFocus(ranked, focus) {
    if (focus !== 'presenter' && focus !== 'reader') {
        return ranked;
    }
    const fitting = ranked.filter((item) => {
        return (
            item.entry.surface === null ||
            item.entry.surface === undefined ||
            item.entry.surface === focus
        );
    });
    if (fitting.length === 0) {
        return ranked;
    }
    // A page written FOR this window beats a page that merely also applies to
    // it: asked from the reader, "read the Bible there" is a better answer
    // than a page about keeping files beside a verse, even when the second
    // one happens to carry the question's words in its name.
    return fitting
        .map((item) => {
            return item.entry.surface === focus
                ? { ...item, score: item.score * 1.3 }
                : item;
        })
        .sort((one, other) => {
            return other.score - one.score;
        });
}

// Every question carries these, so they say nothing about which page answers
// it -- and left in, they drag the coverage score of a page that happens to
// contain "do" up beside the page that actually matches.
const STOP_WORDS = new Set([
    'the', 'and', 'for', 'you', 'your', 'can', 'how', 'what', 'where', 'when',
    'why', 'who', 'does', 'did', 'this', 'that', 'with', 'from', 'into', 'onto',
    'are', 'was', 'were', 'has', 'have', 'had', 'its', 'it', 'my', 'me', 'we',
    'do', 'in', 'on', 'to', 'of', 'is', 'be', 'or', 'an', 'at', 'by', 'as',
    'if', 'so', 'up', 'out', 'get', 'got', 'any', 'all', 'one', 'not', 'but',
    'app', 'please', 'want', 'need', 'make', 'made', 'use', 'using', 'there',
]);

function toTerms(query) {
    const terms = query
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((term) => {
            return term.length > 1 && !STOP_WORDS.has(term);
        });
    // A question made of nothing but stop words still deserves an answer.
    const kept = terms.length > 0 ? terms : query.toLowerCase().split(/\s+/);
    return [...new Set(kept)]
        .filter((term) => {
            return term.length > 1;
        })
        .map((term) => {
            // The user's own word stays first: it is what `genExcerpt` quotes
            // back, and an excerpt in the app's words is the useful half.
            return [term, ...(TERM_ALIASES[term] ?? [])];
        });
}

/**
 * `kind`: `manual` or `internal` to search one corpus, anything else (the
 * default) to prefer the manual -- internal notes are returned only when the
 * manual has nothing, so a user's "how do I ...?" is never answered with a
 * page written for whoever builds the app.
 */
export function searchHelp(query, limit = 5, kind = 'auto', focus = null) {
    const terms = toTerms(query);
    if (terms.length === 0) {
        return [];
    }
    // The excerpt is quoted to a person, so it looks for any word the query
    // reaches -- theirs or the app's -- and shows the line carrying it.
    const excerptTerms = terms.flat();
    const counted = listKnowledgeEntries()
        .filter((entry) => {
            return kind === 'manual' || kind === 'internal'
                ? entry.kind === kind
                : true;
        })
        .map((entry) => {
            return { entry, counts: countEntry(entry, terms) };
        });
    const inverseFrequencies = terms.map((_term, index) => {
        const documentCount = counted.filter(({ counts }) => {
            return (
                counts[index].inTitle ||
                counts[index].inHeadings ||
                counts[index].textCount > 0
            );
        }).length;
        return Math.log(1 + counted.length / Math.max(documentCount, 1));
    });
    const ranked = counted
        .map(({ entry, counts }) => {
            return {
                entry,
                score: scoreCounts(entry, counts, inverseFrequencies),
            };
        })
        .filter((item) => {
            return item.score > 0;
        })
        .sort((one, other) => {
            return other.score - one.score;
        });
    const manualRanked = ranked.filter((item) => {
        return item.entry.kind === 'manual';
    });
    const chosen = applyFocus(
        kind === 'auto' && manualRanked.length > 0 ? manualRanked : ranked,
        focus,
    );
    return chosen
        .slice(0, limit)
        .map(({ entry, score }) => {
            return {
                id: entry.id,
                title: entry.title,
                section: entry.section,
                kind: entry.kind,
                surface: entry.surface ?? null,
                score: Math.round(score),
                excerpt: toEnglishOnly(
                    genExcerpt(entry.searchText, excerptTerms),
                ),
            };
        });
}

export function readHelpPage(id) {
    const wantedId = id.trim().toLowerCase();
    const entry = listKnowledgeEntries().find((item) => {
        return (
            item.id.toLowerCase() === wantedId ||
            item.title.toLowerCase() === wantedId
        );
    });
    if (entry === undefined) {
        return null;
    }
    try {
        const content = readFileSync(entry.absolutePath, 'utf-8').slice(
            0,
            MAX_PAGE_BYTES,
        );
        return { ...entry, body: toBoundedBody(toBody(content), entry.kind) };
    } catch (_error) {
        // Indexed but unreadable (a partial install): the index copy still
        // answers something rather than nothing.
        return { ...entry, body: toBoundedBody(entry.searchText, entry.kind) };
    }
}
