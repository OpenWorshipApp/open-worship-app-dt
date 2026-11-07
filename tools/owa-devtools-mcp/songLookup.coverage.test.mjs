import { describe, expect, it } from 'vitest';

import {
  formatSongLookup,
  SONG_NOT_FOUND_PREFIX,
  SONG_YOURS_PREFIX,
} from './songLookup.mjs';

// A song the collection does not hold, but the user's own Documents list
// does: the model must hear BOTH, so it neither writes the words from memory
// nor makes a second copy of a song they already have.
describe('formatSongLookup, not found but already theirs', () => {
  it('says it is already in their list and asks before a second copy', () => {
    const text = formatSongLookup({
      asked: '  Shine Jesus Shine ',
      yours: ['Shine Jesus Shine'],
      found: null,
      nearest: [],
      collectionSize: 0,
    });
    const lines = text.split('\n');
    expect(lines[0]).toBe(
      `${SONG_NOT_FOUND_PREFIX} "Shine Jesus Shine" is in the app’s ` +
        'public-domain hymn collection.',
    );
    expect(lines[1].startsWith(SONG_YOURS_PREFIX)).toBe(true);
    expect(lines[1]).toContain('Shine Jesus Shine');
    expect(lines[1]).toContain('ask before making a second copy');
    // No nearest titles were offered, so none are named.
    expect(text).not.toContain('Nearest in the collection');
    expect(lines.at(-1)).toContain('Do NOT write its words from memory');
  });

  it('names the collection size only when it is known', () => {
    const text = formatSongLookup({
      asked: 'Ten Thousand Reasons',
      collectionSize: 312,
    });
    expect(text.split('\n')[0]).toContain('(312 classic hymns, offline)');
    expect(text).not.toContain(SONG_YOURS_PREFIX);
  });
});
