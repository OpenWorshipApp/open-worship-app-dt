import { useMemo } from 'react';

import CloseButton from './ScreenCloseButtonComp';
import ScreenBackgroundComp from './ScreenBackgroundComp';
import ScreenVaryAppDocumentComp from './ScreenVaryAppDocumentComp';
import ScreenForegroundComp from './ScreenForegroundComp';
import ScreenDrawComp from './ScreenDrawComp';
import ScreenBibleComp from './ScreenBibleComp';
import { createScreenManager } from './managers/screenManagerHelpers';
import ScreenManager from './managers/ScreenManager';
import { ScreenManagerBaseContext } from './managers/screenManagerHooks';
import appProvider from '../server/appProvider';
import { genStyleRendering } from './preview/MiniScreenAppComp';
import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { getParamKeyValue } from '../helper/domHelpers';

function useScreenManager() {
    const screenManager = useMemo(() => {
        const screenIdParam = getParamKeyValue(
            globalThis.location.search,
            'screenId',
        );
        if (screenIdParam === null) {
            return null;
        }
        const screenId = Number.parseInt(screenIdParam);
        if (Number.isNaN(screenId)) {
            return null;
        }
        document.title = `${appProvider.windowTitle} - ${screenId}`;
        const screenManager = createScreenManager(screenId);
        return screenManager;
    }, []);
    if (screenManager !== null && appProvider.isPageScreen) {
        screenManager.sendScreenMessage(
            {
                screenId: screenManager.screenId,
                type: 'init',
                data: null,
            },
            true,
        );
    }
    return screenManager;
}

ScreenManager.initReceiveScreenMessage();
export default function ScreenAppComp() {
    const screenManager = useScreenManager();
    const screenManagerRef = useAppCurrentRef(screenManager);

    useAppEffect(() => {
        const screenManager = screenManagerRef.current;
        if (screenManager === null) {
            return;
        }
        screenManager.getElementsByDomSelector = (domSelector: string) => {
            return Array.from(document.querySelectorAll(domSelector) ?? []);
        };
        return () => {
            screenManager.getElementsByDomSelector = () => [];
        };
    }, []);

    return (
        <ScreenManagerBaseContext value={screenManager}>
            {screenManager === null ? (
                <div
                    style={{
                        width: '100%',
                        height: '60vh',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        color: 'red',
                        backgroundColor: 'black',
                        padding: '1rem',
                    }}
                >
                    Screen ID is not provided in the URL. Please provide a valid
                    screenId parameter.
                </div>
            ) : (
                <>
                    {genStyleRendering(
                        screenManager.varyAppDocumentEffectManager,
                    )}
                    {genStyleRendering(screenManager.backgroundEffectManager)}
                    {genStyleRendering(screenManager.foregroundEffectManager)}
                    <ScreenBackgroundComp />
                    <ScreenVaryAppDocumentComp />
                    <ScreenBibleComp />
                    <ScreenForegroundComp />
                    <ScreenDrawComp />
                </>
            )}
            <CloseButton isForceShowing={screenManager === null} />
        </ScreenManagerBaseContext>
    );
}
