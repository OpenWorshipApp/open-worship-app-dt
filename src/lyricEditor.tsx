import LyricEditorComp from './lyric-list/LyricEditorComp';
import { main } from './others/appInitHelpers';
import PopupLayoutComp from './router/PopupLayoutComp';

main(
    <PopupLayoutComp>
        <LyricEditorComp />
    </PopupLayoutComp>,
);
