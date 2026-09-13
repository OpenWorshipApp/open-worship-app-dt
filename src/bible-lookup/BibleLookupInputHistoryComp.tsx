import { type KeyboardEvent, useCallback, useState } from 'react';

import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
import { tran } from '../lang/langHelpers';
import { useAppEffect, useAppCurrentRef } from '../helper/appHooks';
import { genStringListSettingManager } from '../helper/SettingManager';
import { extractBibleTitle } from '../helper/bible-helpers/bibleLogicHelpers2';
import type LookupBibleItemController from '../bible-reader/LookupBibleItemController';
import { useLookupBibleItemControllerContext } from '../bible-reader/LookupBibleItemController';
import { bibleHistoryStore } from '../bible-reader/BibleItemsViewController';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { handleDragStart } from '../helper/dragHelpers';
import type BibleItem from '../bible-list/BibleItem';
import { genBibleItemCopyingContextMenu } from '../bible-list/bibleItemHelpers';
import { saveBibleItem } from '../bible-list/bibleHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { useBibleFontFamily } from '../helper/bible-helpers/bibleStyleHelpers';

const historyTextListSettingManager =
    genStringListSettingManager('history-text-list');
function useHistoryTextList(maxHistoryCount: number) {
    const [historyTextList, setHistoryTextList] = useState<string[]>(() => {
        return historyTextListSettingManager.getSetting();
    });
    const setHistoryTextList1 = (newHistoryTextList: string[]) => {
        setHistoryTextList(newHistoryTextList);
        historyTextListSettingManager.setSetting(newHistoryTextList);
    };
    useAppEffect(() => {
        bibleHistoryStore.addBibleItemHistory = (text: string) => {
            if (historyTextList.includes(text)) {
                return historyTextList;
            }
            let newHistory = [text, ...historyTextList];
            newHistory = newHistory.slice(0, maxHistoryCount);
            setHistoryTextList1(newHistory);
        };
        return () => {
            bibleHistoryStore.addBibleItemHistory = () => {};
        };
    }, [historyTextList]);
    return [historyTextList, setHistoryTextList1] as const;
}

function extractHistoryText(historyText: string) {
    const regex = /^\((.+)\)\s(.+)$/;
    const found = regex.exec(historyText);
    if (found === null) {
        return null;
    }
    const bibleKey = found[1];
    const bibleTitle = found[2];
    return {
        bibleKey,
        bibleTitle,
    };
}

async function getBibleItemFromHistoryText(historyText: string) {
    const extracted = extractHistoryText(historyText);
    if (extracted === null) {
        return null;
    }
    const { bibleKey, bibleTitle } = extracted;
    const { result } = await extractBibleTitle(bibleKey, bibleTitle);
    if (result.bibleItem === null) {
        return null;
    }
    return result.bibleItem;
}

async function openInBibleLookup(
    event: any,
    viewController: LookupBibleItemController,
    bibleItem: BibleItem,
) {
    event.preventDefault();
    if (event.shiftKey) {
        viewController.addBibleItemLeft(
            viewController.selectedBibleItem,
            viewController.selectedBibleItem,
        );
    }
    viewController.setLookupContentFromBibleItem(bibleItem);
}

function removeHistory(
    historyTextList: string[],
    historyText: string,
    setHistoryTextList: (newHistoryTextList: string[]) => void,
) {
    const newHistoryTextList = historyTextList.filter((historyText1) => {
        return historyText1 !== historyText;
    });
    setHistoryTextList(newHistoryTextList);
}

function openContextMenu(
    event: any,
    {
        viewController,
        bibleItem,
        remove,
    }: {
        viewController: LookupBibleItemController;
        bibleItem: BibleItem | null;
        remove: () => void;
    },
) {
    let contextMenuItems: ContextMenuItemType[] = [];
    if (bibleItem !== null) {
        contextMenuItems = [
            {
                childBefore: genContextMenuItemIcon('box-arrow-up-right'),
                menuElement: tran('Open'),
                onSelect: () => {
                    openInBibleLookup(event, viewController, bibleItem);
                },
            },
            ...genBibleItemCopyingContextMenu(bibleItem),
            {
                childBefore: genContextMenuItemIcon('floppy'),
                menuElement: tran('Save bible item'),
                onSelect: () => {
                    saveBibleItem(bibleItem);
                },
            },
        ];
    }
    contextMenuItems = [
        ...contextMenuItems,
        {
            childBefore: genContextMenuItemIcon('x-circle', {
                color: 'var(--bs-danger)',
            }),
            menuElement: tran('Remove'),
            onSelect: () => {
                remove();
            },
        },
    ];
    showAppContextMenu(event, contextMenuItems);
}

