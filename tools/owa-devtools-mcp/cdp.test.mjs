import { describe, expect, it } from 'vitest';

import { listNewAppPages, toPageName } from './cdp.mjs';

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
