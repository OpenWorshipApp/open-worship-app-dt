import { useRef } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import ScreenBackgroundColorComp from './ScreenBackgroundColorComp';
import ScreenBackgroundImageComp from './ScreenBackgroundImageComp';
import ScreenBackgroundVideoComp from './ScreenBackgroundVideoComp';
import { AppColorType } from '../others/color/colorHelpers';
import { useAppEffect } from '../helper/debuggerHelpers';
import { getScreenManagerBase } from './managers/screenManagerBaseHelpers';
import {
    useScreenManagerContext,
    ScreenManagerBaseContext,
    useScreenManagerEvents,
} from './managers/screenManagerHooks';
import { BackgroundSrcType } from './screenTypeHelpers';

export default function ScreenBackgroundComp() {
    const screenManager = useScreenManagerContext();
    const { screenBackgroundManager } = screenManager;
    useScreenManagerEvents(['refresh'], screenManager, () => {
        screenBackgroundManager.render();
    });
    const div = useRef<HTMLDivElement>(null);
    useAppEffect(() => {
        if (div.current) {
            screenBackgroundManager.rootContainer = div.current;
        }
    }, [div.current]);
    return (
        <div
            id="background"
            ref={div}
            style={screenBackgroundManager.containerStyle}
        />
    );
}

export function genHtmlBackground(
    screenId: number,
    backgroundSrc: BackgroundSrcType,
) {
    const screenManagerBase = getScreenManagerBase(screenId);
    const htmlStr = renderToStaticMarkup(
        <ScreenManagerBaseContext value={screenManagerBase}>
            <RenderBackground backgroundSrc={backgroundSrc} />
        </ScreenManagerBaseContext>,
    );
    const div = document.createElement('div');
    div.innerHTML = htmlStr;
    const child = div.querySelector('div');
    if (child === null) {
        throw new Error('child is null');
    }
    Object.assign(child.style, backgroundSrc.extraStyle ?? {});
    return child;
}

export function RenderBackground({
    backgroundSrc,
}: Readonly<{
    backgroundSrc: BackgroundSrcType;
}>) {
    const screenManager = useScreenManagerContext();
    const { screenBackgroundManager } = screenManager;
    return (
        <div
            style={{
                ...screenBackgroundManager.containerStyle,
            }}
        >
            <RenderScreenBackground backgroundSrc={backgroundSrc} />
        </div>
    );
}

function RenderScreenBackground({
    backgroundSrc,
}: Readonly<{
    backgroundSrc: BackgroundSrcType;
}>) {
    if (backgroundSrc === null) {
        return null;
    }
    switch (backgroundSrc.type) {
        case 'image':
            return <ScreenBackgroundImageComp backgroundSrc={backgroundSrc} />;
        case 'video':
            return <ScreenBackgroundVideoComp backgroundSrc={backgroundSrc} />;
        case 'color':
            return (
                <ScreenBackgroundColorComp
                    color={backgroundSrc.src as AppColorType}
                />
            );
    }
}
