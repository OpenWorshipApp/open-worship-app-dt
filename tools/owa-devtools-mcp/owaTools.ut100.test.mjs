// Two `owaTools.mjs` handlers its sibling suites leave dark: `owa_language`
// (the app's Languages tab asked over the `owa-agent-data` relay, an install
// given ten minutes) and `owa_bible_note`'s look for an open note window
// when only OTHER pages are open. The endpoint is a fake (`cdp.mjs` mocked).

import { beforeEach, describe, expect, it, vi } from 'vitest';

const app = vi.hoisted(() => ({
  evaluateInApp: vi.fn(),
  evaluateInTarget: vi.fn(),
  listTargets: vi.fn(),
  requireLivePort: vi.fn(),
  runInTarget: vi.fn(),
  waitForNewAppPage: vi.fn(),
  readLiveInstances: vi.fn(),
}));

vi.mock('./cdp.mjs', () => ({
  evaluateInApp: app.evaluateInApp,
  evaluateInTarget: app.evaluateInTarget,
  listTargets: app.listTargets,
  requireLivePort: app.requireLivePort,
  runInTarget: app.runInTarget,
  waitForNewAppPage: app.waitForNewAppPage,
}));
vi.mock('./discovery.mjs', () => ({
  readLiveInstances: app.readLiveInstances,
}));

import { registerOwaTools } from './owaTools.mjs';

const handlers = new Map();
registerOwaTools({
  registerTool(name, _schema, handler) {
    handlers.set(name, handler);
  },
});

// The request rides in the expression as one line of JSON.
const REQUEST_PATTERN = /const request = Object\.assign\((.*), \{\r?\n/;

function requestOf(expression) {
  const matched = REQUEST_PATTERN.exec(expression);
  expect(matched).not.toBeNull();
  return JSON.parse(matched[1]);
}

// The page's own wait inside the expression: `setTimeout(..., <ms>)`.
function pageWaitOf(expression) {
  const matched = /\}, (\d+)\);\s*document\.addEventListener/.exec(expression);
  expect(matched).not.toBeNull();
  return Number(matched[1]);
}

function textOf(result) {
  expect(result.isError).not.toBe(true);
  return JSON.parse(result.content[0].text);
}

function errorOf(result) {
  expect(result.isError).toBe(true);
  return result.content[0].text;
}

beforeEach(() => {
  app.requireLivePort.mockResolvedValue(9222);
  app.listTargets.mockResolvedValue([]);
  app.evaluateInApp.mockResolvedValue({ value: { done: true } });
});

describe('owa_language', () => {
  it('checks a language in the main window, waiting a minute for the catalog', async () => {
    app.evaluateInApp.mockResolvedValue({
      value: { state: 'missing', code: 'xx', size: 13000000 },
    });
    const result = await handlers.get('owa_language')({
      action: 'check',
      language: 'Xxlang',
    });
    expect(textOf(result)).toEqual({
      state: 'missing',
      code: 'xx',
      size: 13000000,
    });
    const [[expression, options]] = app.evaluateInApp.mock.calls;
    expect(requestOf(expression)).toEqual({
      action: 'check',
      language: 'Xxlang',
      domain: 'language',
    });
    expect(pageWaitOf(expression)).toBe(60000);
    // The asking side waits a little longer than the page does.
    expect(options).toEqual({ timeout: 65000 });
  });

  it('gives an install ten minutes: a pack is tens of megabytes on a church line', async () => {
    await handlers.get('owa_language')({ action: 'install', language: 'xx' });
    const [[expression, options]] = app.evaluateInApp.mock.calls;
    expect(requestOf(expression)).toEqual({
      action: 'install',
      language: 'xx',
      domain: 'language',
    });
    expect(pageWaitOf(expression)).toBe(600000);
    expect(options).toEqual({ timeout: 605000 });
  });

  it("answers the app's refusal, its silence and a failed endpoint as errors", async () => {
    const handler = handlers.get('owa_language');
    app.evaluateInApp.mockResolvedValue({
      value: { isError: true, reason: 'The catalog could not be read.' },
    });
    expect(errorOf(await handler({ action: 'list' }))).toBe(
      'The catalog could not be read.',
    );
    app.evaluateInApp.mockResolvedValue({ value: null });
    expect(errorOf(await handler({ action: 'list' }))).toBe(
      'The app did not answer.',
    );
    app.evaluateInApp.mockRejectedValue(new Error('Timed out evaluating'));
    expect(errorOf(await handler({ action: 'list' }))).toBe(
      'Timed out evaluating',
    );
  });
});

describe('owa_bible_note beside open windows', () => {
  it('changes a notes file while only other pages and other notes files are open', async () => {
    app.listTargets.mockResolvedValue([
      { url: 'http://localhost/presenter.html' },
      { url: 'http://localhost/reader.html?file=Sunday.own' },
      { url: 'http://localhost/bibleNote.html?file=Other.own&id=1' },
    ]);
    const result = await handlers.get('owa_bible_note')({
      action: 'update',
      file: 'Sunday',
      id: 2,
      text: 'Remember',
    });
    expect(textOf(result)).toEqual({ done: true });
    expect(app.listTargets).toHaveBeenCalledWith(9222);
    expect(requestOf(app.evaluateInApp.mock.calls[0][0])).toEqual({
      action: 'update',
      file: 'Sunday',
      id: 2,
      text: 'Remember',
      domain: 'note',
    });
  });

  it("refuses while that file's own note window is open, whatever else is", async () => {
    app.listTargets.mockResolvedValue([
      { url: 'http://localhost/presenter.html' },
      { url: 'http://localhost/bibleNote.html?file=Sunday.own&id=4' },
    ]);
    expect(
      errorOf(
        await handlers.get('owa_bible_note')({
          action: 'delete',
          file: 'Sunday',
          id: 2,
        }),
      ),
    ).toContain('The notes file "Sunday" is open in a note window');
    expect(app.evaluateInApp).not.toHaveBeenCalled();
  });
});
