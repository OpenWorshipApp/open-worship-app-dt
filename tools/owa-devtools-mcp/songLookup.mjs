// A song asked for by its NAME -- `owa_lyric_validate` with `mode: "find"`.
//
// The words come from the app, never from the model: the user's own songs
// that answer to the title, and the hymn the app's public-domain collection
// (the Documents list's **Import From Public Domain Songs**) holds under it.
// The collection lives in the renderer bundle, not in this package, so the
// lookup is asked of the app over the same relay `owa_lyric_file` uses
// (`action: "find"`), and this module only turns the app's answer into text.
//
// Why a lookup and not "write it out": asked for "Amazing Grace" by name, a
// model writes the hymn from memory -- routinely a verse short or a line off,
// and for a modern song it writes out somebody's copyright from memory. A
// lookup that says "not here, give me the words or the page" is the honest
// answer; the drafter already takes either.

import { validateOpenLyric } from './openLyric.mjs';
import { formatOpenLyricDraft } from './openLyricDraft.mjs';

/** The first words of a lookup that found nothing to draft. */
export const SONG_NOT_FOUND_PREFIX = 'No song called';

/** The line naming the user's own songs, read back by the offline bot. */
export const SONG_YOURS_PREFIX = 'Already in their songs:';

function quoteList(names) {
  return names
    .map((name) => {
      return `"${name}"`;
    })
    .join(', ');
}

function genByLine(found) {
  const authors = Array.isArray(found.authors) ? found.authors : [];
  const by = authors.length > 0 ? ` by ${authors.join(', ')}` : '';
  const year = found.year ? ` (${found.year})` : '';
  return `"${found.title}"${by}${year}`;
}

/**
 * The app's answer to a find, as the text the model is handed.
 *
 * A found hymn goes through `formatOpenLyricDraft` like any other draft, so
 * the window lifts it into the SAME Create / Copy buttons and preview box --
 * one create path, the hardened one. The text is the collection's own, already
 * valid; it is still run through the validator, because a draft offered under
 * a button must have been checked by the thing that says "valid".
 *
 * @param {{asked?: string, yours?: string[], found?: object|null,
 *   nearest?: string[], collectionSize?: number}} value
 */
export function formatSongLookup(value) {
  const asked = String(value?.asked ?? '').trim();
  const yours = Array.isArray(value?.yours) ? value.yours : [];
  const nearest = Array.isArray(value?.nearest) ? value.nearest : [];
  const size = Number(value?.collectionSize) || 0;
  const yoursLine =
    yours.length > 0
      ? `${SONG_YOURS_PREFIX} ${quoteList(yours)}. Tell them it is ` +
        'already in their Documents list and ask before making a ' +
        'second copy.'
      : null;
  const found = value?.found ?? null;
  if (found !== null && typeof found.content === 'string') {
    const lead = [
      'Drafted a song from the app’s own public-domain hymn ' +
        `collection: ${genByLine(found)} -- the text Import From ` +
        'Public Domain Songs writes, with a link back to the page ' +
        'it was transcribed from. Say that is where it came from.',
      yoursLine,
    ]
      .filter(Boolean)
      .join('\n');
    return formatOpenLyricDraft({
      markdown: found.content,
      tier: 1,
      guessed: [],
      report: validateOpenLyric(found.content),
      lead,
    });
  }
  const where = size > 0 ? ` (${size} classic hymns, offline)` : '';
  const lines = [
    `${SONG_NOT_FOUND_PREFIX} "${asked}" is in the app’s public-domain ` +
      `hymn collection${where}.`,
  ];
  if (yoursLine !== null) {
    lines.push(yoursLine);
  }
  if (nearest.length > 0) {
    lines.push(
      `Nearest in the collection: ${quoteList(nearest)}. If one of ` +
        'these is what they meant, call again with that title.',
    );
  }
  lines.push(
    'Do NOT write its words from memory: a remembered lyric is often ' +
      'wrong, and a modern song’s words belong to its publisher. Ask ' +
      'them to paste the words, or for the address of a page with the ' +
      'song on it, and draft from that.',
  );
  return lines.join('\n');
}
