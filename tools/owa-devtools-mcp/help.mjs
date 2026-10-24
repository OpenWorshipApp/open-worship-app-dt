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

import { getBotFocus } from './botFocus.mjs';
import {
  genPagePartNote,
  readManualPageDate,
  toManualPageBody,
} from './manualPage.mjs';
import {
  genPassageExcerpt,
  genQuestionAnchors,
  genTranslatedExcerpt,
} from './passageMatch.mjs';
import { flattenQuestions } from './questionMatch.mjs';
import { loadQuestionOverlays, loadQuestionPages } from './questions.mjs';
import { loadTranBundle, resolveTranTemplates } from './tran.mjs';
import { listManualTranslations } from './manualI18n.mjs';
import {
  findQuestionLanguage,
  toEnglishSearchWords,
} from './queryLanguage.mjs';

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
// manual page IS the answer and should arrive whole: the cap was set above the
// largest one, 37 KB then. An internal note is only ever read to UNDERSTAND --
// the prompt forbids quoting one -- so it is cut hard, and understanding
// survives the first few KB.
//
// The help window's own page outgrew that cap (57 KB, 2026-10-12), and the cut
// took its last seven steps from every reader at once: the model, the
// walkthrough card, and the window's own pre-read, which chooses what rides on
// a question out of the page it is handed -- "Can you walk me through it step
// by step?" is answered by step 14, which nobody could reach. Raising the cap
// would put 15 000 tokens of one page into a local model's 32k window. So a
// manual page longer than the cap comes in PARTS (`toPageParts`), each within
// it, each but the last saying how to read the next.
const MAX_MODEL_BYTES = { manual: 40 * 1024, internal: 8 * 1024 };
const STEP_START_PATTERN = /\n(?=\d+[a-z]?\. )/g;

/**
 * A page as the parts it is read in, none longer than `limit`: divided at
 * the last numbered step that starts in the second half of the room, so a
 * part opens on a step, and failing that at a line.
 */
export function toPageParts(body, limit = MAX_MODEL_BYTES.manual) {
  const parts = [];
  let rest = String(body ?? '');
  while (rest.length > limit) {
    const room = rest.slice(0, limit);
    let cutAt = -1;
    for (const match of room.matchAll(STEP_START_PATTERN)) {
      cutAt = match.index;
    }
    if (cutAt < limit / 2) {
      cutAt = room.lastIndexOf('\n');
    }
    if (cutAt < limit / 2) {
      cutAt = limit;
    }
    parts.push(rest.slice(0, cutAt).trimEnd());
    rest = rest.slice(cutAt).replace(/^\n+/, '');
  }
  parts.push(rest);
  return parts;
}

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
    const body = toManualPageBody(content);
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

/**
 * The manual's pages in one of the app's other languages that are still
 * translations of the English as it stands (`manualI18n.mjs`), from the
 * bundle's `index.<code>.json` -- read only when a window in that language
 * asks, per call, like the English index -- or straight from
 * `docs/manual-i18n/` in a checkout with no build.
 */
export function listTranslatedEntries(langCode) {
  const code = String(langCode ?? '').split('-')[0];
  if (code === '' || code === 'en') {
    return [];
  }
  const knowledgeDirPath = findKnowledgeDirPath();
  if (knowledgeDirPath !== null) {
    const indexPath = path.join(knowledgeDirPath, `index.${code}.json`);
    if (!existsSync(indexPath)) {
      return [];
    }
    try {
      const index = JSON.parse(readFileSync(indexPath, 'utf-8'));
      return (index.entries ?? [])
        .filter((entry) => {
          return entry.isStale !== true;
        })
        .map((entry) => {
          return {
            ...entry,
            absolutePath: path.join(knowledgeDirPath, entry.file),
          };
        });
    } catch (_error) {
      return [];
    }
  }
  return listManualTranslations(code)
    .filter((page) => {
      return !page.isStale;
    })
    .map((page) => {
      return {
        id: page.id,
        lang: code,
        title: page.title,
        section: page.section,
        kind: 'manual',
        absolutePath: page.absolutePath,
        searchText: toManualPageBody(page.content),
      };
    });
}

