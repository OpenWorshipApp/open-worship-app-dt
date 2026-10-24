import { useRef } from 'react';

import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import {
    useScreenLongTextManagerEvents,
    useScreenForegroundManagerEvents,
} from './managers/screenEventHelpers';
import { getMarqueeBandHeight } from './marqueeBandHelpers';
import ScreenLongTextManager from './managers/ScreenLongTextManager';
import {
    useScreenManagerContext,
    useScreenManagerEvents,
} from './managers/screenManagerHooks';
import { getColorParts } from '../others/themeHelpers';
import { checkIsZoomed } from '../helper/domHelpers';
import { HEX_COLOR_BLACK } from '../others/color/colorHelpers';
import {
    SCREEN_BIBLE_COLUMNS_CLASSNAME,
    SCREEN_BIBLE_COLUMN_CLASSNAME,
} from './screenBibleColumnHelpers';
import { SCREEN_LONG_TEXT_CLASSNAME } from './screenLongTextTypeHelpers';

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

/* Several Bibles side by side, each a scroller of its own. */
#bible-screen-view .${SCREEN_BIBLE_COLUMNS_CLASSNAME} {
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}

#bible-screen-view .${SCREEN_BIBLE_COLUMN_CLASSNAME} {
    display: block;
    position: absolute;
    top: 0;
    height: 100%;
    overflow-x: hidden;
    overflow-y: auto;
}

#bible-screen-view::-webkit-scrollbar,
#bible-screen-view .${SCREEN_BIBLE_COLUMN_CLASSNAME}::-webkit-scrollbar {
    width: 0.2em;
}

#bible-screen-view::-webkit-scrollbar-track,
#bible-screen-view .${SCREEN_BIBLE_COLUMN_CLASSNAME}::-webkit-scrollbar-track {
    background-color: ${colorPart}42;
}

#bible-screen-view::-webkit-scrollbar-thumb,
#bible-screen-view .${SCREEN_BIBLE_COLUMN_CLASSNAME}::-webkit-scrollbar-thumb {
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

/* A long text's section is several lines, and keeps its line breaks. */
#bible-screen-view .${SCREEN_LONG_TEXT_CLASSNAME} td > span {
    white-space: pre-line;
}

#bible-screen-view td .verse-number {
    -webkit-text-stroke: 0.01em greenyellow;
    color: rgba(172, 255, 47, 0.645);
    transform: scale(0.7) translateY(-0.3em);
    opacity: 0.7;
    text-shadow: 0 0 ${HEX_COLOR_BLACK};
}

/* "-2-----": a new chapter of a passage crossing chapters, its number drawn
   like a verse number. The rules take the text's own colour, so they read on
   a white background as well as a dark one. Static: it stays up for as long
   as the passage does. */
#bible-screen-view .bible-chapter-divider {
    display: flex;
    align-items: center;
    gap: 0.4em;
    width: 100%;
    margin: 0.4em 0 0.1em;
}
#bible-screen-view .bible-chapter-divider::before,
#bible-screen-view .bible-chapter-divider::after {
    content: '';
    border-top: max(1px, 0.04em) solid currentColor;
    opacity: 0.35;
}
#bible-screen-view .bible-chapter-divider::before {
    flex: 0 0 1.2em;
}
#bible-screen-view .bible-chapter-divider::after {
    flex: 1;
}
#bible-screen-view .bible-chapter-divider-label {
    -webkit-text-stroke: 0.01em greenyellow;
    color: rgba(172, 255, 47, 0.645);
    text-shadow: 0 0 ${HEX_COLOR_BLACK};
    opacity: 0.7;
    font-weight: bold;
    font-size: 0.7em;
}

/* "...": the operator's, for one more chapter. Never on the projector. */
#bible-screen-view .bible-more-chapter-button {
    display: block;
    margin: 0.3em auto;
    padding: 0 1.2em;
    cursor: pointer;
    color: inherit;
    background: transparent;
    border: 1px solid currentColor;
    border-radius: 0.3em;
    opacity: 0.7;
    letter-spacing: 0.2em;
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

/* Faint on purpose, for a verse and for a song's section alike: it marks
   every line of what is selected, and at 0.6 that was a band of colour over
   the words a room is reading. It still says where the reading is. */
#bible-screen-view .highlight.selected {
    background: ${
        'linear-gradient(transparent, transparent, ' +
        'rgba(255, 0, 157, 0.2), transparent);'
    }
}`;
}

export default function ScreenBibleComp() {
    const screenManager = useScreenManagerContext();
    const { screenLongTextManager } = screenManager;
    const screenLongTextManagerRef = useAppCurrentRef(screenLongTextManager);
    useScreenManagerEvents(['refresh'], screenManager, () => {
        screenLongTextManagerRef.current.render();
    });
    useScreenLongTextManagerEvents(['text-style']);
    // Re-render when this screen's foreground changes, so a top marquee
    // pushes the passage down (and releases it when it comes off).
    const { screenForegroundManager } = screenManager;
    useScreenForegroundManagerEvents(['update'], screenForegroundManager);
    const div = useRef<HTMLDivElement>(null);
    useAppEffect(() => {
        const element = div.current;
        if (element === null) {
            return;
        }
        screenLongTextManager.div = element;
        return () => {
            screenLongTextManager.releaseDiv(element);
        };
    }, [screenLongTextManager, div.current]);
    const marqueeTopData =
        screenForegroundManager.foregroundData.marqueeTopData;
    const containerStyle = screenLongTextManager.containerStyle;
    const topInset =
        marqueeTopData === null
            ? 0
            : getMarqueeBandHeight(marqueeTopData, screenManager.height);
    return (
        <>
            <style>
                {getStyleText(ScreenLongTextManager.textStyleTextColor)}
            </style>
            <style>
                {`#bible-screen-view tr {
                    ${ScreenLongTextManager.textStyleText}
                }`}
            </style>
            <div
                id="bible-screen-view"
                ref={div}
                style={
                    topInset === 0
                        ? containerStyle
                        : {
                              ...containerStyle,
                              top: `${topInset}px`,
                              height: `${screenManager.height - topInset}px`,
                          }
                }
            />
        </>
    );
}
