import { useMemo, useState, useCallback } from 'react';

import appProvider from '../server/appProvider';
import AppDocument from '../app-document-list/AppDocument';
import type Slide from '../app-document-list/Slide';
import { useAppEffectAsync } from '../helper/debuggerHelpers';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';
import {
    getSelectedVaryAppDocument,
    getSelectedEditingSlide,
    setSelectedVaryAppDocument,
    setSelectedEditingSlide,
} from '../app-document-list/appDocumentHelpers';
import { getSelectedLyric, setSelectedLyric } from '../lyric-list/lyricHelpers';
import type Lyric from '../lyric-list/Lyric';
import type { VaryAppDocumentType } from '../app-document-list/appDocumentTypeHelpers';
import type { TabOptionType } from './routeHelpers';
import { toTitleExternal } from './routeHelpers';
import { showAppAlert } from '../popup-widget/popupWidgetHelpers';
import { AllControlType as KeyboardControlType } from '../event/KeyboardEventListener';
import { onSlideItemsKeyboardEvent } from '../slide-editor/slideEditingBeyboardEventHelpers';

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
        title: toTitleExternal('Slide Editor'),
        routePath: appProvider.appDocumentEditorHomePage,
        preCheck: async () => {
            const varyAppDocument = await getSelectedVaryAppDocument();
            if (!AppDocument.checkIsThisType(varyAppDocument)) {
                showAppAlert(
                    'No slide selected',
                    'Please select an Open Worship slide first',
                );
                return false;
            }
            return true;
        },
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
            methodContext.setVaryAppDocument(varyAppDocument);
            const varyAppDocumentItem = await getSelectedEditingSlide();
            methodContext.setSlide(varyAppDocumentItem);
        },
        [],
        {
            setVaryAppDocument,
            setSlide,
        },
    );

    const varyAppDocumentContextValue = useMemo(() => {
        return {
            selectedVaryAppDocument: varyAppDocument,
            setSelectedVaryAppDocument: async (
                newVaryAppDocument: VaryAppDocumentType | null,
            ) => {
                setVaryAppDocument1(newVaryAppDocument);
                let selectedSlide: Slide | null = null;
                if (
                    newVaryAppDocument !== null &&
                    AppDocument.checkIsThisType(newVaryAppDocument)
                ) {
                    const varyAppDocumentItems =
                        await newVaryAppDocument.getSlides();
                    selectedSlide = varyAppDocumentItems[0] ?? null;
                }
                setSlide1(selectedSlide);
            },
        };
    }, [varyAppDocument, setVaryAppDocument1, setSlide1]);

    const editingSlideContextValue = useMemo(() => {
        return {
            selectedSlide: slide,
            holdingSlides,
            setSelectedDocument: async (
                newSelectedSlide: Slide,
                controlType?: KeyboardControlType,
            ) => {
                if (controlType !== undefined) {
                    if (!AppDocument.checkIsThisType(varyAppDocument)) {
                        return;
                    }
                    const newHoldingSlides = await calculateNewHoldingSlides(
                        controlType,
                        varyAppDocument,
                        slide,
                        newSelectedSlide,
                        holdingSlides,
                    );
                    setHoldingSlides(newHoldingSlides);
                    return;
                }
                setSlide1(newSelectedSlide);
            },
            onSlideItemsKeyboardEvent: onSlideItemsKeyboardEvent.bind(null, {
                holdingSlides,
                setHoldingSlides,
                varyAppDocument,
                selectedSlide: slide,
            }),
        };
    }, [slide, varyAppDocument, holdingSlides, setSlide1]);

    const handleFileUpdate = useCallback(async () => {
        if (
            varyAppDocument === null ||
            !AppDocument.checkIsThisType(varyAppDocument)
        ) {
            return;
        }
        const slides = await varyAppDocument.getSlides();
        const newSlide =
            slides.find((item) => {
                return slide !== null && item.checkIsSame(slide);
            }) ??
            slides[0] ??
            null;
        setSlide1(newSlide);
    }, [varyAppDocument, slide, setSlide1]);

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
