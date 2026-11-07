// The Khmer cases of `tools/owa-devtools-mcp/notify.coverage.test.mjs`, kept with the
// language's package so the language and its tests come and go together.
// They run against the same modules, which name no language.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The banner as it is raised: which calls raise one, in which window, how
// often, and in which words -- against a fake app and a small dictionary.
const mocks = vi.hoisted(() => ({
  evaluateInApp: vi.fn(),
  loadTranBundle: vi.fn(),
}));

vi.mock('../../../../../../../../tools/owa-devtools-mcp/cdp.mjs', () => ({ evaluateInApp: mocks.evaluateInApp }));
vi.mock('../../../../../../../../tools/owa-devtools-mcp/tran.mjs', async (importOriginal) => ({
  ...(await importOriginal()),
  loadTranBundle: mocks.loadTranBundle,
}));

import {
  describeToolCall,
  describeToolNotice,
  genNoticeExpression,
  notifyToolCall,
  watchToolCalls,
} from '../../../../../../../../tools/owa-devtools-mcp/notify.mjs';

const BUNDLE = {
  dictionaries: {
    en: { 'clicked something': 'clicked something' },
    km: {
      'clicked something': 'បានចុចអ្វីមួយ',
      'pressed a key': 'បានចុចគ្រាប់ចុច',
      assistant: 'ជំនួយការ',
      'not a banner word': 'x',
    },
    fr: { 'clicked something': 'a cliqué quelque chose' },
  },
};

const KHMER_CLICK_WORDS = {
  en: { who: 'Assistant', what: 'clicked something' },
  km: { who: 'ជំនួយការ', what: 'បានចុចអ្វីមួយ' },
  fr: { who: 'Assistant', what: 'a cliqué quelque chose' },
};

// Five minutes between tests (none moves its own clock that far): the
// banner's one-minute dictionary and 1.2-second repeat guard start empty.
let clock = Date.UTC(2032, 0, 1);
let previousNotice;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  clock += 5 * 60 * 1000;
  vi.setSystemTime(clock);
  previousNotice = process.env.OWA_MCP_NOTICE;
  delete process.env.OWA_MCP_NOTICE;
  mocks.evaluateInApp.mockResolvedValue({ value: true });
  mocks.loadTranBundle.mockReturnValue(BUNDLE);
});

afterEach(() => {
  vi.useRealTimers();
  if (previousNotice === undefined) {
    delete process.env.OWA_MCP_NOTICE;
  } else {
    process.env.OWA_MCP_NOTICE = previousNotice;
  }
});

describe('notifyToolCall', () => {
  it('reads the dictionary once a minute, keeping only the banner words', () => {
    notifyToolCall('owa_click', {});
    notifyToolCall('owa_press_key', { keys: 'F5' });
    expect(mocks.loadTranBundle).toHaveBeenCalledTimes(1);
    expect(mocks.evaluateInApp.mock.calls[1][0]).toBe(
      genNoticeExpression({
        en: { who: 'Assistant', what: 'pressed F5' },
        km: { who: 'ជំនួយការ', what: 'បានចុចគ្រាប់ចុច · F5' },
      }),
    );
    vi.setSystemTime(clock + 61 * 1000);
    notifyToolCall('owa_click', {});
    expect(mocks.loadTranBundle).toHaveBeenCalledTimes(2);
  });
});
