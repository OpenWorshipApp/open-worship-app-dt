import { run } from './others/main';
import { hideAllScreens } from './_screen/screenHelpers';
import { resizeSettingNames } from './resize-actor/flexSizeHelpers';
import { init } from './boot';

init(async () => {
    const BibleReaderComp = (await import('./bible-reader/BibleReaderComp'))
        .default;
    const TopProgressBarComp = (
        await import('./progress-bar/TopProgressBarComp')
    ).default;
    const ToastComp = (await import('./toast/ToastComp')).default;
    const AppContextMenuComp = (
        await import('./context-menu/AppContextMenuComp')
    ).default;
    const HandleAlertComp = (await import('./popup-widget/HandleAlertComp'))
        .default;
    run(
        <>
            <BibleReaderComp flexSizeName={resizeSettingNames.bibleReader} />
            <TopProgressBarComp />
            <ToastComp />
            <AppContextMenuComp />
            <HandleAlertComp />
        </>,
    );
});

hideAllScreens();
