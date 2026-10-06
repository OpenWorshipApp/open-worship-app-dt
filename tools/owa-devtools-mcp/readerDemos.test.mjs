import { describe, expect, it } from 'vitest';

import { toKeystroke } from './guide.mjs';
import {
  getReaderDemo,
  READER_DEMO_IDS,
  READER_DEMO_LIST,
} from './readerDemos.mjs';

describe('Reader demos', () => {
  it('keeps the existing ids while expanding to 100 Reader lessons', () => {
    expect(READER_DEMO_IDS).toEqual(
      expect.arrayContaining([
        'reader-font-larger',
        'reader-font-smaller',
        'reader-open-john-3-16',
        'reader-find-text',
        'reader-previous-passage',
        'reader-next-passage',
        'reader-clear-reference',
        'reader-clear-reference-part',
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
        'reader-bibles-section',
        'reader-notes-section',
        'reader-filter-notes',
        'reader-sort-notes',
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
        'reader-open-settings',
        'reader-open-help',
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
        'reader-switch-split-pane',
      ]),
    );
    expect(new Set(READER_DEMO_IDS).size).toBe(READER_DEMO_LIST.length);
    expect(READER_DEMO_LIST).toHaveLength(100);
    expect(READER_DEMO_LIST.every((demo) => demo.steps.length > 0)).toBe(true);
    expect(
      READER_DEMO_LIST.filter((demo) => demo.isFeatured !== false),
    ).toHaveLength(30);
  });

  it('gives every featured Reader demo a safe action to start with', () => {
    const featured = READER_DEMO_LIST.filter(
      (demo) => demo.isFeatured !== false,
    );
    expect(
      featured.every((demo) =>
        demo.steps.some(
          (step) =>
            typeof step.find === 'string' ||
            typeof step.press === 'string' ||
            step.action === 'rightClick',
        ),
      ),
    ).toBe(true);
  });

  it('keeps pane visibility lessons self-guided because open panes are not toggles', () => {
    for (const id of [
      'reader-bible-notes-panel',
      'reader-bibles-section',
      'reader-notes-section',
    ]) {
      const demo = getReaderDemo(id);
      expect(demo.isFeatured).toBe(false);
      expect(demo.steps).toEqual([
        expect.objectContaining({
          text: expect.stringContaining('View > Widgets'),
        }),
      ]);
      expect(demo.steps[0]).not.toHaveProperty('find');
      expect(demo.steps[0]).not.toHaveProperty('action');
    }
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

  it('localizes panel scopes separately from the control name', () => {
    const labels = { 'Bible Notes': 'NOTES', 'More Options': 'OPTIONS' };
    const demo = getReaderDemo(
      'reader-notes-new-file',
      (value) => labels[value] ?? value,
    );
    expect(demo.steps[0].finds).toEqual([
      'Bible Notes > More Options',
      'NOTES > OPTIONS',
    ]);
  });

  it('keeps mixed Reader lessons actionable only where a control is named', () => {
    const demo = getReaderDemo('reader-copy-text');
    expect(demo.steps.map((step) => step.kind)).toEqual([
      undefined,
      undefined,
      'look',
    ]);
    expect(demo.steps[1].find).toBe('Copy Text');
    for (const source of READER_DEMO_LIST) {
      const resolved = getReaderDemo(source.id);
      if (!resolved.steps.some((step) => step.find || step.press)) continue;
      for (const step of resolved.steps.filter(
        (step) => !step.find && !step.press,
      )) {
        expect(step.kind, source.id).toBe('look');
      }
    }
  });

  it('leaves file writes, graph choices and destructive steps to the person', () => {
    for (const id of [
      'reader-bibles-new-list',
      'reader-notes-new-file',
      'reader-notes-share',
    ]) {
      const demo = getReaderDemo(id);
      expect(
        demo.steps.filter((step) => step.find).map((step) => step.find),
      ).toEqual([
        id.startsWith('reader-bibles-')
          ? 'Bibles > More Options'
          : 'Bible Notes > More Options',
      ]);
    }
    for (const id of [
      'reader-graph-presets',
      'reader-bibles-file-actions',
      'reader-notes-file-actions',
    ]) {
      expect(
        getReaderDemo(id).steps.every((step) => !step.find && !step.press),
      ).toBe(true);
    }
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

  it('presses the real keys that split and move between passages', () => {
    const demo = getReaderDemo('reader-switch-split-pane');
    expect(demo.category).toBe('Reader shortcuts');
    // A click on "Split horizontal" can split a passage that is not the
    // selected one; the key always splits the selected one and keeps it
    // selected on the right, so Left must come next.
    expect(demo.steps.map((step) => step.press ?? step.kind)).toEqual([
      'Ctrl+Shift+S',
      'Ctrl+Shift+Left',
      'Ctrl+Shift+Right',
      'look',
    ]);
    expect(demo.steps.some((step) => step.find !== undefined)).toBe(false);
    const keys = demo.steps
      .filter((step) => step.press)
      .map((step) => toKeystroke(step.press));
    expect(keys.map(({ key }) => key)).toEqual([
      'S',
      'ArrowLeft',
      'ArrowRight',
    ]);
    for (const keystroke of keys) {
      expect(keystroke).toMatchObject({
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
      });
    }
    expect(demo.steps.at(-1).text).toContain('Command+Shift');
  });
});
