import { init } from './boot';
import LyricEditorPopupComp from './lyric-list/LyricEditorPopupComp';
import { run } from './others/main';
import PopupLayoutComp from './router/PopupLayoutComp';

init(async () => {
    run(
        <PopupLayoutComp>
            <LyricEditorPopupComp />
        </PopupLayoutComp>,
    );
});
