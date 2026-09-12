import './BibleKeySelectionComp.scss';

import { useCallback, type MouseEvent, type CSSProperties } from 'react';

import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import type { BibleMinimalInfoType } from '../helper/bible-helpers/bibleDownloadHelpers';
import { getAllLocalBibleInfoList } from '../helper/bible-helpers/bibleDownloadHelpers';
import { showAppAlert } from '../popup-widget/popupWidgetHelpers';
import type { LocaleType } from '../lang/langHelpers';
import { getLanguageTitle, tran } from '../lang/langHelpers';
import { elementDivider } from '../context-menu/AppContextMenuComp';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { getBibleInfo } from '../helper/bible-helpers/bibleInfoHelpers';
import { useAppStateAsync, useAppCurrentRef } from '../helper/appHooks';
import { openBibleSetting } from '../setting/settingHelpers';
import { useBibleFontFamily } from '../helper/bible-helpers/bibleStyleHelpers';
import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';

export async function genContextMenuBibleKeys(
    onSelect: (event: any, bibleKey: string) => void,
    excludeBibleKeys: string[] = [],
) {
    let localeBibleInfoList = await getAllLocalBibleInfoList();
    if (localeBibleInfoList === null) {
        showAppAlert(
            tran('Unable to get bible info list'),
            tran(
                'We were sorry, but we are unable to get bible list at the moment' +
                    ' please try again later',
            ),
        );
        return null;
    }
    localeBibleInfoList = localeBibleInfoList.filter((bibleInfo) => {
        return !excludeBibleKeys.includes(bibleInfo.key);
    });
    const localeBibleInfoMap: { [locale: string]: BibleMinimalInfoType[] } = {};
    for (const bibleInfo of localeBibleInfoList) {
        localeBibleInfoMap[bibleInfo.locale] ??= [];
        localeBibleInfoMap[bibleInfo.locale].push(bibleInfo);
    }
    const menuItems: ContextMenuItemType[] = [];
    let i = 0;
    for (const locale of Object.keys(localeBibleInfoMap).sort((a, b) =>
        a.localeCompare(b),
    )) {
        const bibleInfoList = localeBibleInfoMap[locale];
        const langTitle = getLanguageTitle(
            { locale: locale as LocaleType },
            true,
        );
        menuItems.push(
            ...(i++ > 0
                ? [
                      {
                          menuElement: elementDivider,
                      },
                  ]
                : []),
            {
                childBefore: genContextMenuItemIcon('translate'),
                menuElement: <span data-locale-ff={locale}>{langTitle}</span>,
                title: langTitle,
                disabled: true,
            },
            ...bibleInfoList.map((bibleInfo) => {
                const menuText = `(${bibleInfo.key}) ${bibleInfo.title}`;
                return {
                    childBefore: genContextMenuItemIcon('book'),
                    menuElement: (
                        <span data-locale-ff={bibleInfo.locale}>
                            {menuText}
                        </span>
                    ),
                    title: bibleInfo.title,
                    onSelect: (event1: any) => {
                        onSelect(event1, bibleInfo.key);
                    },
                };
            }),
        );
    }
    return menuItems;
}

export async function showBibleKeyOption(
    event: any,
    onSelect: (bibleKey: string, event: any) => void,
    excludeBibleKeys: string[] = [],
    title?: string,
) {
    const menuItems = await genContextMenuBibleKeys(
        (event: any, bibleKey: string) => {
            onSelect(bibleKey, event);
        },
        excludeBibleKeys,
    );
    if (menuItems === null) {
        return;
    }
    if (title !== undefined) {
        menuItems.unshift(
            {
                childBefore: genContextMenuItemIcon('lightbulb'),
                menuElement: title,
                disabled: true,
            },
            {
                menuElement: elementDivider,
            },
        );
    }
    menuItems.push({
        childBefore: genContextMenuItemIcon('journal-arrow-down'),
        menuElement: (
            <span
                style={{
                    fontWeight: 'bold',
                    color: 'var(--bs-info-text-emphasis)',
                }}
            >
                {tran('Add New Bible')}
            </span>
        ),
        onSelect: () => {
            openBibleSetting();
        },
    });
    showAppContextMenu(event, menuItems);
}

