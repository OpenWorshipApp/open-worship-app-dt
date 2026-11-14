// Two corners of `owaTools.mjs` its sibling suites leave dark: a window
// address that does not parse, and `owa_media_file`'s words of a document
// (a PowerPoint, Word or PDF file read for a song), which waits far longer
// than an ordinary read and answers its pictures as image blocks. The
// endpoint is a fake (`cdp.mjs` mocked).

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

import { checkIsFileWindowUrl, registerOwaTools } from './owaTools.mjs';

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

beforeEach(() => {
  app.requireLivePort.mockResolvedValue(9222);
  app.listTargets.mockResolvedValue([]);
});

describe('checkIsFileWindowUrl', () => {
  it('is no file window for an address that does not parse', () => {
    expect(checkIsFileWindowUrl('not a url')).toBe(false);
    expect(checkIsFileWindowUrl('')).toBe(false);
    // The two that are, for the contrast.
    expect(
      checkIsFileWindowUrl('https://localhost:3000/markdownPreview.html?x=1'),
    ).toBe(true);
    expect(checkIsFileWindowUrl('file:///docs/JHN.3.PDF?uuid=a')).toBe(true);
  });
});

describe("owa_media_file's words of a document", () => {
  it('waits three minutes in the page, a little longer here, in the window named', async () => {
    app.evaluateInApp.mockResolvedValue({
      value: {
        title: 'Amazing Grace',
        font: 'Arial',
        blocks: ['Amazing grace, how sweet the sound'],
        images: [
          'data:image/jpeg;base64,QUJD',
          'not a picture',
          'data:image/png;base64,REVG',
        ],
      },
    });
    const result = await handlers.get('owa_media_file')({
      action: 'info',
      kind: 'document',
      name: 'Hymns.pptx',
      pictures: true,
      page: 'presenter.html',
    });

    const [[expression, options]] = app.evaluateInApp.mock.calls;
    expect(requestOf(expression)).toEqual({
      action: 'info',
      kind: 'document',
      name: 'Hymns.pptx',
      pictures: true,
      domain: 'media',
    });
    expect(pageWaitOf(expression)).toBe(180000);
    expect(options).toEqual({ match: 'presenter.html', timeout: 185000 });
    // The words as text, the pictures as image blocks, a stray value left out.
    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            title: 'Amazing Grace',
            font: 'Arial',
            blocks: ['Amazing grace, how sweet the sound'],
          }),
        },
        { type: 'image', mimeType: 'image/jpeg', data: 'QUJD' },
        { type: 'image', mimeType: 'image/png', data: 'REVG' },
      ],
    });
  });

  it("answers the app's refusal and a failed endpoint as errors", async () => {
    const handler = handlers.get('owa_media_file');
    app.evaluateInApp.mockResolvedValue({
      value: { isError: true, reason: 'No document is called that.' },
    });
    const refused = await handler({
      action: 'info',
      kind: 'document',
      name: 'Missing.docx',
    });
    expect(refused.isError).toBe(true);
    expect(refused.content[0].text).toBe('No document is called that.');

    app.evaluateInApp.mockRejectedValue(new Error('Timed out evaluating'));
    const failed = await handler({
      action: 'info',
      kind: 'document',
      name: 'Slow.pptx',
    });
    expect(failed.isError).toBe(true);
    expect(failed.content[0].text).toBe('Timed out evaluating');
  });

  it('reads any other kind the ordinary way, with no long wait', async () => {
    app.evaluateInApp.mockResolvedValue({ value: { name: 'a.png' } });
    await handlers.get('owa_media_file')({
      action: 'info',
      kind: 'image',
      name: 'a.png',
    });
    const [[expression, options]] = app.evaluateInApp.mock.calls;
    expect(pageWaitOf(expression)).toBeLessThan(180000);
    expect(options?.timeout ?? 0).toBeLessThan(185000);
  });
});
