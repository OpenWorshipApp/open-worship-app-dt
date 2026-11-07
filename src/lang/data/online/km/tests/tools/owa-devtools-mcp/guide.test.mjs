// @vitest-environment jsdom
// The Khmer cases of `tools/owa-devtools-mcp/guide.test.mjs`, kept with the
// language's package so the language and its tests come and go together.
// They run against the same modules, which name no language.
import { pathToFileURL as toSourceUrl } from 'node:url';
import { join as joinSourcePath } from 'node:path';
const SOURCE_URL = toSourceUrl(joinSourcePath(process.cwd(), 'tools/owa-devtools-mcp/guide.test.mjs')).href;
import { describe, expect, it, beforeEach } from 'vitest';

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { genDestructiveLabelRule } from '../../../../../../../../tools/owa-devtools-mcp/destructiveLabel.mjs';
import {
  GUIDE_CARD_HINT_TEMPLATE_LIST,
  GUIDE_CARD_LABEL_KEY_MAP,
  listGuideCardTranKeys,
  detectRecipeWindow,
  dropStepsAlreadyDone,
  genGuideExpression,
  lineUpTranslatedSteps,
  selectGuideStepIndexForTopic,
  selectGuideStepsForTopic,
  stripInternalIds,
  toGuideSteps,
  toKeystroke,
} from '../../../../../../../../tools/owa-devtools-mcp/guide.mjs';
import { extractDictionary, loadTranBundle } from '../../../../../../../../tools/owa-devtools-mcp/tran.mjs';

const GUARD = { rule: genDestructiveLabelRule(loadTranBundle()) };
const REPO_DIR = path.join(
  path.dirname(fileURLToPath(SOURCE_URL)),
  '..',
  '..',
);

// The runtime is a string evaluated in the app page, so it is exercised the
// way the app gets it: evaluated, then driven through its own api.
function startGuide(payload) {
  return new Function(
    `return ${genGuideExpression(`start(${JSON.stringify(payload)})`)}`,
  )();
}

beforeEach(() => {
  delete window.__owaGuide;
  document.getElementById('owa-guide-host')?.remove();
  document.body.innerHTML = '';
  // jsdom lays nothing out, so every control would read as hidden and the
  // ranking below would never be reached.
  Element.prototype.getBoundingClientRect = function () {
    return { x: 10, y: 10, width: 40, height: 20, top: 10, left: 10 };
  };
  Element.prototype.scrollIntoView = function () {};
  // jsdom has no checkVisibility; Electron 43 does, and the matcher
  // asks it whether a control is painted. Answered here the long way --
  // the ancestor walk it replaces in the browser for being 28x slower.
  Element.prototype.checkVisibility = function (options = {}) {
    let node = this;
    while (node !== null && node.nodeType === 1) {
      const style = getComputedStyle(node);
      if (style.display === 'none') {
        return false;
      }
      if (
        (options.checkVisibilityCSS && style.visibility === 'hidden') ||
        (options.opacityProperty && style.opacity === '0')
      ) {
        return false;
      }
      node = node.parentElement;
    }
    return true;
  };
});

// The card sits in the app window and speaks its language: every word it
// asks the dictionary for must be there in Khmer AND French, read straight
// from the packages (a stale built bundle would hide a new key).
describe('the card’s own words', () => {
  it('says its sentences in the words it is handed', () => {
    startGuide({
      steps: [{ text: 'ចុចប៊ូតុង' }],
      words: {
        'Do this step in the window behind me.':
          'សូមធ្វើជំហាននេះនៅក្នុងបង្អួចនៅពីក្រោយខ្ញុំ។',
      },
      guard: GUARD,
    });
    const root = document.getElementById('owa-guide-host').shadowRoot;
    expect(root.textContent).toContain(
      'សូមធ្វើជំហាននេះនៅក្នុងបង្អួចនៅពីក្រោយខ្ញុំ។',
    );
  });

  it('takes the words it is handed', () => {
    startGuide({
      title: 'ម្តងមួយជំហាន',
      steps: [{ text: 'ចុចប៊ូតុង' }, { text: 'រួចហើយ' }],
      labels: { next: 'បន្ទាប់', step: 'ជំហាន' },
      guard: GUARD,
    });
    const root = document.getElementById('owa-guide-host').shadowRoot;
    expect(root.textContent).toContain('ជំហាន 1/2');
    expect(root.textContent).toContain('បន្ទាប់');
    expect(root.textContent).toContain('ម្តងមួយជំហាន');
  });
});

