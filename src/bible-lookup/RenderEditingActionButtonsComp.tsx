import { useCallback, useRef, type MouseEvent } from 'react';

import {
    toShortcutKey,
    useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import {
    exportToWordDocument,
    saveBibleItem,
} from '../bible-list/bibleHelpers';
import type BibleItem from '../bible-list/BibleItem';
import appProvider from '../server/appProvider';
import {
    splitEventMappers,
    splitHorizontalEventMapper,
    splitVerticalEventMapper,
    useLookupBibleItemControllerContext,
} from '../bible-reader/LookupBibleItemController';
import {
    addBibleItemAndPresent,
    ctrlEnterEventMapper,
    ctrlShiftEnterEventMapper,
    showAddingBibleItemFail,
} from './bibleActionHelpers';
import { RenderCopyBibleItemActionButtonsComp } from './RenderActionButtonsComp';
import { tran } from '../lang/langHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { CanvasBibleItemEventListener } from '../slide-editor/canvas/canvasBibleItemHelpers';
import { createMouseEventUnder } from '../context-menu/contextMenuEventHelpers';

function SaveButtonComp({
    handleSaveBibleItem,
    bibleItem,
}: Readonly<{ bibleItem: BibleItem; handleSaveBibleItem: () => void }>) {
    const viewController = useLookupBibleItemControllerContext();
    useKeyboardRegistering(
        [ctrlEnterEventMapper],
        async () => {
            const addedBibleItem = await saveBibleItem(bibleItem, () => {
                viewController.onLookupSaveBibleItem();
            });
            if (addedBibleItem === null) {
                showAddingBibleItemFail();
            }
        },
        [bibleItem],
    );
    return (
        <button
            className="btn btn-sm btn-primary"
            type="button"
            title={
                tran('Save bible item') +
                ` [${toShortcutKey(ctrlEnterEventMapper)}]`
            }
            aria-label={tran('Save bible item')}
            onClick={handleSaveBibleItem}
        >
            <i className="bi bi-floppy" />
        </button>
    );
}

function SaveAndShowButtonComp({
    handleSaveAndPresent,
    bibleItem,
}: Readonly<{
    bibleItem: BibleItem;
    handleSaveAndPresent: (event: MouseEvent) => void;
}>) {
    const viewController = useLookupBibleItemControllerContext();
    useKeyboardRegistering(
        [ctrlShiftEnterEventMapper],
        (event) => {
            if (!appProvider.isPagePresenter) {
                return;
            }
            addBibleItemAndPresent(event, bibleItem, () => {
                viewController.onLookupSaveBibleItem();
            });
        },
        [bibleItem],
    );
    return (
        <button
            className="btn btn-sm btn-primary"
            type="button"
            title={
                tran('Save bible item and show on screen') +
                ` [${toShortcutKey(ctrlShiftEnterEventMapper)}]`
            }
            aria-label={tran('Save bible item and show on screen')}
            onClick={handleSaveAndPresent}
        >
            <i className="bi bi-cast" />
        </button>
    );
}

function InsertBibleItemToSlideButtonComp({
    handleBibleItemInserting,
    bibleItem,
}: Readonly<{
    bibleItem: BibleItem;
    handleBibleItemInserting: () => void;
}>) {
    const viewController = useLookupBibleItemControllerContext();
    useKeyboardRegistering(
        [ctrlShiftEnterEventMapper],
        () => {
            if (!appProvider.isPageAppDocumentEditor) {
                return;
            }
            CanvasBibleItemEventListener.insertBibleItem(bibleItem);
            viewController.onLookupSaveBibleItem();
        },
        [bibleItem],
    );
    return (
        <button
            className="btn btn-sm btn-primary"
            type="button"
            title={
                tran('Insert bible item into selected slide') +
                ` [${toShortcutKey(ctrlShiftEnterEventMapper)}]`
            }
            aria-label={tran('Insert bible item into selected slide')}
            onClick={handleBibleItemInserting}
        >
            <i className="bi bi-file-earmark-slides" />
        </button>
    );
}

export default function RenderEditingActionButtonsComp({
    bibleItem,
}: Readonly<{ bibleItem: BibleItem }>) {
    const viewController = useLookupBibleItemControllerContext();
    const splitHorizontalRef = useRef<HTMLButtonElement>(null);
    const splitVerticalRef = useRef<HTMLButtonElement>(null);
    useKeyboardRegistering(
        splitEventMappers,
        (event) => {
            event.preventDefault();
            const isHorizontal = event.key.toLowerCase() === 's';
            const button = (
                isHorizontal ? splitHorizontalRef : splitVerticalRef
            ).current;
            viewController.splitBibleItemOnPress(
                // A key has no pointer position: the version list a grouped
                // view asks with hangs under the key's own button.
                button === null ? event : createMouseEventUnder(button),
                bibleItem,
                isHorizontal,
            );
        },
        [],
    );
    const viewControllerRef = useAppCurrentRef(viewController);
    const bibleItemRef = useAppCurrentRef(bibleItem);
    const handleSplitHorizontal = useCallback((event: MouseEvent) => {
        viewControllerRef.current.splitBibleItemOnPress(
            event,
            bibleItemRef.current,
            true,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleSplitVertical = useCallback((event: MouseEvent) => {
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
    const onDone = useCallback(() => {
        viewControllerRef.current.onLookupSaveBibleItem();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const onDoneRef = useAppCurrentRef(onDone);
    const handleSaveBibleItem = useCallback(() => {
        saveBibleItem(bibleItemRef.current, onDoneRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleSaveAndPresent = useCallback((event: MouseEvent) => {
        addBibleItemAndPresent(event, bibleItemRef.current, onDoneRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleExportToWord = useCallback(() => {
        exportToWordDocument([bibleItemRef.current]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleBibleItemInserting = useCallback(() => {
        CanvasBibleItemEventListener.insertBibleItem(bibleItemRef.current);
        onDoneRef.current();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="btn-group">
            <RenderCopyBibleItemActionButtonsComp bibleItem={bibleItem} />
            <button
                type="button"
                className="btn btn-sm btn-info"
                title={
                    splitHorizontalLabel +
                    ` [${toShortcutKey(splitHorizontalEventMapper)}]`
                }
                aria-label={splitHorizontalLabel}
                aria-haspopup={isAskingBibleKey ? 'menu' : undefined}
                ref={splitHorizontalRef}
                onClick={handleSplitHorizontal}
            >
                <i className="bi bi-vr" />
            </button>
            <button
                className="btn btn-sm btn-info"
                type="button"
                title={
                    splitVerticalLabel +
                    ` [${toShortcutKey(splitVerticalEventMapper)}]`
                }
                aria-label={splitVerticalLabel}
                aria-haspopup={isAskingBibleKey ? 'menu' : undefined}
                ref={splitVerticalRef}
                onClick={handleSplitVertical}
            >
                <i className="bi bi-hr" />
            </button>
            {viewController.isMinimized ? null : (
                <>
                    <SaveButtonComp
                        handleSaveBibleItem={handleSaveBibleItem}
                        bibleItem={bibleItem}
                    />
                    {appProvider.isPagePresenter ? (
                        <SaveAndShowButtonComp
                            handleSaveAndPresent={handleSaveAndPresent}
                            bibleItem={bibleItem}
                        />
                    ) : null}
                    {appProvider.isPageAppDocumentEditor ? (
                        <InsertBibleItemToSlideButtonComp
                            handleBibleItemInserting={handleBibleItemInserting}
                            bibleItem={bibleItem}
                        />
                    ) : null}
                    <button
                        className="btn btn-sm btn-info"
                        type="button"
                        title={tran('Export to MS Word')}
                        aria-label={tran('Export to MS Word')}
                        onClick={handleExportToWord}
                    >
                        <i className="bi bi-file-earmark-word" />
                    </button>
                </>
            )}
            {viewController.extraEditingActionButtons}
        </div>
    );
}
