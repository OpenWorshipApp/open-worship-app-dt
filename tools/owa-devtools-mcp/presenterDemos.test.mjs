import { describe, expect, it } from 'vitest';

import {
  getPresenterDemo,
  PRESENTER_DEMO_IDS,
  PRESENTER_DEMO_LIST,
} from './presenterDemos.mjs';

describe('Presenter demos', () => {
  it('offers six safe lessons with stable unique ids', () => {
    expect(PRESENTER_DEMO_IDS).toEqual([
      'presenter-bible-lookup',
      'presenter-document-list',
      'presenter-flow-list',
      'presenter-bible-notes',
      'presenter-mini-screen',
      'presenter-full-view',
    ]);
    expect(new Set(PRESENTER_DEMO_IDS).size).toBe(PRESENTER_DEMO_LIST.length);
    expect(PRESENTER_DEMO_LIST).toHaveLength(6);
  });

  it('returns fresh steps with translated alternatives', () => {
    const first = getPresenterDemo('presenter-full-view', (value) => {
      return `translated:${value}`;
    });
    const second = getPresenterDemo('presenter-full-view');
    expect(first.steps[0].finds).toContain('translated:Full view');
    first.steps.shift();
    expect(second.steps).toHaveLength(1);
  });
});
