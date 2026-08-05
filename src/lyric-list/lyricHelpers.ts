import { createContext, use } from 'react';
import { OpenLyric } from 'open-lyric';
import type { OpenLyricTheme, OpenLyricPreviewSetting } from 'open-lyric';

import Lyric from './Lyric';
import { dirSourceSettingNames } from '../helper/constants';
import {
    getSelectedFilePathWithEnsure,
    setSelectedFilePath,
} from '../others/selectedHelpers';
import LyricAppDocumentStage0 from './LyricAppDocumentStage0';
import LyricAppDocumentStage1 from './LyricAppDocumentStage1';
import { getAllLangsAsync } from '../lang/langHelpers';
import { getSetting, setSetting } from '../helper/settingHelpers';
import FileSource from '../helper/FileSource';
import type LyricAppDocumentStageAbstract from './LyricAppDocumentStageAbstract';
import { checkIsDarkMode } from '../others/themeHelpers';

interface ThemeTargetInf {
    get theme(): OpenLyricTheme;
    set theme(theme: OpenLyricTheme);
}
export function applyOpenLyricTheme(
    target: ThemeTargetInf | null,
    isDarkMode?: boolean,
) {
    if (target === null) {
        return;
    }
    isDarkMode ??= checkIsDarkMode();
    target.theme = isDarkMode ? 'dark-bs' : 'light-bs';
}

const SELECTED_LYRIC_SETTING_NAME = 'selected-lyric';

export async function getSelectedLyricFilePath() {
    return await getSelectedFilePathWithEnsure(
        SELECTED_LYRIC_SETTING_NAME,
        dirSourceSettingNames.APP_DOCUMENT,
    );
}

export function setSelectedLyricFilePath(filePath: string | null) {
    setSelectedFilePath(
        SELECTED_LYRIC_SETTING_NAME,
        dirSourceSettingNames.APP_DOCUMENT,
        filePath,
    );
}

export async function getSelectedLyric() {
    const selectedAppDocumentFilePath = await getSelectedLyricFilePath();
    if (selectedAppDocumentFilePath === null) {
        return null;
    }
    return Lyric.getInstance(selectedAppDocumentFilePath);
}

export async function setSelectedLyric(lyric: Lyric | null) {
    setSelectedLyricFilePath(lyric?.filePath ?? null);
}

export const SelectedLyricContext = createContext<{
    selectedLyric: Lyric | null;
    setSelectedLyric: (newLyric: Lyric | null) => void;
} | null>(null);

function useContext() {
    const context = use(SelectedLyricContext);
    if (context === null) {
        throw new Error('No SelectedLyricContext found');
    }
    return context;
}

export function useSelectedLyricSetterContext() {
    const context = useContext();
    return context.setSelectedLyric;
}

const OPEN_LYRIC_PREVIEWER_SETTING_NAME = 'open-lyric-previewer-setting';
export const DEFAULT_OPEN_LYRIC_FONT_SIZE = 16;
function loadOpenLyricSetting() {
    const settingStr = getSetting(OPEN_LYRIC_PREVIEWER_SETTING_NAME);
    if (settingStr === null) {
        return null;
    }
    try {
        const setting = JSON.parse(settingStr);
        return setting;
    } catch (err) {
        console.error('Failed to parse OpenLyric previewer setting', err);
        return null;
    }
}
function saveOpenLyricSetting(setting: OpenLyricPreviewSetting) {
    const settingStr = JSON.stringify(setting);
    setSetting(OPEN_LYRIC_PREVIEWER_SETTING_NAME, settingStr);
}

/**
 * The persisted font settings, readable without an `OpenLyric` instance.
 *
 * Slide HTML is generated from renderers where no previewer component has
 * mounted (the screen window, a stage instance built on demand), so the font
 * settings must not be reachable only through a live `OpenLyric` object —
 * otherwise those renderers silently fall back to open-lyric's own default.
 */
export function getOpenLyricFontSetting(): {
    fontSize: number;
    fontFamily?: string;
} {
    const setting: OpenLyricPreviewSetting = loadOpenLyricSetting() ?? {};
    return {
        fontSize: setting.fontSize ?? DEFAULT_OPEN_LYRIC_FONT_SIZE,
        fontFamily: setting.fontFamily,
    };
}

export async function initOpenLyric(filePath: string, isNoLangInit = false) {
    const lyric = Lyric.getInstance(filePath);
    const [content, langDataList] = await Promise.all([
        lyric.getContent(),
        getAllLangsAsync(),
    ]);
    const openLyricPreviewer = new OpenLyric();
    openLyricPreviewer.value = content;

    openLyricPreviewer.loadSetting = () => {
        const setting = loadOpenLyricSetting();
        return setting;
    };
    openLyricPreviewer.saveSetting = (setting: OpenLyricPreviewSetting) => {
        saveOpenLyricSetting(setting);
        const fileSource = FileSource.getInstance(filePath);
        fileSource.fireUpdateEvent();
    };
    const { fontSize, fontFamily } = getOpenLyricFontSetting();
    openLyricPreviewer.fontSize = fontSize + 'px';
    if (fontFamily) {
        openLyricPreviewer.fontFamily = fontFamily;
    }

    if (!isNoLangInit) {
        for (const langData of langDataList) {
            langData.initOpenLyricPlugins?.({
                openLyric: openLyricPreviewer,
            });
        }
    }
    return openLyricPreviewer;
}

export function getLyricAppDocumentStageByStage(
    filePath: string,
    stage: number,
): [number, LyricAppDocumentStageAbstract] {
    if (stage === 0) {
        return [stage, LyricAppDocumentStage0.getInstance(filePath)];
    }
    return [stage, LyricAppDocumentStage1.getInstance(filePath)];
}
