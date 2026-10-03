import type { OpenLyricInfo } from 'open-lyric';

/**
 * The most slides one Structure step becomes. Every copy is a full slide —
 * `Slide`'s constructor deep-clones its json, so each holds its own copy of
 * the section's rendered HTML, and every copy is one more card the previewer
 * renders — so a typo such as `Cx99` must not turn into ninety-nine of them on
 * a low-spec machine. A repeat past this is a vamp the operator loops by hand.
 */
export const MAX_LYRIC_REPEAT_SLIDES = 10;

export type LyricRepeatType = {
    // 0-based: which play of the step this slide is.
    index: number;
    // How many times the song says the step is played, NOT how many slides
    // were made — a capped `Ax16` still reads `(10/16)` on its last slide.
    count: number;
};

// The ` (2/3)` a repeated step's slide carries after its part name — on the
// card, and (stage 1 and up) in the slide's own corner badge.
export function genLyricRepeatSuffix(openLyricRepeat: LyricRepeatType | null) {
    return openLyricRepeat === null
        ? ''
        : ` (${openLyricRepeat.index + 1}/${openLyricRepeat.count})`;
}

// Where a single slide sits in the play order — what a slide built from one
// part needs to be named and badged like its twin in the whole deck.
export type LyricStepRefType = {
    openLyricIndex: number;
    openLyricRepeat: LyricRepeatType | null;
};

/**
 * One slide's worth of the song's play order: a part, the Structure step it
 * belongs to, and — when that step repeats — which play it is.
 */
export type LyricPlayStepType = {
    key: string;
    // The step's place in the Structure, which is what the lyric previewer
    // counts in: every copy of a repeated step shares it.
    structureIndex: number;
    repeat: LyricRepeatType | null;
};

// open-lyric hands the Structure's `Cx3` back as `repeatText: '3x'` (the same
// spelling a progression's `(3x)` uses), and an empty string with no repeat.
export function toLyricRepeatCount(repeatText: string) {
    const matched = /^\(?([1-9]\d*)x\)?$/.exec(repeatText.trim());
    if (matched === null) {
        return 1;
    }
    return Number.parseInt(matched[1], 10);
}

/**
 * The song's Structure as the slides it is played as: `IV1CxV2Cx3O` is one
 * slide per step, except that a step carrying a repeat count is that many
 * slides in a row (capped at `MAX_LYRIC_REPEAT_SLIDES`).
 *
 * Read from `getInfo()` rather than `getStructure()`, which answers the same
 * part names with the repeat count dropped — and from it ALONE, because both
 * parse the whole song, and this runs on every render of every stage pane.
 * Its sections are one per Structure step, in order; an unnamed one is dropped
 * BEFORE counting, as `getStructure()` drops it, so a structure index means
 * the same thing it always has.
 */
export function genLyricPlaySteps(openLyric: {
    getInfo(): OpenLyricInfo | null;
}): LyricPlayStepType[] {
    const sections = (openLyric.getInfo()?.sections ?? []).filter((section) => {
        return Boolean(section.partName);
    });
    const steps: LyricPlayStepType[] = [];
    sections.forEach((section, structureIndex) => {
        const count = toLyricRepeatCount(section.repeatText);
        if (count === 1) {
            steps.push({ key: section.partName, structureIndex, repeat: null });
            return;
        }
        const slideCount = Math.min(count, MAX_LYRIC_REPEAT_SLIDES);
        for (let index = 0; index < slideCount; index++) {
            steps.push({
                key: section.partName,
                structureIndex,
                repeat: { index, count },
            });
        }
    });
    return steps;
}
