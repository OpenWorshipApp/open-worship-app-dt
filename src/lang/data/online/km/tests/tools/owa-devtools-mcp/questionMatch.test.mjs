// The Khmer cases of `tools/owa-devtools-mcp/questionMatch.coverage.test.mjs`,
// kept with the language's package so the language and its tests come and
// go together. They run against the same modules, which name no language.
import { describe, expect, it } from 'vitest';

import { matchQuestions } from '../../../../../../../../tools/owa-devtools-mcp/questionMatch.mjs';

// A small corpus in the shape of `questions/*.json`. The slide editor's page
// belongs to two windows at once (a page `focus` may be a list).
const PAGES = [
  {
    page: 'editor',
    label: 'Slide Editor',
    focus: ['appDocumentEditor', 'presenter'],
    sections: [
      {
        id: 'canvas',
        label: 'Canvas',
        questions: [
          { id: 'add-text', text: 'How do I add a text box?' },
          { id: 'blank', text: '???' },
        ],
      },
    ],
  },
  {
    page: 'reader',
    label: 'Bible Reader',
    focus: 'reader',
    sections: [
      {
        id: 'lookup',
        label: 'Lookup',
        questions: [
          {
            id: 'type-ref',
            text: 'Where do I type John 3:16?',
            starter: true,
          },
          { id: 'verse-marks', text: 'វិធីបន្ថែមខគម្ពីរ' },
          // Shares more letter pairs with "បន្ថែមខ" than the row above,
          // without holding it.
          { id: 'near', text: 'បន្ថែមគខ' },
        ],
      },
    ],
  },
];

// A question in a script without spaces is ranked by the whole of it, its
// start, inside, then letter pairs -- never by a row with no letters at all.
describe('a question typed in Khmer', () => {
  // Holding the typed words whole outranks merely sharing their letters.
  it('ranks a row it is the middle of above one that only shares letters', () => {
    const found = matchQuestions('បន្ថែមខ', { pages: PAGES });
    expect(found.map((row) => row.id)).toEqual([
      'reader.lookup.verse-marks',
      'reader.lookup.near',
    ]);
  });

  it('never ranks a row whose words are all punctuation', () => {
    const found = matchQuestions('វិធីបន្ថែមខគម្ពីរ', { pages: PAGES });
    expect(found[0].id).toBe('reader.lookup.verse-marks');
    expect(found.some((row) => row.id === 'editor.canvas.blank')).toBe(false);
  });
});
