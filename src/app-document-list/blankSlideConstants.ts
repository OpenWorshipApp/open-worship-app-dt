// The blank slide a PDF, PowerPoint or Word document leads with (its slide 0).
// A leaf of its own so the stage helpers, which run on the projector, can tell
// that slide apart without importing `appDocumentHelpers` and everything it
// pulls in. `appDocumentHelpers` re-exports both for its existing callers.
export const BLANK_HTML_SLIDE_SRC = '/assets/slide0.html';
export const BLANK_IMAGE_SLIDE_SRC = '/assets/blank.png';
