// `agentLyricEdit.mjs` with its OWN worker -- the `owa-agent-file` request
// evaluated in the app's page -- where its sibling suite hands
// `runLyricEdit` a stand-in. The endpoint is a fake (`cdp.mjs` mocked).

import { beforeEach, describe, expect, it, vi } from 'vitest';

const app = vi.hoisted(() => ({ evaluateInApp: vi.fn() }));

vi.mock('./cdp.mjs', () => ({ evaluateInApp: app.evaluateInApp }));

import {
  LYRIC_EDIT_TOOL_NAME,
  registerLyricEditTool,
  runLyricEdit,
} from './agentLyricEdit.mjs';

const SONG = [
  '```ol:Config',
  '- Title: Grace',
  '- Key: C',
  '- Structure: V1',
  '```',
  '',
  '```ol:Verse 1',
  'Amazing grace',
  'How sweet the sound',
  '```',
  '',
].join('\n');
const SONG_PATH = 'C:\\data\\documents\\Grace.owl';

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

// The app's page: `read` gives the song's head, `update` writes it.
function routeApp({ read, update } = {}) {
  app.evaluateInApp.mockImplementation(async (expression) => {
    const request = requestOf(expression);
    if (request.action === 'read') {
      return {
        value: read ?? {
          name: 'Grace',
          filePath: SONG_PATH,
          content: SONG,
          hash: 'h1',
          hasUnsavedChanges: true,
        },
      };
    }
    return {
      value: update ?? { undoId: 'u-1', note: 'Unsaved: press Save.' },
    };
  });
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
  routeApp();
});

describe("the app's own worker", () => {
  it('reads the song in the page asked for, as a song of Documents by name', async () => {
    const result = await runLyricEdit({
      action: 'read',
      file: 'Grace.owl',
      page: 'presenter.html',
    });
    expect(textOf(result)).toMatchObject({
      name: 'Grace',
      hasUnsavedChanges: true,
      title: 'Grace',
      playOrder: ['Verse 1'],
    });
    expect(requests()).toEqual([
      {
        request: { kind: 'lyric', action: 'read', name: 'Grace' },
        options: { match: 'presenter.html' },
      },
    ]);
  });

  it('writes the change back with the hash it read, by the path it read', async () => {
    const result = await runLyricEdit({
      action: 'set-config',
      file: SONG_PATH,
      config: { Tempo: '72' },
    });
    expect(textOf(result)).toEqual({
      name: 'Grace',
      isChanged: true,
      changed: ['Tempo: 72bpm'],
      playOrder: ['Verse 1'],
      parts: ['Verse 1'],
      isSaved: false,
      undoId: 'u-1',
      note: 'Unsaved: press Save.',
    });
    const [read, written] = requests();
    expect(read.request).toEqual({
      kind: 'lyric',
      action: 'read',
      filePath: SONG_PATH,
    });
    expect(read.options).toEqual({ match: undefined });
    expect(written.request).toMatchObject({
      kind: 'lyric',
      action: 'update',
      filePath: SONG_PATH,
      expectedHash: 'h1',
      summary: 'Tempo: 72bpm',
    });
    expect(written.request.content).toContain(
      '- Tempo: 72bpm\n- Structure: V1',
    );
  });

  it("is the app's silence when the page answers nothing", async () => {
    for (const value of [null, undefined, 'read']) {
      app.evaluateInApp.mockResolvedValue({ value });
      expect(
        errorOf(await runLyricEdit({ action: 'read', file: 'Grace' })),
      ).toBe('The app did not answer.');
    }
  });

  it('a song with no words to read is refused before anything is changed', async () => {
    routeApp({ read: { name: 'Grace', filePath: SONG_PATH, hash: 'h1' } });
    expect(
      errorOf(
        await runLyricEdit({
          action: 'set-config',
          file: 'Grace',
          config: { Key: 'D' },
        }),
      ),
    ).toBe('The song could not be read.');
    expect(app.evaluateInApp).toHaveBeenCalledTimes(1);
  });

  it('a file that names no song never reaches the app', async () => {
    expect(errorOf(await runLyricEdit({ action: 'read', file: '  ' }))).toBe(
      'Name the song (`file`): as it is attached, or as it reads in the ' +
        'Documents list.',
    );
    expect(errorOf(await runLyricEdit({ action: 'read' }))).toMatch(
      /^Name the song/,
    );
    expect(
      errorOf(await runLyricEdit({ action: 'read', file: 'C:\\x\\a.ows' })),
    ).toBe('Only a song file (.owl) can be changed here.');
    expect(app.evaluateInApp).not.toHaveBeenCalled();
  });
});

describe('the registered tool', () => {
  function registerHandler() {
    const registerTool = vi.fn();
    registerLyricEditTool({ registerTool });
    const [name, , handler] = registerTool.mock.calls[0];
    expect(name).toBe(LYRIC_EDIT_TOOL_NAME);
    return handler;
  }

  it("runs the app's worker", async () => {
    const handler = registerHandler();
    expect(
      textOf(await handler({ action: 'read', file: 'Grace' })).parts,
    ).toEqual([
      { part: 'Verse 1', lines: ['Amazing grace', 'How sweet the sound'] },
    ]);
  });

  it('answers an endpoint that failed as an error result, never a throw', async () => {
    const handler = registerHandler();
    app.evaluateInApp.mockRejectedValue(new Error('Timed out evaluating'));
    expect(errorOf(await handler({ action: 'read', file: 'Grace' }))).toBe(
      'Timed out evaluating',
    );
    app.evaluateInApp.mockRejectedValue('No running app');
    expect(errorOf(await handler({ action: 'read', file: 'Grace' }))).toBe(
      'No running app',
    );
  });
});
