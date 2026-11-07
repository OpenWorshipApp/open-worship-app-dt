// The sentences `openLyric.test.mjs` does not reach: a directive an Intro
// cannot read, a Config line with no `- Field:` shape, a Locales list with a
// hole in it, a fence with no name or a word for a number, and the report
// when the song is accepted with something worth knowing.
//
// Plain node, no open-lyric import. Every song is made up.

import { describe, expect, test } from 'vitest';

import { checkOpenLyricText, validateOpenLyric } from './openLyric.mjs';

const REQUIRED_CONFIG_LINES = [
  '- Title: T',
  '- Artist: A',
  '- Copyright: C',
  '- Key: C',
  '- Tempo: 68bpm',
  '- Time: 4/4',
];

// Line 1 is the Config fence, 2-7 the required fields, then `configExtra`.
function genDoc(configExtraList, sectionList) {
  return [
    '```ol:Config',
    ...REQUIRED_CONFIG_LINES,
    ...configExtraList,
    '```',
    ...sectionList,
  ].join('\n');
}

const UNSUPPORTED =
  'Unsupported ol part. Use Config, Intro, Instrumental, Interlude, ' +
  'Turnaround, lyric sections, Breakdown, Vamp, or Solo.';

describe('a mixed section line that opens like a directive', () => {
  test('a {p:} or {c:} it cannot read is named, with both forms to write instead', () => {
    const { ok, problems } = validateOpenLyric(
      genDoc(
        ['- Structure: I'],
        ['```ol:Intro', '{p: x}', '{c: Piano!}', '```'],
      ),
    );
    expect(ok).toBe(false);
    expect(problems).toEqual(
      [11, 12].map((line, index) => {
        return {
          line,
          part: 'Intro',
          message:
            'Invalid Intro directive. Expected {p: #3} or {c: Piano + Pads }.',
          hint:
            'Write {p: #2} for a strumming pattern or {c: Piano + Pads } ' +
            'for a cue.',
          excerpt: ['{p: x}', '{c: Piano!}'][index],
        };
      }),
    );
  });
});

describe('Config lines', () => {
  test('a line without the "- Field: value" shape is refused where it is', () => {
    const { problems } = validateOpenLyric(
      genDoc(['- Structure: V1', 'Capo 2'], ['```ol:Verse 1', 'a', '```']),
    );
    expect(problems).toEqual([
      {
        line: 9,
        part: 'Config',
        message: 'Invalid config entry. Use - Field: value.',
        hint: null,
        excerpt: 'Capo 2',
      },
    ]);
  });

  test('a Locales list with an empty entry says which comma to drop', () => {
    const { problems } = validateOpenLyric(
      genDoc(
        ['- Structure: V1', '- Locales: en-US, , km-KH'],
        ['```ol:Verse 1', 'a', '```'],
      ),
    );
    expect(problems).toEqual([
      {
        line: 9,
        part: 'Config',
        message:
          'Locales must be a comma-separated list of locales with no empty entry.',
        hint: 'Drop the extra comma, e.g. "en-US, km-KH".',
        excerpt: '- Locales: en-US, , km-KH',
      },
    ]);
  });
});

describe('a fence header that names no section', () => {
  test('a fence with no name is refused once, and its body is not read as lyrics', () => {
    const { problems } = validateOpenLyric(
      genDoc(
        ['- Structure: V1'],
        ['```ol:Verse 1', 'a', '```', '```ol:', '] a stray bracket', '```'],
      ),
    );
    expect(problems).toEqual([
      {
        line: 13,
        part: null,
        message: UNSUPPORTED,
        hint: 'The fence needs a section name, e.g. ol:Verse 1.',
        excerpt: '```ol:',
      },
    ]);
  });

  test('a section numbered in words is told a number goes there', () => {
    const { problems } = validateOpenLyric(
      genDoc(
        ['- Structure: V1'],
        ['```ol:Verse 1', 'a', '```', '```ol:Verse two', 'b', '```'],
      ),
    );
    expect(problems).toEqual([
      {
        line: 13,
        part: null,
        message: UNSUPPORTED,
        hint: 'A section name takes a number after it, not "two".',
        excerpt: '```ol:Verse two',
      },
    ]);
  });
});

describe('the report of an accepted song', () => {
  test('what open-lyric accepts but a musician wants is said after the verdict', () => {
    const report = checkOpenLyricText(
      genDoc(
        ['- Structure: V1'],
        ['```ol:Verse 1', 'a', '```', '```ol:Chorus', 'b', '```'],
      ),
    );
    expect(report.startsWith('Valid Open Lyric. No problems found.\n\n')).toBe(
      true,
    );
    expect(report).toContain(
      [
        'Worth knowing (open-lyric accepts the song on these points):',
        'Line 13 (Chorus): Chorus is written but Structure never plays it.',
        '    ol:Chorus',
        '    → Add its code to Structure, or leave it as a section the team ' +
          'can jump to by hand.',
      ].join('\n'),
    );
  });
});
