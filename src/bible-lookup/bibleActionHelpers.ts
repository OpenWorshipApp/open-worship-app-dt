import { tran } from '../lang/langHelpers';
import type { EventMapperType as KeyboardEventMapper } from '../event/KeyboardEventListener';
import { saveBibleItem } from '../bible-list/bibleHelpers';
import ScreenBibleManager from '../_screen/managers/ScreenBibleManager';
import type BibleItem from '../bible-list/BibleItem';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import appProvider from '../server/appProvider';
import {
    elementDivider,
    genContextMenuItemIcon,
} from '../context-menu/AppContextMenuComp';
import type LookupBibleItemController from '../bible-reader/LookupBibleItemController';
import { CanvasBibleItemEventListener } from '../slide-editor/canvas/canvasBibleItemHelpers';

export const ctrlShiftEnterEventMapper: KeyboardEventMapper = {
    allControlKey: ['Ctrl', 'Shift'],
    key: 'Enter',
};

export const ctrlEnterEventMapper: KeyboardEventMapper = {
    allControlKey: ['Ctrl'],
    key: 'Enter',
};

export function showAddingBibleItemFail() {
    showSimpleToast('Adding Bible Item', 'Fail to add bible item');
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
        ScreenBibleManager.handleBibleItemSelecting(event, addedBibleItem);
    }
}

export function genFoundBibleItemContextMenu(
    event: any,
    viewController: LookupBibleItemController,
    bibleItem: BibleItem,
    isKeyboardShortcut?: boolean,
): ContextMenuItemType[] {
    let verseKey: string | null = null;
    if (event.target instanceof HTMLElement) {
        verseKey =
            event.target.dataset.verseKey ??
            event.target.parentElement?.dataset.verseKey ??
            null;
    }
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
        ...(verseKey === null || appProvider.isPageAppDocumentEditor
            ? []
            : [
                  {
                      menuElement: tran('Open in Cross Reference'),
                      title: verseKey,
                      onSelect: () => {
                          viewController.bibleCrossReferenceVerseKey = verseKey;
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
                          ScreenBibleManager.handleBibleItemSelecting(
                              event,
                              bibleItem,
                          );
                          onDone();
                      },
                  },
                  {
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
