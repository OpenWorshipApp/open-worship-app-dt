import { tran } from '../../lang/langHelpers';

/**
 * The one name a slide card answers to -- for a screen reader, and for an
 * agent pressing it by its words.
 *
 * A card used to carry no accessible name at all: its number sat in a badge
 * titled `Index: 5`, its name in a bare span, and the only way `owa_find_ui`
 * could reach a slide was through that badge. Asked to *show the next slide*
 * (2026-09-09), the assistant dumped every control in the window, pressed
 * `5 Index: 5` because it happened to bubble to the card, and then reported
 * that it could not find an answer. This is the label the presenter state
 * hands over as `find`, so the two must be built by ONE function: the words
 * on the card and the words the tool says to press can never drift apart.
 *
 * The number is the card's VIEW index, exactly as the badge shows it (a PPTX
 * sub-slide reads `2.01`), because that is what the user sees and counts.
 * Through `tran` because every other accessible name in this app is, and a
 * Khmer window must not answer to English alone; `agentPresenterHelpers`
 * calls this same function for the `find` it hands the tool, in the same
 * window, so the label is translated exactly once and the same way.
 */
export function toSlideAccessibleName(
    viewIndex: number,
    name: string | null | undefined,
) {
    const cleanName = (name ?? '').replace(/\s+/g, ' ').trim();
    const head = `${tran('Slide')} ${viewIndex}`;
    return cleanName.length === 0 ? head : `${head}: ${cleanName}`;
}
