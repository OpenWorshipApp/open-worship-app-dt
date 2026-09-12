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
import AppWindowToolsComp from './others/AppWindowToolsComp';
import GraphViewPanelsHostComp from './graph-view/GraphViewPanelsHostComp';
import LocationNameDetailPanelsHostComp from './location-name-lookup/LocationNameDetailPanelsHostComp';
import { checkIsMainWindow } from './server/appHelpers';

await init();
run(
    <>
        <BibleReaderComp flexSizeName={resizeSettingNames.bibleReader} />
        <TopProgressBarComp />
        <ToastComp />
        <AppContextMenuComp />
        <HandleAlertComp />
        <AppWindowToolsComp />
        <LocationNameDetailPanelsHostComp />
        <GraphViewPanelsHostComp />
    </>,
);

setTimeout(() => {
    const isMainWindow = checkIsMainWindow();
    if (isMainWindow) {
        hideAllScreens();
    }
}, 1000);
