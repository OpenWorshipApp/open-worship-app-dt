import { useCallback, useMemo, MouseEvent } from 'react';

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
    addListEventMapper,
    presenterEventMapper,
    useFoundActionKeyboard,
} from './bibleActionHelpers';
import { RenderCopyBibleItemActionButtonsComp } from './RenderActionButtonsComp';
import { tran } from '../lang/langHelpers';

export default function RenderEditingActionButtonsComp({
    bibleItem,
}: Readonly<{ bibleItem: BibleItem }>) {
    const eventMaps = useMemo(() => {
        return ['s', 'v'].map((key) => {
            return { ...ctrlShiftMetaKeys, key };
        });
    }, []);
    const viewController = useLookupBibleItemControllerContext();
    const onDone = useCallback(() => {
        viewController.onLookupSaveBibleItem();
    }, [viewController]);
    useFoundActionKeyboard(bibleItem);
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
    const handleSplitHorizontal = useCallback(() => {
        viewController.addBibleItemLeft(bibleItem, bibleItem);
    }, [viewController, bibleItem]);
    const handleSplitVertical = useCallback(() => {
        viewController.addBibleItemBottom(bibleItem, bibleItem);
    }, [viewController, bibleItem]);
    const handleSaveBibleItem = useCallback(() => {
        saveBibleItem(bibleItem, onDone);
    }, [bibleItem, onDone]);
    const handleSaveAndPresent = useCallback(
        (event: MouseEvent) => {
            addBibleItemAndPresent(event, bibleItem, onDone);
        },
        [bibleItem, onDone],
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
            <button
                className="btn btn-sm btn-primary"
                type="button"
                title={
                    tran('Save bible item') +
                    ` [${toShortcutKey(addListEventMapper)}]`
                }
                onClick={handleSaveBibleItem}
            >
                <i className="bi bi-floppy" />
            </button>
            {appProvider.isPagePresenter ? (
                <button
                    className="btn btn-sm btn-primary"
                    type="button"
                    title={
                        tran('Save bible item and show on screen') +
                        ` [${toShortcutKey(presenterEventMapper)}]`
                    }
                    onClick={handleSaveAndPresent}
                >
                    <i className="bi bi-cast" />
                </button>
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
        </div>
    );
}
