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
} from './passageMatch.mjs';

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

describe('toPassages', () => {
  it('joins the lines a step was wrapped over and drops headings', () => {
    const passages = toPassages(FIND_BAR_PAGE);
    expect(passages).toHaveLength(5);
    expect(passages[0].text).toContain('in the app menu bar. A slim bar');
    expect(passages[3].text).toContain('**no whole-word and no regex option**');
    expect(
      passages
        .map((passage) => {
          return passage.text;
        })
        .join('\n'),
    ).not.toContain('# Find text');
  });

  it('says where each passage starts in the page', () => {
    const passages = toPassages(FIND_BAR_PAGE);
    for (const passage of passages) {
      expect(
        FIND_BAR_PAGE.slice(passage.at)
          .trimStart()
          .startsWith(passage.text.slice(0, 12)),
      ).toBe(true);
    }
  });

  it('starts a passage at a bold lead, and not at a line that merely starts bold', () => {
    // The help window's own page: paragraphs inside a step, one under the
    // other with no blank line, each opening on a bolded sentence.
    const passages = toPassages(
      [
        '6. Type a question and press **Ctrl+Enter**.',
        '   **The box takes as many lines as you need.** Plain **Enter** starts a new',
        '   line rather than sending.',
        '   **A question you asked before comes back with Alt+↑.** The window remembers;',
        '   **Alt+↑** puts the question before back in the box.',
      ].join('\n'),
    );
    expect(passages).toHaveLength(3);
    expect(passages[1].text).toBe(
      '**The box takes as many lines as you need.** Plain **Enter** starts a new line rather than sending.',
    );
    expect(passages[2].text).toContain(
      'remembers; **Alt+↑** puts the question',
    );
  });

  it('starts a passage at a bold lead the wrap carried over a line break', () => {
    // Five of the help window's leads were wrapped by the manual's
    // ninety-character lines, and each stayed inside the step above it: the
    // step that lists who answers ran to 6 800 characters.
    const passages = toPassages(
      [
        '13. The second list is **who answers**, and you can change your mind.',
        '    **Auto, the last row of that list, chooses for you — among the assistants that',
        '    cost nothing.** Pick **Auto** and the tab stays on it.',
        '    **Settings → Others →',
        '    AI Providers** is where a key goes.',
      ].join('\n'),
    );
    expect(passages).toHaveLength(2);
    expect(
      passages[1].text.startsWith(
        '**Auto, the last row of that list, chooses for you — among the assistants that cost nothing.** Pick',
      ),
    ).toBe(true);
    // A bold NAME the wrap broke is the sentence carrying on.
    expect(passages[1].text).toContain(
      '**Settings → Others → AI Providers** is where',
    );
  });

  it('keeps a paragraph apart from the list under it', () => {
    const passages = toPassages(
      ['**Goal:** hide a panel.', '', '1. Open **View**.', '2. Click it.'].join(
        '\n',
      ),
    );
    expect(
      passages.map((passage) => {
        return passage.text;
      }),
    ).toEqual(['**Goal:** hide a panel.', '1. Open **View**.', '2. Click it.']);
  });
});

describe('toPassageKey', () => {
  it('reads a label out of its template', () => {
    expect(toPassageKey('Click **[en:tran:Clear Long Text]** now')).toBe(
      'click clear long text now',
    );
  });
});

