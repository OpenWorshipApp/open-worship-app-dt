import {
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  checkIsBibleNoteGuideId,
  checkNeedsBibleNoteGuide,
  genFreshPageUrl,
  readHelpPage,
  scrubRecipeIds,
  searchHelp,
} from './help.mjs';

// The Bible Note editor's own guide is a corpus of its own, in an index of
// its own (`build-knowledge.mjs`), read only for a question about a note. A
// fixture again, as in `help.test.mjs`: what is graded is WHEN the guide is
// read and how its pages rank beside the app's own, not the real words.
let knowledgeDirPath = '';
let previousDirPath;

const GUIDE_PREFIX = 'bible-note:ui/';

function writeEntry(entry, body) {
  const filePath = path.join(knowledgeDirPath, entry.file);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, body);
  return { ...entry, searchText: body, headings: '' };
}

function writeGuideEntry(chunkId, title, body) {
  const entry = writeEntry(
    {
      id: `bible-note:${chunkId}`,
      title,
      section: 'Sticky notes',
      kind: 'manual',
      surface: 'bibleNote',
      source: 'bible-note',
      file: `bible-note/${chunkId}.md`,
    },
    `# ${title}\n\n_(From the Bible Note editor's own guide.)_\n\n${body}\n`,
  );
  return { ...entry, searchText: body };
}

beforeAll(() => {
  knowledgeDirPath = mkdtempSync(path.join(tmpdir(), 'owa-knowledge-guide-'));
  const entries = [
    writeEntry(
      {
        id: 'W-14',
        title: 'Keep Bible notes',
        section: 'Bible study',
        kind: 'manual',
        surface: null,
        file: 'manual/w-14.md',
      },
      '# Keep Bible notes\nOpen a note for editing in its own window. Press Save to keep it.\n',
    ),
    writeEntry(
      {
        id: 'W-10',
        title: 'Control what the audience sees',
        section: 'Presenting content',
        kind: 'manual',
        surface: 'presenter',
        file: 'manual/w-10.md',
      },
      '# Control what the audience sees\nShow or hide the screen. Add a slide, make text bold on the slide.\n',
    ),
  ];
  writeFileSync(
    path.join(knowledgeDirPath, 'index.json'),
    JSON.stringify({ entries }),
  );
  const guideEntries = [
    writeGuideEntry(
      'ui/sticky-notes/add-a-sticky-note',
      'Add a sticky note',
      'Click Show Sticky Notes, then add a sticky note on top of the writing area.',
    ),
    writeGuideEntry(
      'ui/formatting-text/make-text-bold-italic-or-underlined',
      'Make text bold, italic or underlined',
      'Select the words and press the bold button, or Ctrl+B, to make text bold.',
    ),
    // The page of a real supported question ("How do I put a table in my
    // note?"), which the known-question route must find wherever it is asked.
    writeGuideEntry(
      'ui/inserting-content/insert-a-table',
      'Insert a table',
      'Choose Insert, then Table, and pick its rows and columns.',
    ),
  ];
  writeFileSync(
    path.join(knowledgeDirPath, 'bible-note', 'index.json'),
    JSON.stringify({ entries: guideEntries }),
  );
  writeFileSync(
    path.join(knowledgeDirPath, 'tran.json'),
    JSON.stringify({
      languages: [{ code: 'en', name: 'English', nativeName: 'English' }],
      dictionaries: {},
    }),
  );
  previousDirPath = process.env.OWA_KNOWLEDGE_DIR;
  process.env.OWA_KNOWLEDGE_DIR = knowledgeDirPath;
});

afterAll(() => {
  if (previousDirPath === undefined) {
    delete process.env.OWA_KNOWLEDGE_DIR;
  } else {
    process.env.OWA_KNOWLEDGE_DIR = previousDirPath;
  }
  rmSync(knowledgeDirPath, { recursive: true, force: true });
});

function toIds(hits) {
  return hits.map((hit) => {
    return hit.id;
  });
}

describe('the Bible Note editor guide in the help search', () => {
  it('answers the note window from the guide', () => {
    const hits = searchHelp(
      'How do I add a sticky note?',
      3,
      'auto',
      'bibleNote',
    );
    expect(hits[0].id).toBe(`${GUIDE_PREFIX}sticky-notes/add-a-sticky-note`);
  });

  it('is never read for a question asked about another window', () => {
    expect(
      toIds(searchHelp('make text bold in my note', 5, 'auto', 'presenter')),
    ).not.toContain(
      `${GUIDE_PREFIX}formatting-text/make-text-bold-italic-or-underlined`,
    );
    expect(checkNeedsBibleNoteGuide('my sticky note', [], 'presenter')).toBe(
      false,
    );
  });

  it('leaves every other search exactly as it was without the guide', () => {
    const asked = [
      ['make text bold on the slide', 'presenter'],
      ['how do I keep my notes', 'reader'],
      ['show or hide the screen', null],
    ];
    const withGuide = asked.map(([query, focus]) => {
      return searchHelp(query, 5, 'auto', focus);
    });
    const guideIndexPath = path.join(
      knowledgeDirPath,
      'bible-note',
      'index.json',
    );
    renameSync(guideIndexPath, `${guideIndexPath}.off`);
    try {
      const withoutGuide = asked.map(([query, focus]) => {
        return searchHelp(query, 5, 'auto', focus);
      });
      expect(withGuide).toEqual(withoutGuide);
    } finally {
      renameSync(`${guideIndexPath}.off`, guideIndexPath);
    }
  });

  it('is read for a note named in words when no window is named', () => {
    expect(
      toIds(searchHelp('How do I add a sticky note to my note?', 5)),
    ).toContain(`${GUIDE_PREFIX}sticky-notes/add-a-sticky-note`);
    expect(toIds(searchHelp('make text bold', 5))).not.toContain(
      `${GUIDE_PREFIX}formatting-text/make-text-bold-italic-or-underlined`,
    );
  });

  it('finds a supported question’s guide page wherever it is asked', () => {
    const hits = searchHelp(
      'How do I put a table in my note?',
      3,
      'auto',
      'presenter',
    );
    expect(hits[0].id).toBe(`${GUIDE_PREFIX}inserting-content/insert-a-table`);
    expect(hits[0].isKnownQuestion).toBe(true);
  });

  it('opens a guide page by its id, with no repository copy to read', () => {
    const page = readHelpPage(`${GUIDE_PREFIX}sticky-notes/add-a-sticky-note`);
    expect(page.title).toBe('Add a sticky note');
    expect(page.body).toContain("Bible Note editor's own guide");
    expect(page.body).toContain('Show Sticky Notes');
    expect(genFreshPageUrl(page)).toBe(null);
    expect(readHelpPage(`${GUIDE_PREFIX}nothing/here`)).toBe(null);
  });

  it('turns a guide id written into words into what it names', () => {
    expect(checkIsBibleNoteGuideId('Bible-Note:ui/a/b')).toBe(true);
    expect(checkIsBibleNoteGuideId('W-14')).toBe(false);
    expect(
      scrubRecipeIds(
        'Read bible-note:ui/sticky-notes/add-a-sticky-note for that.',
      ),
    ).toBe('Read add a sticky note for that.');
  });
});
