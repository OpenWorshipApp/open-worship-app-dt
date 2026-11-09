// `agentSlideEdit.mjs` with its OWN worker -- the `owa-agent-file` request
// evaluated in the app's page, `kind: 'slide'` -- where its sibling suite
// hands `runSlideEdit` a stand-in. The endpoint is a fake (`cdp.mjs`
// mocked).

import { beforeEach, describe, expect, it, vi } from 'vitest';

const app = vi.hoisted(() => ({ evaluateInApp: vi.fn() }));

vi.mock('./cdp.mjs', () => ({ evaluateInApp: app.evaluateInApp }));

import {
  SLIDE_EDIT_TOOL_NAME,
  registerSlideEditTool,
  runSlideEdit,
} from './agentSlideEdit.mjs';

const SLIDE_PATH = 'C:\\data\\documents\\Preaching.ows';

// The request rides in the expression as one line of JSON.
const REQUEST_PATTERN = /const request = Object\.assign\((.*), \{\r?\n/;

function requestOf(expression) {
  const matched = REQUEST_PATTERN.exec(expression);
  expect(matched).not.toBeNull();
  return JSON.parse(matched[1]);
}

function requests() {
  return app.evaluateInApp.mock.calls.map(([expression, options]) => ({
    request: requestOf(expression),
    options,
  }));
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
  app.evaluateInApp.mockResolvedValue({
    value: { name: 'Preaching', slideCount: 2, slides: [] },
  });
});

describe("the app's own worker", () => {
  it('reads every slide whole, in the page asked for', async () => {
    const result = await runSlideEdit({
      action: 'slides',
      file: SLIDE_PATH,
      page: 'presenter.html',
    });
    expect(textOf(result)).toEqual({
      name: 'Preaching',
      slideCount: 2,
      slides: [],
    });
    expect(requests()).toEqual([
      {
        request: {
          kind: 'slide',
          action: 'slides',
          filePath: SLIDE_PATH,
          isFullText: true,
        },
        options: { match: 'presenter.html' },
      },
    ]);
  });

  it('hands a change on by name and answers what the window reads', async () => {
    app.evaluateInApp.mockResolvedValue({
      value: { didChange: true, undoId: 'u-1', isSaved: false },
    });
    const result = await runSlideEdit({
      action: 'move-slide',
      file: 'Preaching',
      slide: 2,
      to: 1,
    });
    expect(textOf(result)).toEqual({
      name: 'Preaching',
      isChanged: true,
      undoId: 'u-1',
      isSaved: false,
    });
    expect(requests()).toEqual([
      {
        request: {
          kind: 'slide',
          action: 'move-slide',
          name: 'Preaching',
          slide: 2,
          to: 1,
        },
        options: { match: undefined },
      },
    ]);
  });

  it("is the app's silence when the page answers nothing", async () => {
    for (const value of [null, undefined, 42]) {
      app.evaluateInApp.mockResolvedValue({ value });
      expect(
        errorOf(await runSlideEdit({ action: 'slides', file: 'Preaching' })),
      ).toBe('The app did not answer.');
    }
  });

  it('a refusal without its own sentence still says what failed', async () => {
    app.evaluateInApp.mockResolvedValue({ value: { isError: true } });
    expect(
      errorOf(await runSlideEdit({ action: 'slides', file: 'Preaching' })),
    ).toBe('The slide document could not be read.');
  });
});

describe('the registered tool', () => {
  function registerHandler() {
    const registerTool = vi.fn();
    registerSlideEditTool({ registerTool });
    const [name, , handler] = registerTool.mock.calls[0];
    expect(name).toBe(SLIDE_EDIT_TOOL_NAME);
    return handler;
  }

  it("runs the app's worker", async () => {
    const handler = registerHandler();
    expect(
      textOf(await handler({ action: 'slides', file: 'Preaching' })),
    ).toEqual({ name: 'Preaching', slideCount: 2, slides: [] });
    expect(requests()[0].request).toEqual({
      kind: 'slide',
      action: 'slides',
      name: 'Preaching',
      isFullText: true,
    });
  });

  it('answers an endpoint that failed as an error result, never a throw', async () => {
    const handler = registerHandler();
    app.evaluateInApp.mockRejectedValue(new Error('Timed out evaluating'));
    expect(
      errorOf(await handler({ action: 'slides', file: 'Preaching' })),
    ).toBe('Timed out evaluating');
    app.evaluateInApp.mockRejectedValue('No running app');
    expect(
      errorOf(await handler({ action: 'slides', file: 'Preaching' })),
    ).toBe('No running app');
  });
});
