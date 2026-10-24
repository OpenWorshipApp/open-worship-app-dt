import { describe, expect, it } from 'vitest';

import {
  formatSongLookup,
  SONG_NOT_FOUND_PREFIX,
  SONG_YOURS_PREFIX,
} from './songLookup.mjs';

const HYMN = [
  '# Amazing Grace',
  '',
  '```ol:Config',
  '- Title: Amazing Grace',
  '- Artist: John Newton',
  '- Copyright: Public Domain (1779)',
  '- Key: C',
  '- Tempo: 120bpm',
  '- Time: 4/4',
  '- Structure: V1V2',
  '- Attachments: [Hymnary.org](https://hymnary.org/text/amazing_grace_how_sweet_the_sound)',
  '```',
  '',
  '```ol:Verse 1',
  'Amazing grace, how sweet the sound',
  'that saved a wretch like me!',
  '```',
  '',
  '```ol:Verse 2',
  'Twas grace that taught my heart to fear,',
  'and grace my fears relieved;',
  '```',
  '',
].join('\n');

describe('formatSongLookup', () => {
  it('hands a found hymn on as a draft the window lifts', () => {
    const text = formatSongLookup({
      asked: 'Amazing Grace',
      yours: [],
      found: {
        title: 'Amazing Grace',
        authors: ['John Newton'],
        year: '1779',
        content: HYMN,
      },
      nearest: [],
      collectionSize: 36,
    });
    // The two things `readDraftedLyric` keys on.
    expect(text.startsWith('Drafted a song')).toBe(true);
    expect(text).toContain('Valid Open Lyric. No problems found.');
    expect(text).toContain('"Amazing Grace" by John Newton (1779)');
    expect(text).toContain('```ol:Config');
    expect(text).not.toContain(SONG_YOURS_PREFIX);
  });

  it('says when the user already has the song', () => {
    const text = formatSongLookup({
      asked: 'Amazing Grace',
      yours: ['Amazing Grace'],
      found: {
        title: 'Amazing Grace',
        authors: [],
        year: '',
        content: HYMN,
      },
      nearest: [],
      collectionSize: 36,
    });
    expect(text.startsWith('Drafted a song')).toBe(true);
    expect(text).toContain(`${SONG_YOURS_PREFIX} "Amazing Grace"`);
  });

  it('refuses to make up a song it did not find', () => {
    const text = formatSongLookup({
      asked: 'Way Maker',
      yours: [],
      found: null,
      nearest: [],
      collectionSize: 36,
    });
    expect(text.startsWith(SONG_NOT_FOUND_PREFIX)).toBe(true);
    expect(text.startsWith('Drafted a song')).toBe(false);
    expect(text).toContain('Do NOT write its words from memory');
    expect(text).not.toContain('Nearest in the collection');
  });

  it('offers the nearest titles when there are some', () => {
    const text = formatSongLookup({
      asked: 'Holy',
      yours: [],
      found: null,
      nearest: ['Holy, Holy, Holy! Lord God Almighty'],
      collectionSize: 36,
    });
    expect(text).toContain(
      'Nearest in the collection: "Holy, Holy, Holy! Lord God Almighty"',
    );
  });
});
