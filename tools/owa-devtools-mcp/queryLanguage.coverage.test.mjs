import { describe, expect, it } from 'vitest';

import {
  findQuestionLanguage,
  genPhraseTable,
  toEnglishSearchWords,
} from './queryLanguage.mjs';

// The module names no script: a language's script and its words are data.
// So the language here is made up, and written in signs (the Miscellaneous
// Symbols block) -- what is under test is how the data is read, not any
// language. Each language's own words are in its package's tests.
const SIGN_SCRIPT = '[\\u2600-\\u26FF]';
const CLOSE = '☂☔';
const CLEAR_LONG_TEXT = '☀☁☃';
const WHERE = '⚐⚑';
const DICTIONARY = { close: CLOSE, 'clear long text': CLEAR_LONG_TEXT };

// A language pack's facts are data somebody wrote: a broken pattern, or a
// language with none, must cost that language its detection, never the
// search.
describe('findQuestionLanguage with facts that cannot be used', () => {
  it('skips a language whose script pattern is not a pattern', () => {
    const languages = [
      { code: 'xy', assistant: { scriptPattern: '[\\u2600-' } },
      { code: 'xx', assistant: { scriptPattern: SIGN_SCRIPT } },
    ];
    expect(findQuestionLanguage(CLOSE, languages)?.code).toBe('xx');
  });

  it('skips a language with no facts or no pattern', () => {
    const languages = [
      { code: 'en' },
      { code: 'yy', assistant: { glossary: {} } },
      null,
      { code: 'xx', assistant: { scriptPattern: SIGN_SCRIPT } },
    ];
    expect(findQuestionLanguage(CLOSE, languages)?.code).toBe('xx');
    expect(findQuestionLanguage(CLOSE, [{ code: 'en' }])).toBeNull();
    expect(findQuestionLanguage(CLOSE, undefined)).toBeNull();
  });
});

describe('toEnglishSearchWords with an unusable pattern', () => {
  it('keeps the whole question as it was, lower-cased', () => {
    expect(
      toEnglishSearchWords('Clear​IT', DICTIONARY, { scriptPattern: '(' }),
    ).toEqual({ groups: [], rest: 'clear it' });
  });
});

describe('genPhraseTable', () => {
  it('reads string labels only, and no glossary word that is all space', () => {
    const table = genPhraseTable(
      { close: CLOSE, nested: { a: 'b' }, count: 3 },
      { glossary: { '  ': 'where', [WHERE]: 'where' } },
    );
    expect([...table.keys()]).toEqual([CLOSE, WHERE]);
    expect(table.get(CLOSE)).toEqual(['close']);
    expect(table.get(WHERE)).toEqual(['where']);
  });
});

describe('toEnglishSearchWords', () => {
  const facts = { scriptPattern: SIGN_SCRIPT, glossary: {} };

  // A writer who puts a space between phrases: the run carries on across
  // it, and the same label said twice is one thing the question names.
  it('reads across single spaces and counts a label once', () => {
    expect(
      toEnglishSearchWords(`${CLOSE} ${CLOSE}`, DICTIONARY, facts),
    ).toEqual({
      groups: [['close']],
      rest: '',
    });
  });

  it('keeps two different labels in the order they were said', () => {
    expect(
      toEnglishSearchWords(`${CLEAR_LONG_TEXT} ${CLOSE}`, DICTIONARY, facts)
        .groups,
    ).toEqual([['clear long text'], ['close']]);
  });
});
