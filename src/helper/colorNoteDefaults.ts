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
