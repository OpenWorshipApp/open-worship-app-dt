// Which PASSAGE of a guide page answers a question.
//
// Deliberately free of `node:fs` and of every other node built-in, for the
// same reason as `questionMatch.mjs` and `botFocus.mjs`: the MCP server uses
// it to quote a page in a search hit, and the chatbot window bundles the very
// same module to decide what part of a long page rides on a question. One
// reading of a page, two callers -- an excerpt that quotes one step while the
// model is handed another is an answer that contradicts its own source.

// How long an excerpt may run. It is read by a person under the page's title
// and by a model in a list of hits, so it is one passage, not a page.
export const EXCERPT_CHAR_LIMIT = 480;
// A passage shorter than this is topped up with what follows it.
const EXCERPT_SHORT_LENGTH = 160;
const LIST_LINE_PATTERN = /^\s*(?:\d+[a-z]?[.)]|[-*•])\s+/;
// A paragraph inside a step opens on a bold LEAD -- a whole bolded sentence,
// its full stop or colon inside the bold: "**Tab only fills the box.**". The
// manual sets those under one another with no blank line between, and the
// help window's own page is five hundred lines with six blank ones: read by
// blank lines alone, one "passage" of it ran to fourteen thousand characters.
// A line that merely STARTS with a bold word ("**Alt+↑** puts the question
// back") is the sentence before it carrying on, and stays where it is.
// A sentence may end in Khmer's full stop (`។`): a translated page
// (`manualI18n.mjs`) must fall into the same passages as its English one.
const BOLD_LEAD_PATTERN = /^\s*\*\*[^*\n]{3,160}[.:?!។]\*\*/;
// The same lead when the manual's ninety-character wrap carried it over a
// line break: "**Auto, the last row of that list, chooses for you — among
// the assistants that" / "cost nothing.** Pick …". Five of the help window's
// leads were wrapped, each stayed inside the step above it, and the step that
// lists who answers ran to 6 800 characters -- longer than what rides.
const BOLD_LEAD_OPEN_PATTERN = /^\s*\*\*[^*\n]{3,160}$/;
const BOLD_LEAD_CLOSE_PATTERN = /^\s*[^*\n]{1,160}[.:?!។]\*\*/;
// Past this length a passage is several subjects under one lead, and its
// words count for less (see `rankPassages`).
const LONG_PASSAGE_LENGTH = 2500;
// The manual marks a step that has a screenshot with a camera. It means
// nothing to somebody reading the words, and less to a model.
const SCREENSHOT_MARK_PATTERN = /\s*📸/gu;

/**
 * Whether a line opens a paragraph on a bold lead, wrapped over to the next
 * line or not. Shared with the chatbot's cut of a translated page
 * (`splitPageBlocks`), which has to fall into the same paragraphs.
 */
export function checkIsBoldLeadLine(line, nextLine = '') {
  return (
    BOLD_LEAD_PATTERN.test(line) ||
    (BOLD_LEAD_OPEN_PATTERN.test(line) &&
      BOLD_LEAD_CLOSE_PATTERN.test(nextLine ?? ''))
  );
}

/** Lower case, labels out of their `[en:tran:…]` templates, words only. */
export function toPassageKey(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/\[[a-z]{2}:tran:([^\]]+)\]/g, '$1')
    .replace(/[^\p{L}\p{N}+]+/gu, ' ')
    .trim();
}

/**
 * The page as passages: a numbered step, a bullet or a paragraph, each with
 * the lines the manual wrapped it over joined back into one. The manual is
 * hard-wrapped at about ninety characters, and a passage quoted line by line
 * reads as a column of half sentences in a window half that wide -- with a
 * bold that crosses a line break drawn as its asterisks.
 *
 * Each passage keeps where it starts in the page, so a caller that cuts the
 * page (rather than quoting it) can cut at a passage's own first character.
 */
