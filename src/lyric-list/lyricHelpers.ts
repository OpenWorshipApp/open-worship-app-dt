import { OpenLyric } from 'open-lyric';
import type { OpenLyricTheme, OpenLyricPreviewSetting } from 'open-lyric';

import Lyric from './Lyric';
import LyricAppDocumentStage0 from './LyricAppDocumentStage0';
import LyricAppDocumentStage1 from './LyricAppDocumentStage1';
import { getAllLangsAsync } from '../lang/langHelpers';
import { getSetting, setSetting } from '../helper/settingHelpers';
import FileSource from '../helper/FileSource';
import type LyricAppDocumentStageAbstract from './LyricAppDocumentStageAbstract';
import { checkIsDarkMode } from '../others/themeHelpers';
import { installOpenLyricPrintPopupHandler } from './lyricPrintHelpers';

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
    installOpenLyricPrintPopupHandler();
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

/**
 * Stage number -> the class that renders it, indexed by stage.
 *
 * The instance cache keys on the CLASS name + file path
 * (`AppDocumentSourceAbs._getInstance`), so a stage only gets an identity of
 * its own by having a class of its own. This list is therefore also the
 * authoritative answer to "how many stages exist" — `getAvailableLyricStages`
 * below is what the previewer offers, so adding a layout here is all it takes
 * to make another stage selectable.
 */
const LYRIC_APP_DOCUMENT_STAGE_CLASSES = [
    LyricAppDocumentStage0,
    LyricAppDocumentStage1,
];

export function getAvailableLyricStages() {
    return LYRIC_APP_DOCUMENT_STAGE_CLASSES.map((_, stage) => {
        return stage;
    });
}

/**
 * Resolves to a REGISTERED stage, and reports which one it landed on.
 *
 * The returned number is the stage actually rendered, not the one asked for:
 * every unregistered stage used to fall through to `LyricAppDocumentStage1`,
 * which handed back the very same cached instance stage 1 was already using —
 * so a second pane rendered a byte-identical clone under a label claiming it
 * was something else, and `genCacheKey`'s `stage:` part could not tell the two
 * apart either. Callers that resolve a PERSISTED stage (playlist items,
 * `lyricSlideScreenHelpers`) need this to stay total, so an out-of-range stage
 * clamps to the nearest registered one instead of failing.
 */
export function getLyricAppDocumentStageByStage(
    filePath: string,
    stage: number,
): [number, LyricAppDocumentStageAbstract] {
    const resolvedStage = Math.min(
        Math.max(Number.isFinite(stage) ? Math.trunc(stage) : 0, 0),
        LYRIC_APP_DOCUMENT_STAGE_CLASSES.length - 1,
    );
    const StageClass = LYRIC_APP_DOCUMENT_STAGE_CLASSES[resolvedStage];
    return [resolvedStage, StageClass.getInstance(filePath)];
}
