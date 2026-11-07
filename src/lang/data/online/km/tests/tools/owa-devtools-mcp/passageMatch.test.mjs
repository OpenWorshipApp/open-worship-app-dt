// The Khmer cases of `tools/owa-devtools-mcp/passageMatch.test.mjs`, kept with the
// language's package so the language and its tests come and go together.
// They run against the same modules, which name no language.
import { describe, expect, it } from 'vitest';

import {
  clipPageToPassages,
  EXCERPT_CHAR_LIMIT,
  genPassageExcerpt,
  genQuestionAnchors,
  rankPassages,
  toPassageKey,
  toPassages,
  toQuestionTerms,
} from '../../../../../../../../tools/owa-devtools-mcp/passageMatch.mjs';

// The find bar's page, as the manual wraps it: bullets under a bullet, a bold
// that crosses a line break, and the answer to "what version" on its last line.
const FIND_BAR_PAGE = [
  '# Find text anywhere (Find bar) & About',
  '',
  '- **Find bar:** press **Ctrl+F** (**⌘F** on macOS) or use **Edit → Find** in the app',
  '  menu bar. A slim bar drops in at the **top-right of the window itself** and searches',
  '  only that window. 📸',
  '  - Type to search as you go; the counter shows the matches.',
  '  - **Enter** jumps to the next match, **Shift+Enter** to the previous one; the **⌃**',
  '    and **⌄** buttons do the same and wrap around.',
  '  - The **Aa** button toggles case-sensitivity. There is **no whole-word and no regex',
  '    option** — the find-in-page does not offer them.',
  '- **About:** shows the app version and project links.',
].join('\n');

describe('genPassageExcerpt', () => {

  // Seen in a Khmer excerpt: `ការតម្រឹមអក្សរ, **[en:tran:Line …` -- a
  // template no resolver could read, cut through. And a Khmer sentence ends
  // on `។`, which the old cut never looked for.
  it('never cuts through a button name, and stops at a sentence of any script', () => {
    const words = 'ពាក្យ '.repeat(85);
    const excerpt = genPassageExcerpt(
      `1. ${words}**[en:tran:Line Spacing]** ${'ពាក្យ '.repeat(40)}`,
      [['ពាក្យ']],
    );
    expect(excerpt).not.toContain('[en:tran:');
    expect(excerpt).not.toMatch(/\*\*\s*…$/);
    const khmer = `1. ${'នេះជាប្រយោគមួយសម្រាប់បំពេញជំហាននេះ។ '.repeat(20)}`;
    expect(genPassageExcerpt(khmer, [['ប្រយោគ']]).endsWith('។ …')).toBe(true);
  });
});
