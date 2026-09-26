import {
    type KeyboardEvent as ReactKeyboardEvent,
    type MouseEvent as ReactMouseEvent,
} from 'react';

import ScreenVaryAppDocumentManager from '../../_screen/managers/ScreenVaryAppDocumentManager';
import appProvider from '../../server/appProvider';
import type { SlideAutoPlayOptionsType } from '../../slide-auto-play/slideAutoPlayRuleHelpers';
import {
    DEFAULT_SLIDE_AUTO_PLAY_OPTIONS,
    toNextIndex,
} from '../../slide-auto-play/slideAutoPlayRuleHelpers';
import { getScreenManagerByScreenId } from '../../_screen/managers/screenManagerHelpers';
import { slidePreviewerMethods } from './AppDocumentPreviewerFooterComp';
import type { VarySlideType } from '../../app-document-list/appDocumentTypeHelpers';
import { bringDomToTopView } from '../../helper/helpers';
import { APP_DOCUMENT_ITEM_CLASS } from './appDocumentHelpers';
import { notifyElementHighlight } from '../../helper/domHelpers';
import Slide from '../../app-document-list/Slide';
import PptxSlide from '../../app-document-list/PptxSlide';
import EventHandler from '../../event/EventHandler';

export function focusNoteEditor(varySlide: VarySlideType) {
    if (
        Slide.checkIsThisType(varySlide) ||
        PptxSlide.checkIsThisType(varySlide)
    ) {
        const slide = varySlide as Slide;
        const uuid = `slide-note-editor-${slide.uuid}`;
        const query = `div[data-note-editor-uuid="${uuid}"]`;
        const elementGetter = () => {
            return document.querySelector(query);
        };
        notifyElementHighlight(elementGetter, {
            moveToView: bringDomToTopView,
            shouldSkipHighlighting: true,
        });
    }
}

export const ON_SLIDE_ITEM_SELECTED_EVENT = 'on-slide-item-selected';
export type OnSlideItemSelectedEventDataType = {
    target: Element;
};

/**
 * Announces "this slide card was clicked", carrying the card element itself.
 *
 * A card knows nothing about who is interested in it — the lyric previewer is,
 * so that clicking a lyric slide scrolls its verse into view — so the element
 * travels with the event and every listener decides for itself whether the
 * click was inside its own subtree.
 *
 * `currentTarget` is read NOW because React nulls it the moment the handler
 * returns; the dispatch itself is deferred a macrotask so the highlight lands
 * after the selection has finished scrolling the card into view.
 */
export function fireOnSlideItemSelectedEvent(event: ReactMouseEvent<Element>) {
    const data: OnSlideItemSelectedEventDataType = {
        target: event.currentTarget,
    };
    setTimeout(() => {
        EventHandler.addPropEvent(ON_SLIDE_ITEM_SELECTED_EVENT, data);
    }, 0);
}

export function handleVarySlideSelecting(
    event: any,
    viewIndex: number,
    varySlide: VarySlideType,
    selectSelectedSlide: (varySlide: VarySlideType) => void,
    // The screens this slide must go to whatever is selected — set when the
    // card is being shown on behalf of something pinned to a screen, empty
    // (the default) everywhere else.
    presetScreenIds: number[] = [],
) {
    if (appProvider.isPageAppDocumentEditor) {
        selectSelectedSlide(varySlide);
    } else {
        slidePreviewerMethods.handleSlideItemSelected(viewIndex, varySlide);
        ScreenVaryAppDocumentManager.handleSlideSelecting(
            event,
            varySlide.filePath,
            varySlide.toJson(),
            false,
            presetScreenIds,
        );
        focusNoteEditor(varySlide);
    }
}

export function genSlideIds(varySlides: VarySlideType[]) {
    return varySlides.map((item) => {
        return item.id;
    });
}

export const SLIDE_ITEMS_CONTAINER_CLASS_NAME = 'app-slide-items-container';
export const DATA_QUERY_KEY = APP_DOCUMENT_ITEM_CLASS + '-id';

export function showVarySlideInViewport(id: number) {
    setTimeout(() => {
        const querySelector = `[${DATA_QUERY_KEY}="${id}"]`;
        const element = document.querySelector(querySelector);
        if (element === null) {
            return;
        }
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center',
        });
    }, 0);
}

/**
 * The slide a step lands on, or null when there is none to land on.
 *
 * The slide-show options ride in here so an arrow key and a running show take
 * the same route: with the default rules (`all`, one at a time) this is the
 * walk it has always been, and `repeatKind` is what makes a show END rather
 * than wrap. A disabled slide is stepped OVER, so the step counts slides the
 * operator can actually see; the search stops once it has been round the
 * list, which is what keeps a document of nothing but disabled slides from
 * spinning here for ever.
 */
