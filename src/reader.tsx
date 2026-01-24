import { run } from './others/main';
import { hideAllScreens } from './_screen/screenHelpers';
import { resizeSettingNames } from './resize-actor/flexSizeHelpers';
import { init } from './boot';
import BibleReaderComp from './bible-reader/BibleReaderComp';
import AppContextMenuComp from './context-menu/AppContextMenuComp';
import HandleAlertComp from './popup-widget/HandleAlertComp';
import TopProgressBarComp from './progress-bar/TopProgressBarComp';
import ToastComp from './toast/ToastComp';

await init();
run(
    <>
        <BibleReaderComp flexSizeName={resizeSettingNames.bibleReader} />
        <TopProgressBarComp />
        <ToastComp />
        <AppContextMenuComp />
        <HandleAlertComp />
    </>,
);

hideAllScreens();