// A page asked for IN a language: `W-06@km`. Only the window asks this way
// (a person's "Read the whole thing" in a Khmer window), so the tool's schema
// carries no extra field for it.
const LANGUAGE_PAGE_ID_PATTERN = /^(.+)@([a-z]{2})$/;

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
  // says "lookup", "verse" is how they say "verses" -- but only a SHORT one.
  // Unbounded, a term matched any longer word that merely STARTS the same
  // way, and 45 such pairs are live in this corpus: "copy" was "copyright",
  // "song" was "SongSelect", "back" was "background", "down" was "download",
  // "stop" was "stopwatch" and "screen" was "Screencast". Ten of them land in
  // a page TITLE, where a match is worth 14 -- which is how
  // `owa_help_search "show screen"` put the page about the keyboard
  // screencast strip (score 77) above the page about the projector (57), and
  // so how a question about what the audience can see started an eight-step
  // walkthrough of a keyboard toy.
  //
  // Three letters keeps every inflection this corpus actually needs
  // ("verses" +1, "screens" +1, "lookup" +2, "presenting" +3) and cuts all 45
  // of those pairs, the shortest of which adds four. A real form that doubles
  // its consonant ("dragging") is lost with them; the base word still
  // matches, and a wrong page is the more expensive of the two mistakes.
  // Below four letters, only whole words: "read" must not match "ready".
  const tail =
    term.length >= 4
      ? '[\\p{L}\\p{N}]{0,3}(?![\\p{L}\\p{N}])'
      : '(?![\\p{L}\\p{N}])';
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
  // Reader questions often describe the problem, not the setting. These
  // everyday words lead to the Reader controls that solve it.
  small: ['font size', 'bigger text', 'too small', 'read'],
  tiny: ['font size', 'bigger text', 'too small', 'read'],
  lost: ['history', 'recent', 'previous', 'back', 'reference'],
  john: ['reference'],
  bibles: ['bible', 'version', 'translation'],
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
  // ("Press Ctrl+B", "Clear Long Text") and the goal is written in the user's
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
          inHeadings: best.inHeadings || countTerm(headings, term) > 0,
          textCount: Math.max(best.textCount, textCount),
        };
      },
      { inTitle: false, inHeadings: false, textCount: 0 },
    );
  });
}

function scoreCounts(entry, counts, inverseFrequencies) {
  let score = 0;
  let matchedWeight = 0;
  let totalWeight = 0;
  counts.forEach((count, index) => {
    totalWeight += inverseFrequencies[index];
    if (!count.inTitle && !count.inHeadings && count.textCount === 0) {
      return;
    }
    matchedWeight += inverseFrequencies[index];
    score +=
      ((count.inTitle ? 14 : 0) +
        (count.inHeadings ? 10 : 0) +
        count.textCount) *
      inverseFrequencies[index];
  });
  if (matchedWeight === 0) {
    return 0;
  }
  // Coverage weighted by how much each word SETTLES, not by how many words
  // matched. Counting words read "How do I move to the next slide?" as a
  // three-word question, and the page that answers it -- W-03, whose step 3
  // is "step through slides ... Arrow keys / PageUp / PageDown" -- carries
  // only "slide". One of three, squared, is a 0.11 multiplier: it scored 7,
  // while a presenting-flow page that happens to say "move", "next" and
  // "slide" in passing scored 27. "move" and "next" are everywhere in this
  // corpus and settle nothing, and the inverse frequencies computed for the
  // score already say so, so the same numbers build the ratio for free.
  //
  // No longer squared: the weighting is the discrimination the square was
  // standing in for, and squaring on top of it put the pages that answer a
  // long question back out of reach.
  const coverage = matchedWeight / totalWeight;
  return score * coverage * (KIND_WEIGHT[entry.kind] ?? 1);
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
      // Any bracket holding Khmer at all, not only one holding
      // NOTHING else: "(ទាញយកពី URL)" is the twin of
      // "Download From URL", and stripping just its Khmer left a
      // card reading "...choose Download From URL (URL)".
      .replace(/\s*\([^()]*[\u1780-\u17FF][^()]*\)/gu, '')
      .replace(
        /\s*[/\u2013\u2014-]\s*[\u1780-\u17FF][\u1780-\u17FF\u200b \t]*(?=[),.;:]|$)/gmu,
        '',
      )
      .replace(
        /\s*[/\u2013\u2014-]\s*[\u1780-\u17FF][\u1780-\u17FF\u200b \t]*/gu,
        ' ',
      )
      .replace(/[\u1780-\u17FF\u19E0-\u19FF][\u1780-\u17FF\u200b \t]*/gu, '')
      .replace(/\(\s*\)/g, '')
      // A label that was Khmer and nothing else leaves its markers behind --
      // an EMPTY pair, standing alone. Not the closing and opening markers of
      // two bolds side by side: `**Take it down.** **Hide Long Text**` came
      // out as one bold reading `Take it down.Hide Long Text` (W-53 and nine
      // other pages, in every language).
      .replace(/(^|[\s(])(?:\*\*\s*\*\*|`\s*`)(?=[\s),.;:]|$)/gm, '$1')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/[ \t]+([),.;:])/g, '$1')
      .trimEnd()
  );
}

