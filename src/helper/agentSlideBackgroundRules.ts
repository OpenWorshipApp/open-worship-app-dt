/**
 * The pure rules of `owa_slide_edit`'s `set-background`: a slide's attached
 * background -- what the little background mark on a slide card is, and
 * what the screen puts behind the slide's words when it is shown
 * (`AttachBackgroundManager`, the `<file>.bg.json` sidecar keyed by slide id,
 * `self` for the whole document).
 *
 * 2026-11-07, the goal _chatbot be the best choice to help modify
 * appdocument slides_: a picture of slides the user liked has a photo behind
 * its words, and the assistant could only say "pick a picture in the
 * Background panel". A background is not a box on the slide -- it is the
 * screen's layer -- so it is set here by the name the Background panel shows
 * it under, a colour, or `none`.
 *
 * Nothing here touches a file; `agentSlideBackgroundHelpers.ts` does.
 */

export const AGENT_SLIDE_BACKGROUND_ACTION = 'set-background';

export type AgentSlideBackgroundActionType =
    typeof AGENT_SLIDE_BACKGROUND_ACTION;

export function checkIsAgentSlideBackgroundAction(
    action: unknown,
): action is AgentSlideBackgroundActionType {
    return action === AGENT_SLIDE_BACKGROUND_ACTION;
}

export type AgentSlideBackgroundWantedType =
    | { kind: 'color'; color: `#${string}` }
    | { kind: 'none' }
    | { kind: 'file'; name: string };

export type AgentCheckedSlideBackgroundType = {
    isError?: false;
    wanted: AgentSlideBackgroundWantedType;
    /**
     * Slide numbers, counted from 1, each once. `null`: every slide -- each
     * by its own id, because a slide card draws its OWN background only (the
     * document's `self` one reaches the screen and no card).
     */
    slides: number[] | null;
};

export type AgentSlideBackgroundRefusalType = {
    isError: true;
    reason: string;
};

export const AGENT_SLIDE_BACKGROUND_LIMITS = {
    nameChars: 200,
    slides: 100,
    /** Names of each kind listed beside a document read. */
    listedNames: 30,
};

const COLOR_PATTERN = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i;
const NONE_WORDS = new Set(['none', 'no background', 'nothing']);

function refuse(reason: string): AgentSlideBackgroundRefusalType {
    return { isError: true, reason };
}

/** Everything about a `set-background` that can be judged with no file. */
export function readAgentSlideBackgroundRequest(request: {
    background?: unknown;
    slides?: unknown;
}): AgentCheckedSlideBackgroundType | AgentSlideBackgroundRefusalType {
    const text =
        typeof request.background === 'string' ? request.background.trim() : '';
    if (text === '') {
        return refuse(
            '`background` is a colour (#RRGGBB), the name of a picture or ' +
                'video in the Background panel, or "none" to take it off.',
        );
    }
    if (text.length > AGENT_SLIDE_BACKGROUND_LIMITS.nameChars) {
        return refuse('`background` is too long to be a name.');
    }
    let slides: number[] | null = null;
    if (request.slides !== undefined) {
        if (
            !Array.isArray(request.slides) ||
            request.slides.length === 0 ||
            request.slides.length > AGENT_SLIDE_BACKGROUND_LIMITS.slides ||
            !request.slides.every((one) => {
                return Number.isInteger(one) && one >= 1;
            })
        ) {
            return refuse(
                '`slides` lists slide numbers counted from 1 (at most ' +
                    `${AGENT_SLIDE_BACKGROUND_LIMITS.slides}); leave it out ` +
                    'for every slide.',
            );
        }
        slides = [...new Set(request.slides as number[])];
    }
    if (COLOR_PATTERN.test(text)) {
        return {
            wanted: { kind: 'color', color: text.toLowerCase() as any },
            slides,
        };
    }
    if (text.startsWith('#')) {
        return refuse(
            `"${text}" is not a colour: write it #RRGGBB or #RRGGBBAA.`,
        );
    }
    if (NONE_WORDS.has(text.toLowerCase())) {
        return { wanted: { kind: 'none' }, slides };
    }
    return { wanted: { kind: 'file', name: text }, slides };
}

