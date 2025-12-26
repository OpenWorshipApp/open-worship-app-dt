import LyricEditorComp from './lyric-list/LyricEditorComp';
import { main } from './others/appInitHelpers';
import AppLayoutComp from './router/AppLayoutComp';
import { forceReloadAppWindows } from './setting/settingHelpers';

main(
    <AppLayoutComp>
        <LyricEditorComp />
    </AppLayoutComp>,
);

window.addEventListener('beforeunload', () => {
    forceReloadAppWindows();
});
