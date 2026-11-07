// The Khmer cases of `tools/owa-devtools-mcp/owaTools.coverage.test.mjs`, kept with the
// language's package so the language and its tests come and go together.
// They run against the same modules, which name no language.
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

// The app-level tools, against a fake app: every page expression a tool
// sends is answered by `state.answer`, except the window-language read,
// which answers `state.lang`. Same mock surface as `owaTools.test.mjs`.
const app = vi.hoisted(() => ({
  evaluateInApp: vi.fn(),
  evaluateInTarget: vi.fn(),
  listTargets: vi.fn(),
  requireLivePort: vi.fn(),
  runInTarget: vi.fn(),
  waitForNewAppPage: vi.fn(),
  readLiveInstances: vi.fn(),
  searchHelp: vi.fn(),
  readHelpPage: vi.fn(),
}));

vi.mock('../../../../../../../../tools/owa-devtools-mcp/cdp.mjs', () => ({
  evaluateInApp: app.evaluateInApp,
  evaluateInTarget: app.evaluateInTarget,
  listTargets: app.listTargets,
  requireLivePort: app.requireLivePort,
  runInTarget: app.runInTarget,
  waitForNewAppPage: app.waitForNewAppPage,
}));
vi.mock('../../../../../../../../tools/owa-devtools-mcp/discovery.mjs', () => ({
  readLiveInstances: app.readLiveInstances,
}));
vi.mock('../../../../../../../../tools/owa-devtools-mcp/help.mjs', async (importOriginal) => ({
  ...(await importOriginal()),
  searchHelp: app.searchHelp,
  readHelpPage: app.readHelpPage,
}));

import { genForegroundExpression } from '../../../../../../../../tools/owa-devtools-mcp/agentForeground.mjs';
import { genPresenterStateExpression } from '../../../../../../../../tools/owa-devtools-mcp/agentPresenter.mjs';
import { genHighlightSelectorExpression } from '../../../../../../../../tools/owa-devtools-mcp/domMatch.mjs';
import {
  genDestructiveReason,
  genPressRefusalReason,
  getFirewallLog,
} from '../../../../../../../../tools/owa-devtools-mcp/firewall.mjs';
import {
  GUIDE_CARD_HINT_TEMPLATE_LIST,
  GUIDE_CARD_LABEL_KEY_MAP,
  GUIDE_CARD_TITLE_KEY,
} from '../../../../../../../../tools/owa-devtools-mcp/guide.mjs';
import { registerOwaTools } from '../../../../../../../../tools/owa-devtools-mcp/owaTools.mjs';
import {
  PICKER_HINT_TEMPLATE,
  genPickerReadExpression,
  genPickerStartExpression,
  genPickerStopExpression,
} from '../../../../../../../../tools/owa-devtools-mcp/picker.mjs';
import { resolveTranTemplates, tranText } from '../../../../../../../../tools/owa-devtools-mcp/tran.mjs';
import { WEBSITE_READ_EVALUATE_TIMEOUT } from '../../../../../../../../tools/owa-devtools-mcp/website.mjs';

const handlers = new Map();
registerOwaTools({
  registerTool(name, schema, handler) {
    handlers.set(name, { schema, handler });
  },
});

function call(name, args = {}) {
  return handlers.get(name).handler(args);
}

function answer(result) {
  expect(result.isError, result.content?.[0]?.text).not.toBe(true);
  return result.content[0].text;
}

function refusal(result) {
  expect(result.isError).toBe(true);
  return result.content[0].text;
}

const LANGUAGE_EXPRESSION =
  "(document.documentElement.lang || 'en').split('-')[0]";

const state = {
  lang: 'en',
  isLanguageDown: false,
  answer: () => ({ value: null }),
};

// Every test starts eleven seconds after the last, so the tools' ten-second
// cache of the window's language never carries one test's language into
// another (no test advances its own clock that far).
let clock = Date.UTC(2031, 0, 1);
function useClock(toFake = ['Date']) {
  vi.useFakeTimers({ toFake });
  clock += 11 * 1000;
  vi.setSystemTime(clock);
}

