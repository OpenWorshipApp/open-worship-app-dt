import { screenManagerSettingNames } from '../../helper/constants';
import { handleError } from '../../helper/errorHelpers';
import { parseJsonSafely } from '../../helper/helpers';
import { genDerivedSettingReader } from '../../helper/derivedSettingHelpers';
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../../context-menu/contextMenuIconHelpers';
import Slide from '../../app-document-list/Slide';
import type ScreenManager from '../managers/ScreenManager';
import {
    getSelectedScreenManagerBases,
    getValidOnScreen,
} from '../managers/screenManagerBaseHelpers';
import { getAllScreenManagers } from '../managers/screenManagerHelpers';
import PdfSlide from '../../app-document-list/PdfSlide';
import type { AppDocumentListType } from '../screenAppDocumentTypeHelpers';
import { tran } from '../../lang/langHelpers';
import PptxSlide from '../../app-document-list/PptxSlide';
import DocxSlide from '../../app-document-list/DocxSlide';

export function openContextMenu(event: any, screenManager: ScreenManager) {
    const screenManagers = getAllScreenManagers();
    const selectedScreenIds = screenManagers
        .filter((screenManager1) => {
            return screenManager1.isSelected;
        })
        .map((screenManager1) => {
            return screenManager1.screenId;
        });
    const isSolo =
        selectedScreenIds.length === 1 &&
        selectedScreenIds.includes(screenManager.screenId);
    const isOne = screenManagers.length === 1;
    const { screenBibleManager } = screenManager;
    const isShowingBible = !!screenBibleManager.screenViewData;
    const isLineSync = screenBibleManager.isLineSync;
    const extraMenuItems: ContextMenuItemType[] = isShowingBible
        ? [
              {
                  childBefore: genContextMenuItemIcon('arrow-left-right'),
                  menuElement: tran(
                      `${isLineSync ? 'Unset' : 'Set'} Line Sync`,
                  ),
                  onSelect() {
                      screenBibleManager.isLineSync = !isLineSync;
                  },
              },
          ]
        : [];
    const menuItems: ContextMenuItemType[] = [
        ...(isOne || isSolo
            ? []
            : [
                  {
                      childBefore: genContextMenuItemIcon('bullseye'),
                      menuElement: tran('Solo'),
                      onSelect() {
                          const screenManagerBases =
                              getSelectedScreenManagerBases();
                          for (const screenManager1 of screenManagerBases) {
                              screenManager1.isSelected = false;
                          }
                          screenManager.isSelected = true;
                      },
                  },
              ]),
        ...(isOne
            ? []
            : [
                  {
                      childBefore: genContextMenuItemIcon(
                          screenManager.isSelected ? 'square' : 'check-square',
                      ),
                      menuElement: screenManager.isSelected
                          ? tran('Deselect')
                          : tran('Select'),
                      onSelect() {
                          screenManager.isSelected = !screenManager.isSelected;
                      },
                  },
                  {
                      childBefore: genContextMenuItemIcon('trash3', {
                          color: 'var(--bs-danger)',
                      }),
                      menuElement: tran('Delete'),
                      onSelect: () => {
                          // delete() awaits the settings sweep; without a
                          // catch a failed write would surface as an unhandled
                          // rejection instead of the app's error handler.
                          screenManager.delete().catch(handleError);
                      },
                  },
              ]),
        ...extraMenuItems,
        {
            childBefore: genContextMenuItemIcon('arrow-clockwise'),
            menuElement: tran('Refresh Preview'),
            onSelect() {
                for (const screenManager of getAllScreenManagers()) {
                    screenManager.fireRefreshEvent();
                }
            },
        },
    ];
    showAppContextMenu(event, menuItems);
}

function checkIsValidOnScreenEntry(item: any) {
    try {
        if (typeof item?.filePath !== 'string') {
            throw new TypeError('Invalid slide path');
        }
        if (
            !PdfSlide.tryValidate(item.itemJson) &&
            !PptxSlide.tryValidate(item.itemJson) &&
            !DocxSlide.tryValidate(item.itemJson)
        ) {
            Slide.validate(item.itemJson);
        }
        return true;
    } catch (_error) {
        return false;
    }
}

// Memoized on the raw setting string. This is the hottest settings read in the
// app: `toClassNameHighlight` reaches it for EVERY slide preview on screen, and
// the string it parses is 835 bytes for a plain slide but ~185 KB once a lyric
// slide is presented (open-lyric writes a full computed-style dump into the
// slide HTML). Un-memoized that was 264 MB of `JSON.parse` for a single click.
const readAppDocumentListOnScreen =
    genDerivedSettingReader<AppDocumentListType>(
        [
            screenManagerSettingNames.VARY_APP_DOCUMENT,
            screenManagerSettingNames.MANAGERS,
        ],
        ([str]) => {
            return deriveAppDocumentListOnScreen(str);
        },
    );

/**
 * A COPY every time on purpose: the persist paths (`set varySlideData` and its
 * siblings) read this map, add or delete their own screen's key and write the
 * whole thing back, so handing out the memoized object would let one present
 * corrupt what every later reader sees.
 */
export function getAppDocumentListOnScreenSetting(): AppDocumentListType {
    return { ...readAppDocumentListOnScreen() };
}

function deriveAppDocumentListOnScreen(str: string): AppDocumentListType {
    try {
        const json = parseJsonSafely(str, true);
        if (json === null) {
            return {};
        }
        // Validate PER ENTRY and drop only the bad ones. Rejecting the whole
        // map on one invalid entry was silent data loss: every caller that
        // persists (`set varySlideData`) does a read-modify-write on this map,
        // so a single stale entry wiped EVERY OTHER screen's presented slide on
        // the next present. The in-memory copy is not rebuilt, so the mini
        // preview kept looking right and the loss only surfaced after a reload
        // with that screen coming up blank mid-service.
        const validEntries: { [key: string]: any } = {};
        for (const [key, item] of Object.entries(json)) {
            if (checkIsValidOnScreenEntry(item)) {
                validEntries[key] = item;
                continue;
            }
            handleError(
                new Error(
                    'Dropping invalid on-screen slide entry for screen id: ' +
                        key,
                ),
            );
        }
        return getValidOnScreen(validEntries);
    } catch (error) {
        handleError(error);
    }
    return {};
}
