import { init } from './boot';
import LyricEditorComp from './lyric-list/LyricEditorComp';
import { run } from './others/main';
import PopupLayoutComp from './router/PopupLayoutComp';

init(async () => {
    run(
        <PopupLayoutComp>
            <LyricEditorComp />
        </PopupLayoutComp>,
    );
});
