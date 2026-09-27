import { createContext } from 'react';

/**
 * True while a canvas item is drawn as part of a THUMBNAIL -- a slide card in
 * the Presenter or the editor's slide list, or a card in the Canvas Items
 * list -- and not on the editing canvas or the projector.
 *
 * The one thing it switches is what an item may load. A YouTube item is a
 * whole video player, and one item used to run three of them in the editor
 * alone (slide card, canvas, Canvas Items card), plus one per card in the
 * Presenter. A thumbnail draws a still instead. The projector cannot use this:
 * it renders through `genSlideHtml`, outside any provider, so it keeps the
 * default and stays live.
 */
export const SlideThumbnailContext = createContext(false);
