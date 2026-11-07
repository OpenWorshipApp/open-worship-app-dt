import { describe, expect, it } from 'vitest';

import { getPresenterDemo, PRESENTER_DEMO_LIST } from './presenterDemos.mjs';

// A window in another language: the English control name is tried first,
// then the words on the translated button -- except for a scoped name,
// which has one exact local name and must not try a stale English one
// first. The made-up translations are signs, not any language.
const LOCAL_LOOKUP = '⌖ ✝';
const LOCAL_IMAGES = '▣ > ▤';
const LOCAL = {
  'Bible Lookup': LOCAL_LOOKUP,
  'Background > Images': LOCAL_IMAGES,
};

function translate(value) {
  return LOCAL[value] ?? value;
}

describe('getPresenterDemo with a translator', () => {
  it('adds the local name after the English one for a plain control', () => {
    const demo = getPresenterDemo('presenter-bible-lookup', translate);
    const step = demo.steps.find((one) => one.find === 'Bible Lookup');
    expect(step.finds).toEqual(['Bible Lookup', LOCAL_LOOKUP]);
    // The source catalog is not decorated by the copy.
    const source = PRESENTER_DEMO_LIST.find(
      (one) => one.id === 'presenter-bible-lookup',
    );
    expect(source.steps.some((one) => Array.isArray(one.finds))).toBe(false);
  });

  it('replaces a scoped name with its local name', () => {
    const demo = getPresenterDemo('presenter-background-filter', translate);
    const step = demo.steps.find((one) => one.find === 'Background > Images');
    expect(step.finds).toEqual([LOCAL_IMAGES]);
  });

  it('adds nothing when the translation reads the same', () => {
    const demo = getPresenterDemo('presenter-bible-lookup');
    const step = demo.steps.find((one) => one.find === 'Bible Lookup');
    expect(step.finds).toEqual(['Bible Lookup']);
    expect(step).not.toHaveProperty('translateFind');
  });

  it('answers an unknown lesson with null', () => {
    expect(getPresenterDemo('presenter-no-such-lesson', translate)).toBeNull();
  });
});