function findNextSlide(
    isNext: boolean,
    varySlides: VarySlideType[],
    itemId: number,
    options: SlideAutoPlayOptionsType = DEFAULT_SLIDE_AUTO_PLAY_OPTIONS,
) {
    const enabledIds = varySlides
        .filter((item) => {
            return !item.isDisabled;
        })
        .map((item) => {
            return item.id;
        });
    if (enabledIds.length === 0) {
        return null;
    }
    const index = varySlides.findIndex((item) => {
        return item.id === itemId;
    });
    if (index === -1) {
        return null;
    }
    if (enabledIds.length === 1 && enabledIds[0] === itemId) {
        return null;
    }
    let cursorIndex = index;
    for (let taken = 0; taken < varySlides.length; taken += 1) {
        const nextIndex = toNextIndex(cursorIndex, varySlides.length, {
            isNext,
            step: taken === 0 ? options.step : 1,
            repeatKind: options.repeatKind,
        });
        if (nextIndex === null) {
            return null;
        }
        const nextVarySlide = varySlides[nextIndex] ?? null;
        if (nextVarySlide === null) {
            return null;
        }
        if (!nextVarySlide.isDisabled) {
            return nextVarySlide;
        }
        cursorIndex = nextIndex;
    }
    return null;
}

/**
 * Step every screen showing a slide of this document onto the next one.
 *
 * Asked of the SCREEN MANAGERS rather than of the DOM. It used to read the
 * highlighted cards -- `[data-vary-app-document-item-id].app-highlight-selected`
 * and the `[data-screen-id]` badges inside them -- which is the same answer
 * one step removed, since that highlight IS `getDataList()` rendered. With a
 * windowed list the card of the slide on screen need not be mounted at all
 * (the operator has scrolled away from it), and reading the DOM then said
 * "nothing is showing" and left the projector where it was.
 *
 * Only the cards' OWN ids are asked, never a pptx sub-slide's: a sub-slide is
 * a step inside its parent card and has no card of its own, exactly as before.
 * It is still a valid TARGET, which is what `allVarySlides` is for.
 */
export function handleNextItemSelecting({
    varySlides,
    isNext,
    options = DEFAULT_SLIDE_AUTO_PLAY_OPTIONS,
}: {
    varySlides: VarySlideType[];
    isNext: boolean;
    options?: SlideAutoPlayOptionsType;
}) {
    // The editor page draws no on-screen highlight and never moved a screen
    // from here; it can be open beside the presenter, and advancing from both
    // would step every screen twice.
    if (appProvider.isPageAppDocumentEditor) {
        return false;
    }
    const allVarySlides = varySlides.reduce((bucket, varySlide) => {
        bucket.push(varySlide);
        if (PptxSlide.checkIsThisType(varySlide)) {
            bucket.push(...varySlide.subSlides);
        }
        return bucket;
    }, [] as VarySlideType[]);
    const foundList = varySlides.reduce(
        (
            bucket: {
                varySlide: VarySlideType;
                screenId: number;
            }[],
            varySlide,
        ) => {
            const onScreenList = ScreenVaryAppDocumentManager.getDataList(
                varySlide.filePath,
                varySlide.id,
            );
            if (onScreenList.length === 0) {
                return bucket;
            }
            const targetItem = findNextSlide(
                isNext,
                allVarySlides,
                varySlide.id,
                options,
            );
            if (targetItem === null) {
                return bucket;
            }
            return bucket.concat(
                onScreenList.map(([key]) => {
                    return {
                        varySlide: targetItem,
                        screenId: Number.parseInt(key),
                    };
                }),
            );
        },
        [],
    );
    // Nothing to step to: with "no repeat" that is the show reaching the end
    // of the document, which the caller turns into a stop.
    if (foundList.length === 0) {
        return false;
    }
    for (let i = 0; i < foundList.length; i++) {
        const { varySlide, screenId } = foundList[i];
        const screenManager = getScreenManagerByScreenId(screenId);
        if (screenManager === null) {
            continue;
        }
        setTimeout(() => {
            const { screenVaryAppDocumentManager } = screenManager;
            screenVaryAppDocumentManager.varySlideData =
                screenVaryAppDocumentManager.toSlideData(
                    varySlide.filePath,
                    varySlide.toJson(),
                );
            focusNoteEditor(varySlide);
        }, i * 100);
    }
    return true;
}

export function getContainerDiv(): HTMLDivElement | null {
    return document.querySelector(`.${SLIDE_ITEMS_CONTAINER_CLASS_NAME}`);
}

export function handleSlideMoving(
    event: KeyboardEvent | ReactKeyboardEvent<any>,
    varySlides: VarySlideType[],
    // The calling previewer's OWN container. Omitted (or null) keeps the
    // historical first-match-in-the-document lookup, which is what a previewer
    // rendered without a scope above it still wants. Passing it is what lets
    // several previewers coexist: every one of them gets this callback, and
    // only the one whose container has focus may act on the key.
    container: HTMLDivElement | null = null,
) {
    if (!appProvider.presenterHomePage) {
        return;
    }
    const element = container ?? getContainerDiv();
    if (element === null) {
        return;
    }
    if (document.activeElement === null) {
        element.focus();
        return;
    } else if (document.activeElement !== element) {
        return;
    }
    event.preventDefault();
    let isLeft = ['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key);
    if (event.key === ' ' && event.shiftKey) {
        isLeft = true;
    }
    handleNextItemSelecting({
        varySlides,
        isNext: !isLeft,
    });
}
