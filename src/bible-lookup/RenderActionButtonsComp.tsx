import { tran } from '../lang/langHelpers';
import { saveBibleItem } from '../bible-list/bibleHelpers';
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
    return (
        <button
            className="btn btn-sm btn-success"
            type="button"
            title={tran('Copy')}
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
    return (
        <div className="btn-group mx-1">
            <RenderCopyBibleItemActionButtonsComp bibleItem={bibleItem} />
            <button
                type="button"
                className="btn btn-sm btn-info"
                title={tran('Split horizontal')}
                onClick={() => {
                    viewController.addBibleItemLeft(bibleItem, bibleItem);
                }}
            >
                <i className="bi bi-vr" />
            </button>
            <button
                className="btn btn-sm btn-info"
                type="button"
                title={tran('Split vertical')}
                onClick={() => {
                    viewController.addBibleItemBottom(bibleItem, bibleItem);
                }}
            >
                <i className="bi bi-hr" />
            </button>
            {viewController.isLookup ? (
                <>
                    <button
                        className="btn btn-sm btn-primary"
                        type="button"
                        title={tran('Save bible item')}
                        onClick={() => {
                            const lookupViewController =
                                viewController as LookupBibleItemController;
                            saveBibleItem(bibleItem, () => {
                                lookupViewController.onLookupSaveBibleItem();
                            });
                        }}
                    >
                        <i className="bi bi-floppy" />
                    </button>
                    {appProvider.isPagePresenter ? (
                        <button
                            className="btn btn-sm btn-primary"
                            type="button"
                            title={tran('Save bible item and show on screen')}
                            onClick={(event) => {
                                const lookupViewController =
                                    viewController as LookupBibleItemController;
                                addBibleItemAndPresent(event, bibleItem, () => {
                                    lookupViewController.onLookupSaveBibleItem();
                                });
                            }}
                        >
                            <i className="bi bi-cast" />
                        </button>
                    ) : null}
                </>
            ) : null}
            <button
                className="btn btn-sm btn-info"
                type="button"
                title={tran('Export to Word document')}
                onClick={() => {
                    bibleItem.exportToWordDocument();
                }}
            >
                <i className="bi bi-file-earmark-word" />
            </button>
        </div>
    );
}
