import {
    Editor,
    OpenLyric,
    OpenLyricMarkdownManager,
    OpenLyricDashboard,
    EditorOpenLyricPlugin,
} from 'open-lyric';

import { dirSourceSettingNames } from './helper/constants.ts';
import DirSource from './helper/DirSource.ts';
import { getParamFileFullName, getParamIdNum } from './helper/domHelpers.ts';
import Lyric from './lyric-list/Lyric.ts';
import { pathJoin, fsExistSync } from './server/fileHelpers.ts';
import appProvider from './server/appProvider.ts';
import {
    genOpenLyricFontFaces,
    getAllLangsAsync,
    initLangCss,
} from './lang/langHelpers.ts';
import { applyOpenLyricTheme } from './lyric-list/lyricHelpers.ts';
import { installOpenLyricPrintPopupHandler } from './lyric-list/lyricPrintHelpers.ts';
import { checkIsDarkMode, THEME_CHANGE_EVENT } from './others/themeHelpers.tsx';
import EventHandler from './event/EventHandler.ts';

function setEditorVerticalLines(editor: Editor) {
    const isDarkMode = checkIsDarkMode();
    const color = isDarkMode
        ? 'rgba(255, 255, 255, 0.1)'
        : 'rgba(0, 0, 0, 0.1)';
    editor.setVerticalLines([
        {
            characters: 40,
            color,
        },
        {
            characters: 60,
            color,
        },
        {
            width: 2,
            characters: 70,
            color,
        },
    ]);
}

export function getDashboardInstance() {
    installOpenLyricPrintPopupHandler();
    OpenLyricDashboard.installShellStyle();
    Editor.installShellStyle();
    OpenLyricMarkdownManager.installShellStyle();
    OpenLyric.installShellStyle();

    OpenLyricDashboard.installShellMarkup({ includeRawTextImport: true });
    Editor.installShellMarkup();
    OpenLyricMarkdownManager.installShellMarkup();
    OpenLyric.installShellMarkup();

    const container = document.querySelector('[data-ol-ref="app"]');
    if (container === null) {
        throw new Error('Root element not found');
    }
    const dashboard = new OpenLyricDashboard({
        container: container as HTMLElement,
        isWeb: true,
    });
    dashboard.isWeb = false;

    const openLyric = new OpenLyric();
    dashboard.openLyric = openLyric;

    const openLyricMarkdownManager = new OpenLyricMarkdownManager();
    dashboard.openLyricMarkdownManager = openLyricMarkdownManager;

    const editor = new Editor({ selectionState: true });
    dashboard.editor = editor;
    editor.addPlugin('open-lyric', new EditorOpenLyricPlugin());

    getAllLangsAsync().then((langDataList) => {
        for (const langData of langDataList) {
            langData.initOpenLyricPlugins?.({
                editor: editor,
                openLyric: openLyric,
                openLyricMarkdownManager: openLyricMarkdownManager,
                genOpenLyricFontFaces,
            });
            initLangCss(langData);
        }
    });

    applyOpenLyricTheme(dashboard);
    setEditorVerticalLines(editor);
    EventHandler.registerEventListener([THEME_CHANGE_EVENT], () => {
        applyOpenLyricTheme(dashboard);
        setEditorVerticalLines(editor);
    });

    return { dashboard, editor, openLyric, openLyricMarkdownManager };
}

export async function getLyric() {
    const url = globalThis.location.href;
    const fileFullName = getParamFileFullName(url);
    if (fileFullName === null) {
        throw new Error('Lyric file not specified');
    }
    const dirPath = DirSource.getDirPathBySettingName(
        dirSourceSettingNames.APP_DOCUMENT,
    );
    if (dirPath === null) {
        throw new Error('Documents directory not set');
    }
    const filePath = pathJoin(dirPath, fileFullName);
    if (fsExistSync(filePath) === false) {
        throw new Error(`Lyric file not found: ${fileFullName}`);
    }
    const lyric = Lyric.getInstance(filePath);
    const suffix = `(${lyric.fileSource.name})`;
    document.title = `${appProvider.windowTitle} - ${suffix}`;
    const content = await lyric.getContent();
    const slideId = getParamIdNum(url);
    return { lyric, content, slideId };
}