// The recipe ids a page cites in passing -- "(W-08 step 1)", "see W-28" --
// leave the text here rather than being argued about in the prompt. The
// prompt forbids showing a volunteer "W-06"; measured 2026-09-08, a model that
// had only SEARCHED still opened its answer with "W-08 has exactly what you
// need", because the id was in the excerpt and in the hit, and a rule the
// model can ignore is not a rule. Shared by the page tool and the excerpts,
// which used to differ: the page was scrubbed, the excerpt was not, and the
// excerpt is what a two-round answer is written from. Only the parenthesised
// aside goes whole -- line breaks and indentation are a page's step structure
// and must survive. The `id` FIELD of a hit is untouched: it is the handle
// `owa_help_page` and `owa_guide_start` take, and the window scrubs whatever
// still reaches the answer (`scrubRecipeIds` in `quickReplyHelpers.ts`).
export function scrubRecipeIds(text) {
  // The hyphen is any a model types -- a non-breaking one (U+2011) walked
  // "W‑42" past this on 2026-10-10 -- as in the window's own scrub.
  return (
    String(text ?? '')
      .replace(
        /[ \t]*[([][^)\]\n]*\b[A-Z]{1,3}[-‐-–−]\d{1,3}[a-z]?\b[^)\]\n]*[)\]]/g,
        '',
      )
      .replace(/\b[A-Z]{1,3}[-‐-–−]\d{1,3}[a-z]?\b/g, '')
      // "-- see W-28." with its id gone is "-- see.", which reads as a
      // typo; the pointer goes with what it pointed at.
      .replace(/(?:\s*[–—-])?\s*\bsee(?:\s+also)?\s*(?=[.,;:)]|$)/gim, '')
      .replace(/[ \t]+([.,;:])/g, '$1')
      .replace(/[,;:](?=[.,;:])/g, '')
      // Only INSIDE a line: the leading spaces are what keep a wrapped step
      // attached to its number.
      .replace(/(?<=\S)[ \t]{2,}/g, ' ')
  );
}

// A recipe for another window is worse than no recipe: it names buttons that
// are not on the user's screen. Dropped outright when anything else matched,
// kept when it is all there is.
//
// A manual page whose `surface` stayed null applies everywhere, so a focus the
// manual has no page written FOR -- the Web Editor, say -- filters nothing out
// and simply ranks by relevance. That is the safe direction to fail in.
function applyFocus(ranked, focus) {
  if (getBotFocus(focus) === null) {
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
  'the',
  'and',
  'for',
  'you',
  'your',
  'can',
  'how',
  'what',
  'where',
  'when',
  'why',
  'who',
  'does',
  'did',
  'this',
  'that',
  'with',
  'from',
  'into',
  'onto',
  'are',
  'was',
  'were',
  'has',
  'have',
  'had',
  'its',
  'it',
  'my',
  'me',
  'we',
  'do',
  'in',
  'on',
  'to',
  'of',
  'is',
  'be',
  'or',
  'an',
  'at',
  'by',
  'as',
  'if',
  'so',
  'up',
  'out',
  'get',
  'got',
  'any',
  'all',
  'one',
  'not',
  'but',
  'app',
  'please',
  'help',
  'want',
  'need',
  'make',
  'made',
  'use',
  'using',
  'there',
  'too',
  'each',
  'other',
]);

