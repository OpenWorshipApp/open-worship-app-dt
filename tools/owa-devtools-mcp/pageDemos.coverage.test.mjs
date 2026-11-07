import { describe, expect, it } from 'vitest';

import { getPageDemo, PAGE_DEMO_LIST } from './pageDemos.mjs';

describe('getPageDemo', () => {
  it('answers an unknown lesson with null', () => {
    expect(getPageDemo('no-such-lesson')).toBeNull();
    expect(getPageDemo(undefined)).toBeNull();
  });

  // Called with no translator, the lesson reads in its own English words.
  it('keeps the English words when no translator is given', () => {
    const demo = getPageDemo('setting-path');
    expect(demo.title).toBe('Choose your data folder');
    expect(demo.steps).toEqual([
      {
        text: PAGE_DEMO_LIST.find((one) => one.id === 'setting-path').detail,
        find: 'Path Settings',
        action: 'click',
      },
    ]);
  });

  it('translates the title, the step and the control it presses', () => {
    const demo = getPageDemo('setting-bible', (value) => `km:${value}`);
    expect(demo.title).toBe('km:Manage Bible versions');
    expect(demo.steps[0].text).toBe(
      'km:Open Bible settings to manage the installed Bible versions.',
    );
    expect(demo.steps[0].find).toBe('km:Bible');
    expect(demo.steps[0].action).toBe('click');
  });

  // A lesson with nothing to press is one to read: it must never offer a
  // Do it that presses nothing.
  it('makes a lesson with no control a step to look at', () => {
    const demo = getPageDemo('bibleNote-edit');
    expect(demo.steps).toHaveLength(1);
    expect(demo.steps[0].kind).toBe('look');
    expect(demo.steps[0]).not.toHaveProperty('find');
    expect(demo.steps[0]).not.toHaveProperty('action');
  });
});
