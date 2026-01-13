import { useMemo } from 'react';

import {
    toShortcutKey,
    useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import { saveBibleItem } from '../bible-list/bibleHelpers';
import BibleItem from '../bible-list/BibleItem';
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
    const onDone = () => {
        viewController.onLookupSaveBibleItem();
    };
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
    return (
        <div className="btn-group mx-1">
            <RenderCopyBibleItemActionButtonsComp bibleItem={bibleItem} />
            <button
                type="button"
                className="btn btn-sm btn-info"
                title={tran`Split horizontal [${toShortcutKey(eventMaps[0])}]`}
                onClick={() => {
                    viewController.addBibleItemLeft(bibleItem, bibleItem);
                }}
            >
                <i className="bi bi-vr" />
            </button>
            <button
                className="btn btn-sm btn-info"
                type="button"
                title={`Split vertical [${toShortcutKey(eventMaps[1])}]`}
                onClick={() => {
                    viewController.addBibleItemBottom(bibleItem, bibleItem);
                }}
            >
                <i className="bi bi-hr" />
            </button>
            <button
                className="btn btn-sm btn-primary"
                type="button"
                title={tran`Save bible item [${toShortcutKey(addListEventMapper)}]`}
                onClick={() => {
                    saveBibleItem(bibleItem, onDone);
                }}
            >
                <i className="bi bi-floppy" />
            </button>
            {appProvider.isPagePresenter ? (
                <button
                    className="btn btn-sm btn-primary"
                    type="button"
                    title={tran`Save bible item and show on screen [${toShortcutKey(
                        presenterEventMapper,
                    )}]`}
                    onClick={(event) => {
                        addBibleItemAndPresent(event, bibleItem, onDone);
                    }}
                >
                    <i className="bi bi-cast" />
                </button>
            ) : null}
        </div>
    );
}