// What reached the app, the language reads left out.
function appCalls() {
  return app.evaluateInApp.mock.calls.filter(([expression]) => {
    return expression !== LANGUAGE_EXPRESSION;
  });
}

// The relay request inside a data or file expression.
function readRequest(expression) {
  const match =
    /const request = Object\.assign\(([\s\S]*?), \{\s*token: Math\.random/.exec(
      expression,
    );
  return match === null ? null : JSON.parse(match[1]);
}

// The walkthrough runtime call at the end of a guide expression.
function readGuideCall(expression) {
  const at = expression.lastIndexOf('return api.');
  if (at === -1 || !expression.endsWith('; })()')) {
    return null;
  }
  return expression.slice(at + 'return api.'.length, -'; })()'.length);
}

function readStartPayload(expression) {
  const guideCall = readGuideCall(expression);
  return guideCall?.startsWith('start(')
    ? JSON.parse(guideCall.slice('start('.length, -1))
    : null;
}

function startCalls() {
  return appCalls()
    .map(([expression, options]) => {
      return { payload: readStartPayload(expression), options };
    })
    .filter((one) => {
      return one.payload !== null;
    });
}

// The text a find expression looks for.
function readFindText(expression) {
  const match = /dm\.parseNeedle\(("(?:[^"\\]|\\.)*")\)/.exec(expression);
  return match === null ? null : JSON.parse(match[1]);
}

beforeEach(() => {
  useClock();
  state.lang = 'en';
  state.isLanguageDown = false;
  state.answer = () => ({ value: null });
  app.evaluateInApp.mockImplementation(async (expression, options) => {
    if (expression === LANGUAGE_EXPRESSION) {
      if (state.isLanguageDown) {
        throw new Error('No running Open Worship App was found.');
      }
      return { value: state.lang };
    }
    return state.answer(expression, options);
  });
  app.requireLivePort.mockResolvedValue(9222);
  app.listTargets.mockResolvedValue([]);
  app.readLiveInstances.mockReturnValue([]);
  app.waitForNewAppPage.mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

const VALID_SONG = [
  '```ol:Config',
  '- Title: Grace',
  '- Artist: A',
  '- Copyright: Public Domain',
  '- Key: C',
  '- Tempo: 68bpm',
  '- Time: 4/4',
  '- Structure: V1',
  '```',
  '```ol:Verse 1',
  'Amazing grace how sweet the sound',
  '```',
].join('\n');

// A recipe as `readHelpPage` hands it out: resolved for a model, or with its
// `[en:tran:…]` templates kept for the card to put into the window's language.
const PAGES = {
  'W-77': {
    title: 'Cast a virtual display',
    body: [
      '# W-77 — Cast a virtual display',
      '',
      '1. Press **Mini Screen Options** to open its menu.',
      '2. Choose **Virtual Screens** in the menu.',
      '3. Press **Add Virtual Display** beside **Virtual Screens Manager**.',
      '4. Press **Cast to a TV** on the new card.',
    ].join('\n'),
  },
  'W-78': {
    title: 'Play a background video',
    body: [
      '1. Open the **[en:tran:Background]** panel and press **[en:tran:Zoom In]**.',
      '2. Double-click a clip to play it.',
    ].join('\n'),
  },
  'W-79': {
    title: 'Find a passage',
    body: [
      '1. Press **[en:tran:Bible Lookup]** to open it.',
      '2. Type the passage, see W-06.',
    ].join('\n'),
  },
  'W-80': {
    title: 'Choose the data folder',
    body: [
      '1. Open **Settings** with the gear at the top right.',
      '2. Press **Path Settings** to see the data folder.',
    ].join('\n'),
  },
};
const TRANSLATED_PAGES = {
  'W-79@km': {
    lang: 'km',
    title: 'រកវគ្គបទគម្ពីរ',
    body: [
      '1. ចុច **[en:tran:Bible Lookup]** ដើម្បីបើក។',
      '2. វាយវគ្គបទគម្ពីរ។',
    ].join('\n'),
  },
};

function fakeHelpPages() {
  app.readHelpPage.mockImplementation((id, langCode, _part, options = {}) => {
    if (TRANSLATED_PAGES[id] !== undefined) {
      return TRANSLATED_PAGES[id];
    }
    const page = PAGES[id.split('@')[0]];
    if (page === undefined) {
      return null;
    }
    return {
      kind: 'manual',
      title: page.title,
      body: options.keepTemplates
        ? page.body
        : resolveTranTemplates(page.body, langCode ?? 'en'),
    };
  });
}

function fakeGuideWindow({ pathname = '/presenter.html', starts = [] } = {}) {
  state.answer = (expression) => {
    if (expression === 'location.pathname') {
      return { value: pathname };
    }
    if (readStartPayload(expression) !== null) {
      return {
        value: starts.shift() ?? { currentStep: 1, isTargetFound: true },
      };
    }
    return { value: null };
  };
}

describe('owa_guide_start from a recipe', () => {
  beforeEach(() => {
    fakeHelpPages();
  });

  it('reads a Khmer window its own translation of the steps and the title', async () => {
    state.lang = 'km';
    fakeGuideWindow();
    answer(
      await call('owa_guide_start', { manualId: 'W-79', page: 'km-g1.html' }),
    );
    const [only] = startCalls();
    const khmer = tranText('Bible Lookup', 'km');
    expect(only.payload.title).toBe('រកវគ្គបទគម្ពីរ');
    expect(only.payload.steps[0].text).toBe(`ចុច ${khmer} ដើម្បីបើក។`);
    expect(only.payload.steps[0].finds).toEqual([khmer, 'Bible Lookup']);
    expect(only.payload.steps[1].text).toBe('វាយវគ្គបទគម្ពីរ។');
    // The card's own words, in the window's language.
    const labels = {};
    for (const [slot, key] of Object.entries(GUIDE_CARD_LABEL_KEY_MAP)) {
      if (tranText(key, 'km') !== key) {
        labels[slot] = tranText(key, 'km');
      }
    }
    expect(labels.next).toBeDefined();
    expect(only.payload.labels).toEqual(labels);
    const template = GUIDE_CARD_HINT_TEMPLATE_LIST[0];
    expect(only.payload.words[template]).toBe(tranText(template, 'km'));
  });
});

describe("labels in the window language", () => {
  it('offers each label with the words on the button beside it', async () => {
    state.lang = 'km';
    state.answer = () => ({ value: { clicked: true, didChange: true } });
    const khmer = tranText('Bible Lookup', 'km');
    expect(khmer).not.toBe('Bible Lookup');
    answer(
      await call('owa_click', {
        find: ['Bible Lookup', 'Zz Unknown', 'Zz One > Zz Two'],
        page: 'km-click.html',
      }),
    );
    const [expression, options] = appCalls()[0];
    expect(options).toEqual({ match: 'km-click.html' });
    expect(expression).toContain(
      JSON.stringify(['Bible Lookup', khmer, 'Zz Unknown', 'Zz One > Zz Two']),
    );
  });
});

describe("owa_find_ui", () => {
  it('tries the words on their screen when the English label finds nothing', async () => {
    state.lang = 'km';
    const khmer = tranText('Zoom In', 'km');
    state.answer = (expression) => {
      return readFindText(expression) === khmer
        ? { value: { matches: [{ text: khmer }] } }
        : { value: { matches: [], nearMisses: [] } };
    };
    const found = JSON.parse(
      answer(await call('owa_find_ui', { text: 'Zoom In', page: 'km-a.html' })),
    );
    expect(found.matches).toEqual([{ text: khmer }]);
    expect(found.foundAs).toBe(khmer);
    expect(found.note).toBe(
      `On their screen this control reads "${khmer}" -- call it that.`,
    );
  });

  it('answers the first miss when the translation misses too', async () => {
    state.lang = 'km';
    state.answer = () => ({ value: { matches: [], nearMisses: ['Zoom'] } });
    const found = JSON.parse(
      answer(await call('owa_find_ui', { text: 'Zoom In', page: 'km-b.html' })),
    );
    expect(found).toEqual({ matches: [], nearMisses: ['Zoom'] });
    expect(appCalls()).toHaveLength(2);
  });
});

describe("owa_pick_element", () => {

  it('says nothing was pointed at when the person pressed Escape', async () => {
    state.lang = 'km';
    state.answer = (expression) => {
      if (expression === genPickerStopExpression()) {
        throw new Error('The window went away.');
      }
      return expression === genPickerReadExpression()
        ? { value: { phase: 'cancelled' } }
        : { value: true };
    };
    expect(
      JSON.parse(
        answer(await call('owa_pick_element', { page: 'km-pick.html' })),
      ),
    ).toEqual({ picked: false, reason: 'Nothing was pointed at.' });
    // Its line is in the window's language.
    const khmerHint = tranText(PICKER_HINT_TEMPLATE, 'km');
    expect(khmerHint).not.toBe(PICKER_HINT_TEMPLATE);
    expect(appCalls()[0]).toEqual([
      genPickerStartExpression(khmerHint),
      { match: 'km-pick.html' },
    ]);
  });
});

describe("owa_guide_start from a recipe", () => {
  beforeEach(() => {
    fakeHelpPages();
  });

  it('puts the button names of an untranslated page into the window language', async () => {
    state.lang = 'km';
    fakeGuideWindow();
    answer(
      await call('owa_guide_start', { manualId: 'W-78', page: 'km-g2.html' }),
    );
    const [only] = startCalls();
    const background = tranText('Background', 'km');
    const zoom = tranText('Zoom In', 'km');
    // Not a dictionary key as a whole, so each half is translated.
    expect(tranText('Background > Zoom In', 'km')).toBe('Background > Zoom In');
    expect(only.payload.title).toBe('Play a background video');
    expect(only.payload.steps.map((step) => step.text)).toEqual([
      `Open the ${background} panel and press ${zoom}.`,
      'Double-click a clip to play it.',
    ]);
    // The window's words first; the panel keeps its English name beside the
    // translated control; each English label comes after its translation.
    expect(only.payload.steps[0].finds).toEqual([
      `${background} > ${zoom}`,
      `Background > ${zoom}`,
      'Background > Zoom In',
      tranText('Background panel', 'km'),
      'Background panel',
      background,
      'Background',
      zoom,
      'Zoom In',
    ]);
  });
});

describe("owa_guide_start with a built-in lesson", () => {

  it('looks for the panel under its Khmer name too', async () => {
    state.lang = 'km';
    const khmerReference = tranText('Bible Reference', 'km');
    expect(khmerReference).not.toBe('Bible Reference');
    const looked = [];
    state.answer = (expression) => {
      if (expression === 'location.pathname') {
        return { value: '/presenter.html' };
      }
      const asked = readFindText(expression);
      if (asked !== null) {
        looked.push(asked);
        return {
          value: { matches: [{ isVisible: asked === khmerReference }] },
        };
      }
      return { value: { currentStep: 1 } };
    };
    answer(
      await call('owa_guide_start', {
        demoId: 'presenter-lookup-reference',
        page: 'presenter.html',
      }),
    );
    expect(looked).toEqual(['Bible Reference', khmerReference]);
    const [only] = startCalls();
    expect(only.payload.steps).toHaveLength(2);
    expect(only.payload.title).toBe(
      tranText('Type a complete reference in Bible Lookup', 'km'),
    );
  });
});
