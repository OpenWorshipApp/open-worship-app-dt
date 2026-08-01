import {
    Editor,
    OpenLyric,
    OpenLyricMarkdownManager,
    OpenLyricDashboard,
    EditorOpenLyricPlugin,
} from 'open-lyric';

import { dirSourceSettingNames } from './helper/constants.ts';
import DirSource from './helper/DirSource.ts';
import { getParamFileFullName } from './helper/domHelpers.ts';
import Lyric from './lyric-list/Lyric.ts';
import { pathJoin, fsExistSync } from './server/fileHelpers.ts';
import appProvider from './server/appProvider.ts';
import { checkIsDarkMode } from './others/themeHelpers.tsx';
import { getAllLangsAsync } from './lang/langHelpers.ts';

export function getDashboardInstance() {
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

    const isDark = checkIsDarkMode();
    dashboard.theme = isDark ? 'dark' : 'light';

    getAllLangsAsync().then((langDataList) => {
        for (const langData of langDataList) {
            langData.initOpenLyricPlugins?.({
                editor: editor,
                openLyric: openLyric,
                openLyricMarkdownManager: openLyricMarkdownManager,
            });
        }
    });

    return dashboard;
}

export async function getLyric() {
    const fileFullName = getParamFileFullName(globalThis.location.href);
    if (fileFullName === null) {
        throw new Error('Lyric file not specified');
    }
    const dirPath = DirSource.getDirPathBySettingName(
        dirSourceSettingNames.LYRIC,
    );
    if (dirPath === null) {
        throw new Error('Lyric directory not set');
    }
    const filePath = pathJoin(dirPath, fileFullName);
    if (fsExistSync(filePath) === false) {
        throw new Error(`Lyric file not found: ${fileFullName}`);
    }
    const lyric = Lyric.getInstance(filePath);
    const suffix = `(${lyric.fileSource.name})`;
    document.title = `${appProvider.windowTitle} - ${suffix}`;
    const content = await lyric.getContent();
    return { lyric, content };
}
