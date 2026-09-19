/**
 * The cue gutter: the fixed left column every line of a run sheet is read down.
 *
 * A run sheet is a call script. What an operator needs from it mid-service is
 * not decoration but a place to count from — WHICH line the run is on, how far
 * down the sheet that is, and what shape the rest of it has. All three live in
 * one column so the eye tracks straight down it rather than hunting across rows
 * of ragged text.
 *
 * Three things ride here, and only one of them is drawn by this component:
 *
 * - the LINE NUMBER, in tabular figures so the column cannot go ragged (this is
 *   the most-repeated number in the panel);
 * - the RAIL, the hairline down the gutter's right edge — a `border-right` in
 *   the stylesheet rather than an element, so it is free and unbroken;
 * - the RUN CURSOR, which rides the rail as a thicker stroke in the accent. The
 *   ancestor that knows where the run is puts a class on the ROW, and the
 *   stylesheet reaches in; a component that had to be told would mean threading
 *   the cursor through every caller that draws a row for something the run
 *   cannot stop on.
 *
 * `lineNumber` of null is such a row — a CC riding with a line, a slide a
 * document holds, a placeholder. It still draws the gutter, so the rail stays
 * unbroken and every label in the sheet starts at the same x; it just carries no
 * number, because the run has no such place to be.
 *
 * A COMMAND — a line that does something rather than one that goes to a screen —
 * is set apart by the number's register alone: same column, same face, held
 * back. No colour of its own, on purpose. This panel already spends colour on
 * four unrelated jobs (the reserved on-air magenta, the accent the cursor wears,
 * each action's own tint, and whatever hex an operator picked for a colour note)
 * and a fifth would leave none of them able to out-shout the others.
 */
export default function PresentingFlowRowGutterComp({
    lineNumber = null,
    isCommand = false,
}: Readonly<{
    lineNumber?: number | null;
    isCommand?: boolean;
}>) {
    return (
        <span
            className={
                'app-presenting-flow-gutter app-data' +
                (isCommand ? ' app-presenting-flow-gutter-command' : '')
            }
            // Decoration to a screen reader: the number is a position in a list
            // the DOM already expresses by order, and the rail is a rule.
            aria-hidden="true"
        >
            {lineNumber}
        </span>
    );
}
