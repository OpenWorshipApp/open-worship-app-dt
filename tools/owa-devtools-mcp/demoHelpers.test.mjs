import { describe, expect, it } from 'vitest';
import { BOT_FOCUS_LIST } from './botFocus.mjs';
import { getBuiltInDemo, getBuiltInDemoPage } from './demoHelpers.mjs';
import { PAGE_DEMO_LIST } from './pageDemos.mjs';
import { pickTarget } from './cdp.mjs';

describe('built-in demo destinations', () => {
  it('chooses an exact window URL before a popup whose URL contains it', () => {
    const main = { url: 'https://localhost:3000/reader.html' };
    const popup = { url: `${main.url}?uuid=reader` };
    expect(pickTarget([popup, main], main.url)).toBe(main);
    expect(pickTarget([main, popup], popup.url)).toBe(popup);
    expect(pickTarget([popup, main], 'reader.html')).toBe(popup);
  });
  it('keeps a requested popup URL when the main window has the same page', () => {
    const page = 'https://localhost:3000/reader.html?uuid=reader';
    expect(getBuiltInDemoPage('reader-font-larger', page)).toBe(page);
  });

  it('routes to the lesson page even when the assistant asks from another page', () => {
    expect(getBuiltInDemoPage('reader-font-larger', 'presenter.html')).toBe(
      'reader.html',
    );
    expect(getBuiltInDemoPage('setting-general', 'reader.html')).toBe(
      'setting.html',
    );
    expect(getBuiltInDemoPage('presenter-bible-lookup', 'setting.html')).toBe(
      'presenter.html',
    );
    expect(getBuiltInDemoPage('unknown', 'reader.html')).toBeNull();
  });

  it('has local lessons for every smaller operator window, never an output screen', () => {
    for (const { key } of BOT_FOCUS_LIST.filter(
      ({ key }) => !['presenter', 'reader'].includes(key),
    )) {
      const lessons = PAGE_DEMO_LIST.filter(({ page }) => page === key);
      expect(lessons.length, key).toBeGreaterThan(0);
      for (const lesson of lessons) {
        expect(getBuiltInDemoPage(lesson.id)).toBe(`${key}.html`);
        const demo = getBuiltInDemo(lesson.id, (text) => `translated:${text}`);
        expect(demo.steps[0].text).toBe(`translated:${lesson.detail}`);
        if (lesson.find)
          expect(demo.steps[0].find).toBe(`translated:${lesson.find}`);
        else expect(demo.steps[0].kind).toBe('look');
      }
    }
    expect(PAGE_DEMO_LIST.some(({ page }) => page === 'screen')).toBe(false);
  });
});