/** `sunrise.jpg` -> `sunrise`; a name with no extension stays. */
function toStem(fullName: string) {
    const index = fullName.lastIndexOf('.');
    return index <= 0 ? fullName : fullName.slice(0, index);
}

/**
 * The file of the folder that `asked` names: its full name, else its name
 * without the extension when only one file has it -- either with the case
 * ignored. `null` when none (or more than one) fits.
 */
export function findBackgroundFileName(names: string[], asked: string) {
    const wanted = asked.trim().toLowerCase();
    const exact = names.find((one) => {
        return one.toLowerCase() === wanted;
    });
    if (exact !== undefined) {
        return exact;
    }
    const byStem = names.filter((one) => {
        return toStem(one).toLowerCase() === wanted;
    });
    return byStem.length === 1 ? byStem[0] : null;
}

const NAME_WORD_SPLIT_PATTERN = /[\s_.,()\-]+/;

/**
 * The files whose name holds every word of `asked` (3 letters or more, the
 * case ignored): "mountain" finds `wp_mountain_reflection.jpg`. A folder of
 * sixty pictures is listed only in part beside a document, so a word is how
 * the rest are reached.
 */
export function findBackgroundCandidates(names: string[], asked: string) {
    const words = asked
        .toLowerCase()
        .split(NAME_WORD_SPLIT_PATTERN)
        .filter((word) => {
            return word.length >= 3;
        });
    if (words.length === 0) {
        return [];
    }
    return names.filter((one) => {
        const lower = one.toLowerCase();
        return words.every((word) => {
            return lower.includes(word);
        });
    });
}

/** Slide numbers to the ids the sidecar is keyed by, or why they cannot be. */
export function toSlideIdList(
    slideList: { id?: unknown }[],
    slides: number[],
    name: string,
): (string | number)[] | AgentSlideBackgroundRefusalType {
    const missing = slides.filter((one) => {
        return one > slideList.length;
    });
    if (missing.length > 0) {
        return refuse(
            `"${name}" has ${slideList.length} ` +
                `slide${slideList.length === 1 ? '' : 's'}, so there is no ` +
                `slide ${missing.join(', ')}. Nothing was changed.`,
        );
    }
    const idList: (string | number)[] = [];
    for (const one of slides) {
        const id = slideList[one - 1]?.id;
        if (typeof id !== 'number' && typeof id !== 'string') {
            return refuse(
                `Slide ${one} of "${name}" has no id to hang a background ` +
                    'on. Nothing was changed.',
            );
        }
        idList.push(id);
    }
    return idList;
}

export type AttachedBackgroundShapeType = {
    type?: unknown;
    item?: unknown;
};

const TYPE_WORD_MAP: Record<string, string> = {
    'bg-color': 'colour',
    'bg-image': 'picture',
    'bg-video': 'video',
    'bg-web': 'web page',
    'bg-camera': 'camera',
};

/**
 * How a background reads to the model: `colour #102030`, `picture
 * sunrise.jpg`, `video waves.mp4`, `web page`, `camera`. `null` for none.
 */
export function describeAttachedBackground(
    data: AttachedBackgroundShapeType | null | undefined,
) {
    if (data === null || data === undefined) {
        return null;
    }
    const word = TYPE_WORD_MAP[String(data.type)] ?? 'background';
    if (data.type === 'bg-color' && typeof data.item === 'string') {
        return `${word} ${data.item}`;
    }
    const item = data.item as { fullName?: unknown } | string | null;
    const fullName =
        typeof item === 'string'
            ? (item.split(/[\\/]/).pop() ?? '')
            : typeof item?.fullName === 'string'
              ? item.fullName
              : '';
    return fullName === '' ? word : `${word} ${fullName}`;
}

/** The sentence a change answers with. */
export function genSlideBackgroundSummary(
    name: string,
    described: string | null,
    slides: number[] | null,
) {
    const where =
        slides === null
            ? `every slide of “${name}”`
            : slides.length === 1
              ? `slide ${slides[0]} of “${name}”`
              : `${slides.length} slides of “${name}”`;
    return described === null
        ? `Took the background off ${where}`
        : `Put the ${described} behind ${where}`;
}
