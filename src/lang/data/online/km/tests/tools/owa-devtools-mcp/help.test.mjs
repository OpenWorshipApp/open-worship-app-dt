// The Khmer cases of `tools/owa-devtools-mcp/help.test.mjs`, kept with the
// language's package so the language and its tests come and go together.
// They run against the same modules, which name no language.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  genFreshPageUrl,
  readHelpPage,
  scrubRecipeIds,
  searchHelp,
  toEnglishOnly,
  toPageParts,
} from '../../../../../../../../tools/owa-devtools-mcp/help.mjs';

// `searchHelp` decides which page answers a volunteer's question, so it is
// graded here against a fixture corpus rather than the real one -- the real one
// is rebuilt whenever the manual changes, and a ranking test that moves with it
// grades nothing. The pages below carry only the words each assertion needs.
let knowledgeDirPath = '';
let previousDirPath;

function writeEntry(entry, body) {
  const filePath = path.join(knowledgeDirPath, entry.file);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, body);
  return { ...entry, searchText: body, headings: '' };
}

beforeAll(() => {
  knowledgeDirPath = mkdtempSync(path.join(tmpdir(), 'owa-knowledge-'));
  const entries = [
    // The page that ANSWERS "nothing is showing": written in the app's
    // words -- screen, display, audience -- and none of the user's.
    writeEntry(
      {
        id: 'W-10',
        title: 'Control what the audience sees',
        section: 'Presenting content',
        kind: 'manual',
        surface: 'presenter',
        file: 'manual/w-10.md',
      },
      '# Control what the audience sees\nShow or hide the screen, or press F5.\nThe Clear buttons empty a layer. The display button picks which display.\n',
    ),
    // The page that merely CONTAINS the user's words. This is the real
    // shape of the bug: it is the only page saying "projector" at all.
    writeEntry(
      {
        id: 'W-19',
        title: 'Draw and spotlight on the app itself',
        section: 'Configuration',
        kind: 'manual',
        surface: null,
        file: 'manual/w-19.md',
      },
      '# Draw and spotlight\nNothing is drawn until you pick a colour (W-10 step 1), and it is showing on the projector while you draw -- see W-18.\n',
    ),
    // The reader's own page, so the focus rule has something to prefer.
    writeEntry(
      {
        id: 'W-11',
        title: 'Read the Bible',
        section: 'Bible study',
        kind: 'manual',
        surface: 'reader',
        file: 'manual/w-11.md',
      },
      [
        '# Read the Bible',
        'Type John 3:16 in the Bible Reference box.',
        'The passage fills the Reader screen.',
        'If the words are too small, use Font Size to make them bigger and readable.',
        'Recent history takes you back to a passage you lost.',
        'Add Extra Bible puts two Bible versions next to each other.',
        '',
      ].join('\n'),
    ),
    // A page longer than one read: thirty steps, about 59 KB, in words no
    // search here asks for.
    writeEntry(
      {
        id: 'W-90',
        title: 'Lorem ipsum',
        section: 'Configuration',
        kind: 'manual',
        surface: null,
        file: 'manual/w-90.md',
      },
      `# Lorem ipsum\n\nDolor sit amet.\n\n${Array.from(
        { length: 30 },
        (_one, at) => {
          return `${at + 1}. Lorem ${at + 1} ${'ipsum dolor sit amet consectetur. '.repeat(58)}`.trimEnd();
        },
      ).join('\n')}\n`,
    ),
    writeEntry(
      {
        id: 'internal:memory/screens.md',
        title: 'memory / screens',
        section: '',
        kind: 'internal',
        surface: null,
        file: 'internal/memory/screens.md',
      },
      `# screens\nThe audience screen and its display picker.\n${'padding for the cap. '.repeat(1200)}`,
    ),
  ];
  writeFileSync(
    path.join(knowledgeDirPath, 'index.json'),
    JSON.stringify({ generatedAt: '', entries }),
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

describe('toEnglishOnly', () => {
  it('takes the Khmer twin and whatever introduced it', () => {
    expect(toEnglishOnly('Bible Lookup / ស្វែងរក in the header')).toBe(
      'Bible Lookup in the header',
    );
    expect(toEnglishOnly('press Clear All (លុបទាំងអស់)')).toBe(
      'press Clear All',
    );
  });
});

// Two bolds side by side are two bolds. Only a pair left EMPTY (a label that
// was Khmer and nothing else) goes: W-53 read `**Take it down.Hide Long
// Text**` in every language.
describe('toEnglishOnly and neighbouring bolds', () => {
  it('takes away a bold that held only Khmer', () => {
    expect(toEnglishOnly('Press **ស្វែងរក** to look it up.')).toBe(
      'Press to look it up.',
    );
  });
});

// A question typed in Khmer is searched by the English words it names
// (`queryLanguage.mjs`): it used to be cut into fragments at every vowel
// sign and found nothing.
describe('a question asked in Khmer', () => {
  it('finds the page its words are about', () => {
    // "How do I read the Bible?"
    const hits = searchHelp('តើខ្ញុំអានព្រះគម្ពីរដោយរបៀបណា?', 3, 'manual');
    expect(hits[0]?.id).toBe('W-11');
  });

  it('a question whose words the app does not know finds nothing', () => {
    // "Hello" -- no page is about it, and its letters are no evidence.
    expect(searchHelp('សួស្តី', 3, 'manual')).toEqual([]);
  });
});

describe('the Khmer twin the manual writes beside every label', () => {
  it('takes the whole bracket, not only the Khmer inside it', () => {
    // The card read "...and choose Download From URL (URL)." because the
    // bracket held a Latin word too, so only its Khmer was stripped.
    expect(toEnglishOnly('choose **Download From URL** (ទាញយកពី URL).')).toBe(
      'choose **Download From URL**.',
    );
  });
});
