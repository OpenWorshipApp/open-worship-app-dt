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
import { useAppCurrentRef } from '../helper/appHooks';
import { getIsAIEnabled } from '../helper/ai/aiHelpers';
import { handleError } from '../helper/errorHelpers';
import { CanvasBibleItemEventListener } from '../slide-editor/canvas/canvasBibleItemHelpers';

export function RenderCopyBibleItemActionButtonsComp({
    bibleItem,
}: Readonly<{ bibleItem: BibleItem }>) {
    const bibleItemRef = useAppCurrentRef(bibleItem);
    const handleCopying = useCallback((event: any) => {
        showAppContextMenu(
            event,
            genBibleItemCopyingContextMenu(bibleItemRef.current),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <button
            className="btn btn-sm btn-success"
            type="button"
            title={tran('Copy')}
            aria-label={tran('Copy')}
            onClick={handleCopying}
        >
            <i className="bi bi-copy" />
        </button>
    );
}

/**
 * The 🤖 at the end of a Bible view's toolbar (2026-10-18, the user's
 * picture of that toolbar circled: _add robot icon to part of the icon … to
 * open the verse in chatbot like open from floating verse detail panel_):
 * the passage the view shows, opened in the assistant the way a verse
 * panel's 🤖 opens it (`bibleItemAskHelpers.ts`). Drawn only while AI is on,
 * like that one.
 */
export function RenderAskAssistantBibleItemButtonComp({
    bibleItem,
}: Readonly<{ bibleItem: BibleItem }>) {
    const bibleItemRef = useAppCurrentRef(bibleItem);
    const handleAsking = useCallback(() => {
        // Loaded at the press: nothing a pane of verses needs until then.
        import('../helper/ai/bibleItemAskHelpers')
            .then(({ openChatbotWithBibleItem }) => {
                return openChatbotWithBibleItem(bibleItemRef.current);
            })
            .catch(handleError);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    if (!getIsAIEnabled()) {
        return null;
    }
    const label = tran('Ask the Assistant About This Passage');
    return (
        <button
            className="btn btn-sm btn-secondary"
            type="button"
            title={label}
            aria-label={label}
            onClick={handleAsking}
        >
            <i className="bi bi-robot" />
        </button>
    );
}

export default function RenderActionButtonsComp({
    bibleItem,
}: Readonly<{ bibleItem: BibleItem }>) {
    const viewController = useBibleItemsViewControllerContext();
    const viewControllerRef = useAppCurrentRef(viewController);
    const bibleItemRef = useAppCurrentRef(bibleItem);
    const handleSplitHorizontal = useCallback((event: any) => {
        viewControllerRef.current.splitBibleItemOnPress(
            event,
            bibleItemRef.current,
            true,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleSplitVertical = useCallback((event: any) => {
        viewControllerRef.current.splitBibleItemOnPress(
            event,
            bibleItemRef.current,
            false,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // In a colour group the split asks which version first, and the buttons
    // say so: they are the menu's `… to` items then.
    const isAskingBibleKey =
        viewController.checkIsSplitAskingBibleKey(bibleItem);
    const splitHorizontalLabel = isAskingBibleKey
        ? tran('Split Horizontal to')
        : tran('Split horizontal');
    const splitVerticalLabel = isAskingBibleKey
        ? tran('Split Vertical to')
        : tran('Split vertical');
    const handleSaveBibleItem = useCallback(() => {
        const lookupViewController =
            viewControllerRef.current as LookupBibleItemController;
        saveBibleItem(bibleItemRef.current, () => {
            lookupViewController.onLookupSaveBibleItem();
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleSaveAndPresent = useCallback((event: any) => {
        const lookupViewController =
            viewControllerRef.current as LookupBibleItemController;
        addBibleItemAndPresent(event, bibleItemRef.current, () => {
            lookupViewController.onLookupSaveBibleItem();
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleExportToWord = useCallback(() => {
        exportToWordDocument([bibleItemRef.current]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleBibleItemInserting = useCallback(() => {
        const lookupViewController =
            viewControllerRef.current as LookupBibleItemController;
        CanvasBibleItemEventListener.insertBibleItem(bibleItemRef.current);
        lookupViewController.onLookupSaveBibleItem();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="btn-group">
            <RenderCopyBibleItemActionButtonsComp bibleItem={bibleItem} />
            <button
                type="button"
                className="btn btn-sm btn-info"
                title={splitHorizontalLabel}
                aria-label={splitHorizontalLabel}
                aria-haspopup={isAskingBibleKey ? 'menu' : undefined}
                onClick={handleSplitHorizontal}
            >
                <i className="bi bi-vr" />
            </button>
            <button
                className="btn btn-sm btn-info"
                type="button"
                title={splitVerticalLabel}
                aria-label={splitVerticalLabel}
                aria-haspopup={isAskingBibleKey ? 'menu' : undefined}
                onClick={handleSplitVertical}
            >
                <i className="bi bi-hr" />
            </button>
            {!viewController.isMinimized && viewController.isLookup ? (
                <>
                    <button
                        className="btn btn-sm btn-primary"
                        type="button"
                        title={tran('Save bible item')}
                        aria-label={tran('Save bible item')}
                        onClick={handleSaveBibleItem}
                    >
                        <i className="bi bi-floppy" />
                    </button>
                    {appProvider.isPagePresenter ? (
                        <button
                            className="btn btn-sm btn-primary"
                            type="button"
                            title={tran('Save bible item and show on screen')}
                            aria-label={tran(
                                'Save bible item and show on screen',
                            )}
                            onClick={handleSaveAndPresent}
                        >
                            <i className="bi bi-cast" />
                        </button>
                    ) : null}
                    {appProvider.isPageAppDocumentEditor ? (
                        <button
                            className="btn btn-sm btn-primary"
                            type="button"
                            title={tran(
                                'Insert bible item into selected slide',
                            )}
                            aria-label={tran(
                                'Insert bible item into selected slide',
                            )}
                            onClick={handleBibleItemInserting}
                        >
                            <i className="bi bi-file-earmark-slides" />
                        </button>
                    ) : null}
                    <button
                        className="btn btn-sm btn-secondary"
                        type="button"
                        title={tran('Export to MS Word')}
                        aria-label={tran('Export to MS Word')}
                        onClick={handleExportToWord}
                    >
                        <i className="bi bi-file-earmark-word" />
                    </button>
                </>
            ) : null}
            <RenderAskAssistantBibleItemButtonComp bibleItem={bibleItem} />
            {viewController.extraActionButtons}
        </div>
    );
}
