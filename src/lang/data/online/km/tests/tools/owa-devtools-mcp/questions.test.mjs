// The Khmer cases of `tools/owa-devtools-mcp/questions.test.mjs`, kept with the
// language's package so the language and its tests come and go together.
// They run against the same modules, which name no language.
import { pathToFileURL as toSourceUrl } from 'node:url';
import { join as joinSourcePath } from 'node:path';
const SOURCE_URL = toSourceUrl(joinSourcePath(process.cwd(), 'tools/owa-devtools-mcp/questions.test.mjs')).href;
const SOURCE_DIRNAME = joinSourcePath(process.cwd(), 'tools/owa-devtools-mcp');
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BOT_FOCUS_KEYS } from '../../../../../../../../tools/owa-devtools-mcp/botFocus.mjs';
import { toManualPageBody } from '../../../../../../../../tools/owa-devtools-mcp/manualPage.mjs';
import { toPassageKey } from '../../../../../../../../tools/owa-devtools-mcp/passageMatch.mjs';
import {
  flattenQuestions,
  listQuestionPageIds,
  loadQuestionOverlays,
  loadQuestionPages,
  matchQuestions,
  outlineQuestions,
} from '../../../../../../../../tools/owa-devtools-mcp/questions.mjs';
import {
  applyQuestionOverlay,
  findTemplateSample,
  toEnglishTemplateAsk,
} from '../../../../../../../../tools/owa-devtools-mcp/questionMatch.mjs';

// Unlike `help.test.mjs`, this runs against the REAL corpus on purpose. The
// files are the deliverable -- a question with no recipe, a duplicate id or a
// section nobody can reach is the defect this test exists to catch, and a
// fixture corpus would grade none of it.
const PAGES = loadQuestionPages();
const ROWS = flattenQuestions(PAGES);

// The manual as it exists on disk, read straight from the sources rather than
// from `electron-build/knowledge` -- that bundle is a build output, and a test
// that needs one built cannot fail on a machine that has not built it.
function listManualIds() {
  const root = join(SOURCE_DIRNAME, '..', '..', 'docs', 'manual-sources');
  const ids = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!entry.name.endsWith('.md')) {
        continue;
      }
      const found = readFileSync(path, 'utf8').match(/^id:\s*(\S+)\s*$/m);
      if (found !== null) {
        ids.push(found[1]);
      }
    }
  };
  walk(root);
  return ids;
}

/** Every manual page on disk by its id, as the words a passage is matched on. */
function readManualPageKeys() {
  const root = join(SOURCE_DIRNAME, '..', '..', 'docs', 'manual-sources');
  const pages = new Map();
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!entry.name.endsWith('.md')) {
        continue;
      }
      const content = readFileSync(path, 'utf8');
      const found = content.match(/^id:\s*(\S+)\s*$/m);
      if (found !== null) {
        pages.set(found[1], toPassageKey(toManualPageBody(content)));
      }
    }
  };
  walk(root);
  return pages;
}

// The corpus in the app's other languages (`src/lang/data/online/<code>/questions.json`): a
// translation is a row's words in that language, kept beside the English it
// was made from. A volunteer reading Khmer is offered Khmer chips, and a
// reworded row shows its new English until its translation is redone.
describe('the corpus in other languages', () => {
  const overlayList = loadQuestionOverlays();
  const rowById = new Map(
    ROWS.map((row) => {
      return [row.id, row];
    }),
  );
  const sectionLabelById = new Map(
    PAGES.flatMap((page) => {
      return page.sections.map((section) => {
        return [`${page.page}.${section.id}`, section.label];
      });
    }),
  );

  // A ratchet, at nothing missing: a question added to the corpus is added
  // with its words in every language that has a file, the way a label is
  // added with its Khmer and French (`tranKeyCoverage.test.ts`). Fill-in
  // rows too, since 2026-10-17: they were the last English in a Khmer
  // window's question list, and are asked in English once finished.
  const MAX_UNTRANSLATED_ROWS = 0;

  it('a translation of words the row no longer says is not shown', () => {
    const pages = applyQuestionOverlay(PAGES, {
      lang: 'km',
      questions: {
        'presenter.bible.present-verse': { en: 'Old words', text: 'ពាក្យចាស់' },
      },
    });
    const row = flattenQuestions(pages).find((one) => {
      return one.id === 'presenter.bible.present-verse';
    });
    expect(row.text).toBe('How do I present a Bible verse?');
  });

  // A fill-in row finished in Khmer is asked as its English, the part the
  // person wrote kept as they wrote it -- in the middle of the row too.
  it('reads a finished fill-in row back into its English', () => {
    const pages = applyQuestionOverlay(PAGES, loadQuestionOverlays().find((one) => {
      return one.lang === 'km';
    }));
    const rows = flattenQuestions(pages);
    expect(
      toEnglishTemplateAsk('តើប៊ូតុងសម្រាប់ សម្អាតទាំងអស់ នៅឯណា?', rows),
    ).toBe('Where is the button for សម្អាតទាំងអស់');
    expect(
      toEnglishTemplateAsk(
        'បង្កើតឯកសារទំនុកច្រៀងសម្រាប់ចម្រៀង "ព្រះគុណដ៏អស្ចារ្យ"',
        rows,
      ),
    ).toBe('Create a lyric file for song "ព្រះគុណដ៏អស្ចារ្យ"');
    // A reference written as a Khmer Bible writes it is the row's example
    // too (2026-11-05: the rows had to keep "John 3:16" in English).
    expect(toEnglishTemplateAsk('ដាក់ ម៉ាថាយ ៥:៤៤ លើអេក្រង់', rows)).toBe(
      'Put ម៉ាថាយ ៥:៤៤ on the screen',
    );
    expect(
      toEnglishTemplateAsk(
        'រក្សាទុក រ៉ូម ៨:២៨ ក្នុងបញ្ជីព្រះគម្ពីររបស់ខ្ញុំ',
        rows,
      ),
    ).toBe('Save រ៉ូម ៨:២៨ to my Bibles list');
    expect(toEnglishTemplateAsk('តើប៊ូតុងសម្រាប់ នៅឯណា?', rows)).toBeNull();
    // The quoted example of a language row is the reader's own words.
    expect(
      toEnglishTemplateAsk('នាំចូលព្រះគម្ពីរជា "ភាសាថៃ"', rows),
    ).toBe('Import a Bible in "ភាសាថៃ"');
    expect(toEnglishTemplateAsk('សួស្ដី', rows)).toBeNull();
  });
});
