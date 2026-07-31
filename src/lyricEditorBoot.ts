import {
    Editor,
    EditorOpenLyricPlugin,
    OpenLyric,
    OpenLyricMarkdownManager,
    OpenLyricDashboard,
} from 'open-lyric';
import {
    EditorPluginKmKh,
    OpenLyricMarkdownManagerPluginKmKh,
    OpenLyricPluginKmKh,
} from 'open-lyric-plugin-km-kh';

import { dirSourceSettingNames } from './helper/constants.ts';
import DirSource from './helper/DirSource.ts';
import { getParamFileFullName } from './helper/domHelpers.ts';
import Lyric from './lyric-list/Lyric.ts';
import { pathJoin, fsExistSync } from './server/fileHelpers.ts';
import appProvider from './server/appProvider.ts';

export function getDashboardInstance(): OpenLyricDashboard {
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
    openLyric.addPlugin('km-KH', new OpenLyricPluginKmKh());

    const openLyricMarkdownManager = new OpenLyricMarkdownManager();
    dashboard.openLyricMarkdownManager = openLyricMarkdownManager;

    const editor = new Editor({ selectionState: true });
    dashboard.editor = editor;
    editor.addPlugin('km-KH', new EditorPluginKmKh());
    editor.addPlugin('open-lyric', new EditorOpenLyricPlugin());

    openLyricMarkdownManager.addPlugin(
        'km-KH',
        new OpenLyricMarkdownManagerPluginKmKh(),
    );

    return dashboard;
}

function getLyric() {
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
    return lyric;
}

export function initDataLoading(dashboard: OpenLyricDashboard) {
    const lyric = getLyric();
    dashboard.loadValue = async () => {
        const content = await lyric.getContent();
        return content;
    };
    dashboard.saveValue = async (value) => {
        await lyric.setContent(value);
    };
}