function RendHistoryItemComp({
    historyText,
    extracted,
    historyTextList,
    setHistoryTextList,
    handleContextMenuOpening,
    handleDoubleClicking,
}: Readonly<{
    historyText: string;
    extracted: { bibleKey: string; bibleTitle: string } | null;
    historyTextList: string[];
    setHistoryTextList: (newHistoryTextList: string[]) => void;
    handleContextMenuOpening: (historyText: string, event: any) => void;
    handleDoubleClicking: (historyText: string, event: any) => void;
}>) {
    const fontFamily = useBibleFontFamily(extracted?.bibleKey ?? '');
    const historyTextListRef = useAppCurrentRef(historyTextList);
    const historyTextRef = useAppCurrentRef(historyText);
    const setHistoryTextListRef = useAppCurrentRef(setHistoryTextList);
    const handleContextMenuOpeningRef = useAppCurrentRef(
        handleContextMenuOpening,
    );
    const handleDoubleClickingRef = useAppCurrentRef(handleDoubleClicking);
    const handleRemoveHistory = useCallback((event: any) => {
        // A quick second press on ✕ must not also double-click the row it
        // sits in, which would reopen the passage it has just removed.
        event.stopPropagation();
        removeHistory(
            historyTextListRef.current,
            historyTextRef.current,
            setHistoryTextListRef.current,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // The row's action is a double-click, which no keyboard can make. Enter
    // and Space on the label do exactly what it does, Shift included (put back
    // split) -- without handing the MOUSE a single-click action it never had.
    const handleLabelKeyDown = useCallback(
        (event: KeyboardEvent<HTMLButtonElement>) => {
            if ((event.key !== 'Enter' && event.key !== ' ') || event.repeat) {
                return;
            }
            event.preventDefault();
            handleDoubleClickingRef.current(historyTextRef.current, event);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleMenuOpening = useCallback((event: any) => {
        handleContextMenuOpeningRef.current(historyTextRef.current, event);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        // A plain box, no longer a `<button>`: it holds three controls, and a
        // button may not hold another. The ⋮ used to be a `span` passing for a
        // button (its words leaked into the row's name), the ✕ was not a
        // control at all, and the row itself did nothing on Enter.
        <div
            className={
                'btn btn-sm d-flex align-items-center app-border-white-round' +
                ' mx-1 p-0'
            }
            title={
                'Double click to put back, shift double click to ' +
                'put back split'
            }
            style={{ height: '27px', fontFamily }}
            draggable
            onDragStart={async (event: any) => {
                const bibleItem =
                    await getBibleItemFromHistoryText(historyText);
                if (bibleItem === null) {
                    return;
                }
                handleDragStart(event, bibleItem);
            }}
            onContextMenu={handleContextMenuOpening.bind(null, historyText)}
            onDoubleClick={handleDoubleClicking.bind(null, historyText)}
        >
            <button
                type="button"
                className="border-0 bg-transparent p-0"
                title={tran('Remove')}
                aria-label={tran('Remove')}
                // Out of the Tab order: the row's ⋮ menu offers Remove as well,
                // and three stops for every one of twenty entries would make
                // the strip a wall to tab through.
                tabIndex={-1}
                style={{ color: 'red', lineHeight: 1 }}
                onClick={handleRemoveHistory}
                onDoubleClick={(event) => {
                    event.stopPropagation();
                }}
            >
                <small>
                    <i className="bi bi-x" aria-hidden="true" />
                </small>
            </button>
            <button
                type="button"
                className="d-flex flex-fill border-0 bg-transparent p-0 text-reset"
                style={{ minWidth: 0 }}
                onKeyDown={handleLabelKeyDown}
            >
                <small className="flex-fill app-ellipsis">{historyText}</small>
            </button>
            <ContextMenuDotsButtonComp onOpening={handleMenuOpening} />
        </div>
    );
}

export default function BibleLookupInputHistoryComp({
    maxHistoryCount = 20,
}: Readonly<{
    maxHistoryCount?: number;
}>) {
    const viewController = useLookupBibleItemControllerContext();
    const [historyTextList, setHistoryTextList] =
        useHistoryTextList(maxHistoryCount);
    const viewControllerRef = useAppCurrentRef(viewController);
    const historyTextListRef = useAppCurrentRef(historyTextList);
    const setHistoryTextListRef = useAppCurrentRef(setHistoryTextList);
    const handleContextMenuOpening = useCallback(
        async (historyText: string, event: any) => {
            const bibleItem = await getBibleItemFromHistoryText(historyText);
            openContextMenu(event, {
                viewController: viewControllerRef.current,
                bibleItem,
                remove: () => {
                    removeHistory(
                        historyTextListRef.current,
                        historyText,
                        setHistoryTextListRef.current,
                    );
                },
            });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleDoubleClicking = useCallback(
        async (historyText: string, event: any) => {
            const bibleItem = await getBibleItemFromHistoryText(historyText);
            if (bibleItem === null) {
                return;
            }
            openInBibleLookup(event, viewControllerRef.current, bibleItem);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    return (
        <div
            className="h-100 d-flex rounded px-1 me-1 app-inner-shadow"
            style={{
                overflowX: 'auto',
                overflowY: 'hidden',
                minWidth: '150px',
                paddingTop: '2px',
            }}
        >
            {historyTextList.map((historyText) => {
                const extracted = extractHistoryText(historyText);
                return (
                    <RendHistoryItemComp
                        key={historyText}
                        historyText={historyText}
                        extracted={extracted}
                        historyTextList={historyTextList}
                        setHistoryTextList={setHistoryTextList}
                        handleContextMenuOpening={handleContextMenuOpening}
                        handleDoubleClicking={handleDoubleClicking}
                    />
                );
            })}
        </div>
    );
}