export function toPassages(text) {
  const passages = [];
  let current = null;
  const close = () => {
    if (current !== null && current.text.trim().length > 0) {
      passages.push({ text: current.text.trim(), at: current.at });
    }
    current = null;
  };
  let offset = 0;
  const rawLines = String(text ?? '').split('\n');
  for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex++) {
    const rawLine = rawLines[lineIndex];
    const lineAt = offset;
    offset += rawLine.length + 1;
    const line = rawLine.replace(/\s+$/, '');
    if (line.trim().length === 0 || line.trimStart().startsWith('#')) {
      close();
      continue;
    }
    if (
      LIST_LINE_PATTERN.test(line) ||
      checkIsBoldLeadLine(line, rawLines[lineIndex + 1])
    ) {
      close();
      current = { text: line.trim(), at: lineAt };
      continue;
    }
    const part = line.trim().replace(/^>\s?/, '');
    if (current === null) {
      current = { text: part, at: lineAt };
    } else {
      current.text = `${current.text} ${part}`;
    }
  }
  close();
  return passages;
}

/**
 * A score for every passage, best first.
 *
 * `anchors` are what a supported question is ABOUT -- its control, its menu
 * item, its key -- and outrank every word: a passage that names the control
 * is the passage, whatever else the question said. They do not ADD UP: the
 * panels page names "the divider between Document List and Presenting Flow
 * List" in three steps, the last of which also says "Reset Widgets Size",
 * and "Widgets" is the menu "How do I hide a panel?" is filed with -- summed,
 * the reset step outranked the step that hides. The best anchor counts, the
 * words decide between passages that carry it, and the earlier one wins a
 * tie, because a recipe introduces a control before it comes back to it.
 * `terms` is a list of
 * groups, the user's own word first and the app's words for it after
 * (`help.mjs` `toTerms`); a word is matched at a word's START and only at
 * three letters or more -- "am" in "What version am I running?" used to be
 * found inside "the same" -- and weighs more the fewer passages carry it.
 *
 * A word counts ONCE, and for less in a very long passage. Measured
 * 2026-10-12 on a local model over the help window's own page: "Can I add
 * something while you are still answering?" was handed the step that lists
 * every assistant and server -- 5 300 characters, so it carries "add",
 * "while", "still", "more" and "works" -- in place of the 540 that say
 * **Add**, and answered that the guide does not explain it. A row's keywords
 * repeat its question's words ("help window", "small window"), and each
 * repeat had been a vote of its own. And a passage of several thousand
 * characters is several subjects under one lead: it carries a word of nearly
 * every question. An anchor is not weighed down -- a control named in a long
 * step is still that step's -- and nor is a passage of ordinary length.
 */
export function rankPassages(passages, terms = [], anchors = []) {
  const keys = passages.map((passage) => {
    return toPassageKey(passage.text);
  });
  const anchorKeys = anchors.map(toPassageKey).filter((anchor) => {
    return anchor.length >= 2;
  });
  const seenWords = new Set();
  const groups = terms
    .map((group) => {
      return (Array.isArray(group) ? group : [group])
        .map((term) => {
          return String(term).toLowerCase();
        })
        .filter((term) => {
          return term.length >= 3;
        });
    })
    .filter((group) => {
      if (group.length === 0 || seenWords.has(group[0])) {
        return false;
      }
      seenWords.add(group[0]);
      return true;
    });
  const hasWord = (key, term) => {
    return ` ${key}`.includes(` ${term}`);
  };
  const frequencies = groups.map((group) => {
    return keys.filter((key) => {
      return group.some((term) => {
        return hasWord(key, term);
      });
    }).length;
  });
  return keys
    .map((key, index) => {
      let score = 0;
      anchorKeys.forEach((anchor, anchorIndex) => {
        if (` ${key} `.includes(` ${anchor} `)) {
          // The first anchor is the control; the rest are its menu and key.
          score = Math.max(score, anchorIndex === 0 ? 60 : 40);
        }
      });
      let wordScore = 0;
      groups.forEach((group, groupIndex) => {
        const isOwnWord = hasWord(key, group[0]);
        const isAlias =
          !isOwnWord &&
          group.slice(1).some((term) => {
            return hasWord(key, term);
          });
        if (isOwnWord || isAlias) {
          wordScore +=
            (isOwnWord ? 1 : 0.7) *
            Math.log(
              1 + passages.length / Math.max(frequencies[groupIndex], 1),
            );
        }
      });
      score +=
        wordScore *
        (key.length <= LONG_PASSAGE_LENGTH
          ? 1
          : Math.sqrt(LONG_PASSAGE_LENGTH / key.length));
      return { index, score };
    })
    .filter((item) => {
      return item.score > 0;
    })
    .sort((one, other) => {
      return other.score - one.score || one.index - other.index;
    });
}

