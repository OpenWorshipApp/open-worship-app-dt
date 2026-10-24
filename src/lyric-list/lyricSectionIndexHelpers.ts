// The badge's opening tag, then its text (`2/7`). A whole class TOKEN: `\b`
// would also match before the `-` of a longer class such as
// `ol-song-view__section-index-note`.
const SECTION_INDEX_PATTERN =
    /(<span\b[^>]*\bclass="(?:[^"]*\s)?ol-song-view__section-index(?=[\s"])[^"]*"[^>]*>)([^<]*)/g;

// The serializer inlines every COMPUTED style, so the badge arrives with the
// pixel width measured for `1/7` and a pixel `left` that pins its left edge —
// the longer text would run off the card and read `Vers`. It is anchored
// `right: 0` by open-lyric, so freeing both lets it grow leftwards.
// Declarations later in one `style` attribute win, so appending is enough.
const SECTION_INDEX_FREE_WIDTH_STYLE =
    'left: auto; inset-inline-start: auto; width: auto; ' +
    'min-width: max-content; max-width: none; white-space: nowrap;';

function freeTagWidth(tag: string) {
    if (/\sstyle="/.test(tag)) {
        return tag.replace(/(\sstyle="[^"]*?)\s*;?\s*"/, (_, styleStart) => {
            return `${styleStart}; ${SECTION_INDEX_FREE_WIDTH_STYLE}"`;
        });
    }
    return tag.replace(/>$/, ` style="${SECTION_INDEX_FREE_WIDTH_STYLE}">`);
}

function escapeHtmlText(text: string) {
    return text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

/**
 * Writes the slide's name into open-lyric's corner badge — `Chorus (2/3) · 7/7`
 * rather than `2/7` — so a singer glancing at a back-stage screen sees WHICH
 * part is up, not only how far into the song it is. The section title at the
 * top of the slide names the part, but it is small, muted, and cannot say which
 * play of a repeated step this is.
 *
 * `stepNumber` (1-based) replaces the badge's own position: open-lyric renders
 * a part ONCE, so a Chorus sung at steps 2 and 7 carries `2/7` on both, and the
 * last chorus of the song would tell the singer they were near its start.
 *
 * Done on the serialized HTML because open-lyric has no option for it. Markup
 * without a badge (the `Info` card, stage 0's `isShowingIndex: false`) comes
 * back unchanged.
 */
export function addTitleToSectionIndex(
    html: string,
    title: string,
    stepNumber = -1,
) {
    const escapedTitle = escapeHtmlText(title);
    return html.replace(SECTION_INDEX_PATTERN, (_, tag, text: string) => {
        const indexText =
            stepNumber > 0 ? text.replace(/^\d+(?=\/)/, `${stepNumber}`) : text;
        return `${freeTagWidth(tag)}${escapedTitle} · ${indexText}`;
    });
}
