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
    items: VarySlideType[],
    itemId: number,
) {
    let index = items.findIndex((item) => {
        return item.id === itemId;
    });
    if (index === -1) {
        return null;
    }
    index += isNext ? 1 : -1;
    index += items.length;

    return items[index % items.length] ?? null;
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
    const divSelectedList = container.querySelectorAll(
        `[${DATA_QUERY_KEY}].${HIGHLIGHT_SELECTED_CLASSNAME}`,
    );
    const foundList = Array.from(divSelectedList).reduce(
        (
            bucket: {
                item: VarySlideType;
                screenId: number;
            }[],
            divSelected,
        ) => {
            const itemId = Number.parseInt(
                divSelected?.getAttribute(DATA_QUERY_KEY) ?? '',
            );
            const screenIds = Array.from(
                divSelected.querySelectorAll('[data-screen-id]'),
            ).map((element) => {
                return Number.parseInt(
                    element.getAttribute('data-screen-id') ?? '',
                );
            });
            const targetItem = findNextSlide(isNext, varySlides, itemId);
            if (targetItem === null) {
                return bucket;
            }
            return bucket.concat(
                screenIds.map((screenId) => {
                    return { item: targetItem, screenId };
                }),
            );
        },
        [],
    );
    if (foundList.length === 0) {
        return;
    }
    for (let i = 0; i < foundList.length; i++) {
        const { item, screenId } = foundList[i];
        const screenManager = getScreenManagerByScreenId(screenId);
        if (screenManager === null) {
            continue;
        }
        setTimeout(() => {
            const { screenVaryAppDocumentManager } = screenManager;
            screenVaryAppDocumentManager.varySlideData =
                screenVaryAppDocumentManager.toSlideData(
                    item.filePath,
                    item.toJson(),
                );
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
