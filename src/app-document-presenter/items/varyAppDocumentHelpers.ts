import ScreenVaryAppDocumentManager from '../../_screen/managers/ScreenVaryAppDocumentManager';
import appProvider from '../../server/appProvider';
import { getScreenManagerByScreenId } from '../../_screen/managers/screenManagerHelpers';
import { slidePreviewerMethods } from './AppDocumentPreviewerFooterComp';
import type { VaryAppDocumentItemType } from '../../app-document-list/appDocumentTypeHelpers';
import { HIGHLIGHT_SELECTED_CLASSNAME } from '../../helper/helpers';

export function handleAppDocumentItemSelecting(
    event: any,
    viewIndex: number,
    varyAppDocumentItem: VaryAppDocumentItemType,
    selectSelectedSlide: (varyAppDocumentItem: VaryAppDocumentItemType) => void,
) {
    if (appProvider.isPageAppDocumentEditor) {
        selectSelectedSlide(varyAppDocumentItem);
    } else {
        slidePreviewerMethods.handleSlideItemSelected(
            viewIndex,
            varyAppDocumentItem,
        );
        ScreenVaryAppDocumentManager.handleSlideSelecting(
            event,
            varyAppDocumentItem.filePath,
            varyAppDocumentItem.toJson(),
        );
    }
}

export function genSlideIds(varyAppDocumentItems: VaryAppDocumentItemType[]) {
    return varyAppDocumentItems.map((item) => {
        return item.id;
    });
}

export const SLIDE_ITEMS_CONTAINER_CLASS_NAME = 'app-slide-items-container';
export const DATA_QUERY_KEY = 'data-vary-app-document-item-id';

export function showVaryAppDocumentItemInViewport(id: number) {
    setTimeout(() => {
        const querySelector = `[data-vary-app-document-item-id="${id}"]`;
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
    items: VaryAppDocumentItemType[],
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
    varyAppDocumentItems,
    isNext,
}: {
    container: HTMLDivElement;
    varyAppDocumentItems: VaryAppDocumentItemType[];
    isNext: boolean;
}) {
    const divSelectedList = container.querySelectorAll(
        `[${DATA_QUERY_KEY}].${HIGHLIGHT_SELECTED_CLASSNAME}`,
    );
    const foundList = Array.from(divSelectedList).reduce(
        (
            bucket: {
                item: VaryAppDocumentItemType;
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
            const targetItem = findNextSlide(
                isNext,
                varyAppDocumentItems,
                itemId,
            );
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
            screenVaryAppDocumentManager.varyAppDocumentItemData =
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
    event: KeyboardEvent,
    varyAppDocumentItems: VaryAppDocumentItemType[],
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
    const isLeft = ['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key);
    handleNextItemSelecting({
        container: element,
        varyAppDocumentItems,
        isNext: !isLeft,
    });
}