// A cut never lands inside a button's name: `**[en:tran:Line …` is a
// template no resolver can read, and it reached the help window as those
// very characters (2026-10-17, a Khmer excerpt). The cut goes before it,
// with the bold that opened round it.
function cutBeforeOpenTemplate(head) {
  const open = head.lastIndexOf('[en:tran:');
  if (open === -1 || head.includes(']', open)) {
    return head;
  }
  return head.slice(0, open).replace(/\*+$/, '');
}

// The last place inside the text a sentence ends: a full stop of ANY script
// (`\p{Sentence_Terminal}` -- the Khmer `។` as well as `.`, `!`, `?`)
// with a space or the end after it.
function findLastSentenceEnd(head) {
  let last = -1;
  for (const match of head.matchAll(/\p{Sentence_Terminal}(?=\s|$)/gu)) {
    last = match.index;
  }
  return last;
}

function cutExcerpt(text) {
  if (text.length <= EXCERPT_CHAR_LIMIT) {
    return text;
  }
  const head = cutBeforeOpenTemplate(text.slice(0, EXCERPT_CHAR_LIMIT));
  // The last sentence that ends inside the limit, when one ends late enough
  // to be worth stopping at; else the last whole word. Said either way: a
  // quote that stops without saying so reads as the whole of it.
  const sentenceEnd = findLastSentenceEnd(head);
  if (sentenceEnd >= EXCERPT_CHAR_LIMIT * 0.5) {
    return `${head.slice(0, sentenceEnd + 1)} …`;
  }
  return `${head.slice(0, Math.max(head.lastIndexOf(' '), 1)).trimEnd()} …`;
}

/**
 * The passage of a page that answers the question, quoted whole.
 *
 * It used to be the FIRST line carrying ANY word of the query, with the four
 * lines after it. Measured 2026-10-12 over the 398 supported questions that
 * name a page: that quoted the control the question is about for 37 of 166,
 * its key for 11 of 35 and its menu for 4 of 14, and 252 excerpts stopped in
 * the middle of a sentence without saying so. The excerpt is the whole body
 * of the answer when no assistant is reachable, and what a model writes a
 * two-round answer from.
 */
export function genPassageExcerpt(text, terms = [], anchors = []) {
  const passages = toPassages(String(text ?? '').replace(/\r\n/g, '\n'));
  if (passages.length === 0) {
    return '';
  }
  // Nothing matched: the page's opening, as before.
  const bestIndex = rankPassages(passages, terms, anchors)[0]?.index ?? 0;
  let excerpt = passages[bestIndex].text;
  // A long passage is quoted from the sentence that names what the question
  // is about: the Presenter overview's header paragraph bolds a dozen
  // controls, and the one asked for is past where the quote would stop.
  if (excerpt.length > EXCERPT_CHAR_LIMIT) {
    const lowered = excerpt.toLowerCase();
    const focusAt = anchors.reduce((found, anchor) => {
      const at = lowered.indexOf(String(anchor).toLowerCase());
      return at !== -1 && (found === -1 || at < found) ? at : found;
    }, -1);
    if (focusAt > EXCERPT_CHAR_LIMIT * 0.6) {
      const sentenceAt = Math.max(
        excerpt.lastIndexOf('. ', focusAt),
        excerpt.lastIndexOf('; ', focusAt),
      );
      const startAt = sentenceAt === -1 ? Math.max(0, focusAt - 80) : sentenceAt + 2;
      excerpt = `… ${excerpt.slice(startAt).trimStart()}`;
    }
  }
  for (
    let next = bestIndex + 1;
    next < passages.length && excerpt.length < EXCERPT_SHORT_LENGTH;
    next++
  ) {
    excerpt += `\n${passages[next].text}`;
  }
  return cutExcerpt(excerpt.replace(SCREENSHOT_MARK_PATTERN, ''));
}

