import { use, useCallback, type DragEvent, type MouseEvent } from 'react';

import ScreenBackgroundManager from '../_screen/managers/ScreenBackgroundManager';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { pressElementLikeButton } from '../helper/helpers';
import { genShowOnScreensContextMenu } from '../others/FileItemHandlerComp';
import { serializeForDragging } from '../others/color/colorHelpers';
import { ColorSwatchExtraMenuContext } from '../others/color/colorSwatchMenuHelpers';
import { genFillCopyCssMenuItems } from './fillCssMenuHelpers';
import {
    checkIsFillDark,
    genFillBackground,
    genFillMotionPlan,
    type FillType,
} from './fillValueHelpers';

/**
 * How much smaller than on a screen a tile draws a pattern's tiles: at the
 * tile's true scale a 24px tile on a 1920px screen is half a pixel, and every
 * pattern would read as a flat colour.
 */
export const FILL_TILE_SCALE = 0.25;

/**
 * One gradient or pattern of the Fills tab, as the colour swatches are one
 * colour: pressed, it goes up; dragged, it is a fill background; its
 * right-click copies its CSS -- as a swatch's copies its colour -- and shows
 * it on chosen screens. Drawn still -- a moving one only carries a mark that
 * it moves -- so the panel never animates at rest.
 */
export default function FillTileComp({
    src,
    fill,
    label,
    isSelected,
    onPick,
}: Readonly<{
    src: string;
    fill: FillType;
    /** Already translated, or language-neutral (`genFillCodeLabel`). */
    label: string;
    isSelected: boolean;
    onPick: (src: string, event: MouseEvent) => void;
}>) {
    const srcRef = useAppCurrentRef(src);
    const onPickRef = useAppCurrentRef(onPick);
    const genExtraMenuItems = use(ColorSwatchExtraMenuContext);
    const genExtraMenuItemsRef = useAppCurrentRef(genExtraMenuItems);
    const handleDragStart = useCallback((event: DragEvent) => {
        serializeForDragging(event, srcRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleContextMenu = useCallback((event: MouseEvent) => {
        const fillSrc = srcRef.current;
        showAppContextMenu(event as any, [
            ...genFillCopyCssMenuItems(fillSrc),
            ...genShowOnScreensContextMenu((menuEvent) => {
                ScreenBackgroundManager.handleBackgroundSelecting(
                    menuEvent,
                    'fill',
                    { src: fillSrc },
                    true,
                );
            }),
            ...(genExtraMenuItemsRef.current?.(fillSrc) ?? []),
        ]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleClick = useCallback((event: MouseEvent) => {
        onPickRef.current(srcRef.current, event);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // A div, as a colour swatch is, so Enter/Space press it through
    // `pressElementLikeButton`: what follows a press may be the "which
    // screen?" menu, opened at the event's own coordinates.
    const handleKeyDown = useCallback((event: any) => {
        pressElementLikeButton(event);
    }, []);
    const isMoving = genFillMotionPlan(fill) !== null;
    return (
        <div
            role="button"
            tabIndex={0}
            aria-label={label}
            aria-pressed={isSelected}
            title={label}
            draggable
            onDragStart={handleDragStart}
            onContextMenu={handleContextMenu}
            onKeyDown={handleKeyDown}
            className={
                'fill-tile app-caught-hover-pointer' +
                (isSelected ? ' is-selected' : '') +
                (checkIsFillDark(fill) ? ' is-dark' : '')
            }
            style={{ background: genFillBackground(fill, FILL_TILE_SCALE) }}
            onClick={handleClick}
        >
            {isMoving ? (
                <i className="bi bi-wind fill-tile-motion" aria-hidden="true" />
            ) : null}
            {isSelected ? (
                <i className="bi bi-check-lg" aria-hidden="true" />
            ) : null}
        </div>
    );
}
