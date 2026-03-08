import NoteItemEditorPopupComp from './bible-list/note/NoteItemEditorPopupComp';
import { init } from './boot';
import { run } from './others/main';
import PopupLayoutComp from './router/PopupLayoutComp';

init(async () => {
    run(
        <PopupLayoutComp>
            <NoteItemEditorPopupComp />
        </PopupLayoutComp>,
    );
});
