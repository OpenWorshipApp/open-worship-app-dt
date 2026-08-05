import { lazy, use } from 'react';

import { tran } from '../lang/langHelpers';
import { toWidgetLabel } from '../others/labelIconHelpers';
import ResizeActorComp from '../resize-actor/ResizeActorComp';
import {
    applyOpenLyricTheme,
    initOpenLyric,
    SelectedLyricContext,
} from './lyricHelpers';
import LyricManager, { LyricManagerContext } from './LyricManager';
import { useAppEffect, useAppStateAsync } from '../helper/appHooks';
import { useIsDarkMode } from '../others/themeHelpers';

const LazyLyricRenderPreviewBodyComp = lazy(() => {
    return import('./LyricRenderPreviewBodyComp');
});
const LazyLyricSlidesPreviewerComp = lazy(() => {
    return import('./LyricSlidesPreviewerComp');
});

export default function LyricHandlerComp() {
    const context = use(SelectedLyricContext);
    const selectedLyric = context?.selectedLyric ?? null;

    const [lyricManager] = useAppStateAsync(async () => {
        if (selectedLyric === null) {
            return null;
        }
        const openLyricPreviewer = await initOpenLyric(selectedLyric.filePath);
        const manager = new LyricManager(selectedLyric, openLyricPreviewer);
        return manager;
    }, [selectedLyric]);

    const isDarkMode = useIsDarkMode();
    applyOpenLyricTheme(lyricManager?.openLyricPreviewer ?? null, isDarkMode);

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
                <h3 className="text-muted">{tran('Loading')}...</h3>
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
                                ...toWidgetLabel('Previewer'),
                            },
                            {
                                children: LazyLyricSlidesPreviewerComp,
                                key: 'v2',
                                ...toWidgetLabel('Slides'),
                            },
                        ]}
                    />
                </LyricManagerContext>
            </div>
        </div>
    );
}
