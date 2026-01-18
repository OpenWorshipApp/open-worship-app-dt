import { init } from './boot';
import { run } from './others/main';
import PopupLayoutComp from './router/PopupLayoutComp';

init(async () => {
    const LyricEditorComp = (await import('./lyric-list/LyricEditorComp'))
        .default;
    run(
        <PopupLayoutComp>
            <LyricEditorComp />
        </PopupLayoutComp>,
    );
});