/**
 * The same excerpt out of a page's TRANSLATION: the passage that answers is
 * chosen on the English page, by the words of the question (`rankPassages`),
 * and the passages at the same place in the translation are quoted. A
 * translation keeps its page's steps and paragraphs where they are
 * (`manualI18n.mjs`); one that does not -- a different number of passages --
 * is no match for this, and null says so: the English excerpt stands.
 */
export function genTranslatedExcerpt(
  englishText,
  translatedText,
  terms = [],
  anchors = [],
) {
  const englishPassages = toPassages(
    String(englishText ?? '').replace(/\r\n/g, '\n'),
  );
  const translatedPassages = toPassages(
    String(translatedText ?? '').replace(/\r\n/g, '\n'),
  );
  if (
    englishPassages.length === 0 ||
    englishPassages.length !== translatedPassages.length
  ) {
    return null;
  }
  const bestIndex =
    rankPassages(englishPassages, terms, anchors)[0]?.index ?? 0;
  let englishLength = englishPassages[bestIndex].text.length;
  let excerpt = translatedPassages[bestIndex].text;
  for (
    let next = bestIndex + 1;
    next < englishPassages.length && englishLength < EXCERPT_SHORT_LENGTH;
    next++
  ) {
    englishLength += englishPassages[next].text.length + 1;
    excerpt += `\n${translatedPassages[next].text}`;
  }
  return cutExcerpt(excerpt.replace(SCREENSHOT_MARK_PATTERN, ''));
}

// The small words a question is asked in. Not `help.mjs`'s list: that one
// serves a ranking over three hundred pages and reads the disk; this one only
// has to keep "how do I" from choosing a passage.
const QUESTION_STOP_WORDS = new Set(
  (
    'a about again all am an and any are as at be been but by can could did do ' +
    'does doing done for from get had has have how i if in into is it its me ' +
    'my no not of on one or our out own please put she should so some than ' +
    'that the their them then there these they this to too up us use using ' +
    'want was we were what when where which who why will with would you your'
  ).split(' '),
);

/**
 * A question's own words as term groups for `rankPassages`: three letters or
 * more, the small words out. The window has no alias table -- the corpus row
 * that carries the question brings its `keywords`, which are exactly "what
 * they would type instead", and the caller adds those as groups of their own.
 */
export function toQuestionTerms(text) {
  const words =
    String(text ?? '')
      .toLowerCase()
      .match(/[\p{L}\p{N}+]{3,}/gu) ?? [];
  return [...new Set(words)]
    .filter((word) => {
      return !QUESTION_STOP_WORDS.has(word);
    })
    .map((word) => {
      return [word];
    });
}

/**
 * A page too long to hand over whole, cut to its OPENING and the passages
 * that match the question, in the page's own order.
 *
 * `null` when NOTHING on the page matches: the caller then has only the
 * page's first characters to offer, and should say so rather than treat them
 * as the answer. When the best passage already lies inside the first `limit`
 * characters, those are returned as they stand (`isHead`): they read
 * continuously, and they carry it.
 *
 * Measured 2026-10-12 on a local model (gemma-4-e4b): the help window's page
 * is 41 000 characters, its first 6 000 say nothing of the `/` commands, and
 * "What commands can I type instead of asking?" -- a question the window
 * itself offers -- was answered "the guide covers this app only; type /btw".
 * Half the supported questions (199 of 398) are filed under a page longer
 * than what rides.
 *
 * A match longer than ALL the room the matches share can only ever ride in
 * part, so it WAITS: the matches after it that fit are taken first, while
 * they score at least half of what it does, and it has what is left -- half
 * the room kept for it when it is the best match of all. Cut where it was
 * met, with nothing after it, the 5 300 characters above were all that rode
 * beside the opening, and the passage ranked second -- the answer -- never
 * did: of 23 questions about the help window whose answering passage was
 * marked by hand, it rode for 14, and for 22 with this and the two rules in
 * `rankPassages`. A passage merely too long for what is LEFT is cut on the
 * spot, as before.
 */
