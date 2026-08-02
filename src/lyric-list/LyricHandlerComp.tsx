import { lazy, use } from 'react';

import { getAllLangsAsync, tran } from '../lang/langHelpers';
import ResizeActorComp from '../resize-actor/ResizeActorComp';
import { SelectedLyricContext } from './lyricHelpers';
import LyricManager, { LyricManagerContext } from './LyricManager';
import { OpenLyric, type OpenLyricPreviewSetting } from 'open-lyric';
import { useAppEffect, useAppStateAsync } from '../helper/appHooks';
import EventHandler from '../event/EventHandler';
import { checkIsDarkMode, THEME_CHANGE_EVENT } from '../others/themeHelpers';
import { getSetting, setSetting } from '../helper/settingHelpers';

const LazyLyricRenderPreviewBodyComp = lazy(() => {
    return import('./LyricRenderPreviewBodyComp');
});
const LazyLyricSlidesPreviewerComp = lazy(() => {
    return import('./LyricSlidesPreviewerComp');
});

function applyTheme(openLyricPreviewer: OpenLyric) {
    const isDarkMode = checkIsDarkMode();
    openLyricPreviewer.theme = isDarkMode ? 'dark' : 'light';
}

const OPEN_LYRIC_PREVIEWER_SETTING_NAME = 'open-lyric-previewer-setting';
export default function LyricHandlerComp() {
    const context = use(SelectedLyricContext);
    const selectedLyric = context?.selectedLyric ?? null;

    const [lyricManager] = useAppStateAsync(async () => {
        if (selectedLyric === null) {
            return null;
        }
        const [content, langDataList] = await Promise.all([
            selectedLyric.getContent(),
            getAllLangsAsync(),
        ]);
        const openLyricPreviewer = new OpenLyric();
        for (const langData of langDataList) {
            langData.initOpenLyricPlugins?.({
                openLyric: openLyricPreviewer,
            });
        }
        openLyricPreviewer.value = content;
        const manager = new LyricManager(selectedLyric, openLyricPreviewer);
        return manager;
    }, [selectedLyric]);

    useAppEffect(() => {
        if (!lyricManager) {
            return;
        }
        const openLyricPreviewer = lyricManager.openLyricPreviewer;
        openLyricPreviewer.loadSetting = () => {
            const settingStr = getSetting(OPEN_LYRIC_PREVIEWER_SETTING_NAME);
            if (settingStr === null) {
                return null;
            }
            try {
                const setting = JSON.parse(settingStr);
                return setting;
            } catch (err) {
                console.error(
                    'Failed to parse OpenLyric previewer setting',
                    err,
                );
                return null;
            }
        };
        openLyricPreviewer.saveSetting = (setting: OpenLyricPreviewSetting) => {
            const settingStr = JSON.stringify(setting);
            setSetting(OPEN_LYRIC_PREVIEWER_SETTING_NAME, settingStr);
            lyricManager.fileSource.fireUpdateEvent();
        };
        applyTheme(openLyricPreviewer);
        const registeredEvent = EventHandler.registerEventListener(
            [THEME_CHANGE_EVENT],
            () => {
                applyTheme(openLyricPreviewer);
            },
        );
        return () => {
            EventHandler.unregisterEventListener(registeredEvent);
            openLyricPreviewer.loadSetting = () => {
                return null;
            };
            openLyricPreviewer.saveSetting = () => {};
        };
    }, [lyricManager]);

    useAppEffect(() => {
        if (!lyricManager) {
            return;
        }
        const registered = lyricManager.fileSource.registerEventListener(
            ['update'],
            async () => {
                const content = await lyricManager.lyric.getContent();
                lyricManager.openLyricPreviewer.value = content;
            },
        );
        return () => {
            lyricManager.fileSource.unregisterEventListener(registered);
        };
    }, [lyricManager]);

    if (lyricManager === undefined) {
        return (
            <div
                className={
                    'card w-100 h-100 app-zero-border-radius d-flex ' +
                    'align-items-center justify-content-center'
                }
            >
                <h3 className="text-muted">{tran('Loading...')}</h3>
            </div>
        );
    }

    if (selectedLyric === null) {
        return (
            <div
                className={
                    'card w-100 h-100 app-zero-border-radius d-flex ' +
                    'align-items-center justify-content-center'
                }
            >
                <h3 className="text-muted">{tran('No Lyric Selected')}</h3>
            </div>
        );
    }

    return (
        <div className="card w-100 h-100 app-zero-border-radius app-overflow-hidden">
            <div className="card-body w-100 h-100 app-overflow-hidden">
                <LyricManagerContext value={lyricManager}>
                    <ResizeActorComp
                        flexSizeName={'lyric-previewer'}
                        isHorizontal={false}
                        flexSizeDefault={{
                            v1: ['1'],
                            v2: ['1'],
                        }}
                        dataInput={[
                            {
                                children: LazyLyricRenderPreviewBodyComp,
                                key: 'v1',
                                widgetName: 'Previewer',
                            },
                            {
                                children: LazyLyricSlidesPreviewerComp,
                                key: 'v2',
                                widgetName: 'Slides',
                            },
                        ]}
                    />
                </LyricManagerContext>
            </div>
        </div>
    );
}
