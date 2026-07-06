import { init } from './boot';
import { run } from './others/main';
import NoteItemEditorPopupComp from './bible-list/note/NoteItemEditorPopupComp';
import PopupLayoutComp from './router/PopupLayoutComp';
import {
    getBibleNoteData,
    initBibleNote,
} from './bible-list/note/bibleNoteHelpers';

init(async () => {
    const bibleNoteData = await getBibleNoteData();
    if (bibleNoteData === null) {
        throw new Error('No bible note data found');
    }
    const bibleNote = await initBibleNote({
        ...bibleNoteData,
    });
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
        </PopupLayoutComp>,
    );
});
