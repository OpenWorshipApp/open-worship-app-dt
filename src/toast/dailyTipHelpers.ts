import { getSetting, setSetting } from '../helper/settingHelpers';
import { tran } from '../lang/langHelpers';
import {
    getPresenterDemo,
    PRESENTER_DEMO_LIST,
} from '../../tools/owa-devtools-mcp/presenterDemos.mjs';
import {
    getReaderDemo,
    READER_DEMO_LIST,
} from '../../tools/owa-devtools-mcp/readerDemos.mjs';
export {
    DAILY_TIPS_DISABLED_SETTING_NAME,
    disableDailyTips,
    getAreDailyTipsDisabled,
    setAreDailyTipsEnabled,
} from './dailyTipSettingHelpers';

export type DailyTipPageType = 'presenter' | 'reader';

export type DailyTipType = {
    id: string;
    demoId: string;
    title: string;
    detail: string;
    category?: string;
    isDaily?: boolean;
};

export type DailyTipGuideStepType = {
    text: string;
    find?: string | null;
    action?: 'click' | 'type' | 'hover' | 'rightClick';
    value?: string;
    press?: string;
};

export type DailyTipGuideType = {
    title: string;
    steps: DailyTipGuideStepType[];
    mode: 'show' | 'demo';
};

export type DailyTipCallToolType = (
    name: 'owa_guide_start',
    args: Record<string, unknown>,
) => Promise<unknown>;

function getCanDemoFromToolResult(result: unknown): boolean | null {
    let parsed = result;
    if (typeof parsed === 'string') {
        try {
            parsed = JSON.parse(parsed);
        } catch (_error) {
            return null;
        }
    }
    if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'canDemo' in parsed &&
        typeof parsed.canDemo === 'boolean'
    ) {
        return parsed.canDemo;
    }
    return null;
}

export const DAILY_TIP_SESSION_KEY = 'daily-tip-auto-shown';

function getAppMenuCategory(id: string) {
    if (id.endsWith('menu-file')) {
        return tran('File menu');
    }
    if (id.endsWith('menu-edit')) {
        return tran('Edit menu');
    }
    if (id.endsWith('menu-tools')) {
        return tran('Tools menu');
    }
    if (id.endsWith('menu-window')) {
        return tran('Window menu');
    }
    if (id.endsWith('menu-help')) {
        return tran('Help menu');
    }
    return null;
}

function getPresenterTips(): DailyTipType[] {
    const documentsIds = new Set([
        'presenter-document-list',
        'presenter-slide-editor-window',
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
        'presenter-more-options',
        'presenter-songselect',
        'presenter-public-domain',
    ]);
    const screenIds = new Set([
        'presenter-mini-screen',
        'presenter-present-bible',
        'presenter-style-bible',
        'presenter-screen-controls',
        'presenter-multi-screen',
        'presenter-draw-spotlight',
        'presenter-keyboard-screencast',
    ]);
    // The overlay layer has a heading of its own rather than sitting under
    // "Background and media": ten components, each with a lesson, would have
    // buried the five background tabs they are filed beside -- and a volunteer
    // hunting for the countdown is not thinking about backgrounds at all.
    const foregroundIds = new Set([
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
        'presenter-foreground-extras',
    ]);
    const backgroundIds = new Set([
        'presenter-colors-tab',
        'presenter-images-tab',
        'presenter-videos-tab',
        'presenter-cameras-tab',
        'presenter-webs-tab',
        'presenter-audios-tab',
        'presenter-background-color',
        'presenter-background-image',
        'presenter-background-video',
        'presenter-background-camera',
        'presenter-background-web',
        'presenter-play-audio',
        'presenter-download-media',
    ]);
    const serviceIds = new Set([
        'presenter-flow-list',
        'presenter-build-flow',
        'presenter-share-flow',
    ]);
    const viewMenuIds = new Set([
        'presenter-view-reload',
        'presenter-view-relaunch',
        'presenter-view-devtools',
        'presenter-view-zoom',
        'presenter-view-fullscreen',
        'presenter-view-widgets',
        'presenter-view-reset-widgets',
    ]);
    const notForDailyIds = new Set([
        'presenter-view-reload',
        'presenter-view-relaunch',
        'presenter-view-devtools',
    ]);
    return PRESENTER_DEMO_LIST.map((demo) => {
        const menuCategory = getAppMenuCategory(demo.id);
        const category =
            menuCategory ??
            (documentsIds.has(demo.id)
                ? tran('Documents and slides')
                : screenIds.has(demo.id)
                  ? tran('Audience screens')
                  : foregroundIds.has(demo.id)
                    ? tran('Foreground overlays')
                    : backgroundIds.has(demo.id)
                      ? tran('Background and media')
                      : serviceIds.has(demo.id)
                        ? tran('Service planning')
                        : viewMenuIds.has(demo.id)
                          ? tran('View menu')
                          : tran('Getting started'));
        return {
            id: demo.id,
            demoId: demo.id,
            title: tran(demo.label),
            detail: tran(demo.detail),
            category,
            isDaily: !notForDailyIds.has(demo.id),
        };
    });
}

