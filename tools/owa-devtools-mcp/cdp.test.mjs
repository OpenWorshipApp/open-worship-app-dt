import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  listNewAppPages,
  runInTarget,
  toPageName,
  toPageErrorMessage,
} from './cdp.mjs';

// What `owa_click` reads to say a press opened a WINDOW (2026-10-06: the
// Settings gear opened Settings and the press still answered `unverified`).
describe('listNewAppPages', () => {
  const main = {
    id: 'A',
    url: 'https://localhost:3000/presenter.html',
  };

  it('names an app window that was not there before the press', () => {
    const setting = { id: 'B', url: 'https://localhost:3000/setting.html' };
    expect(listNewAppPages([main], [main, setting])).toEqual(['setting.html']);
  });

  it('names a screen window by its page, whatever server it loads from', () => {
    const screen = {
      id: 'C',
      url: 'http://127.0.0.1:39240/screen.html?screenId=1',
    };
    expect(listNewAppPages([main], [main, screen])).toEqual(['screen.html']);
  });

  // The hidden windows that photograph a slide's website, or read one for
  // `owa_read_website`, come and go on their own; a press is never credited
  // with one.
  it('never counts a window that is not one of the app pages', () => {
    const capture = { id: 'D', url: 'https://example.com/' };
    const blank = { id: 'E', url: 'about:blank' };
    expect(listNewAppPages([main], [main, capture, blank])).toEqual([]);
  });

  it('never counts a window that was already open', () => {
    const setting = { id: 'B', url: 'https://localhost:3000/setting.html' };
    expect(listNewAppPages([main, setting], [main, setting])).toEqual([]);
  });
});

describe('toPageName', () => {
  it('keeps the page file and drops the address and query around it', () => {
    expect(toPageName('https://localhost:3000/presenter.html')).toBe(
      'presenter.html',
    );
    expect(toPageName('owa://local/reader.html#top')).toBe('reader.html');
    expect(toPageName('http://127.0.0.1:1/screen.html?screenId=2')).toBe(
      'screen.html',
    );
  });
});

// A page's error said where it was thrown, four frames of a script made up
// for the call, to every caller and into a model's context.
describe('toPageErrorMessage', () => {
  it('keeps what the error says and drops where it was thrown', () => {
    expect(
      toPageErrorMessage(
        [
          'Error: That window is not open',
          '    at IpcRenderer.<anonymous> (<anonymous>:20:28)',
          '    at IpcRenderer.wrapper (node:events:639:12)',
        ].join('\n'),
      ),
    ).toBe('That window is not open');
  });

  it('keeps a typed error and a message over several lines', () => {
    expect(
      toPageErrorMessage(
        [
          'TypeError: Cannot read properties of null',
          "reading 'x'",
          '    at f (a.js:1:1)',
        ].join('\n'),
      ),
    ).toBe(
      ['TypeError: Cannot read properties of null', "reading 'x'"].join('\n'),
    );
    expect(toPageErrorMessage('Uncaught')).toBe('Uncaught');
    expect(toPageErrorMessage(undefined)).toBe('');
  });
});

// A page that answers every command it is sent, in order, on one socket.
function stubWebSocket(answer) {
  const sockets = [];
  class FakeWebSocket {
    constructor(url) {
      this.url = url;
      this.sent = [];
      this.listeners = {};
      this.isClosed = false;
      sockets.push(this);
      setTimeout(() => this.emit('open', {}), 0);
    }
    addEventListener(type, listener) {
      this.listeners[type] = listener;
    }
    emit(type, event) {
      this.listeners[type]?.(event);
    }
    send(text) {
      const message = JSON.parse(text);
      this.sent.push([message.method, Date.now()]);
      setTimeout(() => {
        this.emit('message', {
          data: JSON.stringify({ id: message.id, ...answer(message) }),
        });
      }, 0);
    }
    close() {
      this.isClosed = true;
    }
  }
  vi.stubGlobal('WebSocket', FakeWebSocket);
  return sockets;
}

describe('runInTarget', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // One gesture, one socket: the drop of real files is three commands the
  // page has to see as one drag, with a pause between two of them.
  it('runs the steps in order on one socket, waiting where told', async () => {
    const sockets = stubWebSocket((message) => {
      return { result: { echo: message.params.type } };
    });
    const target = { url: 'x', webSocketDebuggerUrl: 'ws://x' };
    const resultList = await runInTarget(target, [
      { method: 'Input.dispatchDragEvent', params: { type: 'dragEnter' } },
      { waitMs: 40 },
      { method: 'Input.dispatchDragEvent', params: { type: 'drop' } },
    ]);
    expect(resultList).toEqual([{ echo: 'dragEnter' }, { echo: 'drop' }]);
    expect(sockets).toHaveLength(1);
    expect(sockets[0].isClosed).toBe(true);
    const [first, second] = sockets[0].sent;
    expect(second[1] - first[1]).toBeGreaterThanOrEqual(35);
  });

  it('stops at the first command the page refuses, naming it', async () => {
    stubWebSocket(() => {
      return { error: { message: 'No such drag' } };
    });
    const target = { url: 'x', webSocketDebuggerUrl: 'ws://x' };
    await expect(
      runInTarget(target, [{ method: 'Input.dispatchDragEvent' }]),
    ).rejects.toThrow('Input.dispatchDragEvent: No such drag');
  });
});
