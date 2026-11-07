import { describe, expect, it } from 'vitest';

import {
  applyQuestionOverlay,
  findTemplateSample,
  matchQuestions,
  outlineQuestions,
  toEnglishTemplateAsk,
} from './questionMatch.mjs';

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
        ],
      },
    ],
  },
];

describe('a page that belongs to several windows', () => {
  it('answers in each window it names, and in no other', () => {
    const inEditor = matchQuestions('text box', {
      focus: 'appDocumentEditor',
      pages: PAGES,
    });
    const inPresenter = matchQuestions('text box', {
      focus: 'presenter',
      pages: PAGES,
    });
    const inReader = matchQuestions('text box', {
      focus: 'reader',
      pages: PAGES,
    });
    expect(inEditor.map((row) => row.id)).toEqual(['editor.canvas.add-text']);
    expect(inPresenter.map((row) => row.id)).toEqual([
      'editor.canvas.add-text',
    ]);
    expect(inReader).toEqual([]);
  });

  it('outlines only the pages a window can see', () => {
    expect(
      outlineQuestions({ focus: 'presenter', pages: PAGES }).map((page) => {
        return page.page;
      }),
    ).toEqual(['editor']);
    expect(
      outlineQuestions({ focus: 'reader', pages: PAGES }).map((page) => {
        return page.page;
      }),
    ).toEqual(['reader']);
  });
});

describe('applyQuestionOverlay', () => {
  it('hands the corpus back as it is when there is no overlay', () => {
    expect(applyQuestionOverlay(PAGES, null)).toBe(PAGES);
    expect(applyQuestionOverlay(PAGES, undefined)).toBe(PAGES);
  });
});

describe('findTemplateSample', () => {
  it('finds no gap in a sentence that has none', () => {
    expect(findTemplateSample('How do I add a text box?')).toBeNull();
    expect(findTemplateSample(undefined)).toBeNull();
  });
});

describe('toEnglishTemplateAsk', () => {
  // A translated row in a made-up language written in signs: what is under
  // test is how the two examples line up, not any language.
  const LOCAL_IMPORT_SONG = '♫ ⇣';

  // The translated row's example is a quoted name and the English one an
  // address: the two cannot be lined up around a gap, so nothing is read.
  it('reads nothing back when the two examples are not of one kind', () => {
    const rows = [
      {
        isTemplate: true,
        text: `${LOCAL_IMPORT_SONG} "Amazing Grace"`,
        textEn: 'Import the song from https://example.com/song',
      },
    ];
    expect(
      toEnglishTemplateAsk(`${LOCAL_IMPORT_SONG} "Blessed Assurance"`, rows),
    ).toBeNull();
  });

  it('reads nothing back from a row with no example in it', () => {
    const rows = [
      {
        isTemplate: true,
        text: LOCAL_IMPORT_SONG,
        textEn: 'Import the song ...',
      },
    ];
    expect(toEnglishTemplateAsk(`${LOCAL_IMPORT_SONG} ✦`, rows)).toBeNull();
  });
});

// A question typed in a script without spaces is in each package's tests.