function getReaderTips(): DailyTipType[] {
    const navigationIds = new Set([
        'reader-open-john-3-16',
        'reader-previous-passage',
        'reader-next-passage',
        'reader-clear-reference',
        'reader-type-reference',
        'reader-reference-shortcuts',
        'reader-history-chips',
        'reader-version-info',
        'reader-verse-ranges',
    ]);
    const readingIds = new Set([
        'reader-font-larger',
        'reader-font-smaller',
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
        'reader-edit-arrange-passages',
    ]);
    const notesIds = new Set([
        'reader-bible-notes-panel',
        'reader-verse-marks',
        'reader-note-actions',
    ]);
    const viewMenuIds = new Set([
        'reader-view-reload',
        'reader-view-relaunch',
        'reader-view-devtools',
        'reader-view-zoom',
        'reader-view-fullscreen',
        'reader-view-widgets',
        'reader-view-reset-widgets',
    ]);
    const notForDailyIds = new Set([
        'reader-view-reload',
        'reader-view-relaunch',
        'reader-view-devtools',
    ]);
    return READER_DEMO_LIST.map((demo) => {
        const menuCategory = getAppMenuCategory(demo.id);
        const category =
            menuCategory ??
            (navigationIds.has(demo.id)
                ? tran('Getting started')
                : readingIds.has(demo.id)
                  ? tran('Reading and layout')
                  : notesIds.has(demo.id)
                    ? tran('Notes and marks')
                    : viewMenuIds.has(demo.id)
                      ? tran('View menu')
                      : demo.id === 'reader-header-tools'
                        ? tran('Reader shortcuts')
                        : tran('Study tools'));
        return {
            id: demo.id,
            demoId: demo.id,
            title: tran(demo.label),
            detail: tran(demo.detail),
            category,
            isDaily: !notForDailyIds.has(demo.id),
        };
    });
}

export function getDailyTipPage(homePage: string): DailyTipPageType | null {
    if (homePage.includes('presenter.html')) {
        return 'presenter';
    }
    if (homePage.includes('reader.html')) {
        return 'reader';
    }
    return null;
}

export function getDailyTips(page: DailyTipPageType): DailyTipType[] {
    return page === 'presenter' ? getPresenterTips() : getReaderTips();
}

export function getDailyTipGuide(
    page: DailyTipPageType,
    tip: DailyTipType,
): DailyTipGuideType | null {
    const demo =
        page === 'presenter'
            ? getPresenterDemo(tip.demoId, tran)
            : getReaderDemo(tip.demoId, tran);
    if (demo === null) {
        return null;
    }
    const steps = demo.steps.map((step) => {
        const find = step.finds?.at(-1) ?? step.find;
        return {
            text: step.text,
            ...(find === undefined ? {} : { find }),
            ...(step.action === undefined ? {} : { action: step.action }),
            ...(step.value === undefined ? {} : { value: step.value }),
            ...(step.press === undefined ? {} : { press: step.press }),
        };
    });
    const actionableSteps = steps.filter((step) => {
        return (
            typeof step.find === 'string' ||
            typeof step.press === 'string' ||
            step.action === 'rightClick'
        );
    });
    return {
        title: tip.title,
        steps: actionableSteps.length === 0 ? steps : actionableSteps,
        mode: actionableSteps.length === 0 ? 'show' : 'demo',
    };
}

export async function startDailyTipGuide(
    page: DailyTipPageType,
    tip: DailyTipType,
    callTool: DailyTipCallToolType,
) {
    const guide = getDailyTipGuide(page, tip);
    try {
        const result = await callTool('owa_guide_start', {
            demoId: tip.demoId,
        });
        // During development the renderer can hot-reload a newly actionable
        // lesson while Electron's MCP host still knows its older, show-only
        // form. Upgrade that successful-but-stale start in place too.
        if (
            guide?.mode !== 'demo' ||
            getCanDemoFromToolResult(result) !== false
        ) {
            return;
        }
    } catch (error) {
        if (
            !(error instanceof Error) ||
            !error.message.includes('Unknown built-in demo')
        ) {
            throw error;
        }
    }
    // The renderer hot-reloads before Electron's long-lived MCP host. Send
    // the selected lesson itself when that host still has the older catalog,
    // so Show it never asks the user to restart just to practise a tip.
    if (guide === null) {
        throw new Error(`No walkthrough is available for "${tip.title}".`);
    }
    await callTool('owa_guide_start', {
        ...guide,
        page: `${page}.html`,
    });
}

function getLastTipSettingName(page: DailyTipPageType) {
    return `daily-tip-last-${page}`;
}

export function pickDailyTipIndex(
    page: DailyTipPageType,
    tips: DailyTipType[],
    random = Math.random,
) {
    if (tips.length < 2) {
        return 0;
    }
    const lastId = getSetting(getLastTipSettingName(page));
    const dailyTips = tips.filter(({ isDaily }) => isDaily !== false);
    const choices = dailyTips
        .map((tip, index) => ({ tip, index }))
        .filter(({ tip }) => tip.id !== lastId);
    const selected = choices[Math.floor(random() * choices.length)]?.tip;
    return selected === undefined ? 0 : tips.indexOf(selected);
}

export function rememberDailyTip(page: DailyTipPageType, tip: DailyTipType) {
    setSetting(getLastTipSettingName(page), tip.id);
}
