import { screenManagerSettingNames } from '../../helper/constants';
import { handleError } from '../../helper/errorHelpers';
import { isValidJson } from '../../helper/helpers';
import { getSetting } from '../../helper/settingHelpers';
import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../../context-menu/appContextMenuHelpers';
import Slide from '../../app-document-list/Slide';
import ScreenManager from '../managers/ScreenManager';
import {
    getSelectedScreenManagerBases,
    getValidOnScreen,
} from '../managers/screenManagerBaseHelpers';
import { getAllScreenManagers } from '../managers/screenManagerHelpers';
import PdfSlide from '../../app-document-list/PdfSlide';
import { AppDocumentListType } from '../screenAppDocumentTypeHelpers';

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
                  menuElement: `${isLineSync ? 'Unset' : 'Set'} Line Sync`,
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
                      menuElement: 'Solo',
                      onSelect() {
                          const screenManagerBases =
                              getSelectedScreenManagerBases();
                          screenManagerBases.forEach((screenManager1) => {
                              screenManager1.isSelected = false;
                          });
                          screenManager.isSelected = true;
                      },
                  },
              ]),
        ...(isOne
            ? []
            : [
                  {
                      menuElement: screenManager.isSelected
                          ? 'Deselect'
                          : 'Select',
                      onSelect() {
                          screenManager.isSelected = !screenManager.isSelected;
                      },
                  },
                  {
                      menuElement: 'Delete',
                      onSelect: () => {
                          screenManager.delete();
                      },
                  },
              ]),
        ...extraMenuItems,
        {
            menuElement: 'Refresh Preview',
            onSelect() {
                getAllScreenManagers().forEach((screenManager) => {
                    screenManager.fireRefreshEvent();
                });
            },
        },
    ];
    showAppContextMenu(event, menuItems);
}

export function getAppDocumentListOnScreenSetting(): AppDocumentListType {
    const str = getSetting(screenManagerSettingNames.VARY_APP_DOCUMENT) ?? '';
    try {
        if (!isValidJson(str, true)) {
            return {};
        }
        const json = JSON.parse(str);
        Object.values(json).forEach((item: any) => {
            if (typeof item.filePath !== 'string') {
                throw new Error('Invalid slide path');
            }
            if (!PdfSlide.tryValidate(item.itemJson)) {
                Slide.validate(item.itemJson);
            }
        });
        return getValidOnScreen(json);
    } catch (error) {
        handleError(error);
    }
    return {};
}
