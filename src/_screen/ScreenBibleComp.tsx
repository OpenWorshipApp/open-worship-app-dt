import { useRef } from 'react';

import { useAppEffect } from '../helper/debuggerHelpers';
import { useScreenBibleManagerEvents } from './managers/screenEventHelpers';
import ScreenBibleManager from './managers/ScreenBibleManager';
import {
    useScreenManagerContext,
    useScreenManagerEvents,
} from './managers/screenManagerHooks';
import { getColorParts } from '../others/initHelpers';
import { checkIsZoomed } from '../helper/domHelpers';
import { HEX_COLOR_BLACK } from '../others/color/colorHelpers';

function getStyleText(textColor?: string) {
    const { colorPart, invertColorPart } = getColorParts(textColor);
    const isZoomed = checkIsZoomed();
    // TODO: find solution for sticky header when zoomed

    return `
#bible-screen-view {
    overflow-x: hidden;
    overflow-y: auto;
}

#bible-screen-view div {
    display: inline-block;
}

#bible-screen-view::-webkit-scrollbar {
    width: 0.2em;
}

#bible-screen-view::-webkit-scrollbar-track {
    background-color: ${colorPart}42;
}

#bible-screen-view::-webkit-scrollbar-thumb {
    background-color: ${invertColorPart};
}

#bible-screen-view table {
    table-layout: fixed;
    width: 100%;
    border-radius: 0.1em;
    margin: 0.1em;
    margin-bottom: 1em;
    border-spacing: 0.1em;
    border-collapse: separate;
}

#bible-screen-view thead {
    padding-left: 0.5em;
    padding-right: 0.5em;
    -webkit-text-stroke-width: 0.01em;
}

#bible-screen-view th {
    border-radius: 0.1em;
    ${isZoomed ? '' : 'position: sticky; top: 0;'}
}
#bible-screen-view th > div {
    backdrop-filter: blur(5px);
    background-color: ${colorPart}53;
}

#bible-screen-view th,
#bible-screen-view td {
    -webkit-font-smoothing: antialiased;
    border-left: 1px solid ${colorPart};
    text-align: left;
    vertical-align: top;
    line-height: 1.5em;
    padding: 0.3em;
    box-sizing: border-box;
}
#bible-screen-view th {
    padding: 0;
}

#bible-screen-view td>span {
    padding-left: 0.2em;
    padding-right: 0.2em;
}

#bible-screen-view td .verse-number {
    -webkit-text-stroke: 0.01em greenyellow;
    color: rgba(172, 255, 47, 0.645);
    transform: scale(0.7) translateY(-0.3em);
    opacity: 0.7;
    text-shadow: 0 0 ${HEX_COLOR_BLACK};
}

#bible-screen-view .header .bible-key {
    opacity: 0.5;
    font-weight: 100;
    transform: scale(0.7);
}

#bible-screen-view .header .title {
    display: inline-block;
    overflow-x: auto;
    overflow-y: hidden;
    white-space: nowrap;
    text-align: left;
}

#bible-screen-view .header .title::-webkit-scrollbar {
  background-color: ${colorPart}42;
}

#bible-screen-view .header .title div {
    display: inline-block;
    white-space: nowrap;
}

#bible-screen-view .highlight {
    border-radius: 0.5em;
    transition: background-color 0.5s ease;
    border: 0.05em solid transparent;
    cursor: pointer;
}

#bible-screen-view .highlight.hover {
    border-bottom-color: ${invertColorPart}1a;
}

#bible-screen-view .highlight.selected {
    background: ${
        'linear-gradient(transparent, transparent, ' +
        'rgba(255, 0, 157, 0.6), transparent);'
    }
}`;
}

export default function ScreenBibleComp() {
    const screenManager = useScreenManagerContext();
    useScreenManagerEvents(['refresh'], screenManager, () => {
        screenManager.screenBibleManager.render();
    });
    useScreenBibleManagerEvents(['text-style']);
    const div = useRef<HTMLDivElement>(null);
    const { screenBibleManager } = screenManager;
    useAppEffect(() => {
        if (div.current) {
            screenBibleManager.div = div.current;
        }
    }, [div.current]);
    return (
        <>
            <style>{getStyleText(ScreenBibleManager.textStyleTextColor)}</style>
            <style>
                {`#bible-screen-view tr {
                    ${ScreenBibleManager.textStyleText}
                }`}
            </style>
            <div
                id="bible-screen-view"
                ref={div}
                style={screenBibleManager.containerStyle}
            />
        </>
    );
}
