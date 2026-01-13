import HandleAlertComp from './popup-widget/HandleAlertComp';
import { main } from './others/appInitHelpers';
import TopProgressBarComp from './progress-bar/TopProgressBarComp';
import SettingComp from './setting/SettingComp';
import ToastComp from './toast/ToastComp';
import AppContextMenuComp from './context-menu/AppContextMenuComp';

main(
    <>
        <SettingComp />
        <TopProgressBarComp />
        <ToastComp />
        <HandleAlertComp />
        <AppContextMenuComp />
    </>,
);
