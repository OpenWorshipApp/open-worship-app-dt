import { OpenLyric } from 'open-lyric';
import type { OpenLyricTheme, OpenLyricPreviewSetting } from 'open-lyric';

import Lyric from './Lyric';
import LyricAppDocumentStage0 from './LyricAppDocumentStage0';
import LyricAppDocumentStage1 from './LyricAppDocumentStage1';
import LyricAppDocumentStage2 from './LyricAppDocumentStage2';
import LyricAppDocumentStage3 from './LyricAppDocumentStage3';
import LyricAppDocumentStage4 from './LyricAppDocumentStage4';
import LyricAppDocumentStage5 from './LyricAppDocumentStage5';
import { genOpenLyricFontFaces, initAllLangCss } from '../lang/langHelpers';
import SettingManager from '../helper/SettingManager';
import FileSource from '../helper/FileSource';
import type LyricAppDocumentStageAbstract from './LyricAppDocumentStageAbstract';
import { checkIsDarkMode } from '../others/themeHelpers';
import { installOpenLyricPrintPopupHandler } from './lyricPrintHelpers';
import { OpenLyricPluginPlayer } from 'open-lyric-plugin-player';

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

export const DEFAULT_OPEN_LYRIC_FONT_SIZE = 16;
const openLyricPreviewerSettingManager =
    new SettingManager<OpenLyricPreviewSetting>({
        settingName: 'open-lyric-previewer-setting',
        defaultValue: {},
        isErrorToDefault: true,
        validate: (jsonString) => {
            try {
                return JSON.parse(jsonString) instanceof Object;
            } catch (_error) {
                return false;
            }
        },
        serialize: (setting) => JSON.stringify(setting),
        deserialize: (jsonString) => JSON.parse(jsonString),
    });
function loadOpenLyricSetting() {
    return openLyricPreviewerSettingManager.getSetting();
}
function saveOpenLyricSetting(setting: OpenLyricPreviewSetting) {
    openLyricPreviewerSettingManager.setSetting(setting);
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
    const setting: OpenLyricPreviewSetting = loadOpenLyricSetting();
    return {
        fontSize: setting.fontSize ?? DEFAULT_OPEN_LYRIC_FONT_SIZE,
        fontFamily: setting.fontFamily,
    };
}

export async function initOpenLyric(filePath: string, isNoLangInit = false) {
    installOpenLyricPrintPopupHandler();
    const lyric = Lyric.getInstance(filePath);
    // `initAllLangCss`, not just the language list: open-lyric freezes every
    // line of a slide into pixel boxes measured in whatever faces the window
    // has REGISTERED at that moment. A song set in `app-Battambang`, built
    // before any other panel had registered the Khmer faces, was measured in
    // the browser's fallback (Times New Roman) and then drawn in Battambang,
    // whose Latin letters run ~19% wider — the long lines wrapped inside their
    // frozen boxes and printed over the next line, in the Stage Previewer and
    // on the projector alike, until a reload happened to win the race.
    // Registered first, open-lyric's own `document.fonts` wait loads the face
    // before anything is measured.
    const [content, langDataList] = await Promise.all([
        lyric.getContent(),
        initAllLangCss(),
    ]);
    const openLyricPreviewer = new OpenLyric();
    openLyricPreviewer.value = content;

    const openLyricPlayer = new OpenLyricPluginPlayer();
    openLyricPreviewer.addPlugin('player', openLyricPlayer);

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
                genOpenLyricFontFaces,
            });
        }
    }
    return openLyricPreviewer;
}

/**
 * Stage number -> the LAYOUT that renders it, indexed by stage.
 *
 * A layout, not an identity: stage 0 is the plain one, 1 adds the section
 * titles and chords, 2 and 3 are the band's look-ahead (a stage-1 slide with
 * the next one or two under it, smaller and dimmer), 4 is the same look-ahead
 * with stage-0 slides for the audience, 5 is a stage-1 slide between the
 * previous (top left) and the next (bottom right), and every stage past
 * the list keeps the stage-1 look (`FALLBACK_STAGE_CLASS`) it always had. So
 * this list says how a stage LOOKS, never how many stages there are. What a
 * stage number of its own buys past the end of this list is its own
 * `lyric-stage-style-<stage>` record — padding, opacity, font boost, theme and
 * custom CSS — which is what the Stage Previewer's ⚙ edits, and its own
 * cached slides.
 */
const LYRIC_APP_DOCUMENT_STAGE_CLASSES = [
    LyricAppDocumentStage0,
    LyricAppDocumentStage1,
    LyricAppDocumentStage2,
    LyricAppDocumentStage3,
    LyricAppDocumentStage4,
    LyricAppDocumentStage5,
];
// Adding a layout? Raise `STAGE_NUMBER_CHOICE_COUNT` (`screenHelpers`) with
// it, so the St: and Add Stage menus offer the new stage without Increment.
// NOT the last entry: a screen already set to `St: 6` showed the stage-1
// layout before the look-ahead stages existed, and still does.
const FALLBACK_STAGE_CLASS = LyricAppDocumentStage1;

/**
 * A stage number is any non-negative integer — screens have always allowed one
 * (the mini screen's `St:` menu increments without a ceiling), so the previewer
 * and everything that reads a PERSISTED stage have to accept the same range or
 * a screen set to `St: 3` shows a stage nothing can preview.
 */
export function checkIsValidLyricStage(stage: number) {
    return Number.isInteger(stage) && stage >= 0;
}

/**
 * Resolves a stage to its document, and reports the stage it landed on.
 *
 * Total on purpose — callers resolve a PERSISTED number (presenting flow
 * items, `lyricSlideScreenHelpers`, a screen's `St:`) — so a negative or
 * non-finite stage lands on the base stage rather than failing. It no longer
 * clamps at the top: a stage past the layout list keeps its OWN number and
 * gets its own instance (see `getStageInstance`), because the number is what
 * picks the stage's style record, and clamping used to hand a stage past the
 * list back the stage-1 document while still echoing its number to the caller.
 */
export function getLyricAppDocumentStageByStage(
    filePath: string,
    stage: number,
): [number, LyricAppDocumentStageAbstract] {
    const resolvedStage = Math.max(
        Number.isFinite(stage) ? Math.trunc(stage) : 0,
        0,
    );
    const StageClass =
        LYRIC_APP_DOCUMENT_STAGE_CLASSES[resolvedStage] ?? FALLBACK_STAGE_CLASS;
    return [
        resolvedStage,
        StageClass.getStageInstance(filePath, resolvedStage),
    ];
}
