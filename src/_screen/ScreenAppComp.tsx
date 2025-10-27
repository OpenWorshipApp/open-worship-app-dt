import CloseButton from './ScreenCloseButtonComp';
import ScreenBackgroundComp from './ScreenBackgroundComp';
import ScreenSlideComp from './ScreenVaryAppDocumentComp';
import ScreenForegroundComp from './ScreenForegroundComp';
import ScreenBibleComp from './ScreenBibleComp';
import { createScreenManager } from './managers/screenManagerHelpers';
import ScreenManager from './managers/ScreenManager';
import { ScreenManagerBaseContext } from './managers/screenManagerHooks';
import appProvider from '../server/appProvider';
import { genStyleRendering } from './preview/MiniScreenAppComp';

ScreenManager.initReceiveScreenMessage();
export default function ScreenAppComp() {
    const urlParams = new URLSearchParams(globalThis.location.search);
    const screenId = Number.parseInt(urlParams.get('screenId') ?? '');
    if (Number.isNaN(screenId)) {
        return null;
    }
    const screenManager = createScreenManager(screenId);
    if (screenManager === null) {
        return null;
    }
    if (appProvider.isPageScreen) {
        screenManager.sendScreenMessage(
            {
                screenId,
                type: 'init',
                data: null,
            },
            true,
        );
    }
    const {
        varyAppDocumentEffectManager,
        backgroundEffectManager,
        foregroundEffectManager,
    } = screenManager;
    return (
        <ScreenManagerBaseContext value={screenManager}>
            {genStyleRendering(varyAppDocumentEffectManager)}
            {genStyleRendering(backgroundEffectManager)}
            {genStyleRendering(foregroundEffectManager)}
            <ScreenBackgroundComp />
            <ScreenSlideComp />
            <ScreenBibleComp />
            <ScreenForegroundComp />
            <CloseButton />
        </ScreenManagerBaseContext>
    );
}
