import HandleAlertComp from './popup-widget/HandleAlertComp';
import BibleReaderComp from './bible-reader/BibleReaderComp';
import AppContextMenuComp from './context-menu/AppContextMenuComp';
import TopProgressBarComp from './progress-bar/TopProgressBarComp';
import ToastComp from './toast/ToastComp';
import { main } from './others/bootstrap';
import { hideAllScreens } from './_screen/screenHelpers';
import { resizeSettingNames } from './resize-actor/flexSizeHelpers';

main(
    <>
        <BibleReaderComp flexSizeName={resizeSettingNames.bibleReader} />
        <TopProgressBarComp />
        <ToastComp />
        <AppContextMenuComp />
        <HandleAlertComp />
    </>,
);

hideAllScreens();
