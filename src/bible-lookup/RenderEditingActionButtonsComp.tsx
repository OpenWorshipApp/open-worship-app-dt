import { useCallback, useMemo, type MouseEvent } from 'react';

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
    ctrlShiftMetaKeys,
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
            onClick={handleBibleItemInserting}
        >
            <i className="bi bi-file-earmark-slides" />
        </button>
    );
}

export default function RenderEditingActionButtonsComp({
    bibleItem,
}: Readonly<{ bibleItem: BibleItem }>) {
    const eventMaps = useMemo(() => {
        return ['s', 'v'].map((key) => {
            return { ...ctrlShiftMetaKeys, key };
        });
    }, []);
    const viewController = useLookupBibleItemControllerContext();
    useKeyboardRegistering(
        eventMaps,
        (event) => {
            if (event.key.toLowerCase() === 's') {
                viewController.addBibleItemLeft(bibleItem, bibleItem);
            } else {
                viewController.addBibleItemBottom(bibleItem, bibleItem);
            }
        },
        [],
    );
    const viewControllerRef = useAppCurrentRef(viewController);
    const bibleItemRef = useAppCurrentRef(bibleItem);
    const handleSplitHorizontal = useCallback(() => {
        viewControllerRef.current.addBibleItemLeft(
            bibleItemRef.current,
            bibleItemRef.current,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleSplitVertical = useCallback(() => {
        viewControllerRef.current.addBibleItemBottom(
            bibleItemRef.current,
            bibleItemRef.current,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
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
        <div className="btn-group mx-1">
            <RenderCopyBibleItemActionButtonsComp bibleItem={bibleItem} />
            <button
                type="button"
                className="btn btn-sm btn-info"
                title={
                    tran('Split horizontal') +
                    ` [${toShortcutKey(eventMaps[0])}]`
                }
                onClick={handleSplitHorizontal}
            >
                <i className="bi bi-vr" />
            </button>
            <button
                className="btn btn-sm btn-info"
                type="button"
                title={`Split vertical [${toShortcutKey(eventMaps[1])}]`}
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
                        onClick={handleExportToWord}
                    >
                        <i
                            className="bi bi-file-earmark-word"
                            style={{
                                color: 'blue',
                            }}
                        />
                    </button>
                </>
            )}
            {viewController.extraEditingActionButtons}
        </div>
    );
}
