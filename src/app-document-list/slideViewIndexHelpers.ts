/**
 * The numbers a slide card is counted by. A PPTX slide's sub-slides read in
 * hundredths after it (slide 16's first is 16.01), and worked out in floating
 * point those hundredths do not stay put: `15 + 0.01 + 1` is
 * 16.009999999999998, which is what the badge on that card used to say
 * (2026-11-22), and 237 of the first 300 x 99 sub-slide numbers went the same
 * way. Both are kept to the hundredth they mean, so the badge, the card's
 * accessible name and the number an agent is handed print as written.
 */
const SUB_SLIDE_SCALE = 100;

/** The index (the card's number less one) of sub-slide `j` of slide `i`. */
export function toSubSlideIndex(i: number, j: number) {
    return (i * SUB_SLIDE_SCALE + j + 1) / SUB_SLIDE_SCALE;
}

/** The number on the card: `index + 1`, kept to its hundredth. */
export function toSlideViewIndex(index: number) {
    return Math.round((index + 1) * SUB_SLIDE_SCALE) / SUB_SLIDE_SCALE;
}
