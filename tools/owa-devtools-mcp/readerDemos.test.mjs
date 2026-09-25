import { describe, expect, it } from 'vitest';

import {
  getReaderDemo,
  READER_DEMO_IDS,
  READER_DEMO_LIST,
} from './readerDemos.mjs';

describe('Reader demos', () => {
  it('offers 54 Reader lessons with stable unique ids', () => {
    expect(READER_DEMO_IDS).toEqual([
      'reader-font-larger',
      'reader-font-smaller',
      'reader-open-john-3-16',
      'reader-find-text',
      'reader-previous-passage',
      'reader-next-passage',
      'reader-clear-reference',
      'reader-names-lookup',
      'reader-names-language',
      'reader-add-bible',
      'reader-full-view',
      'reader-copy-passage',
      'reader-split-side-by-side',
      'reader-split-stacked',
      'reader-save-passage',
      'reader-present-passage',
      'reader-auto-scroll',
      'reader-scroll-top',
      'reader-bible-line-breaks',
      'reader-model-line-breaks',
      'reader-cross-references',
      'reader-people-in-passage',
      'reader-resources',
      'reader-filter-books',
      'reader-bible-notes-panel',
      'reader-type-reference',
      'reader-reference-shortcuts',
      'reader-history-chips',
      'reader-version-info',
      'reader-verse-ranges',
      'reader-extra-passage-actions',
      'reader-ai-audio',
      'reader-edit-arrange-passages',
      'reader-find-results',
      'reader-name-details',
      'reader-graph-explore',
      'reader-graph-manage',
      'reader-resource-organize',
      'reader-resource-file-actions',
      'reader-verse-marks',
      'reader-note-actions',
      'reader-header-tools',
      'reader-menu-file',
      'reader-menu-edit',
      'reader-menu-tools',
      'reader-menu-window',
      'reader-menu-help',
      'reader-view-reload',
      'reader-view-relaunch',
      'reader-view-devtools',
      'reader-view-zoom',
      'reader-view-fullscreen',
      'reader-view-widgets',
      'reader-view-reset-widgets',
    ]);
    expect(new Set(READER_DEMO_IDS).size).toBe(READER_DEMO_LIST.length);
    expect(READER_DEMO_LIST).toHaveLength(54);
    expect(READER_DEMO_LIST.every((demo) => demo.steps.length > 0)).toBe(true);
    expect(
      READER_DEMO_LIST.filter((demo) => demo.isFeatured !== false),
    ).toHaveLength(24);
  });

  it('returns fresh steps and adds translated control labels', () => {
    const first = getReaderDemo('reader-find-text', (value) => {
      return value === 'Search verses' ? 'SEARCH TRANSLATED' : value;
    });
    const second = getReaderDemo('reader-find-text');
    expect(first.steps[2].finds).toContain('SEARCH TRANSLATED');
    first.steps.shift();
    expect(second.steps).toHaveLength(3);
  });

  it('localizes a label prefix without changing its number', () => {
    const demo = getReaderDemo('reader-open-john-3-16', (value) => {
      return value === 'Verse' ? 'VERSET' : value;
    });
    expect(demo.steps[3].finds).toContain('VERSET 16');
  });

  it('localizes every alternative for a control whose label changes', () => {
    const demo = getReaderDemo('reader-full-view', (value) => {
      return value === 'Full'
        ? 'PLEIN'
        : value === 'Exit Full'
          ? 'QUITTER'
          : value;
    });
    expect(demo.steps[0].finds).toEqual([
      'Full',
      'Exit Full',
      'PLEIN',
      'QUITTER',
    ]);
  });

  it('keeps native-menu lessons self-guided instead of auto-running them', () => {
    const demo = getReaderDemo('reader-view-relaunch');
    expect(demo.steps).toEqual([
      {
        text: 'View > Relaunch restarts the whole Open Worship app, not just the Reader. A confirmation protects against an accidental click.',
      },
    ]);
  });
});
