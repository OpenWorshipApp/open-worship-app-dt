import { useCallback } from 'react';

import { tran } from '../lang/langHelpers';
import {
    exportToWordDocument,
    saveBibleItem,
} from '../bible-list/bibleHelpers';
import type BibleItem from '../bible-list/BibleItem';
import { useBibleItemsViewControllerContext } from '../bible-reader/BibleItemsViewController';
import type LookupBibleItemController from '../bible-reader/LookupBibleItemController';
import appProvider from '../server/appProvider';
import { addBibleItemAndPresent } from './bibleActionHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genBibleItemCopyingContextMenu } from '../bible-list/bibleItemHelpers';

export function RenderCopyBibleItemActionButtonsComp({
    bibleItem,
}: Readonly<{ bibleItem: BibleItem }>) {
    const handleCopying = useCallback(
        (event: any) => {
            showAppContextMenu(
                event,
                genBibleItemCopyingContextMenu(bibleItem),
            );
        },
        [bibleItem],
    );
    return (
        <button
            className="btn btn-sm btn-success"
            type="button"
            title={tran('Copy')}
            onClick={handleCopying}
        >
            <i className="bi bi-copy" />
        </button>
    );
}

export default function RenderActionButtonsComp({
    bibleItem,
}: Readonly<{ bibleItem: BibleItem }>) {
    const viewController = useBibleItemsViewControllerContext();
    const handleSplitHorizontal = useCallback(() => {
        viewController.addBibleItemLeft(bibleItem, bibleItem);
    }, [viewController, bibleItem]);
    const handleSplitVertical = useCallback(() => {
        viewController.addBibleItemBottom(bibleItem, bibleItem);
    }, [viewController, bibleItem]);
    const handleSaveBibleItem = useCallback(() => {
        const lookupViewController =
            viewController as LookupBibleItemController;
        saveBibleItem(bibleItem, () => {
            lookupViewController.onLookupSaveBibleItem();
        });
    }, [viewController, bibleItem]);
    const handleSaveAndPresent = useCallback(
        (event: any) => {
            const lookupViewController =
                viewController as LookupBibleItemController;
            addBibleItemAndPresent(event, bibleItem, () => {
                lookupViewController.onLookupSaveBibleItem();
            });
        },
        [viewController, bibleItem],
    );
    const handleExportToWord = useCallback(() => {
        exportToWordDocument([bibleItem]);
    }, [bibleItem]);
    return (
        <div className="btn-group mx-1">
            <RenderCopyBibleItemActionButtonsComp bibleItem={bibleItem} />
            <button
                type="button"
                className="btn btn-sm btn-info"
                title={tran('Split horizontal')}
                onClick={handleSplitHorizontal}
            >
                <i className="bi bi-vr" />
            </button>
            <button
                className="btn btn-sm btn-info"
                type="button"
                title={tran('Split vertical')}
                onClick={handleSplitVertical}
            >
                <i className="bi bi-hr" />
            </button>
            {viewController.isLookup ? (
                <>
                    <button
                        className="btn btn-sm btn-primary"
                        type="button"
                        title={tran('Save bible item')}
                        onClick={handleSaveBibleItem}
                    >
                        <i className="bi bi-floppy" />
                    </button>
                    {appProvider.isPagePresenter ? (
                        <button
                            className="btn btn-sm btn-primary"
                            type="button"
                            title={tran('Save bible item and show on screen')}
                            onClick={handleSaveAndPresent}
                        >
                            <i className="bi bi-cast" />
                        </button>
                    ) : null}
                </>
            ) : null}
            <button
                className="btn btn-sm btn-secondary"
                type="button"
                title={tran('Export to MS Word')}
                onClick={handleExportToWord}
            >
                <i
                    className="bi bi-file-earmark-word"
                    style={{
                        color: 'blue',
                    }}
                />
            </button>
        </div>
    );
}
