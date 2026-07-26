import './bootstrapCss';
import { init } from './boot';
import { run } from './others/main';
import { hideAllScreens } from './_screen/screenHelpers';
import { resizeSettingNames } from './resize-actor/flexSizeHelpers';
import BibleReaderComp from './bible-reader/BibleReaderComp';
import AppContextMenuComp from './context-menu/AppContextMenuComp';
import HandleAlertComp from './popup-widget/HandleAlertComp';
import TopProgressBarComp from './progress-bar/TopProgressBarComp';
import ToastComp from './toast/ToastComp';
import PresentingControlComp from './presenting-control/PresentingControlComp';

await init();
run(
    <>
        <BibleReaderComp flexSizeName={resizeSettingNames.bibleReader} />
        <TopProgressBarComp />
        <ToastComp />
        <AppContextMenuComp />
        <HandleAlertComp />
        <PresentingControlComp />
    </>,
);

hideAllScreens();
