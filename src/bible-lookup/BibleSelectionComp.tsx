import './BibleSelectionComp.scss';

import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import {
    BibleMinimalInfoType,
    getAllLocalBibleInfoList,
} from '../helper/bible-helpers/bibleDownloadHelpers';
import { showAppAlert } from '../popup-widget/popupWidgetHelpers';
import { getFontFamily, LocaleType } from '../lang/langHelpers';
import { elementDivider } from '../context-menu/AppContextMenuComp';
import { getBibleInfo } from '../helper/bible-helpers/bibleInfoHelpers';
import { useAppStateAsync } from '../helper/debuggerHelpers';
import { CSSProperties } from 'react';

export async function genContextMenuBibleKeys(
    onSelect: (event: any, bibleKey: string) => void,
    excludeBibleKeys: string[] = [],
) {
    let localeBibleInfoList = await getAllLocalBibleInfoList();
    if (localeBibleInfoList === null) {
        showAppAlert(
            'Unable to get bible info list',
            'We were sorry, but we are unable to get bible list at the moment' +
                ' please try again later',
        );
        return null;
    }
    localeBibleInfoList = localeBibleInfoList.filter((bibleInfo) => {
        return !excludeBibleKeys.includes(bibleInfo.key);
    });
    const localeBibleInfoMap: { [locale: string]: BibleMinimalInfoType[] } = {};
    localeBibleInfoList.forEach((bibleInfo) => {
        localeBibleInfoMap[bibleInfo.locale] ??= [];
        localeBibleInfoMap[bibleInfo.locale].push(bibleInfo);
    });
    const locales = Object.keys(localeBibleInfoMap);
    const localeFontFamilyMap = Object.fromEntries(
        (
            await Promise.all(
                locales.map((locale) => {
                    return getFontFamily(locale as LocaleType);
                }),
            )
        ).map((fontFamily, index) => {
            const locale = locales[index];
            return [locale, fontFamily];
        }),
    );
    const menuItems: ContextMenuItemType[] = [];
    let i = 0;
    for (const locale of Object.keys(localeBibleInfoMap).sort((a, b) =>
        a.localeCompare(b),
    )) {
        const bibleInfoList = localeBibleInfoMap[locale];
        menuItems.push(
            ...(i++ > 0
                ? [
                      {
                          menuElement: elementDivider,
                      },
                  ]
                : []),
            ...[
                {
                    menuElement: locale,
                    disabled: true,
                },
                ...bibleInfoList.map((bibleInfo) => {
                    return {
                        menuElement: `(${bibleInfo.key}) ${bibleInfo.title}`,
                        title: bibleInfo.title,
                        onSelect: (event1: any) => {
                            onSelect(event1, bibleInfo.key);
                        },
                        style: {
                            fontFamily: localeFontFamilyMap[locale],
                        },
                    };
                }),
            ],
        );
    }
    return menuItems;
}

export async function showBibleOption(
    event: any,
    onSelect: (bibleKey: string) => void,
    excludeBibleKeys: string[] = [],
    title?: string,
) {
    const menuItems = await genContextMenuBibleKeys(
        (_: any, bibleKey: string) => {
            onSelect(bibleKey);
        },
        excludeBibleKeys,
    );
    if (menuItems === null) {
        return;
    }
    if (title !== undefined) {
        menuItems.unshift(
            {
                menuElement: title,
                disabled: true,
            },
            {
                menuElement: elementDivider,
            },
        );
    }
    showAppContextMenu(event, menuItems);
}

function handleBibleSelectionMini(
    event: any,
    bibleKey: string,
    onChange: (oldBibleKey: string, newBibleKey: string) => void,
    title?: string,
) {
    event.stopPropagation();
    showBibleOption(
        event,
        (newBibleKey: string) => {
            onChange(bibleKey, newBibleKey);
        },
        [bibleKey],
        title,
    );
}

export default function BibleSelectionComp({
    bibleKey,
    onBibleKeyChange,
}: Readonly<{
    bibleKey: string;
    onBibleKeyChange: (oldBibleKey: string, newBibleKey: string) => void;
}>) {
    return (
        <button
            className="input-group-text"
            onClick={(event) => {
                handleBibleSelectionMini(event, bibleKey, onBibleKeyChange);
            }}
        >
            <BibleKeyWithTileComp bibleKey={bibleKey} />
            <i className="bi bi-chevron-down" />
        </button>
    );
}

export function BibleSelectionMiniComp({
    bibleKey,
    onBibleKeyChange,
    isMinimal,
    contextMenuTitle,
    extraStyle = {},
}: Readonly<{
    bibleKey: string;
    onBibleKeyChange?: (
        isContextMenu: boolean,
        oldBibleKey: string,
        newBibleKey: string,
    ) => void;
    isMinimal?: boolean;
    contextMenuTitle?: string;
    extraStyle?: CSSProperties;
}>) {
    const isHandleClickEvent = onBibleKeyChange !== undefined;
    return (
        <span
            className={
                `bible-selector ${isHandleClickEvent ? 'pointer' : ''} ` +
                (isMinimal ? ' bg-info' : 'badge rounded-pill text-bg-info')
            }
            style={{
                paddingLeft: isMinimal ? '2px' : '6px',
                paddingRight: isMinimal ? '2px' : '6px',
                ...extraStyle,
            }}
            onClick={
                isHandleClickEvent
                    ? (event) => {
                          handleBibleSelectionMini(
                              event,
                              bibleKey,
                              onBibleKeyChange.bind(null, false),
                          );
                      }
                    : undefined
            }
            onContextMenu={
                isHandleClickEvent
                    ? (event) => {
                          handleBibleSelectionMini(
                              event,
                              bibleKey,
                              onBibleKeyChange.bind(null, true),
                              contextMenuTitle,
                          );
                      }
                    : undefined
            }
        >
            <BibleKeyWithTileComp bibleKey={bibleKey} />
        </span>
    );
}

function BibleKeyWithTileComp({ bibleKey }: Readonly<{ bibleKey: string }>) {
    const [bibleInfo] = useAppStateAsync(() => {
        return getBibleInfo(bibleKey);
    }, [bibleKey]);
    return (
        <span title={bibleInfo?.title} data-bible-key={bibleKey}>
            {bibleKey}
        </span>
    );
}
