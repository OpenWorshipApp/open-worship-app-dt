import './ScreenBackgroundFillComp.scss';

import type { CSSProperties } from 'react';

import {
    genFillCss,
    genFillMotionPlan,
    parseFill,
} from '../background/fillValueHelpers';

/**
 * A screen's FILL background: a colour, a gradient or a pattern
 * (`fillValueHelpers`). A moving one moves only where it is presented --
 * `isMoving` is the screen window's -- and only by `transform`: a layer a tile
 * (or a quarter) larger than the screen, painted once and slid by the
 * compositor (`ScreenBackgroundFillComp.scss`). The presenter's Mini Screens
 * draw it still: a preview is not worth a frame a second on an old machine.
 *
 * Drawn through `renderToStaticMarkup` (`genHtmlBackground`), so it is plain
 * markup: no state, no effect.
 */
export default function ScreenBackgroundFillComp({
    src,
    isMoving,
}: Readonly<{
    src: string;
    isMoving: boolean;
}>) {
    const fill = parseFill(src);
    const boxStyle: CSSProperties = {
        width: '100%',
        height: '100%',
    };
    if (fill === null) {
        // Not a fill (a hand-edited setting, say): nothing is drawn rather
        // than something nobody asked for.
        return <div style={boxStyle} />;
    }
    const plan = isMoving ? genFillMotionPlan(fill) : null;
    if (plan === null) {
        return <div style={{ ...boxStyle, ...genFillCss(fill) }} />;
    }
    const tile = plan.tilePx === undefined ? null : `${plan.tilePx}px`;
    const layerStyle = {
        ...genFillCss(fill),
        '--app-fill-seconds': `${plan.seconds}s`,
        ...(tile === null ? {} : { '--app-fill-tile': tile }),
    } as CSSProperties;
    return (
        <div className="app-fill-box" style={boxStyle}>
            <div
                className={`app-fill-motion ${plan.animationName}`}
                style={layerStyle}
            />
        </div>
    );
}