function handleBibleKeySelectionMini(
    event: any,
    bibleKey: string,
    onChange: (oldBibleKey: string, newBibleKey: string) => void,
    title?: string,
) {
    event.stopPropagation();
    showBibleKeyOption(
        event,
        (newBibleKey: string) => {
            onChange(bibleKey, newBibleKey);
        },
        [bibleKey],
        title,
    );
}

function BibleKeyWithTileComp({ bibleKey }: Readonly<{ bibleKey: string }>) {
    const [bibleInfo] = useAppStateAsync(() => {
        return getBibleInfo(bibleKey);
    }, [bibleKey]);
    const fontFamily = useBibleFontFamily(bibleKey);
    return (
        <span title={bibleInfo?.title} style={{ fontFamily }}>
            {bibleKey}
        </span>
    );
}

export default function BibleKeySelectionComp({
    bibleKey,
    onBibleKeyChange,
}: Readonly<{
    bibleKey: string;
    onBibleKeyChange: (oldBibleKey: string, newBibleKey: string) => void;
}>) {
    const bibleKeyRef = useAppCurrentRef(bibleKey);
    const onBibleKeyChangeRef = useAppCurrentRef(onBibleKeyChange);
    const handleClick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
        handleBibleKeySelectionMini(
            event,
            bibleKeyRef.current,
            onBibleKeyChangeRef.current,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <button className="input-group-text" onClick={handleClick}>
            <BibleKeyWithTileComp bibleKey={bibleKey} />
            <i className="bi bi-chevron-down" />
        </button>
    );
}

export function BibleKeySelectionMiniComp({
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
    const bibleKeyRef = useAppCurrentRef(bibleKey);
    const onBibleKeyChangeRef = useAppCurrentRef(onBibleKeyChange);
    const handleClickEvent = useCallback((event: MouseEvent) => {
        if (onBibleKeyChangeRef.current === undefined) {
            return;
        }
        handleBibleKeySelectionMini(
            event,
            bibleKeyRef.current,
            onBibleKeyChangeRef.current.bind(null, false),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const contextMenuTitleRef = useAppCurrentRef(contextMenuTitle);
    const handleContextMenuEvent = useCallback((event: MouseEvent) => {
        if (onBibleKeyChangeRef.current === undefined) {
            return;
        }
        handleBibleKeySelectionMini(
            event,
            bibleKeyRef.current,
            onBibleKeyChangeRef.current.bind(null, true),
            contextMenuTitleRef.current,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const hasContextMenu = isHandleClickEvent && contextMenuTitle !== undefined;
    return (
        <span
            className={
                `bible-selector ${isHandleClickEvent ? 'pointer' : ''} ` +
                (isMinimal ? ' bg-info' : 'badge rounded-pill text-bg-info') +
                (hasContextMenu ? ' bible-selector-with-menu' : '')
            }
            style={{
                padding: '1px 2px',
                ...extraStyle,
            }}
            onClick={isHandleClickEvent ? handleClickEvent : undefined}
            onContextMenu={
                isHandleClickEvent ? handleContextMenuEvent : undefined
            }
        >
            <BibleKeyWithTileComp bibleKey={bibleKey} />
            {/* This chip is the one control in the app whose right-click is not
                its left-click: a click REPLACES the bible, a right-click ADDS an
                extra one to compare against. Nothing on the chip said so, and a
                touch screen cannot right-click at all.

                It rides INSIDE the chip, so the pill reads as one control with
                two doors rather than as a chip with a loose button beside it.
                Its own press never reaches the chip's `onClick` —
                `ContextMenuDotsButtonComp` stops the press — so the click that
                REPLACES the bible cannot fire from the button that ADDS one.

                Gated on `contextMenuTitle` rather than on a new flag, because
                that title IS the second menu's name and only the caller that has
                a second menu passes one. Every other site here answers a
                right-click with the same list a click gives, and a button for a
                duplicate would only crowd the chip. */}
            {hasContextMenu ? (
                <ContextMenuDotsButtonComp
                    onOpening={handleContextMenuEvent}
                    label={contextMenuTitle}
                />
            ) : null}
        </span>
    );
}
