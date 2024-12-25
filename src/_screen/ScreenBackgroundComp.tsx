import { useRef } from 'react';

import ReactDOMServer from 'react-dom/server';
import ScreenBackgroundColorComp from './ScreenBackgroundColorComp';
import ScreenBackgroundImageComp from './ScreenBackgroundImageComp';
import ScreenBackgroundVideoComp from './ScreenBackgroundVideoComp';
import { useScreenManagerEvents } from './managers/screenEventHelpers';
import { AppColorType } from '../others/color/colorHelpers';
import { useAppEffect } from '../helper/debuggerHelpers';
import { BackgroundSrcType } from './screenHelpers';
import {
    ScreenManagerContext, useScreenManagerContext,
} from './managers/screenManagerHelpers';
import ScreenManager from './managers/ScreenManager';

export default function ScreenBackgroundComp() {
    const screenManager = useScreenManagerContext();
    useScreenManagerEvents(['resize'], screenManager, () => {
        screenManager.screenBackgroundManager.render();
    });
    const div = useRef<HTMLDivElement>(null);
    const { screenBackgroundManager } = screenManager;
    useAppEffect(() => {
        if (div.current) {
            screenBackgroundManager.div = div.current;
        }
    }, [div.current]);
    return (
        <div id='background' ref={div}
            style={screenBackgroundManager.containerStyle}
        />
    );
}

export function genHtmlBackground(
    backgroundSrc: BackgroundSrcType, screenManager: ScreenManager,
) {
    const htmlStr = ReactDOMServer.renderToStaticMarkup(
        <ScreenManagerContext value={screenManager}>
            <RenderBackground backgroundSrc={backgroundSrc} />
        </ScreenManagerContext>
    );
    const div = document.createElement('div');
    div.innerHTML = htmlStr;
    const child = div.querySelector('div');
    if (child === null) {
        throw new Error('child is null');
    }
    return child;
}

export function RenderBackground({ backgroundSrc }: Readonly<{
    backgroundSrc: BackgroundSrcType,
}>) {
    const screenManager = useScreenManagerContext();
    const { screenBackgroundManager } = screenManager;
    return (
        <div style={{
            ...screenBackgroundManager.containerStyle,
        }}>
            <RenderScreenBackground backgroundSrc={backgroundSrc} />
        </div>
    );
}

function RenderScreenBackground({ backgroundSrc }: Readonly<{
    backgroundSrc: BackgroundSrcType,
}>) {
    if (backgroundSrc === null) {
        return null;
    }
    switch (backgroundSrc.type) {
        case 'image':
            return (
                <ScreenBackgroundImageComp backgroundSrc={backgroundSrc} />
            );
        case 'video':
            return (
                <ScreenBackgroundVideoComp backgroundSrc={backgroundSrc} />
            );
        case 'color':
            return (
                <ScreenBackgroundColorComp
                    color={backgroundSrc.src as AppColorType} />
            );
    }
}
