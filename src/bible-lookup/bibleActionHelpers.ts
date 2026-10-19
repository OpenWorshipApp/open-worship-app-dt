import { tran } from '../lang/langHelpers';
import {
    exportToWordDocument,
    saveBibleItem,
} from '../bible-list/bibleHelpers';
import ScreenLongTextManager from '../_screen/managers/ScreenLongTextManager';
import type BibleItem from '../bible-list/BibleItem';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import appProvider from '../server/appProvider';
import { elementDivider } from '../context-menu/AppContextMenuComp';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import type LookupBibleItemController from '../bible-reader/LookupBibleItemController';
import { CanvasBibleItemEventListener } from '../slide-editor/canvas/canvasBibleItemHelpers';

import {
    ctrlEnterEventMapper,
    ctrlShiftEnterEventMapper,
} from '../keyboard-shortcut/appShortcutMappers';

// Declared with every other shortcut so Help -> Keyboard Shortcuts lists them.
export { ctrlEnterEventMapper, ctrlShiftEnterEventMapper };

export function showAddingBibleItemFail() {
    showSimpleToast(tran('Adding Bible Item'), tran('Fail to add bible item'));
}

export async function addBibleItemAndPresent(
    event: any,
    bibleItem: BibleItem,
    onDone?: () => void,
) {
    const addedBibleItem = await saveBibleItem(bibleItem, onDone);
    if (addedBibleItem === null) {
        showAddingBibleItemFail();
    } else {
        ScreenLongTextManager.handleBibleItemSelecting(event, addedBibleItem);
    }
}

const VERSE_KEY_SELECTOR = '[data-verse-key]';

function toElement(node: unknown): Element | null {
    if (node instanceof Element) {
        return node;
    }
    // A text node: a dispatched event, or a selection anchored in verse text.
    return node instanceof Node ? node.parentElement : null;
}

function toVerseElement(element: Element | null): HTMLElement | null {
    return element?.closest<HTMLElement>(VERSE_KEY_SELECTOR) ?? null;
}

/**
 * The verse a bible view's context menu was opened on, or null.
 *
 * `closest`, not the target and its parent: a verse holds more than its own
 * text node. A decorated name ("Aaron" in Exodus 4:14), a word of the
 * extra-verses layout or of a custom-HTML verse sits two or more levels down,
 * and the menu used to drop "Open in Cross Reference" on all of them.
 *
 * A menu opened away from any verse — from the keyboard, which targets the
 * focused control — lets the text selection name the verse instead, but only
 * one inside the view the menu belongs to: a selection left behind in another
 * pane is not this menu's verse.
 */
function findContextMenuVerseKey(event: any): string | null {
    const targetElement = toElement(event?.target);
    const targetVerseElement = toVerseElement(targetElement);
    if (targetVerseElement !== null) {
        return targetVerseElement.dataset.verseKey ?? null;
    }
    // `currentTarget` is the view while React dispatches (this runs before
    // the menu's first await); the target is inside that view anyway.
    const viewElement = toElement(event?.currentTarget) ?? targetElement;
    if (viewElement === null) {
        return null;
    }
    const selectedVerseElement = toVerseElement(
        toElement(globalThis.getSelection?.()?.anchorNode),
    );
    if (
        selectedVerseElement === null ||
        !viewElement.contains(selectedVerseElement)
    ) {
        return null;
    }
    return selectedVerseElement.dataset.verseKey ?? null;
}

export function genFoundBibleItemContextMenu(
    event: any,
    viewController: LookupBibleItemController,
    bibleItem: BibleItem,
    isKeyboardShortcut?: boolean,
): ContextMenuItemType[] {
    const verseKey = findContextMenuVerseKey(event);
    const onDone = () => {
        viewController.onLookupSaveBibleItem();
    };
    return [
        {
            menuElement: elementDivider,
        },
        {
            childBefore: genContextMenuItemIcon('floppy'),
            menuElement: tran('Save bible item'),
            keyboardShortcut: isKeyboardShortcut
                ? ctrlEnterEventMapper
                : undefined,
            onSelect: async () => {
                const addedBibleItem = await saveBibleItem(bibleItem, onDone);
                if (addedBibleItem === null) {
                    showAddingBibleItemFail();
                }
            },
        },
        {
            // Also on the header's hover strip; in the menu too, like that
            // strip's other actions, for a pane too narrow to show them all.
            childBefore: genContextMenuItemIcon('file-earmark-word'),
            menuElement: tran('Export to MS Word'),
            onSelect: () => {
                exportToWordDocument([bibleItem]);
            },
        },
        ...(verseKey === null || appProvider.isPageAppDocumentEditor
            ? []
            : [
                  {
                      childBefore: genContextMenuItemIcon('link-45deg'),
                      // No `title`: the verse key is the app's own handle
                      // (`(KJV) GEN 22:1`), and as a tooltip it became part of
                      // the item's spoken name. The panel this opens names the
                      // verse in the reader's language.
                      menuElement: tran('Open in Cross Reference'),
                      onSelect: () => {
                          viewController.selectedVerseKey = verseKey;
                          viewController.openBibleSearch('c');
                          viewController.setIsAdvanceLookupOpened(true);
                      },
                  },
              ]),
        ...(appProvider.isPagePresenter
            ? [
                  {
                      childBefore: genContextMenuItemIcon('display'),
                      menuElement: tran('Show bible item'),
                      onSelect: (event: any) => {
                          ScreenLongTextManager.handleBibleItemSelecting(
                              event,
                              bibleItem,
                          );
                          onDone();
                      },
                  },
                  {
                      childBefore: genContextMenuItemIcon('floppy'),
                      childAfter: genContextMenuItemIcon('display'),
                      keyboardShortcut: isKeyboardShortcut
                          ? ctrlShiftEnterEventMapper
                          : undefined,
                      menuElement: tran('Save bible item and show on screen'),
                      onSelect: async (event: any) => {
                          addBibleItemAndPresent(event, bibleItem, onDone);
                      },
                  },
              ]
            : []),
        ...(appProvider.isPageAppDocumentEditor
            ? [
                  {
                      childBefore: genContextMenuItemIcon(
                          'file-earmark-slides',
                      ),
                      menuElement: tran('Insert bible item'),
                      onSelect: () => {
                          CanvasBibleItemEventListener.insertBibleItem(
                              bibleItem,
                          );
                          onDone();
                      },
                  },
              ]
            : []),
    ];
}
