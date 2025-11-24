import './ScreenBibleTextShadow.scss';

import { CSSProperties, useMemo } from 'react';

import ScreenBibleManager from '../_screen/managers/ScreenBibleManager';
import { AppColorType, toHexColorString } from '../others/color/colorHelpers';
import { useAppEffect } from '../helper/debuggerHelpers';
import { renderToStaticMarkup } from 'react-dom/server';
import { useStylingColor } from '../_screen/preview/stylingHelpers';

function genShadowElement(style: CSSProperties, title: string) {
    return (
        <div className="ow-outline-demo app-blank-bg px-1" style={style}>
            {title}
        </div>
    );
}
function genShadowGroup(prefix: string, color1: string, color2: string) {
    const htmlString = renderToStaticMarkup(
        <>
            {genShadowElement(
                {
                    color: color1,
                    textShadow:
                        `2px 2px 0 ${color2}, ` +
                        `2px -2px 0 ${color2}, ` +
                        `-2px 2px 0 ${color2}, ` +
                        `-2px -2px 0 ${color2}, ` +
                        `2px 0px 0 ${color2}, ` +
                        `0px 2px 0 ${color2}, ` +
                        `-2px 0px 0 ${color2}, ` +
                        `0px -2px 0 ${color2}`,
                },
                `${prefix}:Outline1`,
            )}
            {genShadowElement(
                {
                    color: color1,
                    textShadow:
                        `2px 2px 0 ${color2}, ` +
                        `2px -2px 0 ${color2}, ` +
                        `-2px 2px 0 ${color2}, ` +
                        `-2px -2px 0 ${color2}, ` +
                        `2px 0px 0 ${color2}, ` +
                        `0px 2px 0 ${color2}, ` +
                        `-2px 0px 0 ${color2}, ` +
                        `0px -2px 0 ${color2}, ` +
                        `1px 1px 5px #000, ` +
                        `-1px -1px 5px #000`,
                },
                `${prefix}:Outline2`,
            )}
            {genShadowElement(
                {
                    color: color1,
                    textShadow:
                        `2px 2px 0 ${color2}, ` +
                        `2px -2px 0 ${color2}, ` +
                        `-2px 2px 0 ${color2}, ` +
                        `-2px -2px 0 ${color2}, ` +
                        `2px 0px 0 ${color2}, ` +
                        `0px 2px 0 ${color2}, ` +
                        `-2px 0px 0 ${color2}, ` +
                        `0px -2px 0 ${color2}, ` +
                        `1px 1px 5px #000, ` +
                        `-1px -1px 5px #000,` +
                        `1px -1px 5px #000,` +
                        `-1px 1px 5px #000`,
                },
                `${prefix}:Outline3`,
            )}
        </>,
    );
    return htmlString;
}

function clickListener(event: any) {
    const target = event.currentTarget as HTMLDivElement;
    ScreenBibleManager.applyTextStyle({
        textShadow: target.style.textShadow,
        color: target.style.color as AppColorType,
    });
}
function checkRendered(container: HTMLDivElement) {
    const divList =
        container.querySelectorAll<HTMLDivElement>('.ow-outline-demo');
    const listenList = Array.from(divList).map((child) => {
        child.addEventListener('click', clickListener);
        return { child, listener: clickListener };
    });
    return () => {
        for (const { child, listener } of listenList) {
            child.removeEventListener('click', listener);
        }
    };
}

function genColorHTML({
    color,
    isWhite,
    isBlack,
}: {
    color: string;
    isWhite: boolean;
    isBlack: boolean;
}) {
    let htmlText = `
    <div>
        ${renderToStaticMarkup(genShadowElement({ color: '#ffffff' }, 'Reset White'))}
        ${renderToStaticMarkup(genShadowElement({ color: '#000000' }, 'Reset Black'))}
    </div>
    `;

    if (!isWhite && !isBlack) {
        htmlText += `
            <br/>
            <hr/>
            <div>
                ${genShadowGroup('G1', color, '#2d3c7d30')}
                ${genShadowGroup('G2', color, '#00000030')}
            </div>
        `;
    }
    htmlText += `
        <br/>
        <hr/>
        <div>
            ${genShadowGroup('G3', '#ffffff', '#212c5d30')}
            ${genShadowGroup('G4', '#ffffff', '#00000030')}
        </div>
        <br/>
    `;
    htmlText += `
        <br/>
        <hr/>
        <div>
            ${genShadowGroup('G3', '#000000', '#7a90f330')}
            ${genShadowGroup('G4', '#000000', '#ffffff30')}
        </div>
        <br/>
    `;
    return htmlText;
}
export default function ScreenBibleTextShadow() {
    const [color] = useStylingColor();
    useAppEffect(() => {
        const divList =
            document.querySelectorAll<HTMLDivElement>('.ow-outline-demo');
        const listenList = Array.from(divList).map((element) => {
            const listener = () => {
                ScreenBibleManager.applyTextStyle({
                    textShadow: element.style.textShadow,
                    color: element.style.color as AppColorType,
                });
            };
            element.addEventListener('click', listener);
            return { element, listener };
        });
        return () => {
            for (const { element, listener } of listenList) {
                element.removeEventListener('click', listener);
            }
        };
    }, []);
    const isWhite = useMemo(() => {
        const hexColor = toHexColorString(color);
        return hexColor.toLowerCase().startsWith('#ffffff');
    }, [color]);
    const isBlack = useMemo(() => {
        const hexColor = toHexColorString(color);
        return hexColor.toLowerCase().startsWith('#000000');
    }, [color]);
    const htmlColorText = useMemo(() => {
        const htmlText = genColorHTML({ color, isWhite, isBlack });
        return htmlText;
    }, [color]);
    return (
        <div className="card-body">
            <div
                className="text-shadow d-flex flex-wrap gap-2"
                ref={(element) => {
                    if (element) {
                        return checkRendered(element);
                    }
                }}
                dangerouslySetInnerHTML={{
                    __html: htmlColorText,
                }}
            ></div>
        </div>
    );
}
