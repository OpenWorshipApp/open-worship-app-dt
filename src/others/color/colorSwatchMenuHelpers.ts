import { createContext, type DragEvent } from 'react';

import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import type { AppColorType } from './colorHelpers';

/**
 * Rows a colour swatch adds to its own right-click, for the swatches of ONE
 * place only. `RenderColorComp` is every colour picker in the app -- a
 * foreground widget's text colour, a slide's fill -- and only the Background
 * panel's Fills tab means "this colour is a background", so that tab
 * provides its rows (the fill's own transition) here and nothing else sees
 * them. Its gradient and pattern tiles ask the same, with their fill's text.
 */
export const ColorSwatchExtraMenuContext = createContext<
    ((fillSrc: AppColorType | string) => ContextMenuItemType[]) | null
>(null);

/**
 * Where a fill or an animation pressed in this part of the app GOES, for the
 * parts of a swatch or a tile that do not go through the picker's own press:
 * its drag and its **Show on Screens** row. Unset -- the Background panel --
 * they put up a background, as they always have. The Foreground panel's Fill
 * Show and Animation Show set it, so a tile dragged out of them or shown on
 * chosen screens from its menu lands on the FOREGROUND, as its press does
 * (2026-11-15).
 */
export type PaintTargetType = {
    /** Starts the drag of this fill or animation. */
    handleDragStart: (event: DragEvent, src: string) => void;
    /** The **Show on Screens** rows for this fill or animation. */
    genShowOnScreensMenuItems: (src: string) => ContextMenuItemType[];
};

export const PaintTargetContext = createContext<PaintTargetType | null>(null);
