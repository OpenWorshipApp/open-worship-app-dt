import 'bible-note/styles.css';

import './bootstrapCss';
import { init } from './boot';
import { run } from './others/main';
import NoteItemEditorPopupComp from './bible-list/note/NoteItemEditorPopupComp';
import PopupLayoutComp from './router/PopupLayoutComp';
import {
    getBibleNoteData,
    initBibleNote,
} from './bible-list/note/bibleNoteHelpers';
import { registerAppMenuClicked } from './lang/langHelpers';
import PresentingControlComp from './presenting-control/PresentingControlComp';

init(async () => {
    const bibleNoteData = await getBibleNoteData();
    if (bibleNoteData === null) {
        throw new Error('No bible note data found');
    }
    const bibleNote = await initBibleNote({
        ...bibleNoteData,
    });
    // Every menu click lands here, including items owned by other features and
    // parent items that carry no `clickData` at all — hence the optional read.
    const handleSearchOpening = (
        _event: any,
        clickData?: {
            isOpenSearch?: boolean;
        },
    ) => {
        if (clickData?.isOpenSearch) {
            bibleNote.searchText('');
        }
    };
    registerAppMenuClicked(handleSearchOpening);
    run(
        <PopupLayoutComp>
            <div
                id="bible-note-root"
                className="app-selectable-text"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    overflow: 'hidden',
                }}
                ref={(ele) => {
                    if (ele === null) {
                        return;
                    }
                    bibleNote.render(ele);
                    return () => {
                        bibleNote.unmount();
                    };
                }}
            />
            <NoteItemEditorPopupComp bibleNote={bibleNote} />
            <PresentingControlComp />
        </PopupLayoutComp>,
    );
});
