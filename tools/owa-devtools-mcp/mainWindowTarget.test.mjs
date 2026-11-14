import { describe, expect, it } from 'vitest';

import { BOT_MAIN_WINDOW_PAGES } from './botFocus.mjs';
import {
  SCREEN_MIRROR_PAGE,
  findMainWindowTarget,
  toMainWindowPage,
} from './mainWindowTarget.mjs';

const ROOT = 'https://localhost:3000';

describe('toMainWindowPage', () => {
  it('names every page the main window navigates between, dev and packaged', () => {
    for (const page of [...BOT_MAIN_WINDOW_PAGES, SCREEN_MIRROR_PAGE]) {
      expect(toMainWindowPage(`${ROOT}/${page}`)).toBe(page);
      expect(toMainWindowPage(`owa://local/${page}`)).toBe(page);
    }
    expect(toMainWindowPage(`${ROOT}/presenter.html#x`)).toBe('presenter.html');
  });

  // Every popup carries a `uuid` (`openPopupWindow`): the same page in a
  // window of its own is not the main window.
  it('refuses a popup of a main page, and every page the main window never shows', () => {
    for (const url of [
      `${ROOT}/reader.html?uuid=reader`,
      `${ROOT}/presenter.html?uuid=reader`,
      `${ROOT}/appDocumentEditor.html?uuid=x&a=1`,
      `${ROOT}/setting.html`,
      `${ROOT}/lwShare.html`,
      `http://127.0.0.1:39241/screen.html?screenId=1`,
      `${ROOT}/chatbot.html?uuid=chatbot`,
      `${ROOT}/xreader.html`,
      'devtools://devtools/bundled/inspector.html',
      'not a url',
      '',
      undefined,
    ]) {
      expect(toMainWindowPage(url), String(url)).toBeNull();
    }
  });
});

describe('findMainWindowTarget', () => {
  const main = { id: 'main', url: `${ROOT}/reader.html` };
  const readerWindow = { id: 'popup', url: `${ROOT}/reader.html?uuid=reader` };

  it('picks the main window however the windows are listed', () => {
    expect(findMainWindowTarget([readerWindow, main])).toBe(main);
    expect(findMainWindowTarget([main, readerWindow])).toBe(main);
  });

  it('answers null when none is the main window', () => {
    expect(findMainWindowTarget([readerWindow])).toBeNull();
    expect(findMainWindowTarget([])).toBeNull();
    expect(findMainWindowTarget(undefined)).toBeNull();
  });
});
