import type ScreenManager from '../_screen/managers/ScreenManager';
import type {
    MirrorScreenContext,
    MirrorScreenMessage,
} from '../../electron/screenMirrorProtocol';
import { appLocalStorage } from '../setting/directory-setting/appLocalStorage';
import appProvider from '../server/appProvider';
import { getScreenManagerBase } from '../_screen/managers/screenManagerBaseHelpers';

// Only screen appearance settings cross the connection, never secrets or documents.
const PRESENTATION_SETTING =
    /^(?:screen-|pt-effect-|bible-(?:screen|font|text|style)|foreground-|background-|pdf-full-width$|page-base-|language-locale$)/;

export async function getMirrorBootstrap(
    manager: ScreenManager,
): Promise<MirrorScreenContext> {
    const settings: Record<string, string> = {};
    for (const key of await appLocalStorage.listKeys()) {
        if (!PRESENTATION_SETTING.test(key)) continue;
        const value = appLocalStorage.getItem(key);
        if (value !== null && value.length < 256000) settings[key] = value;
    }
    // The whole state of every screen this one shows (Screen Show), first:
    // its overlays find it waiting when the foreground puts them up.
    const screenShowMessages: MirrorScreenMessage[] = [];
    for (const { id } of manager.screenForegroundManager.foregroundData
        .screenDataList) {
        const payload =
            id === manager.screenId
                ? null
                : getScreenManagerBase(id)?.genScreenShowPayload();
        if (payload) {
            screenShowMessages.push({
                screenId: manager.screenId,
                type: 'screen-show',
                data: payload,
            });
        }
    }
    const messages: MirrorScreenMessage[] = [
        ...screenShowMessages,
        ...manager.genSyncSnapshotMessages(),
    ];
    const fontCss: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
        try {
            for (const rule of Array.from(sheet.cssRules)) {
                if (rule instanceof CSSFontFaceRule)
                    fontCss.push(
                        rule.cssText.replace(
                            /url\(([^)]+)\)/g,
                            (_match, value: string) => {
                                const url = value
                                    .trim()
                                    .replace(/^['"]|['"]$/g, '');
                                return `url("${new URL(url, sheet.href ?? location.href).href}")`;
                            },
                        ),
                    );
            }
        } catch {
            /* Cross-origin stylesheets cannot be read. */
        }
    }
    return {
        screenId: manager.screenId,
        stage: manager.stage,
        settings,
        resources: {},
        fontCss: fontCss.join('\n'),
        isWindows: appProvider.systemUtils.isWindows,
        remote: false,
        messages,
    };
}
