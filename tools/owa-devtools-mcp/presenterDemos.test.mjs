import { describe, expect, it } from 'vitest';

import {
  getPresenterDemo,
  PRESENTER_DEMO_IDS,
  PRESENTER_DEMO_LIST,
} from './presenterDemos.mjs';

describe('Presenter demos', () => {
  it('offers 74 Presenter lessons with stable unique ids', () => {
    expect(PRESENTER_DEMO_IDS).toEqual([
      'presenter-bible-lookup',
      'presenter-document-list',
      'presenter-flow-list',
      'presenter-bible-notes',
      'presenter-mini-screen',
      'presenter-full-view',
      'presenter-slide-editor-window',
      'presenter-reader-window',
      'presenter-settings',
      'presenter-help-menu',
      'presenter-foreground-panel',
      'presenter-foreground-countdown',
      'presenter-foreground-stopwatch',
      'presenter-foreground-time',
      'presenter-foreground-marquee-top',
      'presenter-foreground-marquee-bottom',
      'presenter-foreground-quick-text',
      'presenter-foreground-video',
      'presenter-foreground-image',
      'presenter-foreground-camera',
      'presenter-foreground-web',
      'presenter-foreground-properties',
      'presenter-foreground-sessions',
      'presenter-foreground-clear',
      'presenter-colors-tab',
      'presenter-images-tab',
      'presenter-videos-tab',
      'presenter-cameras-tab',
      'presenter-webs-tab',
      'presenter-audios-tab',
      'presenter-path-editor',
      'presenter-filter-documents',
      'presenter-sort-documents',
      'presenter-filter-document-types',
      'presenter-pin-document',
      'presenter-thumbnail-size',
      'presenter-preview-width',
      'presenter-present-slide',
      'presenter-auto-play',
      'presenter-present-lyrics',
      'presenter-present-bible',
      'presenter-style-bible',
      'presenter-background-color',
      'presenter-background-image',
      'presenter-background-video',
      'presenter-background-camera',
      'presenter-background-web',
      'presenter-play-audio',
      'presenter-foreground-extras',
      'presenter-screen-controls',
      'presenter-multi-screen',
      'presenter-draw-spotlight',
      'presenter-keyboard-screencast',
      'presenter-download-media',
      'presenter-build-flow',
      'presenter-share-flow',
      'presenter-songselect',
      'presenter-public-domain',
      'presenter-more-options',
      'presenter-app-assistant',
      'presenter-ai-chat',
      'presenter-find',
      'presenter-menu-file',
      'presenter-menu-edit',
      'presenter-menu-tools',
      'presenter-menu-window',
      'presenter-menu-help',
      'presenter-view-reload',
      'presenter-view-relaunch',
      'presenter-view-devtools',
      'presenter-view-zoom',
      'presenter-view-fullscreen',
      'presenter-view-widgets',
      'presenter-view-reset-widgets',
    ]);
    expect(new Set(PRESENTER_DEMO_IDS).size).toBe(PRESENTER_DEMO_LIST.length);
    expect(PRESENTER_DEMO_LIST).toHaveLength(74);
    expect(PRESENTER_DEMO_LIST.every((demo) => demo.steps.length > 0)).toBe(
      true,
    );
    expect(
      PRESENTER_DEMO_LIST.filter((demo) => demo.isFeatured !== false),
    ).toHaveLength(24);
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

  it('keeps live-screen and native-menu lessons self-guided', () => {
    expect(getPresenterDemo('presenter-present-slide').steps[0]).toMatchObject({
      find: 'Documents',
      action: 'click',
    });
    expect(getPresenterDemo('presenter-present-slide').steps[1]).toEqual({
      text: 'Double-click the slide card you want to present. This lesson will not put anything on an audience screen for you.',
      kind: 'look',
    });
    expect(getPresenterDemo('presenter-view-relaunch').steps[0]).toEqual({
      text: 'View > Relaunch restarts the whole Open Worship app, including the Presenter and any audience windows. A confirmation protects against an accidental click.',
    });
  });

  it('gives Do it a safe first action wherever the app can help', () => {
    const withoutSafeAction = PRESENTER_DEMO_LIST.filter((demo) => {
      return !demo.steps.some((step) => {
        return (
          typeof step.find === 'string' ||
          typeof step.press === 'string' ||
          step.action === 'rightClick'
        );
      });
    }).map(({ id }) => id);
    expect(withoutSafeAction).toEqual([
      'presenter-menu-file',
      'presenter-menu-edit',
      'presenter-menu-tools',
      'presenter-menu-window',
      'presenter-menu-help',
      'presenter-view-reload',
      'presenter-view-relaunch',
      'presenter-view-devtools',
      'presenter-view-widgets',
      'presenter-view-reset-widgets',
    ]);
    for (const demo of PRESENTER_DEMO_LIST) {
      const resolved = getPresenterDemo(demo.id);
      const hasAction = resolved.steps.some((step) => {
        return (
          typeof step.find === 'string' ||
          typeof step.press === 'string' ||
          step.action === 'rightClick'
        );
      });
      if (hasAction) {
        expect(
          resolved.steps.every((step) => {
            return (
              typeof step.find === 'string' ||
              typeof step.press === 'string' ||
              step.action === 'rightClick' ||
              step.kind === 'look'
            );
          }),
        ).toBe(true);
      }
    }
  });
});
