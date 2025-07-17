import { useMemo } from 'react';
import { saveBibleItem } from '../bible-list/bibleHelpers';
import BibleItem from '../bible-list/BibleItem';
import { useBibleItemsViewControllerContext } from '../bible-reader/BibleItemsViewController';
import LookupBibleItemController from '../bible-reader/LookupBibleItemController';
import appProvider from '../server/appProvider';
import { addBibleItemAndPresent } from './bibleActionHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genBibleItemCopyingContextMenu } from '../bible-list/bibleItemHelpers';

export function RenderCopyBibleItemActionButtonsComp({
    bibleItem,
}: Readonly<{ bibleItem: BibleItem }>) {
    return (
        <button
            type="button"
            className="btn btn-sm btn-success"
            title="`Copy"
            onClick={(event: any) => {
                showAppContextMenu(
                    event,
                    genBibleItemCopyingContextMenu(bibleItem),
                );
            }}
        >
            <i className="bi bi-copy" />
        </button>
    );
}

export default function RenderActionButtonsComp({
    bibleItem,
}: Readonly<{ bibleItem: BibleItem }>) {
    const viewController = useBibleItemsViewControllerContext();
    const isBibleLookup = useMemo(() => {
        return viewController instanceof LookupBibleItemController;
    }, [viewController]);
    return (
        <div className="btn-group mx-1">
            <RenderCopyBibleItemActionButtonsComp bibleItem={bibleItem} />
            <button
                type="button"
                className="btn btn-sm btn-info"
                title="`Split horizontal"
                onClick={() => {
                    viewController.addBibleItemLeft(bibleItem, bibleItem);
                }}
            >
                <i className="bi bi-vr" />
            </button>
            <button
                type="button"
                className="btn btn-sm btn-info"
                title="`Split vertical"
                onClick={() => {
                    viewController.addBibleItemBottom(bibleItem, bibleItem);
                }}
            >
                <i className="bi bi-hr" />
            </button>
            {isBibleLookup ? (
                <>
                    <button
                        type="button"
                        className="btn btn-sm btn-info"
                        title="`Save bible item"
                        onClick={() => {
                            const lookupViewController =
                                viewController as LookupBibleItemController;
                            saveBibleItem(
                                bibleItem,
                                lookupViewController.onLookupSaveBibleItem,
                            );
                        }}
                    >
                        <i className="bi bi-floppy" />
                    </button>
                    {appProvider.isPagePresenter ? (
                        <button
                            type="button"
                            className="btn btn-sm btn-info"
                            title="`Save bible item and show on screen"
                            onClick={(event) => {
                                const lookupViewController =
                                    viewController as LookupBibleItemController;
                                addBibleItemAndPresent(
                                    event,
                                    bibleItem,
                                    lookupViewController.onLookupSaveBibleItem,
                                );
                            }}
                        >
                            <i className="bi bi-cast" />
                        </button>
                    ) : null}
                </>
            ) : null}
        </div>
    );
}
