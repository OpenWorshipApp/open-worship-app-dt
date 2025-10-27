import './ScreenBibleTextShadow.scss';

import ScreenBibleManager from '../_screen/managers/ScreenBibleManager';
import { AppColorType } from '../others/color/colorHelpers';
import { useAppEffect } from '../helper/debuggerHelpers';
import ReactDOMServer from 'react-dom/server';
import { useMemo } from 'react';
import { useStylingColor } from '../_screen/preview/stylingHelpers';

function genShadow(prefix: string, color1: string, color2: string) {
    const htmlString = ReactDOMServer.renderToStaticMarkup(
        <>
            <div
                className="ow-outline-demo"
                style={{
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
                }}
            >
                {prefix}:Outline1
            </div>
            <div
                className="ow-outline-demo"
                style={{
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
                }}
            >
                {prefix}:Outline2
            </div>
            <div
                className="ow-outline-demo"
                style={{
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
                }}
            >
                {prefix}:Outline3
            </div>
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

export default function ScreenBibleTextShadow() {
    const [color] = useStylingColor();
    useAppEffect(() => {
        const divList =
            document.querySelectorAll<HTMLDivElement>('.ow-outline-demo');
        const listenList = Array.from(divList).map((d) => {
            const listener = () => {
                ScreenBibleManager.applyTextStyle({
                    textShadow: d.style.textShadow,
                    color: d.style.color as AppColorType,
                });
            };
            d.addEventListener('click', listener);
            return { d, listener };
        });
        return () => {
            for (const listen of listenList) {
                listen.d.removeEventListener('click', listen.listener);
            }
        };
    }, []);
    const htmlColorText = useMemo(() => {
        let text = `
            <div class="ow-outline-demo" style="color:${color}">None</div>
        `;
        text += '<hr/>' + genShadow('G1', color, '#4054b2');
        text += '<hr/>' + genShadow('G2', color, '#000000');
        return text;
    }, [color]);
    return (
        <div className="card-body">
            <div
                ref={(element) => {
                    if (element) {
                        return checkRendered(element);
                    }
                }}
                className="text-shadow"
                dangerouslySetInnerHTML={{
                    __html: htmlColorText,
                }}
            ></div>
        </div>
    );
}
