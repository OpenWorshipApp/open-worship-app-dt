import { lazy, useMemo } from 'react';

import { tran } from '../lang/langHelpers';
import { toWidgetLabel } from '../others/labelIconHelpers';
import ResizeActorComp from '../resize-actor/ResizeActorComp';
import Lyric from './Lyric';
import { applyOpenLyricTheme, initOpenLyric } from './lyricHelpers';
import LyricManager, { LyricManagerContext } from './LyricManager';
import { useAppEffect, useAppStateAsync } from '../helper/appHooks';
import { useIsDarkMode } from '../others/themeHelpers';

const LazyLyricRenderPreviewBodyComp = lazy(() => {
    return import('./LyricRenderPreviewBodyComp');
});
const LazyLyricSlidesPreviewerComp = lazy(() => {
    return import('./LyricSlidesPreviewerComp');
});

/**
 * The lyric previewer BODY. It is one of the bodies the app-document previewer
 * swaps in (a `.owl` selection gets this instead of the slide list + note pane),
 * so it renders no card chrome of its own — the previewer keeps its header and
 * footer around whichever body is showing.
 */
export default function LyricHandlerComp({
    filePath,
}: Readonly<{
    filePath: string;
}>) {
    const selectedLyric = useMemo(() => {
        return Lyric.getInstance(filePath);
    }, [filePath]);

    const [lyricManager] = useAppStateAsync(async () => {
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

    if (lyricManager === undefined || lyricManager === null) {
        return (
            <div
                className={
                    'w-100 h-100 d-flex ' +
                    'align-items-center justify-content-center'
                }
            >
                <h3 className="text-muted">{tran('Loading')}...</h3>
            </div>
        );
    }

    return (
        <div className="w-100 h-100 app-overflow-hidden">
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
    );
}
