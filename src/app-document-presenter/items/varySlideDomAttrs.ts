/**
 * The DOCUMENT a slide card belongs to, beside its id
 * (`data-vary-app-document-item-id`). Slide ids restart at 0 in every
 * document, so anything that points at a card from outside the previewer -- a
 * run sheet's Reveal Original -- needs both to find the right one.
 *
 * A leaf module so the card and the run sheet can share the name without
 * either pulling in the other's imports.
 */
export const VARY_SLIDE_FILE_PATH_ATTR = 'data-vary-app-document-file-path';
