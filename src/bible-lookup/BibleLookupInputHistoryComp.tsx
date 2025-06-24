import { useState } from 'react';

import { useAppEffect } from '../helper/debuggerHelpers';
import { getSetting, setSetting } from '../helper/settingHelpers';
import { extractBibleTitle } from '../helper/bible-helpers/serverBibleHelpers2';
import LookupBibleItemController, {
    useLookupBibleItemControllerContext,
} from '../bible-reader/LookupBibleItemController';
import { historyStore } from '../bible-reader/BibleItemsViewController';
import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import { handleDragStart } from '../helper/dragHelpers';
import BibleItem from '../bible-list/BibleItem';
import { genDefaultBibleItemContextMenu } from '../bible-list/bibleItemHelpers';
import { saveBibleItem } from '../bible-list/bibleHelpers';
import { genContextMenuItemIcon } from '../context-menu/AppContextMenuComp';

const HISTORY_TEXT_LIST_SETTING_NAME = 'history-text-list';
function useHistoryTextList(maxHistoryCount: number) {
    const historyTextListJson = getSetting(
        HISTORY_TEXT_LIST_SETTING_NAME,
        '[]',
    );
    const defaultHistoryTextList = JSON.parse(historyTextListJson) as string[];
    const [historyTextList, setHistoryTextList] = useState<string[]>(
        defaultHistoryTextList,
    );
    const setHistoryTextList1 = (newHistoryTextList: string[]) => {
        setHistoryTextList(newHistoryTextList);
        setSetting(
            HISTORY_TEXT_LIST_SETTING_NAME,
            JSON.stringify(newHistoryTextList),
        );
    };
    useAppEffect(() => {
        historyStore.addHistory = (text: string) => {
            if (historyTextList.includes(text)) {
                return historyTextList;
            }
            let newHistory = [text, ...historyTextList];
            newHistory = newHistory.slice(0, maxHistoryCount);
            setHistoryTextList1(newHistory);
        };
        return () => {
            historyStore.addHistory = () => {};
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
    const contextMenuItems: ContextMenuItemType[] = [];
    if (bibleItem !== null) {
        contextMenuItems.push({
            menuElement: '`Open',
            onSelect: () => {
                openInBibleLookup(event, viewController, bibleItem);
            },
        });
        contextMenuItems.push(...genDefaultBibleItemContextMenu(bibleItem));
        contextMenuItems.push({
            childBefore: genContextMenuItemIcon('floppy'),
            menuElement: '`Save bible item',
            onSelect: () => {
                saveBibleItem(bibleItem);
            },
        });
    }
    contextMenuItems.push({
        menuElement: '`Remove',
        onSelect: () => {
            remove();
        },
    });
    showAppContextMenu(event, contextMenuItems);
}

export default function BibleLookupInputHistoryComp({
    maxHistoryCount = 20,
}: Readonly<{
    maxHistoryCount?: number;
}>) {
    const viewController = useLookupBibleItemControllerContext();
    const [historyTextList, setHistoryTextList] =
        useHistoryTextList(maxHistoryCount);
    const handleContextMenuOpening = async (
        historyText: string,
        event: any,
    ) => {
        const bibleItem = await getBibleItemFromHistoryText(historyText);
        openContextMenu(event, {
            viewController,
            bibleItem,
            remove: () => {
                removeHistory(historyTextList, historyText, setHistoryTextList);
            },
        });
    };
    const handleDoubleClicking = async (historyText: string, event: any) => {
        const bibleItem = await getBibleItemFromHistoryText(historyText);
        if (bibleItem === null) {
            return;
        }
        openInBibleLookup(event, viewController, bibleItem);
    };
    return (
        <div
            className="d-flex shadow-sm rounded px-1 me-1"
            style={{
                overflowX: 'auto',
                overflowY: 'hidden',
                minWidth: '150px',
            }}
        >
            {historyTextList.map((historyText) => {
                const extracted = extractHistoryText(historyText);
                return (
                    <button
                        key={historyText}
                        data-bible-key={extracted?.bibleKey ?? ''}
                        title={
                            'Double click to put back, shift double click to ' +
                            'put back split'
                        }
                        className="btn btn-sm d-flex app-border-white-round"
                        style={{ height: '25px' }}
                        draggable
                        onDragStart={async (event: any) => {
                            const bibleItem =
                                await getBibleItemFromHistoryText(historyText);
                            if (bibleItem === null) {
                                return;
                            }
                            handleDragStart(event, bibleItem);
                        }}
                        onContextMenu={handleContextMenuOpening.bind(
                            null,
                            historyText,
                        )}
                        onDoubleClick={handleDoubleClicking.bind(
                            null,
                            historyText,
                        )}
                    >
                        <small
                            title="Remove"
                            style={{ color: 'red' }}
                            onClick={() => {
                                removeHistory(
                                    historyTextList,
                                    historyText,
                                    setHistoryTextList,
                                );
                            }}
                        >
                            <i className="bi bi-x" />
                        </small>
                        <small className="flex-fill">{historyText}</small>
                    </button>
                );
            })}
        </div>
    );
}