describe('rankPassages', () => {
  it('does not find a two-letter word inside another word', () => {
    // "am" is in "the same"; it used to choose the Enter bullet for a
    // question about the version.
    const passages = toPassages(FIND_BAR_PAGE);
    const ranked = rankPassages(passages, [['version'], ['am'], ['running']]);
    expect(passages[ranked[0].index].text).toContain('**About:**');
  });

  it('puts the passage naming the control above every word match', () => {
    const passages = toPassages(FIND_BAR_PAGE);
    const ranked = rankPassages(
      passages,
      [['find'], ['window'], ['text']],
      ['Aa'],
    );
    expect(passages[ranked[0].index].text).toContain('**Aa** button');
  });

  it('takes the first passage that names the control, unless the words choose', () => {
    // The panels page: the divider is named where it hides a panel and again
    // where it resets one, and the reset step also says "Widgets" -- the
    // menu the hide question is filed with. Summed, the reset step won.
    const passages = [
      { text: '1. Open **View** → **Widgets**. One tick-box per panel.', at: 0 },
      {
        text: '7. Right-click the divider between A and B and choose **Close First Widget**: the panel collapses.',
        at: 60,
      },
      {
        text: '9. Right-click the divider between A and B again and choose **Reset Size**; **Reset Widgets Size** is for every panel.',
        at: 170,
      },
    ];
    const anchors = ['divider between A and B', 'Widgets'];
    expect(rankPassages(passages, [['hide'], ['panel']], anchors)[0].index).toBe(
      1,
    );
    // The words still decide between passages that carry the control.
    expect(
      rankPassages(passages, [['reset'], ['size']], anchors)[0].index,
    ).toBe(2);
  });

  it('counts a word the app uses for theirs, for less', () => {
    const passages = [
      { text: 'Turn the screen on.', at: 0 },
      { text: 'The projector is the second monitor.', at: 30 },
    ];
    const ranked = rankPassages(passages, [['projector', 'screen']]);
    expect(
      ranked.map((item) => {
        return item.index;
      }),
    ).toEqual([1, 0]);
  });

  it('counts a word once, however often the question and its keywords say it', () => {
    // "How do I get more room … in the help window?" with the keywords
    // "small window" and "top of the help window": three votes for
    // "window" outvoted the words only the answer carries.
    const passages = [
      { text: 'The help window opens beside the app.', at: 0 },
      { text: 'Fold the lists to one line for more room.', at: 40 },
    ];
    const terms = [
      ['room'],
      ['window'],
      ['fold'],
      ['line'],
      ['window'],
      ['help'],
      ['window'],
      ['help'],
    ];
    expect(rankPassages(passages, terms)[0].index).toBe(1);
  });

  it('weighs the words of a very long passage down, and never its control', () => {
    // One step of the help window's page lists every assistant and server:
    // thousands of characters, so it carries a word of nearly every question.
    const passages = [
      {
        text: `13. Who answers. ${'Add a server, wait while it loads, and it still works for more. '.repeat(150)}`,
        at: 0,
      },
      {
        text: '**And you can keep talking while it works.** Type what you forgot and press **Add**.',
        at: 9700,
      },
    ];
    const terms = toQuestionTerms(
      'Can I add something while you are still answering?',
    );
    expect(rankPassages(passages, terms)[0].index).toBe(1);
    // A control named in the long step is still that step's.
    expect(rankPassages(passages, terms, ['Who answers'])[0].index).toBe(0);
  });

  it('answers nothing when nothing matches', () => {
    expect(rankPassages(toPassages(FIND_BAR_PAGE), [['zebra']])).toEqual([]);
  });
});

describe('genPassageExcerpt', () => {
  it('quotes the passage that answers, whole and unwrapped', () => {
    const excerpt = genPassageExcerpt(FIND_BAR_PAGE, [
      ['jump'],
      ['next'],
      ['match'],
    ]);
    expect(excerpt.startsWith('- **Enter** jumps to the next match')).toBe(true);
    expect(excerpt).toContain('the **⌃** and **⌄** buttons');
    // Short, so the next bullet comes too -- on its own line.
    expect(excerpt.split('\n')).toHaveLength(2);
  });

  it('leaves the screenshot marks out', () => {
    expect(
      genPassageExcerpt(FIND_BAR_PAGE, [['ctrl+f'], ['slim']]),
    ).not.toContain('📸');
  });

  it('falls back to the opening when no word is on the page', () => {
    expect(
      genPassageExcerpt(FIND_BAR_PAGE, [['zebra']]).startsWith(
        '- **Find bar:**',
      ),
    ).toBe(true);
  });

  it('stops at a sentence and says it stopped', () => {
    const long = `1. ${'This sentence is here to fill the step. '.repeat(20)}`;
    const excerpt = genPassageExcerpt(long, [['sentence']]);
    expect(excerpt.length).toBeLessThanOrEqual(EXCERPT_CHAR_LIMIT + 2);
    expect(excerpt.endsWith('. …')).toBe(true);
  });

  it('starts a long passage at the sentence naming the control', () => {
    const header =
      `- **Header:** ${'one more control sits here; '.repeat(22)}` +
      'and the **Stay Awake** cup keeps the computer from sleeping.';
    const excerpt = genPassageExcerpt(header, [['awake']], ['Stay Awake']);
    expect(excerpt.startsWith('… ')).toBe(true);
    expect(excerpt).toContain('**Stay Awake** cup');
  });

  it('reads a page saved with Windows line endings', () => {
    const excerpt = genPassageExcerpt(FIND_BAR_PAGE.replace(/\n/g, '\r\n'), [
      ['version'],
    ]);
    expect(excerpt).toBe(
      '- **About:** shows the app version and project links.',
    );
  });

  it('is empty for an empty page', () => {
    expect(genPassageExcerpt('', [['anything']])).toBe('');
  });
});

describe('toQuestionTerms', () => {
  it('keeps the words that say what is asked', () => {
    expect(
      toQuestionTerms('What commands can I type instead of asking?'),
    ).toEqual([['commands'], ['type'], ['instead'], ['asking']]);
  });

  it('is empty for nothing', () => {
    expect(toQuestionTerms('')).toEqual([]);
    expect(toQuestionTerms(undefined)).toEqual([]);
  });
});

