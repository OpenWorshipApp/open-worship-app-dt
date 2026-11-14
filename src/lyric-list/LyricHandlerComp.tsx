import { lazy, useMemo, useRef, useState } from 'react';

import { tran } from '../lang/langHelpers';
import { toWidgetLabel } from '../others/labelIconHelpers';
import ResizeActorComp from '../resize-actor/ResizeActorComp';
import Lyric from './Lyric';
import { applyOpenLyricTheme, initOpenLyric } from './lyricHelpers';
import LyricManager, { LyricManagerContext } from './LyricManager';
import {
    useAppCurrentRef,
    useAppEffect,
    useAppStateAsync,
} from '../helper/appHooks';
import { useIsDarkMode } from '../others/themeHelpers';
import LyricSlide, { INDEX_CLASSNAME_PREFIX } from './LyricSlide';
import EventHandler from '../event/EventHandler';
import {
    ON_SLIDE_ITEM_SELECTED_EVENT,
    type OnSlideItemSelectedEventDataType,
} from '../app-document-presenter/items/varyAppDocumentHelpers';
import appProvider from '../server/appProvider';
import {
    checkIsSameLyricNoteList,
    getLyricNoteList,
    type LyricNoteType,
} from './lyricNoteHelpers';
import LyricNotesComp from './LyricNotesComp';

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
    flexSizeNamePrefix = '',
}: Readonly<{
    filePath: string;
    // Same reason as the slide previewer's: a floating preview of a song would
    // otherwise share, and overwrite, the main panel's pane sizes.
    flexSizeNamePrefix?: string;
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

    // The song's `Note` sections, for the read-only note pane. Read off the
    // text the previewer already holds, so a manager that has just arrived
    // has its notes on its FIRST render — the pane wraps the song's own panes,
    // and finding the notes a render later would mount those panes twice.
    // `noteState` only answers for the manager it was read for: an update
    // stores what it read, and a new song starts from its own text again.
    const [noteState, setNoteState] = useState<{
        owner: LyricManager;
        noteList: LyricNoteType[];
    } | null>(null);
    const noteList = useMemo(() => {
        if (!lyricManager) {
            return [];
        }
        if (noteState?.owner === lyricManager) {
            return noteState.noteList;
        }
        return getLyricNoteList(lyricManager.openLyricPreviewer.value);
    }, [lyricManager, noteState]);
    const noteListRef = useAppCurrentRef(noteList);

    useAppEffect(() => {
        if (!lyricManager) {
            return;
        }
        const registered = lyricManager.fileSource.registerEventListener(
            ['update'],
            async () => {
                await lyricManager.refreshOpenLyricContent();
                // A line scan of the text just re-fed, on the listener that
                // already runs: and a re-render only when the notes changed,
                // since this fires on every keystroke in the Lyric Editor.
                const newNoteList = getLyricNoteList(
                    lyricManager.openLyricPreviewer.value,
                );
                if (
                    checkIsSameLyricNoteList(noteListRef.current, newNoteList)
                ) {
                    return;
                }
                setNoteState({ owner: lyricManager, noteList: newNoteList });
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

    const lyricPanes = (
        <ResizeActorComp
            flexSizeName={`${flexSizeNamePrefix}lyric-previewer`}
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
    );
    // The note pane is the Presenter's, as a slide document's is, and only for
    // a song that HAS a note: most have none, and an empty box would take
    // room from the slides on a small screen. It WRAPS the song's panes rather
    // than joining them as a `v3`: a stored size whose keys differ from the
    // defaults is thrown away (`getFlexSizeSetting`), so a third pane that comes
    // and goes with the song would reset the Previewer / Slides split every
    // time a song with notes and one without took turns. Open from the start,
    // since it is only there when there is something to read.
    const isShowingNotes = appProvider.isPagePresenter && noteList.length > 0;

    return (
        <div className="w-100 h-100 app-overflow-hidden" ref={containerRef}>
            <LyricManagerContext value={lyricManager}>
                {isShowingNotes ? (
                    <ResizeActorComp
                        flexSizeName={`${flexSizeNamePrefix}lyric-previewer-note`}
                        isHorizontal={false}
                        flexSizeDefault={{
                            v1: ['6'],
                            v2: ['1'],
                        }}
                        dataInput={[
                            {
                                children: {
                                    render: () => {
                                        return lyricPanes;
                                    },
                                },
                                key: 'v1',
                                ...toWidgetLabel('Lyrics'),
                                className: 'app-flex-item',
                            },
                            {
                                children: {
                                    render: () => {
                                        return (
                                            <LyricNotesComp
                                                noteList={noteList}
                                            />
                                        );
                                    },
                                },
                                key: 'v2',
                                ...toWidgetLabel('Note'),
                                className: 'app-flex-item',
                            },
                        ]}
                    />
                ) : (
                    lyricPanes
                )}
            </LyricManagerContext>
        </div>
    );
}
