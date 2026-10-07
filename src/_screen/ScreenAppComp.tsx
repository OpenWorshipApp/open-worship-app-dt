import { useMemo } from 'react';

import CloseButton from './ScreenCloseButtonComp';
import ScreenBackgroundComp from './ScreenBackgroundComp';
import ScreenVaryAppDocumentComp from './ScreenVaryAppDocumentComp';
import ScreenForegroundComp from './ScreenForegroundComp';
import ScreenDrawComp from './ScreenDrawComp';
import ScreenFocusComp from './ScreenFocusComp';
import ScreenBibleComp from './ScreenBibleComp';
import { createScreenManager } from './managers/screenManagerHelpers';
import ScreenManager from './managers/ScreenManager';
import type { ScreenMessageType } from './screenTypeHelpers';
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
        const context = appProvider.screenUtils?.getContext();
        if (context) screenManager._stage = context.stage;
        return screenManager;
    }, []);
    useAppEffect(() => {
        // effect, not render-phase: sending during render fires on every
        // re-render (doubled under StrictMode)
        if (screenManager !== null && appProvider.isPageScreen) {
            const context = appProvider.screenUtils?.getContext();
            for (const message of context?.messages ?? []) {
                ScreenManager.applyScreenManagerSyncScreen(
                    message as ScreenMessageType,
                );
            }
            screenManager.sendScreenMessage(
                {
                    screenId: screenManager.screenId,
                    type: 'init',
                    data: null,
                },
                true,
            );
        }
    }, [screenManager]);
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
                    <ScreenForegroundComp isBehind />
                    <ScreenVaryAppDocumentComp />
                    <ScreenBibleComp />
                    <ScreenForegroundComp />
                    <ScreenDrawComp />
                    <ScreenFocusComp />
                </>
            )}
            <CloseButton isForceShowing={screenManager === null} />
        </ScreenManagerBaseContext>
    );
}
