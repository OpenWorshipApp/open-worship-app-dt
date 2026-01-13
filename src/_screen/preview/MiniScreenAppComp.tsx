import ScreenForegroundComp from '../ScreenForegroundComp';
import ScreenBackgroundComp from '../ScreenBackgroundComp';
import ScreenSlideComp from '../ScreenVaryAppDocumentComp';
import ScreenBibleComp from '../ScreenBibleComp';
import { getScreenManagerByScreenId } from '../managers/screenManagerHelpers';
import { ScreenManagerBaseContext } from '../managers/screenManagerHooks';
import ScreenEffectManager from '../managers/ScreenEffectManager';
import { checkIsDarkMode } from '../../others/initHelpers';

const genBGBlank = () => {
    const isDarkMode = checkIsDarkMode();
    if (isDarkMode) {
        return `linear-gradient(45deg, var(--bs-gray-700) 25%, var(--bs-gray-800) 25%),
        linear-gradient(-45deg, var(--bs-gray-700) 25%, var(--bs-gray-800) 25%),
        linear-gradient(45deg, var(--bs-gray-800) 75%, var(--bs-gray-700) 75%),
        linear-gradient(-45deg, var(--bs-gray-800) 75%, var(--bs-gray-700) 75%)`;
    }
    return `linear-gradient(45deg, var(--bs-gray-300) 25%, var(--bs-gray-200) 25%),
    linear-gradient(-45deg, var(--bs-gray-300) 25%, var(--bs-gray-200) 25%),
    linear-gradient(45deg, var(--bs-gray-200) 75%, var(--bs-gray-300) 75%),
    linear-gradient(-45deg, var(--bs-gray-200) 75%, var(--bs-gray-300) 75%)`;
};

export function genStyleRendering(effectManager: ScreenEffectManager) {
    return Object.entries(effectManager.styleAnimList).map(
        ([effectType, styleAnim]) => {
            return <style key={effectType}>{styleAnim.styleText}</style>;
        },
    );
}

export default function MiniScreenAppComp({
    screenId,
}: Readonly<{
    screenId: number;
}>) {
    const screenManager = getScreenManagerByScreenId(screenId);
    if (screenManager === null) {
        return null;
    }
    const {
        varyAppDocumentEffectManager,
        backgroundEffectManager,
        foregroundEffectManager,
    } = screenManager;
    return (
        <ScreenManagerBaseContext value={screenManager}>
            {genStyleRendering(backgroundEffectManager)}
            {genStyleRendering(varyAppDocumentEffectManager)}
            {genStyleRendering(foregroundEffectManager)}
            <div
                style={{
                    pointerEvents: 'none',
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    backgroundImage: genBGBlank(),
                    backgroundSize: '20px 20px',
                    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                }}
            />
            <ScreenBackgroundComp />
            <ScreenSlideComp />
            <ScreenBibleComp />
            <ScreenForegroundComp />
        </ScreenManagerBaseContext>
    );
}
