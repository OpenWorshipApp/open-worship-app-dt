import { describe, expect, it } from 'vitest';

import {
  findQuestionLanguage,
  genPhraseTable,
  toEnglishSearchWords,
} from './queryLanguage.mjs';
import { loadTranBundle } from './tran.mjs';

// A small Khmer dictionary in the bundle's shape (English key -> the words on
// the Khmer button), and the facts a language's `assistant.json` carries.
const DICTIONARY = {
  'clear long text': 'លុបអត្ថបទវែង',
  'bible lookup': 'ស្វែងរកព្រះគម្ពីរ',
  // One letter of its own, which `ខ្ញុំ` begins with.
  'k key': 'ខ',
  close: 'បិទ',
  'no thanks': 'ទេ អរគុណ',
  'a label far too long to be the words on any one button of the app':
    'ស្លាកវែងពេកដើម្បីជាពាក្យនៅលើប៊ូតុងណាមួយនៃកម្មវិធីនេះទាល់តែសោះណាស់',
};
const FACTS = {
  scriptPattern: '[\\u1780-\\u17FF\\u19E0-\\u19FF]',
  glossary: { តើ: '', ខ្ញុំ: '', នៅឯណា: 'where', បិទ: 'turn off' },
};
const LANGUAGES = [
  { code: 'en', assistant: { scriptPattern: '[A-Za-z]' } },
  { code: 'km', assistant: FACTS },
];

describe('findQuestionLanguage', () => {
  it('a question in Khmer letters is Khmer', () => {
    expect(findQuestionLanguage('លុបអត្ថបទវែង', LANGUAGES)?.code).toBe('km');
  });

  // English and French share their letters, and the guide reads both.
  it('Latin letters are no question language of their own', () => {
    expect(findQuestionLanguage('How do I clear?', LANGUAGES)).toBeNull();
    expect(findQuestionLanguage('如何', LANGUAGES)).toBeNull();
  });
});

describe('toEnglishSearchWords', () => {
  it('reads a button name as its English key', () => {
    expect(toEnglishSearchWords('លុបអត្ថបទវែង', DICTIONARY, FACTS)).toEqual({
      groups: [['clear long text']],
      rest: '',
    });
  });

  it('reads a question with no spaces, word by word', () => {
    const { groups } = toEnglishSearchWords(
      'តើខ្ញុំស្វែងរកព្រះគម្ពីរនៅឯណា?',
      DICTIONARY,
      FACTS,
    );
    expect(groups).toEqual([['bible lookup'], ['where']]);
  });

  // `ខ` is a letter of its own and the start of `ខ្ញុំ`: a phrase ends where
  // a letter ends, never before a subscript.
  it('never finds a word inside another word', () => {
    const { groups } = toEnglishSearchWords('ខ្ញុំ', DICTIONARY, {
      scriptPattern: FACTS.scriptPattern,
    });
    expect(groups).toEqual([]);
  });

  it('drops what matches nothing, and keeps what was not in the script', () => {
    expect(toEnglishSearchWords('សួស្តី F5', DICTIONARY, FACTS)).toEqual({
      groups: [],
      rest: 'f5',
    });
  });

  it('reads a label with a space in it', () => {
    expect(toEnglishSearchWords('ទេ អរគុណ', DICTIONARY, FACTS).groups).toEqual(
      [['no thanks']],
    );
  });

  // The dictionary and the glossary both know `បិទ`; what they say is ONE
  // thing the question names.
  it('one group of alternatives for one word', () => {
    expect(toEnglishSearchWords('បិទ', DICTIONARY, FACTS).groups).toEqual([
      ['close', 'turn', 'off'],
    ]);
  });
});

describe('genPhraseTable', () => {
  it('leaves sentences out of the phrase book', () => {
    const table = genPhraseTable(DICTIONARY, FACTS);
    expect(table.has('លុបអត្ថបទវែង')).toBe(true);
    expect(
      [...table.values()].flat().some((one) => one.startsWith('a label')),
    ).toBe(false);
  });

  it('a glossary word that means nothing is consumed, not searched', () => {
    expect(genPhraseTable({}, FACTS).get('តើ')).toEqual([]);
  });
});

// The app's own dictionary and Khmer facts, as the help search reads them.
describe('with the real Khmer dictionary', () => {
  const bundle = loadTranBundle();
  const language = findQuestionLanguage('ក', bundle.languages);

  it('Khmer has its facts in the bundle', () => {
    expect(language?.code).toBe('km');
  });

  it('reads the measured questions as the words their pages use', () => {
    const read = (query) => {
      return toEnglishSearchWords(
        query,
        bundle.dictionaries.km,
        language.facts,
      ).groups.flat();
    };
    expect(read('លុបអត្ថបទវែង')).toContain('clear long text');
    expect(read('តើខ្ញុំប្តូរភាសាដោយរបៀបណា')).toEqual(
      expect.arrayContaining(['change', 'language', 'how']),
    );
    // `នៅលើអេក្រង់` is a label of its own, "On Screen": the longer phrase
    // wins, and the search counts it as the phrase and as its words.
    const showVerse = read('តើខ្ញុំបង្ហាញខគម្ពីរនៅលើអេក្រង់យ៉ាងដូចម្តេច?');
    expect(showVerse).toEqual(expect.arrayContaining(['show', 'verse']));
    expect(showVerse.some((one) => one.includes('screen'))).toBe(true);
  });
});