function toTerms(query) {
  // Marks are part of a word: Khmer vowel signs and its subscript mark are
  // `\p{M}`, and splitting on them cut `ស្វែងរក` into pieces no page holds.
  const terms = query
    .toLowerCase()
    .split(/[^\p{L}\p{M}\p{N}]+/u)
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
 * The terms a question is searched by. A question in a script the guide is
 * not written in (Khmer) is read as the English words it names
 * (`queryLanguage.mjs`): each label or question word one group of
 * alternatives, the way `TERM_ALIASES` widens an English word. Whatever was
 * in Latin letters beside it (a key name, an English word) is read as
 * always.
 */
function toSearchTerms(query, bundle) {
  const language = findQuestionLanguage(query, bundle?.languages);
  if (language === null) {
    return toTerms(query);
  }
  const { groups, rest } = toEnglishSearchWords(
    query,
    bundle?.dictionaries?.[language.code] ?? {},
    language.facts,
  );
  // A label of several words counts as the phrase -- the page that NAMES the
  // control scores for it -- and as its words, the way the same question
  // typed in English is counted.
  const groupTerms = groups
    .flatMap((group) => {
      const phraseWords = group.find((one) => {
        return one.includes(' ');
      });
      return phraseWords === undefined
        ? [group]
        : [group, ...phraseWords.split(' ').map((word) => [word])];
    })
    .map((group) => {
      const words = group
        .filter((word) => {
          return word.length > 1 && !STOP_WORDS.has(word);
        })
        .flatMap((word) => {
          return [word, ...(TERM_ALIASES[word] ?? [])];
        });
      return [...new Set(words)];
    })
    .filter((group) => {
      return group.length > 0;
    });
  const restTerms = /[\p{L}\p{N}]/u.test(rest) ? toTerms(rest) : [];
  const seen = new Set();
  return [...restTerms, ...groupTerms].filter((group) => {
    if (seen.has(group[0])) {
      return false;
    }
    seen.add(group[0]);
    return true;
  });
}

/**
 * `kind`: `manual` or `internal` to search one corpus, anything else (the
 * default) to prefer the manual -- internal notes are returned only when the
 * manual has nothing, so a user's "how do I ...?" is never answered with a
 * page written for whoever builds the app.
 */
/**
 * The recipe a question was FILED under, when the query IS one of the
 * corpus's own questions -- a chip, a row of the suggestion list, the More
 * list. The words of a supported question are then not evidence to be
 * weighed but a label already read: measured 2026-09-02 on all 258 corpus
 * questions with a recipe, the ranking below put that recipe first for 57%
 * of them, so a question picked off the app's own list got the wrong page
 * two times in five. A paraphrase never matches here and is ranked as
 * before -- this is a lookup, not a second ranker.
 */
// Letters of every script: a Khmer chip's words were an empty key.
function toQuestionKey(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();
}

export function findKnownQuestionRow(query) {
  const key = toQuestionKey(query);
  if (key.length === 0) {
    return null;
  }
  let pages;
  try {
    pages = loadQuestionPages();
  } catch {
    // No corpus on disk is no reason for a search to fail.
    return null;
  }
  const rows = flattenQuestions(pages);
  const row = rows.find((one) => {
    return toQuestionKey(one.text) === key;
  });
  if (row !== undefined) {
    return row;
  }
  // A chip pressed in another language is that row in its words
  // (`questions/i18n/`), read only for a question that is not in Latin
  // letters -- the chip a Khmer window shows.
  if (!/(?=\p{L})\P{Script=Latin}/u.test(String(query ?? ''))) {
    return null;
  }
  for (const overlay of loadQuestionOverlays()) {
    for (const [id, words] of Object.entries(overlay.questions ?? {})) {
      if (toQuestionKey(words?.text) !== key) {
        continue;
      }
      // A translation of words the row no longer says is no label of it.
      const translated = rows.find((one) => {
        return one.id === id && one.text === words.en;
      });
      if (translated !== undefined) {
        return translated;
      }
    }
  }
  return null;
}

export function findKnownQuestionRecipe(query) {
  return findKnownQuestionRow(query)?.resources?.recipe ?? null;
}

// Added to the top score so the known page is first whatever the words did.
const KNOWN_QUESTION_BONUS = 100;

export function searchHelp(
  query,
  limit = 5,
  kind = 'auto',
  focus = null,
  langCode = null,
) {
  // One read of the label dictionary for the whole search: the question's
  // own words (a Khmer question is read through it) and every excerpt.
  const tranBundle = loadTranBundle();
  const terms = toSearchTerms(query, tranBundle);
  if (terms.length === 0) {
    return [];
  }
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
  // A supported question's own recipe goes first, marked, so a caller can
  // tell a label from a guess. Only the manual can be filed under: the
  // internal corpus is never the answer to a question a user picked.
  const knownRow = kind === 'internal' ? null : findKnownQuestionRow(query);
  const knownId = knownRow?.resources?.recipe ?? null;
  // What a supported question is about -- its control, its menu item, its
  // key -- says which PASSAGE of its page to quote, whatever the words did.
  const knownAnchors =
    knownId === null ? [] : genQuestionAnchors(knownRow.resources);
  const known =
    knownId === null
      ? undefined
      : counted.find(({ entry }) => {
          return entry.id === knownId;
        });
  const picked =
    known === undefined
      ? chosen
      : [
          {
            entry: known.entry,
            score: (chosen[0]?.score ?? 0) + KNOWN_QUESTION_BONUS,
            isKnownQuestion: true,
          },
          ...chosen.filter(({ entry }) => {
            return entry.id !== knownId;
          }),
        ];
  // The translated pages, only for a manual search in another language
  // (the offline guide's): the index of that language is read then and only
  // then.
  const translatedMap = new Map(
    (kind === 'manual' ? listTranslatedEntries(langCode) : []).map((one) => {
      return [one.id, one];
    }),
  );
  return picked.slice(0, limit).map(({ entry, score, isKnownQuestion }) => {
    return {
      id: entry.id,
      title: entry.title,
      section: entry.section,
      kind: entry.kind,
      surface: entry.surface ?? null,
      score: Math.round(score),
      ...(isKnownQuestion === true ? { isKnownQuestion: true } : {}),
      // The passage that answers, quoted whole (`passageMatch.mjs`). It used
      // to be the first line carrying ANY word of the query and the four
      // lines after it: measured 2026-10-12 over the 398 supported questions
      // that name a page, that quoted the control the question is about for
      // 37 of 166 (now 160), its key for 11 of 35 (28) and its menu for 4 of
      // 14 (14), and 252 excerpts stopped mid-sentence without saying so.
      // "am" in "What version of the app am I running?" was found inside
      // "the same", so the answer to it was the find bar's Enter key.
      excerpt: resolveTranTemplates(
        scrubRecipeIds(
          toEnglishOnly(
            genPassageExcerpt(
              entry.searchText,
              terms,
              isKnownQuestion === true ? knownAnchors : [],
            ),
          ),
        ),
        langCode,
        tranBundle,
      ),
      ...genTranslatedFields(
        entry,
        translatedMap,
        terms,
        isKnownQuestion === true ? knownAnchors : [],
        langCode,
        tranBundle,
      ),
    };
  });
}

/**
 * What a hit says in the window's language, when its page is translated and
 * current: the same passage out of the translation, and its title. Asked for
 * only by a manual search in a non-English window -- the guide's offline
 * answer quotes it; a model reads the English page (`owa_help_page`).
 */
function genTranslatedFields(
  entry,
  translatedMap,
  terms,
  anchors,
  langCode,
  tranBundle,
) {
  const translated = translatedMap.get(entry.id);
  if (translated === undefined) {
    return {};
  }
  const excerpt = genTranslatedExcerpt(
    entry.searchText,
    translated.searchText,
    terms,
    anchors,
  );
  if (excerpt === null) {
    return {};
  }
  return {
    titleInLanguage: translated.title,
    excerptInLanguage: resolveTranTemplates(
      scrubRecipeIds(excerpt),
      langCode,
      tranBundle,
    ),
  };
}

// Where the NEWEST copy of a manual page is: the project's own repository.
// The pages on this computer were written when its release was built; a
// control renamed since, or a page that was wrong and has been fixed, is
// right there first. Only a manual page has one -- the address is put
// together here from the index, never from anything a model wrote, and the
// developer notes are not what a volunteer's answer comes from.
const MANUAL_REPO_RAW_URL =
  'https://raw.githubusercontent.com/OpenWorshipApp/open-worship-app-dt/' +
  'main/docs/manual-sources/';
const MANUAL_FILE_PREFIX = 'manual/';

export function genFreshPageUrl(entry) {
  if (
    entry.kind !== 'manual' ||
    typeof entry.file !== 'string' ||
    !entry.file.startsWith(MANUAL_FILE_PREFIX) ||
    entry.file.includes('..')
  ) {
    return null;
  }
  return (
    MANUAL_REPO_RAW_URL +
    entry.file
      .slice(MANUAL_FILE_PREFIX.length)
      .split('/')
      .map(encodeURIComponent)
      .join('/')
  );
}

/**
 * One knowledge document. `part` is which part of a manual page too long for
 * one read (1 by default; past the last, the last), or `'whole'` for a
 * caller that sends none of it to a model -- the walkthrough card is built
 * from every step.
 */
export function readHelpPage(
  id,
  langCode = null,
  part = 1,
  // The page as written, `[en:tran:…]` and all: what the walkthrough card
  // reads its steps from to put each one into the app's language AFTER every
  // rule that reads the recipe's own English words has run (`owaTools.mjs`).
  { keepTemplates = false } = {},
) {
  let wantedId = id.trim().toLowerCase();
  // `W-06@km`: the page in that language when its translation is current,
  // and the English page (its labels in that language) when it is not.
  const languageMatch = LANGUAGE_PAGE_ID_PATTERN.exec(wantedId);
  let translatedEntry;
  if (languageMatch !== null) {
    wantedId = languageMatch[1];
    langCode = languageMatch[2];
    translatedEntry = listTranslatedEntries(languageMatch[2]).find((item) => {
      return item.id.toLowerCase() === wantedId;
    });
  }
  const entry =
    translatedEntry ??
    listKnowledgeEntries().find((item) => {
      return (
        item.id.toLowerCase() === wantedId ||
        item.title.toLowerCase() === wantedId
      );
    });
  if (entry === undefined) {
    return null;
  }
  // Templates are filled in BEFORE the cut, so a page trimmed at the byte
  // cap can never end halfway through a token and hand the model a bare
  // `[en:tran:Clear` to read out to somebody.
  const tranBundle = loadTranBundle();
  const toPageBody = (raw) => {
    const text = keepTemplates
      ? raw
      : resolveTranTemplates(raw, langCode, tranBundle);
    if (part === 'whole') {
      return { body: text, part: 1, partCount: 1 };
    }
    if (entry.kind !== 'manual') {
      return { body: toBoundedBody(text, entry.kind), part: 1, partCount: 1 };
    }
    const parts = toPageParts(text);
    const wanted = Math.min(
      Math.max(Math.trunc(Number(part)) || 1, 1),
      parts.length,
    );
    return {
      body: parts[wanted - 1] + genPagePartNote(wanted, parts.length),
      part: wanted,
      partCount: parts.length,
    };
  };
  try {
    const content = readFileSync(entry.absolutePath, 'utf-8').slice(
      0,
      MAX_PAGE_BYTES,
    );
    return {
      ...entry,
      ...toPageBody(toManualPageBody(content)),
      // The day this copy was generated, for telling it from the newest one.
      date: readManualPageDate(content),
    };
  } catch (_error) {
    // Indexed but unreadable (a partial install): the index copy still
    // answers something rather than nothing.
    return { ...entry, ...toPageBody(entry.searchText), date: null };
  }
}