export function clipPageToPassages(
  text,
  terms = [],
  anchors = [],
  limit = 6000,
  headLimit = 2000,
) {
  const page = String(text ?? '').replace(/\r\n/g, '\n').trim();
  const passages = toPassages(page);
  const ranked = rankPassages(passages, terms, anchors);
  if (ranked.length === 0) {
    return null;
  }
  const best = passages[ranked[0].index];
  if (best.at + best.text.length <= limit) {
    return { text: page.slice(0, limit).trimEnd(), isEndCut: true, isHead: true };
  }
  const kept = new Map();
  let used = 0;
  // The opening says what the page is about and how to get there.
  for (let index = 0; index < passages.length; index++) {
    const size = passages[index].text.length + 1;
    if (used + size > headLimit) {
      break;
    }
    kept.set(index, passages[index].text);
    used += size;
  }
  const headCount = kept.size;
  // A passage's start, to the last sentence that fits. Only ever ONE
  // passage is cut -- a second half passage is two things half said.
  const cutToRoom = (passage, room) => {
    const head = passage.slice(0, room);
    const sentenceEnd = Math.max(
      head.lastIndexOf('. '),
      head.lastIndexOf('! '),
      head.lastIndexOf('? '),
    );
    return `${head.slice(0, sentenceEnd > room * 0.5 ? sentenceEnd + 1 : room).trimEnd()} …`;
  };
  const matchRoom = limit - used - 3;
  // The first match longer than all of that room, and what is kept for it.
  let waiting = null;
  let isCut = false;
  for (const { index, score } of ranked) {
    if (kept.has(index)) {
      continue;
    }
    const room = limit - used - 3 - (waiting?.held ?? 0);
    if (room < 200 || (waiting !== null && score < waiting.score * 0.5)) {
      break;
    }
    const passage = passages[index].text;
    if (passage.length <= room) {
      kept.set(index, passage);
      used += passage.length + 3;
      continue;
    }
    if (passage.length > matchRoom) {
      waiting ??= {
        index,
        score,
        held: kept.size === headCount ? Math.floor(matchRoom / 2) : 0,
      };
      continue;
    }
    if (waiting !== null) {
      continue;
    }
    kept.set(index, cutToRoom(passage, room));
    isCut = true;
    break;
  }
  const roomLeft = limit - used - 3;
  if (waiting !== null && !isCut && roomLeft >= 200) {
    kept.set(waiting.index, cutToRoom(passages[waiting.index].text, roomLeft));
  }
  const order = [...kept.keys()].sort((one, other) => {
    return one - other;
  });
  let clipped = '';
  order.forEach((index, at) => {
    if (at > 0) {
      clipped += order[at - 1] === index - 1 ? '\n' : '\n…\n';
    }
    clipped += kept.get(index);
  });
  return {
    text: clipped,
    isHead: false,
    // Whether the page goes on past the last passage quoted.
    isEndCut:
      order[order.length - 1] !== passages.length - 1 ||
      kept.get(order[order.length - 1]) !== passages[passages.length - 1].text,
  };
}

/**
 * What a supported question is ABOUT, as words to look for on its page: the
 * control (`find`, its last part when it is scoped as "Panel > Control"),
 * the menu item, each key of the shortcut. Read off the corpus row's
 * `resources`; anything that is not a string is left out, because the corpus
 * is JSON nobody type-checks and four rows once carried a list.
 *
 * And FIRST, when the row has one, its `passage`: the words the passage that
 * answers it opens on, copied from the page. A question about the help
 * window has no control to go by, and words alone chose the wrong passage of
 * its 57 000-character page for "How do I copy an answer?" -- the 270
 * characters that say **Copy** came fourth, behind the bug report's four
 * Copy buttons and the song drafter's. A label is right by construction;
 * `questions.test.mjs` fails when the page stops carrying it.
 */
export function genQuestionAnchors(resources) {
  const anchors = [];
  if (typeof resources?.passage === 'string') {
    anchors.push(resources.passage.trim());
  }
  const find = resources?.find;
  if (typeof find === 'string') {
    anchors.push(find.split('>').pop().trim());
  }
  if (typeof resources?.menu === 'string') {
    anchors.push(resources.menu.split('→').pop().trim());
  }
  if (typeof resources?.shortcut === 'string') {
    // "Enter / Shift+Enter", "Arrow keys / PageDown / Space": each is a key.
    for (const key of resources.shortcut.split('/')) {
      anchors.push(key.trim());
    }
  }
  return anchors.filter((anchor) => {
    return anchor.length > 0;
  });
}
