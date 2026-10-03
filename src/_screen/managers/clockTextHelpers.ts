/**
 * Write a clock's digit group only when it reads differently.
 *
 * The countdown, stopwatch and time widgets tick on `requestAnimationFrame`,
 * sixty times a second, to show digits that change once a second. Writing them
 * unconditionally replaced the node on every frame -- a style, layout and paint
 * pass in the screen window and again in every mini preview, for as long as a
 * clock is up, on the machines least able to spare it.
 */
export function setClockText(element: HTMLElement | null, text: string) {
    if (element !== null && element.textContent !== text) {
        element.textContent = text;
    }
}

/** The same rule for a `data-*` attribute a clock's CSS reads. */
export function setClockDataset(
    element: HTMLElement | null,
    key: string,
    value: string,
) {
    if (element !== null && element.dataset[key] !== value) {
        element.dataset[key] = value;
    }
}
