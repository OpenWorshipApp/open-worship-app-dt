import { lazy, useMemo, useRef } from 'react';

import { tran } from '../lang/langHelpers';
import { toWidgetLabel } from '../others/labelIconHelpers';
import ResizeActorComp from '../resize-actor/ResizeActorComp';
import Lyric from './Lyric';
import { applyOpenLyricTheme, initOpenLyric } from './lyricHelpers';
import LyricManager, { LyricManagerContext } from './LyricManager';
import { useAppEffect, useAppStateAsync } from '../helper/appHooks';
import { useIsDarkMode } from '../others/themeHelpers';
import LyricSlide, { INDEX_CLASSNAME_PREFIX } from './LyricSlide';
import EventHandler from '../event/EventHandler';
import {
    ON_SLIDE_ITEM_SELECTED_EVENT,
    type OnSlideItemSelectedEventDataType,
} from '../app-document-presenter/items/varyAppDocumentHelpers';

/**
 * The song-structure index a slide card stands for, or null when the card is
 * not a lyric one (or is one of the extra slides, which carry `-1`).
 *
 * The suffix is sliced rather than split on `-`: the prefix has dashes of its
 * own and a `-1` index adds another, so `split('-').pop()` reads `-1` as `1`
 * and would scroll the song to the wrong verse.
 */
function getLyricIndexOfElement(element: Element) {
    const className = Array.from(element.classList).find((eachClassName) => {
        return eachClassName.startsWith(INDEX_CLASSNAME_PREFIX);
    });
    if (className === undefined) {
        return null;
    }
    const index = Number.parseInt(
        className.slice(INDEX_CLASSNAME_PREFIX.length + 1),
    );
    return Number.isNaN(index) || index < 0 ? null : index;
}

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
    const containerRef = useRef<HTMLDivElement | null>(null);
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
                await lyricManager.refreshOpenLyricContent();
            },
        );
        lyricManager.containerElement = containerRef.current;
        lyricManager.initLyricPreviewEvent();
        // Song → slides: clicking a verse in the rendered song brings its card
        // into view, in THIS previewer's panes only.
        lyricManager.onSectionSelected = (index: number) => {
            LyricSlide.notifyLyricElement(index, lyricManager.containerElement);
        };
        // Slides → song: the card click is announced app-wide (any slide kind,
        // any previewer), so the first thing to settle is whether the card that
        // was clicked is one of ours.
        const selectedEvent = EventHandler.registerEventListener(
            [ON_SLIDE_ITEM_SELECTED_EVENT],
            ({ target }: OnSlideItemSelectedEventDataType) => {
                const container = lyricManager.containerElement;
                if (container === null || !container.contains(target)) {
                    return;
                }
                const index = getLyricIndexOfElement(target);
                if (index === null) {
                    return;
                }
                lyricManager.notifyLyricElement(index);
            },
        );
        return () => {
            EventHandler.unregisterEventListener(selectedEvent);
            lyricManager.fileSource.unregisterEventListener(registered);
            lyricManager.destroy();
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
        <div className="w-100 h-100 app-overflow-hidden" ref={containerRef}>
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
