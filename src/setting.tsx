import { init } from './boot';
import AppContextMenuComp from './context-menu/AppContextMenuComp';
import { run } from './others/main';
import HandleAlertComp from './popup-widget/HandleAlertComp';
import TopProgressBarComp from './progress-bar/TopProgressBarComp';
import ToastComp from './toast/ToastComp';

init(async () => {
    // Problem with language object initialization order
    const SettingComp = (await import('./setting/SettingComp')).default;
    run(
        <>
            <SettingComp />
            <TopProgressBarComp />
            <ToastComp />
            <HandleAlertComp />
            <AppContextMenuComp />
        </>,
    );
});
