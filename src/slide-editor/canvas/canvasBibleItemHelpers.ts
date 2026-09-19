import BibleItem from '../../bible-list/BibleItem';
import { readTextFromClipboard } from '../../server/appHelpers';
import LookupBibleItemController from '../../bible-reader/LookupBibleItemController';
import { cloneJson } from '../../helper/helpers';
import type { CanvasItemBiblePropsType } from './CanvasItemBibleItem';
import EventHandler from '../../event/EventHandler';

// The bible lookup popup renders outside the slide editor's React tree, so it
// cannot reach the live CanvasController through context; the editor's
// file-update handler also ignores self-write echoes, so inserting through a
// detached controller would not refresh the open editor. This global event
// hands the bible item to whichever slide editor canvas is currently mounted.
export class CanvasBibleItemEventListener extends EventHandler<'insert-bible-item'> {
    static readonly eventNamePrefix: string = 'canvas-bible-item';
    static insertBibleItem(bibleItem: BibleItem) {
        this.addPropEvent('insert-bible-item', bibleItem);
    }
}

// "(KJV) 2 Samuel 5:15\n(15): Ibhar also, and Elishua,..."
const BIBLE_ITEM_TEXT_REGEX = /^\((.+)\)\s(.+)\n[\s\S]+$/;

export async function readBibleItemFromClipboard() {
    const clipboardText = await readTextFromClipboard();
    if (!clipboardText) {
        return null;
    }
    const normalizedText = clipboardText.replaceAll('\r\n', '\n').trim();
    const matched = BIBLE_ITEM_TEXT_REGEX.exec(normalizedText);
    if (matched === null) {
        return null;
    }
    const [, bibleKey, title] = matched;
    try {
        return await BibleItem.fromTitleText(bibleKey, title);
    } catch (_error) {
        return null;
    }
}

// Seeds the lookup controller with this box's verse, the way the bible list's
// `Lookup` menu item does, then hands over to the caller to show the popup.
export function lookupBibleItemProps(
    props: CanvasItemBiblePropsType,
    openBibleLookup: () => void,
) {
    const viewController = new LookupBibleItemController();
    viewController.applyTargetOrBibleKey(viewController.selectedBibleItem, {
        bibleKey: props.bibleKeys[0],
        target: cloneJson(props.bibleItemTarget),
    });
    openBibleLookup();
}
