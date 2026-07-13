import { useMemo, useState, useCallback } from 'react';

import appProvider from '../server/appProvider';
import AppDocument, {
    checkIsAppDocumentSelected,
    openAppDocumentPopup,
} from '../app-document-list/AppDocument';
import type Slide from '../app-document-list/Slide';
import { useAppEffectAsync } from '../helper/appHooks';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';
import { checkIsSameValues } from '../helper/helpers';
import {
    getSelectedVaryAppDocument,
    getSelectedEditingSlide,
    setSelectedVaryAppDocument,
    setSelectedEditingSlide,
    preloadAttachedBackground,
    type SelectedAppDocumentContextType,
    type SelectedSlideContextType,
} from '../app-document-list/appDocumentHelpers';
import { getSelectedLyric, setSelectedLyric } from '../lyric-list/lyricHelpers';
import type Lyric from '../lyric-list/Lyric';
import type { VaryAppDocumentType } from '../app-document-list/appDocumentTypeHelpers';
import type { TabOptionType } from './routeHelpers';
import { toTitleExternal } from './routeHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import { type AllControlType as KeyboardControlType } from '../event/KeyboardEventListener';
import { onSlideItemsKeyboardEvent } from '../slide-editor/slideEditingKeyboardEventHelpers';
import { checkIsHistoryMovementEventType } from '../editing-manager/EditingHistoryManager';
import { tran } from '../lang/langHelpers';

export function genLayoutTabs() {
    const presenterTab: TabOptionType = {
        title: toTitleExternal('Presenter', {
            color: 'var(--app-color-presenter)',
        }),
        routePath: appProvider.presenterHomePage,
    };

    const readerTab: TabOptionType = {
        title: (
            <span
                style={{
                    color: 'var(--app-color-reader)',
                }}
            >
                <i className="bi bi-book px-1" />
                {toTitleExternal('Bible Reader')}
            </span>
        ),
        routePath: appProvider.readerHomePage,
    };

    const experimentTab: TabOptionType = {
        title: toTitleExternal('(dev)Experiment'),
        routePath: appProvider.experimentHomePage,
    };

    const editorTab: TabOptionType = {
        title: (
            <>
                <span>{tran('Slide Editor') + ' '}</span>
                <span
                    className="ms-2"
                    onClick={async (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const isSelected = await checkIsAppDocumentSelected();
                        if (!isSelected) {
                            return;
                        }
                        const varyAppDocument =
                            await getSelectedVaryAppDocument();
                        openAppDocumentPopup(varyAppDocument!);
                    }}
                >
                    <i className="bi bi-box-arrow-up-right" />
                </span>
            </>
        ),
        routePath: appProvider.appDocumentEditorHomePage,
        preCheck: checkIsAppDocumentSelected,
    };
    return { presenterTab, readerTab, experimentTab, editorTab };
}

export function genTabs() {
    const { presenterTab, readerTab, experimentTab, editorTab } =
        genLayoutTabs();
    const newTabs: TabOptionType[] = [];
    if (!appProvider.isPagePresenter) {
        newTabs.push(presenterTab);
    } else if (!appProvider.isPageAppDocumentEditor) {
        newTabs.push(editorTab);
    }
    newTabs.push(readerTab);
    if (appProvider.systemUtils.isDev) {
        newTabs.push(experimentTab);
    }
    return newTabs;
}

async function calculateNewHoldingSlides(
    controlType: KeyboardControlType,
    appDocument: AppDocument,
    currentSlide: Slide | null,
    newSlide: Slide,
    currentHoldingSlides: Slide[],
) {
    if (controlType === 'Ctrl') {
        if (
            currentHoldingSlides.some((slide) => {
                return slide.checkIsSame(newSlide);
            })
        ) {
            if (currentSlide?.checkIsSame(newSlide)) {
                return currentHoldingSlides;
            }
            return currentHoldingSlides.filter((slide) => {
                return !slide.checkIsSame(newSlide);
            });
        }
        return [...currentHoldingSlides, newSlide];
    }
    if (currentSlide === null) {
        return [newSlide];
    }
    const index = await appDocument.getSlideIndex(newSlide);
    if (index === -1) {
        return currentHoldingSlides;
    }
    const currentIndex = await appDocument.getSlideIndex(currentSlide);
    if (currentIndex === -1) {
        return currentHoldingSlides;
    }
    const slides = await appDocument.getSlides();
    return slides.slice(
        Math.min(index, currentIndex),
        Math.max(index, currentIndex) + 1,
    );
}

