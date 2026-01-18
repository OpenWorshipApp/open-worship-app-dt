import { init } from './boot';
import { run } from './others/main';

init(async () => {
    const SettingComp = (await import('./setting/SettingComp')).default;
    const TopProgressBarComp = (
        await import('./progress-bar/TopProgressBarComp')
    ).default;
    const ToastComp = (await import('./toast/ToastComp')).default;
    const HandleAlertComp = (await import('./popup-widget/HandleAlertComp'))
        .default;
    const AppContextMenuComp = (
        await import('./context-menu/AppContextMenuComp')
    ).default;
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
