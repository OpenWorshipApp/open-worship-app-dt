// @vitest-environment jsdom
// The Khmer cases of `tools/owa-devtools-mcp/notify.test.mjs`, kept with the
// language's package so the language and its tests come and go together.
// They run against the same modules, which name no language.
import { beforeEach, describe, expect, it } from 'vitest';

import {
  describeToolCall,
  describeToolNotice,
  genNoticeExpression,
  genNoticeWords,
  listNoticeTranKeys,
  watchToolCalls,
} from '../../../../../../../../tools/owa-devtools-mcp/notify.mjs';
import { loadTranBundle } from '../../../../../../../../tools/owa-devtools-mcp/tran.mjs';

// No banner is drawn here: the app may not be running, and a test must not
// reach out to it. The transport seam is what matters.
beforeEach(() => {
    process.env.OWA_MCP_NOTICE = '0';
});

// Reported 2026-10-06: the banner stayed English in a Khmer window. It is said
// in the language the app is DISPLAYING now, through the app's own dictionary,
// and a phrase the dictionary does not have yet is said in English WHOLE.
describe('the banner speaks the language the app is shown in', () => {
  // A dictionary as `tran.mjs` hands it over: sanitized keys.
  const dictionaries = {
    km: {
      'app assistant': 'ជំនួយការកម្មវិធី',
      'clicked something': 'បានចុចអ្វីមួយ',
      'took a foreground extra off the screen': 'បានដកធាតុផ្ទៃខាងមុខ',
      countdown: 'រាប់ថយក្រោយ',
      'read a website': 'បានអានគេហទំព័រ',
    },
    fr: { assistant: 'Assistant', 'app assistant': "Assistant de l'application" },
  };

  it('translates the phrase, who is acting, and a detail word the dictionary has', () => {
    const words = genNoticeWords(
      describeToolNotice('owa_click', {}),
      dictionaries,
    );
    expect(words.en).toEqual({ who: 'Assistant', what: 'clicked something' });
    // `Assistant` is not in the Khmer dictionary yet: the app's own name for
    // the assistant stands in.
    expect(words.km).toEqual({
      who: 'ជំនួយការកម្មវិធី',
      what: 'បានចុចអ្វីមួយ',
    });
    const stopped = genNoticeWords(
      describeToolNotice('owa_foreground', {
        action: 'stop',
        widget: 'countdown',
      }),
      dictionaries,
    );
    expect(stopped.km.what).toBe('បានដកធាតុផ្ទៃខាងមុខ · រាប់ថយក្រោយ');
    // A site is a site in every language.
    const read = genNoticeWords(
      describeToolNotice('owa_read_website', { url: 'https://example.com/x' }),
      dictionaries,
    );
    expect(read.km.what).toBe('បានអានគេហទំព័រ · example.com');
  });
});

// The pill itself, evaluated the way the page gets it.
describe('the banner in the page', () => {
  beforeEach(() => {
    delete window.__owaAgentNotice;
    document.getElementById('owa-agent-notice-host')?.remove();
    document.documentElement.lang = 'en';
  });

  function show(words) {
    return new Function(`return (${genNoticeExpression(words)})`)();
  }

  function readPill() {
    const root = document.getElementById('owa-agent-notice-host').shadowRoot;
    return {
      who: root.querySelector('.who').textContent,
      what: root.querySelector('.what').textContent,
      lang: root.querySelector('.pill').lang,
      css: root.querySelector('style').textContent,
    };
  }

  const words = {
    en: { who: 'Assistant', what: 'clicked something' },
    km: { who: 'ជំនួយការ', what: 'បានចុចអ្វីមួយ' },
  };

  it('picks the words for the language the window is displaying', () => {
    document.documentElement.lang = 'km';
    expect(show(words)).toBe(true);
    expect(readPill()).toMatchObject({
      who: 'ជំនួយការ',
      what: 'បានចុចអ្វីមួយ',
      lang: 'km',
    });
  });
});
