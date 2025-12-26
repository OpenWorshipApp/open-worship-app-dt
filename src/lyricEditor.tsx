import LyricEditorComp from './lyric-list/LyricEditorComp';
import { main } from './others/appInitHelpers';
import AppLayoutComp from './router/AppLayoutComp';

main(
    <AppLayoutComp>
        <LyricEditorComp />
    </AppLayoutComp>,
);
