import { type KeyboardEvent as ReactKeyboardEvent } from 'react';

import ScreenVaryAppDocumentManager from '../../_screen/managers/ScreenVaryAppDocumentManager';
import appProvider from '../../server/appProvider';
import { getScreenManagerByScreenId } from '../../_screen/managers/screenManagerHelpers';
import { slidePreviewerMethods } from './AppDocumentPreviewerFooterComp';
import type { VarySlideType } from '../../app-document-list/appDocumentTypeHelpers';
import {
    bringDomToTopView,
    HIGHLIGHT_SELECTED_CLASSNAME,
} from '../../helper/helpers';
import { APP_DOCUMENT_ITEM_CLASS } from './appDocumentHelpers';
import { notifyNewElementAdded } from '../../helper/domHelpers';
import Slide from '../../app-document-list/Slide';
import PptxSlide from '../../app-document-list/PptxSlide';

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
        notifyNewElementAdded(elementGetter, {
            moveToView: bringDomToTopView,
            shouldSkipHighlighting: true,
        });
    }
}

export function handleVarySlideSelecting(
    event: any,
    viewIndex: number,
    varySlide: VarySlideType,
    selectSelectedSlide: (varySlide: VarySlideType) => void,
) {
    if (appProvider.isPageAppDocumentEditor) {
        selectSelectedSlide(varySlide);
    } else {
        slidePreviewerMethods.handleSlideItemSelected(viewIndex, varySlide);
        ScreenVaryAppDocumentManager.handleSlideSelecting(
            event,
            varySlide.filePath,
            varySlide.toJson(),
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

function findNextSlide(
    isNext: boolean,
    varySlides: VarySlideType[],
    itemId: number,
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
    if (enabledIds.length === 1 && enabledIds[0] === itemId) {
        return null;
    }
    let index = varySlides.findIndex((item) => {
        return item.id === itemId;
    });
    if (index === -1) {
        return null;
    }
    index += isNext ? 1 : -1;
    index += varySlides.length;

    const nextVarySlide = varySlides[index % varySlides.length] ?? null;
    if (nextVarySlide?.isDisabled) {
        return findNextSlide(isNext, varySlides, nextVarySlide.id);
    }
    return nextVarySlide;
}

export function handleNextItemSelecting({
    container,
    varySlides,
    isNext,
}: {
    container: HTMLDivElement;
    varySlides: VarySlideType[];
    isNext: boolean;
}) {
    const allVarySlides = varySlides.reduce((bucket, varySlide) => {
        bucket.push(varySlide);
        if (PptxSlide.checkIsThisType(varySlide)) {
            bucket.push(...varySlide.subSlides);
        }
        return bucket;
    }, [] as VarySlideType[]);
    const divSelectedList = container.querySelectorAll(
        `[${DATA_QUERY_KEY}].${HIGHLIGHT_SELECTED_CLASSNAME}`,
    );
    const foundList = Array.from(divSelectedList).reduce(
        (
            bucket: {
                varySlide: VarySlideType;
                screenId: number;
            }[],
            divSelected,
        ) => {
            const itemId = Number.parseInt(
                divSelected?.getAttribute(DATA_QUERY_KEY) ?? '',
            );
            const selectedElements = Array.from(
                divSelected.querySelectorAll<HTMLElement>('[data-screen-id]'),
            );
            const screenIds = selectedElements.map((element) => {
                return Number.parseInt(element.dataset.screenId ?? '');
            });
            const targetItem = findNextSlide(isNext, allVarySlides, itemId);
            if (targetItem === null) {
                return bucket;
            }
            return bucket.concat(
                screenIds.map((screenId) => {
                    return { varySlide: targetItem, screenId };
                }),
            );
        },
        [],
    );
    if (foundList.length === 0) {
        return;
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
}

export function getContainerDiv(): HTMLDivElement | null {
    return document.querySelector(`.${SLIDE_ITEMS_CONTAINER_CLASS_NAME}`);
}

export function handleArrowing(
    event: KeyboardEvent | ReactKeyboardEvent<any>,
    varySlides: VarySlideType[],
) {
    if (!appProvider.presenterHomePage) {
        return;
    }
    const element = getContainerDiv();
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
        container: element,
        varySlides,
        isNext: !isLeft,
    });
}
