import { type BibleNote } from 'BibleNote.js';
import { useCallback, useMemo, useState } from 'react';

import FloatingWidgetComp from '../../app-modal/FloatingWidgetComp';
import { useBibleNoteControl } from './bibleNoteHelpers1';
import RenderBibleLookupComp from '../../bible-lookup/RenderBibleLookupComp';
import LookupBibleItemController from '../../bible-reader/LookupBibleItemController';
import { BibleItemsViewControllerContext } from '../../bible-reader/BibleItemsViewController';
import { tran } from '../../lang/langHelpers';
import {
    ctrlEnterEventMapper,
    ctrlShiftEnterEventMapper,
} from '../../bible-lookup/bibleActionHelpers';
import {
    toShortcutKey,
    useKeyboardRegistering,
} from '../../event/KeyboardEventListener';

function BibleNoteBibleLookupComp({
    bibleNote,
    setIsShowingBibleLookup,
}: Readonly<{
    bibleNote: BibleNote;
    setIsShowingBibleLookup: (isShowing: boolean) => void;
}>) {
    const addBibleFullText = useCallback(
        async (
            viewController: LookupBibleItemController,
            preProcess = () => {},
        ) => {
            const { result } = await viewController.getEditingResult();
            if (result.bibleItem === null) {
                return;
            }
            preProcess();
            const text = await result.bibleItem.toFullText();
            bibleNote.addText(text);
        },
        [bibleNote],
    );
    const lookupBibleItemController = useMemo(() => {
        const newLookupBibleItemController = new LookupBibleItemController(
            'bible-note',
        );
        newLookupBibleItemController.isMinimized = true;
        newLookupBibleItemController.extraEditingActionButtons = (
            <>
                <button
                    className="btn btn-sm btn-primary"
                    type="button"
                    title={
                        tran('Insert Collapse Bible Text') +
                        ` [${toShortcutKey(ctrlEnterEventMapper)}]`
                    }
                    onClick={async () => {
                        addBibleFullText(newLookupBibleItemController);
                    }}
                >
                    <i className="bi bi-archive" />
                </button>
                <button
                    className="btn btn-sm btn-primary"
                    type="button"
                    title={
                        tran('Insert Bible Text') +
                        ` [${toShortcutKey(ctrlShiftEnterEventMapper)}]`
                    }
                    onClick={async () => {
                        addBibleFullText(newLookupBibleItemController, () => {
                            bibleNote.addText('^');
                        });
                    }}
                >
                    <i className="bi bi-box-arrow-in-left" />
                </button>
            </>
        );
        return newLookupBibleItemController;
    }, [bibleNote, addBibleFullText]);
    useKeyboardRegistering(
        [ctrlEnterEventMapper],
        async () => {
            addBibleFullText(lookupBibleItemController);
        },
        [lookupBibleItemController],
    );
    useKeyboardRegistering(
        [ctrlShiftEnterEventMapper],
        () => {
            addBibleFullText(lookupBibleItemController, () => {
                bibleNote.addText('^');
            });
        },
        [lookupBibleItemController, bibleNote, addBibleFullText],
    );
    return (
        <FloatingWidgetComp
            onClose={() => setIsShowingBibleLookup(false)}
            collapsedChildren={
                <div className="d-flex m-2">{tran('Bible Lookup')}</div>
            }
            options={{
                width: 550,
                height: 700,
                minWidth: 300,
                minHeight: 200,
            }}
        >
            <BibleItemsViewControllerContext value={lookupBibleItemController}>
                <RenderBibleLookupComp />
            </BibleItemsViewControllerContext>
        </FloatingWidgetComp>
    );
}

export default function NoteItemEditorPopupComp({
    bibleNote,
}: Readonly<{ bibleNote: BibleNote }>) {
    const [isShowingBibleLookup, setIsShowingBibleLookup] = useState(false);
    useBibleNoteControl({ bibleNote, setIsShowingBibleLookup });
    if (isShowingBibleLookup) {
        return (
            <BibleNoteBibleLookupComp
                bibleNote={bibleNote}
                setIsShowingBibleLookup={setIsShowingBibleLookup}
            />
        );
    }
    return null;
}