describe('genQuestionAnchors', () => {
  it('reads the control, the menu item and each key', () => {
    expect(
      genQuestionAnchors({
        find: 'Background > Videos',
        menu: 'View → Reset Widgets Size',
        shortcut: 'Enter / Shift+Enter',
      }),
    ).toEqual(['Videos', 'Reset Widgets Size', 'Enter', 'Shift+Enter']);
  });

  it('puts the passage a row names in front of its control', () => {
    expect(
      genQuestionAnchors({
        find: 'Copy',
        passage: ' Under every answer is Copy ',
      }),
    ).toEqual(['Under every answer is Copy', 'Copy']);
    // ...so that passage outranks one that merely names the control more.
    const passages = [
      { text: '8. Under every answer is **Copy**, and it says **✓ Copied**.', at: 0 },
      {
        text: '9. Press **Report**: **Copy report**, **Copy subject**, **Copy picture**, then paste and save.',
        at: 70,
      },
    ];
    const terms = [['copy'], ['paste'], ['save']];
    expect(rankPassages(passages, terms)[0].index).toBe(1);
    expect(
      rankPassages(
        passages,
        terms,
        genQuestionAnchors({ passage: 'Under every answer is Copy' }),
      )[0].index,
    ).toBe(0);
  });

  it('leaves out what is not a string, and survives no resources', () => {
    // Four corpus rows carried a list here; the window read it as text.
    expect(genQuestionAnchors({ find: ['Report'], menu: 7 })).toEqual([]);
    expect(genQuestionAnchors(undefined)).toEqual([]);
    expect(genQuestionAnchors(null)).toEqual([]);
  });
});

describe('clipPageToPassages', () => {
  const filler = (name) => {
    return `${name} ${'plain words about something else entirely. '.repeat(22)}`;
  };
  const LONG_PAGE = [
    '# Ask the app for help',
    '',
    '**Goal:** get an answer without leaving the app.',
    '',
    `1. ${filler('Open the window.')}`,
    `2. ${filler('Tabs along the top.')}`,
    `3. ${filler('Rename a tab.')}`,
    `4. ${filler('Lock a tab.')}`,
    `5. ${filler('The pickers.')}`,
    `6. ${filler('Type a question.')}`,
    `7. ${filler('Attach a picture.')}`,
    '   **Some things need no assistant at all — type a slash.** A line that starts',
    '   with a slash is a command: it runs on the spot, and the list of commands',
    '   appears above the box.',
    `8. ${filler('Copy an answer.')}`,
  ].join('\n');

  it('carries the opening and the passage that answers, wherever it is', () => {
    const cut = clipPageToPassages(
      LONG_PAGE,
      toQuestionTerms('What commands can I type instead of asking?'),
    );
    expect(cut.isHead).toBe(false);
    expect(cut.text.startsWith('**Goal:** get an answer')).toBe(true);
    expect(cut.text).toContain('\n…\n**Some things need no assistant at all');
    expect(cut.text).toContain('the list of commands appears above the box.');
    expect(cut.text.length).toBeLessThanOrEqual(6000);
    expect(cut.isEndCut).toBe(true);
  });

  it('hands back the start of the page when that already carries it', () => {
    const cut = clipPageToPassages(LONG_PAGE, toQuestionTerms('rename a tab'));
    expect(cut.isHead).toBe(true);
    expect(cut.text).toBe(LONG_PAGE.trim().slice(0, 6000).trimEnd());
  });

  it('says so when nothing on the page matches', () => {
    expect(
      clipPageToPassages(LONG_PAGE, toQuestionTerms('zebra crossing')),
    ).toBe(null);
  });

  it('puts the passage naming the control ahead of the words', () => {
    const cut = clipPageToPassages(
      LONG_PAGE,
      toQuestionTerms('how do I lock it'),
      ['Copy an answer'],
    );
    expect(cut.text).toContain('8. Copy an answer.');
  });

  it('makes a match longer than all the room wait for the ones that fit', () => {
    // Cut where it was met, with nothing after it, the long step was all
    // that rode beside the opening, and the passage that answers never did.
    const page = [
      LONG_PAGE,
      `9. Who answers. ${'Add a server and wait while it is still loading, then add more. '.repeat(100)}`,
      '   **And you can keep talking while it works.** Type what you forgot and press **Add**.',
    ].join('\n');
    const cut = clipPageToPassages(
      page,
      toQuestionTerms('Can I add more while you are still answering?'),
    );
    expect(cut.text).toContain('9. Who answers.');
    // The long one is cut at a sentence, and the answer rides whole after it.
    expect(cut.text).toContain(
      '. …\n**And you can keep talking while it works.** Type what you forgot and press **Add**.',
    );
    expect(cut.text.length).toBeLessThanOrEqual(6000);
  });

  it('cuts a best passage longer than the room left, at a sentence', () => {
    const page = `${LONG_PAGE}\n9. Zebra crossing. ${'A sentence about zebras. '.repeat(400)}`;
    const cut = clipPageToPassages(page, toQuestionTerms('zebra crossing'));
    expect(cut.text).toContain('9. Zebra crossing.');
    expect(cut.text.endsWith('. …')).toBe(true);
    expect(cut.text.length).toBeLessThanOrEqual(6000);
  });
});
