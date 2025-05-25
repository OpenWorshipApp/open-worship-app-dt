import BibleItem from '../bible-list/BibleItem';
import LookupBibleItemController, {
    closeEventMapper,
    ctrlShiftMetaKeys,
    useLookupBibleItemControllerContext,
} from './LookupBibleItemController';
import { handleError } from '../helper/errorHelpers';
import { useKeyboardRegistering } from '../event/KeyboardEventListener';
import BibleItemsViewController from './BibleItemsViewController';
import { RECEIVING_DROP_CLASSNAME } from '../helper/helpers';

enum DraggingPosEnum {
    TOP = '-top',
    BOTTOM = '-bottom',
    LEFT = '-left',
    RIGHT = '-right',
    CENTER = '',
}

type DragDropEventType = React.DragEvent<HTMLDivElement>;

export function genDraggingClass(event: DragDropEventType) {
    const { nativeEvent } = event;
    const { offsetX, offsetY } = nativeEvent;
    const rect = (
        event.currentTarget as HTMLDivElement
    ).getBoundingClientRect();
    const isLeft = offsetX < rect.width / 3;
    const isRight = offsetX > (rect.width * 2) / 3;
    const isTop = offsetY < rect.height / 3;
    const isBottom = offsetY > (rect.height * 2) / 3;
    let suffix = DraggingPosEnum.CENTER.toString();
    if (isLeft) {
        suffix += DraggingPosEnum.LEFT;
    } else if (isRight) {
        suffix += DraggingPosEnum.RIGHT;
    } else if (isTop) {
        suffix += DraggingPosEnum.TOP;
    } else if (isBottom) {
        suffix += DraggingPosEnum.BOTTOM;
    }
    return `${RECEIVING_DROP_CLASSNAME}${suffix}`;
}

export function removeDraggingClass(event: DragDropEventType) {
    const allPos = Object.values(DraggingPosEnum);
    return allPos
        .map((suffix) => {
            const className = `${RECEIVING_DROP_CLASSNAME}${suffix}`;
            if (event.currentTarget.classList.contains(className)) {
                event.currentTarget.classList.remove(className);
                return suffix;
            }
            return null;
        })
        .filter((suffix) => suffix !== null);
}

export function applyDropped(
    event: DragDropEventType,
    bibleItemViewCtl: BibleItemsViewController,
    bibleItem: BibleItem,
) {
    const allPos = removeDraggingClass(event);
    const data = event.dataTransfer.getData('text');
    try {
        const json = JSON.parse(data);
        if (json.type === 'bibleItem') {
            const newBibleItem = BibleItem.fromJson(json.data);
            for (const pos of allPos) {
                if (pos === DraggingPosEnum.CENTER.toString()) {
                    bibleItemViewCtl.applyTargetOrBibleKey(
                        bibleItem,
                        newBibleItem,
                    );
                } else if (pos === DraggingPosEnum.LEFT.toString()) {
                    bibleItemViewCtl.addBibleItemLeft(
                        bibleItem,
                        newBibleItem,
                        true,
                    );
                } else if (pos === DraggingPosEnum.RIGHT.toString()) {
                    bibleItemViewCtl.addBibleItemRight(
                        bibleItem,
                        newBibleItem,
                        true,
                    );
                } else if (pos === DraggingPosEnum.TOP.toString()) {
                    bibleItemViewCtl.addBibleItemTop(
                        bibleItem,
                        newBibleItem,
                        true,
                    );
                } else if (pos === DraggingPosEnum.BOTTOM.toString()) {
                    bibleItemViewCtl.addBibleItemBottom(
                        bibleItem,
                        newBibleItem,
                        true,
                    );
                }
            }
        }
    } catch (error) {
        handleError(error);
    }
}

function changeEditingBibleItem(
    viewController: LookupBibleItemController,
    eventKey: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown',
) {
    const allBibleItems = viewController.straightBibleItems;
    if (allBibleItems.length === 0) {
        return;
    }
    const selectedIndex = viewController.selectedIndex;
    if (selectedIndex === -1) {
        return;
    }
    const arrowPosMap = {
        ArrowLeft: 'left',
        ArrowRight: 'right',
        ArrowUp: 'top',
        ArrowDown: 'bottom',
    };
    const neighborBibleItems = viewController.getNeighborBibleItems(
        viewController.selectedBibleItem,
        [arrowPosMap[eventKey]],
    );
    let targetBibleItem: BibleItem | null = null;
    if (eventKey === 'ArrowUp' || eventKey === 'ArrowDown') {
        if (eventKey === 'ArrowUp') {
            targetBibleItem = neighborBibleItems.top;
        } else {
            targetBibleItem = neighborBibleItems.bottom;
        }
    } else if (eventKey === 'ArrowLeft' || eventKey === 'ArrowRight') {
        if (eventKey === 'ArrowLeft') {
            targetBibleItem = neighborBibleItems.left;
        } else {
            targetBibleItem = neighborBibleItems.right;
        }
    }
    if (targetBibleItem === null) {
        return;
    }
    viewController.editBibleItem(targetBibleItem);
}

export function useNextEditingBibleItem() {
    const viewController = useLookupBibleItemControllerContext();
    const eventMapperList = [
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
    ].map((key) => {
        return { ...ctrlShiftMetaKeys, key };
    });
    useKeyboardRegistering(
        eventMapperList,
        (event) => {
            event.preventDefault();
            changeEditingBibleItem(viewController, event.key as any);
        },
        [],
    );
}

export function closeCurrentEditingBibleItem(
    viewController: LookupBibleItemController,
) {
    const selectedBibleItem = viewController.selectedBibleItem;
    if (viewController.straightBibleItems.length < 2) {
        return;
    }
    viewController.deleteBibleItem(selectedBibleItem);
}

export function useCloseBibleItemRenderer() {
    const viewController = useLookupBibleItemControllerContext();
    useKeyboardRegistering(
        [closeEventMapper],
        (event) => {
            event.preventDefault();
            closeCurrentEditingBibleItem(viewController);
        },
        [],
    );
}
