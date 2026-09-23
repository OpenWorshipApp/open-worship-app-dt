import { getSetting, setSetting } from '../helper/settingHelpers';
import { tran } from '../lang/langHelpers';
import { READER_DEMO_LIST } from '../../tools/owa-devtools-mcp/readerDemos.mjs';
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

export const DAILY_TIP_SESSION_KEY = 'daily-tip-auto-shown';

function getPresenterTips(): DailyTipType[] {
    return [
        {
            id: 'presenter-bible-lookup',
            demoId: 'presenter-bible-lookup',
            title: tran('Look up a Bible passage'),
            detail: tran('Open Bible Lookup without leaving the Presenter.'),
        },
        {
            id: 'presenter-document-list',
            demoId: 'presenter-document-list',
            title: tran('Show or hide the Document List'),
            detail: tran('Toggle the panel that holds your slide documents.'),
        },
        {
            id: 'presenter-flow-list',
            demoId: 'presenter-flow-list',
            title: tran('Show or hide the Presenting Flow List'),
            detail: tran(
                'Toggle the panel used to build and follow a service order.',
            ),
        },
        {
            id: 'presenter-bible-notes',
            demoId: 'presenter-bible-notes',
            title: tran('Show or hide Bibles and Bible Notes'),
            detail: tran('Toggle the panel for saved passages and notes.'),
        },
        {
            id: 'presenter-mini-screen',
            demoId: 'presenter-mini-screen',
            title: tran('Show or hide the Mini Screen'),
            detail: tran(
                'Toggle the panel that previews and controls audience screens.',
            ),
        },
        {
            id: 'presenter-full-view',
            demoId: 'presenter-full-view',
            title: tran('Give the Presenter more room'),
            detail: tran('Switch the Presenter between normal and full view.'),
        },
    ];
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
        const category = navigationIds.has(demo.id)
            ? tran('Getting started')
            : readingIds.has(demo.id)
              ? tran('Reading and layout')
              : notesIds.has(demo.id)
                ? tran('Notes and marks')
                : viewMenuIds.has(demo.id)
                  ? tran('View menu')
                  : demo.id === 'reader-header-tools'
                    ? tran('Reader shortcuts')
                    : tran('Study tools');
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
