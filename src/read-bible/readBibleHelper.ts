import BibleItem from '../bible-list/BibleItem';
import BibleItemViewController, {
    SearchBibleItemViewController,
} from './BibleItemViewController';
import { handleError } from '../helper/errorHelpers';
import { useKeyboardRegistering } from '../event/KeyboardEventListener';

export enum DraggingPosEnum {
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
    const bc = (event.currentTarget as HTMLDivElement)
        .getBoundingClientRect();
    const isLeft = offsetX < bc.width / 3;
    const isRight = offsetX > bc.width * 2 / 3;
    const isTop = offsetY < bc.height / 3;
    const isBottom = offsetY > bc.height * 2 / 3;
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
    return `receiving-child${suffix}`;
}

export function removeDraggingClass(event: DragDropEventType) {
    const allPos = Object.values(DraggingPosEnum);
    return allPos.map((suffix) => {
        const className = `receiving-child${suffix}`;
        if (event.currentTarget.classList.contains(className)) {
            event.currentTarget.classList.remove(className);
            return suffix;
        }
        return null;
    }).filter((suffix) => suffix !== null);
}

export function applyDragged(
    event: DragDropEventType, bibleItemViewCtl: BibleItemViewController,
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
                    bibleItemViewCtl.changeBibleItem(bibleItem, newBibleItem);
                } else if (pos === DraggingPosEnum.LEFT.toString()) {
                    bibleItemViewCtl.addBibleItemLeft(bibleItem, newBibleItem);
                } else if (pos === DraggingPosEnum.RIGHT.toString()) {
                    bibleItemViewCtl.addBibleItemRight(bibleItem, newBibleItem);
                } else if (pos === DraggingPosEnum.TOP.toString()) {
                    bibleItemViewCtl.addBibleItemTop(bibleItem, newBibleItem);
                } else if (pos === DraggingPosEnum.BOTTOM.toString()) {
                    bibleItemViewCtl.addBibleItemBottom(
                        bibleItem, newBibleItem,
                    );
                }
            }
        }
    } catch (error) {
        handleError(error);
    }
}


function changeEditingBibleItem(isLeft = false) {
    const viewController = SearchBibleItemViewController.getInstance();
    const allBibleItems = viewController.straightBibleItems;
    if (allBibleItems.length === 0) {
        return;
    }
    let selectedIndex = viewController.selectedIndex;
    if (selectedIndex === -1) {
        return;
    }
    selectedIndex = (
        (selectedIndex + (isLeft ? - 1 : 1) + allBibleItems.length) %
        allBibleItems.length
    );
    viewController.editBibleItem(allBibleItems[selectedIndex]);
}

const metaKeys: any = {
    wControlKey: ['Ctrl', 'Shift'],
    lControlKey: ['Ctrl', 'Shift'],
    mControlKey: ['Meta', 'Shift'],
};

export function useNextEditingBibleItem(key: 'ArrowLeft' | 'ArrowRight') {
    useKeyboardRegistering([{ ...metaKeys, key }], (e) => {
        e.preventDefault();
        changeEditingBibleItem(key === 'ArrowLeft');
    });
}

export function useSplitBibleItemRenderer(key: 's' | 'v') {
    useKeyboardRegistering([{ ...metaKeys, key }], () => {
        const viewController = SearchBibleItemViewController.getInstance();
        const bibleItem = viewController.selectedBibleItem;
        if (key === 's') {
            viewController.addBibleItemLeft(bibleItem, bibleItem);
        } else {
            viewController.addBibleItemBottom(bibleItem, bibleItem);
        }
    });
}

export function closeCurrentEditingBibleItem() {
    const viewController = SearchBibleItemViewController.getInstance();
    const selectedBibleItem = viewController.selectedBibleItem;
    if (viewController.straightBibleItems.length < 2) {
        return;
    }
    changeEditingBibleItem(true);
    viewController.removeBibleItem(selectedBibleItem);
}

export function useCloseBibleItemRenderer() {
    useKeyboardRegistering([{
        wControlKey: ['Ctrl'],
        lControlKey: ['Ctrl'],
        mControlKey: ['Meta'],
        key: 'w',
    }], (e) => {
        e.preventDefault();
        closeCurrentEditingBibleItem();
    });
}
