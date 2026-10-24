import colorList from '../others/color-list.json';

/**
 * The colour note a bible preview section falls back to when its own note was
 * never set (2026-10-19, the user: _all bible preview section should have
 * color_ ... _when not setting found for the color of the editing section then
 * it should be `lime`_).
 *
 * Read from the shared colour list -- the same one the colour-note menu lists
 * -- so the default can never name a colour the menu does not offer and the
 * hex is written in one place only.
 */
export const DEFAULT_BIBLE_COLOR_NOTE: string = colorList.main.lime;

/**
 * The first colour of the menu's list that is not in `usedColorNotes`
 * (lower-cased codes), `null` once every one is taken. What a bible preview
 * section that was NOT split off another one starts in (2026-10-22, the user:
 * _new section that is not from splitting have to assign with different color
 * (color not used in any section)_).
 */
export function findUnusedColorNote(usedColorNotes: Set<string>) {
    for (const colors of [colorList.main, colorList.extension]) {
        for (const color of Object.values(colors)) {
            if (!usedColorNotes.has(color.toLowerCase())) {
                return color;
            }
        }
    }
    return null;
}
