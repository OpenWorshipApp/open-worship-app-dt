import './BibleSelectionComp.scss';

import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import { useLocalBibleInfoList } from '../setting/bible-setting/bibleSettingHelpers';
import {
    BibleMinimalInfoType,
    getAllLocalBibleInfoList,
} from '../helper/bible-helpers/bibleDownloadHelpers';
import { showAppAlert } from '../popup-widget/popupWidgetHelpers';
import { getFontFamily, LocaleType } from '../lang/langHelpers';
import { elementDivider } from '../context-menu/AppContextMenuComp';

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
    showAppContextMenu(event, menuItems);
}

function handleClickEvent(
    event: any,
    bibleKey: string,
    onChange: (oldBibleKey: string, newBibleKey: string) => void,
) {
    event.stopPropagation();
    showBibleOption(
        event,
        (newBibleKey: string) => {
            onChange(bibleKey, newBibleKey);
        },
        [bibleKey],
    );
}

export default function BibleSelectionComp({
    bibleKey,
    onBibleKeyChange,
}: Readonly<{
    bibleKey: string;
    onBibleKeyChange: (oldBibleKey: string, newBibleKey: string) => void;
}>) {
    const [bibleInfoList] = useLocalBibleInfoList();
    if (bibleInfoList === null) {
        return <div>Loading ...</div>;
    }
    if (bibleInfoList === undefined) {
        return <div className="alert alert-danger">Error</div>;
    }
    return (
        <button
            className="input-group-text"
            onClick={(event) => {
                handleClickEvent(event, bibleKey, onBibleKeyChange);
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
}: Readonly<{
    bibleKey: string;
    onBibleKeyChange?: (oldBibleKey: string, newBibleKey: string) => void;
    isMinimal?: boolean;
}>) {
    const [bibleInfoList] = useLocalBibleInfoList();
    if (bibleInfoList === null) {
        return <div>...</div>;
    }
    if (bibleInfoList === undefined) {
        return <div className="badge rounded-pill text-bg-danger">Error</div>;
    }
    const isHandleClickEvent = onBibleKeyChange !== undefined;
    return (
        <span
            className={
                `bible-selector ${isHandleClickEvent ? 'pointer' : ''} ` +
                (isMinimal ? ' bg-info' : 'badge rounded-pill text-bg-info')
            }
            onClick={
                isHandleClickEvent
                    ? (event) => {
                          handleClickEvent(event, bibleKey, onBibleKeyChange);
                      }
                    : undefined
            }
        >
            <BibleKeyWithTileComp bibleKey={bibleKey} />
        </span>
    );
}

function BibleKeyWithTileComp({ bibleKey }: Readonly<{ bibleKey: string }>) {
    const [bibleInfoList] = useLocalBibleInfoList();
    const currentBibleInfo = bibleInfoList?.find(
        (bibleInfo) => bibleInfo.key === bibleKey,
    );
    return (
        <span title={currentBibleInfo?.title} data-bible-key={bibleKey}>
            {bibleKey}
        </span>
    );
}
