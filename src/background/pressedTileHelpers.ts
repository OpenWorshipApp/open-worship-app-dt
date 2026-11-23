/**
 * The tile a press landed on, kept to put the keyboard back on it once the
 * press has re-rendered its picker (the first press swaps the one picker for
 * a picker per screen, unmounting the very tile that had the focus).
 *
 * A tile is known by its label AND the section it is in: an effect both
 * kinds draw (2026-11-19, a category's Aurora, Waves or Fireworks) is a CSS
 * tile and a shader tile of the same name, and by the label alone the
 * keyboard went from the shader pressed to the CSS one above it.
 */
export type PressedTileType = {
    label: string;
    section: string | null;
    at: number;
};

const SECTION_SELECTOR = '.fill-picker-section';

function toSectionLabel(element: Element) {
    return (
        element.closest(SECTION_SELECTOR)?.getAttribute('aria-label') ?? null
    );
}

export function readPressedTile(
    target: HTMLElement,
    selector: string,
): PressedTileType | null {
    const label = target.matches?.(selector)
        ? target.getAttribute('aria-label')
        : null;
    if (label === null) {
        return null;
    }
    return { label, section: toSectionLabel(target), at: Date.now() };
}

export function findPressedTile(
    container: HTMLElement,
    selector: string,
    pressed: PressedTileType,
) {
    return Array.from(container.querySelectorAll<HTMLElement>(selector)).find(
        (element) => {
            return (
                element.getAttribute('aria-label') === pressed.label &&
                toSectionLabel(element) === pressed.section
            );
        },
    );
}
