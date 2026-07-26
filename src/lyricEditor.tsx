import './bootstrapCss';
import { init } from './boot';
import LyricEditorPopupComp from './lyric-list/LyricEditorPopupComp';
import { run } from './others/main';
import PopupLayoutComp from './router/PopupLayoutComp';
import PresentingControlComp from './presenting-control/PresentingControlComp';

init(async () => {
    run(
        <PopupLayoutComp>
            <LyricEditorPopupComp />
            <PresentingControlComp />
        </PopupLayoutComp>,
    );
});
