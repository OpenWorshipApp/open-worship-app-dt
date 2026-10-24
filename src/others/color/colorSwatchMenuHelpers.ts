import { createContext } from 'react';

import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import type { AppColorType } from './colorHelpers';

/**
 * Rows a colour swatch adds to its own right-click, for the swatches of ONE
 * place only. `RenderColorComp` is every colour picker in the app -- a
 * foreground widget's text colour, a slide's fill -- and only the Background
 * panel's Colors tab means "this colour is a background", so that tab
 * provides its rows (the colour's own transition) here and nothing else sees
 * them.
 */
export const ColorSwatchExtraMenuContext = createContext<
    ((color: AppColorType) => ContextMenuItemType[]) | null
>(null);