describe('toGuideSteps', () => {
  // A page's own translation is read for its WORDS (`withLocalStepText`):
  // left to `toEnglishOnly`, a Khmer step was its button names and nothing
  // else, and the card fell back to the English sentence.
  it('keeps a translated step whole when asked to', () => {
    const page = [
      '1. ចុច **[en:tran:Font Size]** ហើយរំកិលវាទៅខាងស្ដាំ។',
      '2. ចុច **[en:tran:Add Extra Bible]**។',
    ].join('\n');
    expect(toGuideSteps(page)[0].text).toBe('[en:tran:Font Size]');
    const kept = toGuideSteps(page, undefined, { isTextKept: true });
    expect(kept.map((step) => step.text)).toEqual([
      'ចុច [en:tran:Font Size] ហើយរំកិលវាទៅខាងស្ដាំ។',
      'ចុច [en:tran:Add Extra Bible]។',
    ]);
  });

  // The keystroke is dropped as a thing to RING and kept as a thing to
  // press: W-06 step 4 ("close the dialog ... or Ctrl+Q") named no control
  // at all, so "Do it" could only apologise on it.
  it('scopes a control to the panel the same step names', () => {
    // W-21 step 1, verbatim. "Background" on its own is also the word on
    // the screen preview's background-transition button, which is where
    // the ring landed before the panel was part of the question.
    const steps = toGuideSteps(
      '1. Open the **Background** (ផ្ទៃខាងក្រោយ) panel and choose the ' +
        '**Videos** (វីដេអូ) tab.\n',
    );
    expect(steps[0].finds[0]).toBe('Background > Videos');
    // The panel itself is next, so a COLLAPSED panel still gets rung --
    // that is the half of the step not done yet.
    expect(steps[0].finds).toContain('Background panel');
    expect(steps[0].finds).toContain('Background');
  });
});

// From `tools/owa-devtools-mcp/guide.coverage.test.mjs`.
// A translation is read as the English page's steps only when the two line
// up; one that does not is the English card, never the wrong step's words.
describe('lineUpTranslatedSteps', () => {
  const english = [
    '1. Open **Bible Lookup** at the top.',
    '2. Type **John 3:16** and press **Enter**.',
  ].join('\n');

  it('reads a translation step for step when it has the same steps', () => {
    const local = ['1. បើក **Bible Lookup** ។', '2. វាយ **John 3:16** ។'].join(
      '\n',
    );
    const lined = lineUpTranslatedSteps(english, local, 2);
    expect(
      lined.map((step) => {
        return step.text;
      }),
    ).toEqual(['បើក Bible Lookup ។', 'វាយ John 3:16 ។']);
  });

  it('gives up on a translation with a step of its own', () => {
    const local = [
      '1. បើក **Bible Lookup** ។',
      '2. វាយ **John 3:16** ។',
      '3. ចុច **Enter** ។',
    ].join('\n');
    expect(toGuideSteps(english)).toHaveLength(2);
    expect(lineUpTranslatedSteps(english, local, 2)).toBeNull();
  });

  // A bullet page's `**Goal:**` is front matter in English and a bold line
  // like any other in its translation: lined up by place, it is dropped.
  const englishBullets = [
    '**Goal:** Read a verse on the screen.',
    '',
    '- **Bible Lookup** opens the lookup.',
    '- **Enter** shows the verse.',
  ].join('\n');
  const localBullets = [
    '**គោលដៅ:** អានខគម្ពីរ។',
    '',
    '- **Bible Lookup** បើកការស្វែងរក។',
    '- **Enter** បង្ហាញខ។',
  ].join('\n');

  it('lines a bullet page up by place, front matter left out', () => {
    const count = toGuideSteps(englishBullets).length;
    expect(count).toBe(2);
    const lined = lineUpTranslatedSteps(englishBullets, localBullets, count);
    expect(
      lined.map((step) => {
        return step.text;
      }),
    ).toEqual(['Bible Lookup បើកការស្វែងរក។', 'Enter បង្ហាញខ។']);
  });

  it('gives up on a bullet page whose lines do not pair up', () => {
    const extra = `${localBullets}\n- **Escape** បិទ។`;
    expect(lineUpTranslatedSteps(englishBullets, extra, 2)).toBeNull();
  });
});