export function useAppDocumentContextValues() {
    const [varyAppDocument, setVaryAppDocument] =
        useState<VaryAppDocumentType | null>(null);

    const setVaryAppDocument1 = useCallback(
        (newVaryAppDocument: VaryAppDocumentType | null) => {
            setVaryAppDocument(newVaryAppDocument);
            setSelectedVaryAppDocument(newVaryAppDocument);
        },
        [],
    );

    const [holdingSlides, setHoldingSlides] = useState<Slide[]>([]);
    const [slide, setSlide] = useState<Slide | null>(null);

    const setSlide1 = useCallback((newSlide: Slide | null) => {
        setSlide(newSlide);
        setHoldingSlides([]);
        setSelectedEditingSlide(newSlide);
    }, []);

    useAppEffectAsync(
        async (methodContext) => {
            const varyAppDocument = await getSelectedVaryAppDocument();
            if (varyAppDocument !== null) {
                preloadAttachedBackground(varyAppDocument);
            }
            methodContext.setVaryAppDocument(varyAppDocument);
            const slide = await getSelectedEditingSlide();
            methodContext.setSlide(slide);
        },
        [],
        {
            setVaryAppDocument,
            setSlide,
        },
    );

    const varyAppDocumentContextValue =
        useMemo((): SelectedAppDocumentContextType => {
            const setSelectedVaryAppDocument = async (
                newVaryAppDocument: VaryAppDocumentType | null,
            ) => {
                setVaryAppDocument1(newVaryAppDocument);
                let selectedSlideEditing: Slide | null = null;
                if (newVaryAppDocument !== null) {
                    if (AppDocument.checkIsThisType(newVaryAppDocument)) {
                        const slides = await newVaryAppDocument.getSlides();
                        preloadAttachedBackground(newVaryAppDocument, slides);
                        selectedSlideEditing = slides[0] ?? null;
                    } else {
                        preloadAttachedBackground(newVaryAppDocument);
                    }
                }
                setSlide1(selectedSlideEditing);
            };
            return {
                selectedVaryAppDocument: varyAppDocument,
                setSelectedVaryAppDocument,
            };
        }, [varyAppDocument, setVaryAppDocument1, setSlide1]);

    const editingSlideContextValue = useMemo((): SelectedSlideContextType => {
        if (!appProvider.isPageAppDocumentEditor) {
            return {
                selectedSlideEditing: null,
                holdingSlides: [],
                setSelectedSlide: () => {},
                onSlideItemsKeyboardEvent: (event: any) => {
                    onSlideItemsKeyboardEvent(
                        {
                            holdingSlides: [],
                            setHoldingSlides: () => {},
                            varyAppDocument,
                            selectedSlideEditing: null,
                        },
                        event,
                    );
                },
            };
        }
        const setSelectedSlide = async (
            newSelectedSlideEditing: Slide | null,
            controlType?: KeyboardControlType,
        ) => {
            if (controlType === undefined) {
                setSlide1(newSelectedSlideEditing);
                return;
            }
            if (
                newSelectedSlideEditing === null ||
                !AppDocument.checkIsThisType(varyAppDocument)
            ) {
                return;
            }
            const newHoldingSlides = await calculateNewHoldingSlides(
                controlType,
                varyAppDocument,
                slide,
                newSelectedSlideEditing,
                holdingSlides,
            );
            setHoldingSlides(newHoldingSlides);
        };
        return {
            selectedSlideEditing: slide,
            holdingSlides,
            setSelectedSlide,
            onSlideItemsKeyboardEvent: (event: any) => {
                onSlideItemsKeyboardEvent(
                    {
                        holdingSlides,
                        setHoldingSlides,
                        varyAppDocument,
                        selectedSlideEditing: slide,
                    },
                    event,
                );
            },
        };
    }, [slide, varyAppDocument, holdingSlides, setSlide1]);

    const handleFileUpdate = useCallback(
        async (data?: any) => {
            if (
                varyAppDocument === null ||
                !AppDocument.checkIsThisType(varyAppDocument)
            ) {
                return;
            }
            // Distinguish a self-write echo from a genuine external change.
            // Our own editing/saving fires history-update events; re-applying
            // them reverts in-progress edits (the a->b->c glitch, where a
            // late "b" save event overwrites the current "c" editor state).
            // Only history navigation (undo/redo/discard) should refresh the
            // editor
            // from a history event; other history-editing echoes are ignored.
            const isHistoryNavigation = checkIsHistoryMovementEventType(
                data?.eventType,
            );
            if (data?.isHistoryEditing === true && !isHistoryNavigation) {
                return;
            }
            const slides = await varyAppDocument.getSlides();
            const matchedSlide =
                slides.find((item) => {
                    return slide !== null && item.checkIsSame(slide);
                }) ?? null;
            // Never silently jump the editor to an unrelated slide. If the
            // slide the user is currently viewing no longer exists at this
            // point in the document's history (e.g. an Undo/Redo/Discard
            // moved past the point where it was created/still exists), fall
            // back to the first slide but tell the user why their view
            // changed, instead of swapping it out from under them with no
            // indication (this previously looked like silent data loss).
            if (matchedSlide === null) {
                if (slide !== null && slides.length > 0) {
                    showSimpleToast(
                        'Slide History',
                        'The slide you were viewing no longer exists at ' +
                            'this point in history; switched to the first ' +
                            'slide instead.',
                    );
                }
                setSlide1(slides[0] ?? null);
                return;
            }
            // Guard against redundant/self echoes: only refresh the editor
            // when the saved value actually differs from what the editor
            // currently holds. If a different application changed the file,
            // the content differs and we apply it; if the file was saved with
            // the current editing value, we keep the live editor state.
            if (
                !isHistoryNavigation &&
                slide !== null &&
                checkIsSameValues(matchedSlide.toJson(), slide.toJson())
            ) {
                return;
            }
            setSlide1(matchedSlide);
        },
        [varyAppDocument, slide, setSlide1],
    );

    useFileSourceEvents(
        ['update'],
        handleFileUpdate,
        [handleFileUpdate],
        varyAppDocument?.filePath,
    );

    const handleFileDelete = useCallback(
        (filePath: string) => {
            if (varyAppDocument?.filePath === filePath) {
                setVaryAppDocument1(null);
                setSlide1(null);
            }
        },
        [varyAppDocument, setVaryAppDocument1, setSlide1],
    );

    useFileSourceEvents(['delete'], handleFileDelete, [handleFileDelete]);

    return {
        varyAppDocumentContextValue,
        editingSlideContextValue,
    };
}

export function useLyricContextValues() {
    const [lyric, setLyric] = useState<Lyric | null>(null);

    const setLyric1 = useCallback((newLyric: Lyric | null) => {
        setLyric(newLyric);
        setSelectedLyric(newLyric);
    }, []);

    useAppEffectAsync(
        async (methodContext) => {
            const lyric = await getSelectedLyric();
            methodContext.setLyric(lyric);
        },
        [],
        { setLyric },
    );

    const lyricContextValue = useMemo(() => {
        return {
            selectedLyric: lyric,
            setSelectedLyric: async (newLyric: Lyric | null) => {
                setLyric1(newLyric);
            },
        };
    }, [lyric, setLyric1]);

    const handleFileDelete = useCallback(
        (filePath: string) => {
            if (lyric?.filePath === filePath) {
                setLyric1(null);
            }
        },
        [lyric, setLyric1],
    );

    useFileSourceEvents(['delete'], handleFileDelete, [handleFileDelete]);

    return { lyricContextValue };
}
