import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Banners its sibling suites leave unsaid: a tool asked with no action at
// all (the audit's probe gets the plain news), a foreground extra hidden
// through its own panel, and a note's banner when the app's window list
// cannot be read. `cdp.mjs` is a fake: nothing reaches a running app.
const mocks = vi.hoisted(() => ({
  evaluateInApp: vi.fn(),
  listTargets: vi.fn(),
  requireLivePort: vi.fn(),
  loadTranBundle: vi.fn(),
}));

vi.mock('./cdp.mjs', () => ({
  evaluateInApp: mocks.evaluateInApp,
  listTargets: mocks.listTargets,
  requireLivePort: mocks.requireLivePort,
}));
vi.mock('./tran.mjs', async (importOriginal) => ({
  ...(await importOriginal()),
  loadTranBundle: mocks.loadTranBundle,
}));

import {
  describeToolNotice,
  findNoteWindowTarget,
  notifyToolCall,
} from './notify.mjs';

// Five minutes between tests: the one-minute dictionary and the
// 1.2-second repeat guard start empty.
let clock = Date.UTC(2033, 0, 1);
let previousNotice;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  clock += 5 * 60 * 1000;
  vi.setSystemTime(clock);
  previousNotice = process.env.OWA_MCP_NOTICE;
  delete process.env.OWA_MCP_NOTICE;
  mocks.evaluateInApp.mockResolvedValue({ value: true });
  mocks.loadTranBundle.mockReturnValue({ dictionaries: { en: {} } });
});

afterEach(() => {
  vi.useRealTimers();
  if (previousNotice === undefined) {
    delete process.env.OWA_MCP_NOTICE;
  } else {
    process.env.OWA_MCP_NOTICE = previousNotice;
  }
});

describe('a tool asked with no action', () => {
  it('says the plain news of the tool', () => {
    expect(describeToolNotice('owa_foreground_edit', {})).toEqual({
      text: 'changed a foreground extra',
      key: 'changed a foreground extra',
      detail: [],
    });
    expect(describeToolNotice('owa_resource_file', undefined)).toEqual({
      text: 'made a study file',
      key: 'made a study file',
      detail: [],
    });
    expect(describeToolNotice('owa_presenting_flow_edit', {})).toEqual({
      text: 'changed a run sheet',
      key: 'changed a run sheet',
      detail: [],
    });
  });
});

describe('owa_foreground_edit', () => {
  it('a hide says what taking that extra off the screen says', () => {
    const hidden = describeToolNotice('owa_foreground_edit', {
      action: 'hide',
      widget: 'clock',
      session: 'Morning',
    });
    expect(hidden).toEqual({
      text: 'took the clock off the screen',
      key: 'took a foreground extra off the screen',
      detail: [{ key: 'Time' }],
    });
    expect(hidden).toEqual(
      describeToolNotice('owa_foreground', { action: 'stop', widget: 'clock' }),
    );
    // Every extra at once.
    expect(
      describeToolNotice('owa_foreground_edit', {
        action: 'hide',
        widget: 'all',
      }),
    ).toEqual({
      text: 'took every foreground extra off the screen',
      key: 'took every foreground extra off the screen',
      detail: [],
    });
  });
});

describe("a Bible note's banner", () => {
  const NOTE = { fileFullName: 'Default.own', noteId: 3 };
  const NOTE_WINDOW = {
    id: 'NOTE-3',
    url: 'https://localhost:3000/bibleNote.html?file=Default.own&id=3&uuid=z',
  };

  it('passes over a window whose address does not parse', () => {
    expect(
      findNoteWindowTarget(
        [
          { id: 'BLANK', url: '' },
          { id: 'ODD', url: 'not a url' },
          NOTE_WINDOW,
        ],
        NOTE,
      ),
    ).toBe(NOTE_WINDOW);
    expect(
      findNoteWindowTarget([{ id: 'ODD', url: 'not a url' }], NOTE),
    ).toBeNull();
  });

  it("goes up in the main window when the app's windows cannot be listed", async () => {
    mocks.requireLivePort.mockRejectedValue(new Error('No app is running'));
    notifyToolCall('owa_note_edit', {
      action: 'edit',
      file: 'Default.own',
      id: 3,
    });
    await vi.waitFor(() => {
      expect(mocks.evaluateInApp).toHaveBeenCalledTimes(1);
    });
    expect(mocks.evaluateInApp.mock.calls[0][1]).toEqual({ match: undefined });
    expect(mocks.listTargets).not.toHaveBeenCalled();

    // The list itself failing is the same.
    vi.setSystemTime(clock + 2000);
    mocks.requireLivePort.mockResolvedValue(9222);
    mocks.listTargets.mockRejectedValue(new Error('socket hang up'));
    notifyToolCall('owa_note_edit', {
      action: 'edit',
      file: 'Default.own',
      id: 3,
    });
    await vi.waitFor(() => {
      expect(mocks.evaluateInApp).toHaveBeenCalledTimes(2);
    });
    expect(mocks.listTargets).toHaveBeenCalledWith(9222);
    expect(mocks.evaluateInApp.mock.calls[1][1]).toEqual({ match: undefined });
  });
});
