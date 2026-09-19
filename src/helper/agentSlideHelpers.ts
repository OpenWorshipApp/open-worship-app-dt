/**
 * The pure half of the slide actions behind `owa_slide_file`: what a request
 * may say, what each action does to a slide document's JSON, and how a slide
 * is described back to the model.
 *
 * ## Why there are slide actions at all
 *
 * Before these, changing one word on one slide meant `update` with the WHOLE
 * document as JSON: the model read every slide and retyped every one of them
 * -- pictures embedded inline included -- and whatever it did not understand
 * in that JSON was what it dropped. One slide at a time is cheaper for the
 * model, and it cannot damage the slides it was not asked about, because it
 * never writes them.
 *
 * ## Why this imports nothing from the app
 *
 * The other half (`agentFileHelpers.ts`) reads the editing history, takes the
 * backup and writes, and the canvas classes it validates with need a browser.
 * The rules here -- which box an `id` names, where a new slide goes, what a
 * locked box refuses -- are exactly the kind that must be tested without any
 * of that, so this module takes plain JSON and the app's defaults as
 * arguments and hands plain JSON back. It never mutates what it is given: the
 * caller's copy is the state the backup was taken from.
 */

type JsonObjectType = Record<string, any>;
type DimType = { width: number; height: number };

export const AGENT_SLIDE_ACTION_LIST = [
    'slides',
    'add-slide',
    'update-slide',
    'delete-slide',
    'move-slide',
    'duplicate-slide',
] as const;

export type AgentSlideActionType = (typeof AGENT_SLIDE_ACTION_LIST)[number];
export type AgentSlideChangeActionType = Exclude<
    AgentSlideActionType,
    'slides'
>;

export function checkIsAgentSlideAction(
    action: unknown,
): action is AgentSlideActionType {
    return AGENT_SLIDE_ACTION_LIST.includes(action as AgentSlideActionType);
}

/**
 * Every bound in one place. Each is either what the app can hold (a font
 * size, a box's size) or what a model's context can: the answer to `slides`
 * rides every later round of the conversation, so a hymn book's worth of
 * slides is paged rather than handed over whole, and a box's text is shown
 * cut.
 */
export const AGENT_SLIDE_LIMITS = {
    listedSlides: 100,
    listedItems: 30,
    shownTextChars: 300,
    shownUrlChars: 200,
    // Pretty-printed characters of listed slides before the list pages.
    listedChars: 40000,
    itemsPerCall: 50,
    textChars: 5000,
    fontNameChars: 200,
    fontSizeMin: 1,
    fontSizeMax: 1000,
    boxMax: 100000,
    rotateMax: 360,
} as const;

/** One text box as a request describes it. */
export type AgentSlideItemSpecType = {
    id?: number;
    text?: string;
    remove?: boolean;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string;
    color?: string;
    backgroundColor?: string;
    align?: 'left' | 'center' | 'right';
    valign?: 'top' | 'center' | 'bottom';
    left?: number;
    top?: number;
    width?: number;
    height?: number;
    rotate?: number;
};

export type AgentSlideRequestType = {
    slide?: unknown;
    to?: unknown;
    items?: unknown;
};

/** A request once `readAgentSlideRequest` has passed it. */
export type AgentCheckedSlideRequestType = {
    slide?: number;
    to?: number;
    specs: AgentSlideItemSpecType[];
};

export type AgentSlideRefusalType = { isError: true; reason: string };

export type AgentSlideContextType = {
    /** The document's name as the user reads it, for the sentences. */
    name: string;
    /** The app's own default text box, as JSON. */
    genTextDefaults: () => JsonObjectType;
    /** The size a slide gets when the document has none to copy. */
    getDefaultDim: () => DimType;
};

/** A box a change writes, and what it was before when it was there. */
export type AgentCheckedItemType = {
    item: JsonObjectType;
    before?: JsonObjectType;
};

export type AgentSlideChangeType = {
    isError?: false;
    /** False when the document already says this: nothing to write. */
    didChange: boolean;
    /** The whole document after the change. */
    json: JsonObjectType;
    /** For a person, in the list of changes `owa_undo` can put back. */
    summary: string;
    /**
     * The boxes this change wrote, for the app's own item validator -- the
     * boxes it did not touch are carried as they are, as the editor would.
     */
    checkItems: AgentCheckedItemType[];
    result: Record<string, unknown>;
    /** A sentence for the model beyond the caller's own note. */
    note?: string;
};

export type AgentSlideDocumentType = {
    name: string;
    slideCount: number;
    width: number | null;
    height: number | null;
    slides: JsonObjectType[];
    isTruncated?: boolean;
    note?: string;
};

const BOX_FIELD_LIST = [
    'left',
    'top',
    'width',
    'height',
    'rotate',
    'backgroundColor',
] as const;
const TEXT_FIELD_LIST = [
    'text',
    'fontSize',
    'fontFamily',
    'fontWeight',
    'color',
    'align',
    'valign',
] as const;
const SPEC_KEY_LIST: readonly string[] = [
    'id',
    'remove',
    ...BOX_FIELD_LIST,
    ...TEXT_FIELD_LIST,
];
const ALIGN_LIST: readonly string[] = ['left', 'center', 'right'];
const VALIGN_LIST: readonly string[] = ['top', 'center', 'bottom'];
const COLOR_PATTERN = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const REMOTE_URL_PATTERN = /^https?:\/\//i;
// A new box without a size of its own: most of the slide's width, a third of
// its height, in the middle -- where a volunteer would drag one to.
const NEW_BOX_WIDTH_RATIO = 0.8;
const NEW_BOX_HEIGHT_RATIO = 0.3;
const NEW_BOX_FONT_SIZE = 60;

function refuse(reason: string): AgentSlideRefusalType {
    return { isError: true, reason };
}

function checkIsPlainObject(value: unknown): value is JsonObjectType {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkIsFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function checkIsCountingNumber(value: unknown): value is number {
    return Number.isInteger(value) && (value as number) >= 1;
}

// The editor stores a text box's vertical alignment as the flex word it
// renders with (`alignItems`); a person, and so a model, says top and bottom.
function toAppValign(valign: 'top' | 'center' | 'bottom') {
    if (valign === 'top') {
        return 'start';
    }
    return valign === 'bottom' ? 'end' : 'center';
}

function toShownValign(value: unknown) {
    if (value === 'start') {
        return 'top';
    }
    if (value === 'end') {
        return 'bottom';
    }
    return value === 'center' ? 'center' : null;
}

function toShownAlign(value: unknown) {
    return typeof value === 'string' && ALIGN_LIST.includes(value)
        ? value
        : null;
}

// --- what a request may say ---------------------------------------------

function checkSpecField(key: string, value: unknown): string | null {
    const limits = AGENT_SLIDE_LIMITS;
    switch (key) {
        case 'id':
            return Number.isInteger(value)
                ? null
                : '`id` is the number of a box, as action "slides" shows it';
        case 'remove':
            return typeof value === 'boolean'
                ? null
                : '`remove` is true or false';
        case 'text':
            if (typeof value !== 'string') {
                return '`text` is the words, as a string';
            }
            return value.length <= limits.textChars
                ? null
                : `\`text\` is at most ${limits.textChars} characters`;
        case 'fontSize':
            return checkIsFiniteNumber(value) &&
                value >= limits.fontSizeMin &&
                value <= limits.fontSizeMax
                ? null
                : `\`fontSize\` is pixels, from ${limits.fontSizeMin} to ` +
                      `${limits.fontSizeMax}`;
        case 'fontFamily':
        case 'fontWeight':
            return typeof value === 'string' &&
                value.length <= limits.fontNameChars
                ? null
                : `\`${key}\` is a name, or "" for the default`;
        case 'color':
        case 'backgroundColor':
            return typeof value === 'string' && COLOR_PATTERN.test(value)
                ? null
                : `\`${key}\` is a color written #RRGGBB, or #RRGGBBAA ` +
                      'with its opacity';
        case 'align':
            return typeof value === 'string' && ALIGN_LIST.includes(value)
                ? null
                : '`align` is left, center or right';
        case 'valign':
            return typeof value === 'string' && VALIGN_LIST.includes(value)
                ? null
                : '`valign` is top, center or bottom';
        case 'left':
        case 'top':
            return checkIsFiniteNumber(value) &&
                Math.abs(value) <= limits.boxMax
                ? null
                : `\`${key}\` is pixels from the slide's ${key} edge`;
        case 'width':
        case 'height':
            return checkIsFiniteNumber(value) &&
                value >= 1 &&
                value <= limits.boxMax
                ? null
                : `\`${key}\` is pixels, at least 1`;
        case 'rotate':
            return checkIsFiniteNumber(value) &&
                Math.abs(value) <= limits.rotateMax
                ? null
                : `\`rotate\` is degrees, from -${limits.rotateMax} to ` +
                      `${limits.rotateMax}`;
        default:
            return (
                `"${key.slice(0, 40)}" is not a field of a box -- the ` +
                `fields are ${SPEC_KEY_LIST.join(', ')}`
            );
    }
}

function readItemSpecs(
    action: AgentSlideActionType,
    items: unknown,
):
    | AgentSlideRefusalType
    | { isError?: false; specs: AgentSlideItemSpecType[] } {
    if (items === undefined) {
        return action === 'update-slide'
            ? refuse(
                  'update-slide needs `items`: each one with an `id` ' +
                      'changes that box or takes it off with `remove`, and ' +
                      'one without an `id` is a new text box.',
              )
            : { specs: [] };
    }
    if (action !== 'add-slide' && action !== 'update-slide') {
        return refuse(
            `\`items\` is for add-slide and update-slide; ${action} does ` +
                'not take any.',
        );
    }
    if (!Array.isArray(items)) {
        return refuse('`items` is a list of boxes.');
    }
    if (items.length > AGENT_SLIDE_LIMITS.itemsPerCall) {
        return refuse(
            `At most ${AGENT_SLIDE_LIMITS.itemsPerCall} boxes go in one ` +
                'call -- send the rest in another.',
        );
    }
    if (items.length === 0 && action === 'update-slide') {
        return refuse('update-slide needs at least one box in `items`.');
    }
    const specs: AgentSlideItemSpecType[] = [];
    const seenIdSet = new Set<number>();
    for (const [index, entry] of items.entries()) {
        const label = `Box ${index + 1} of \`items\``;
        if (!checkIsPlainObject(entry)) {
            return refuse(
                `${label} is not a box: each one is an object like ` +
                    '{"text": "Welcome"}.',
            );
        }
        const keyList = Object.keys(entry).filter((key) => {
            return entry[key] !== undefined;
        });
        for (const key of keyList) {
            const fieldReason = checkSpecField(key, entry[key]);
            if (fieldReason !== null) {
                return refuse(`${label}: ${fieldReason}.`);
            }
        }
        // A copy: the caller's object is not held on to or changed.
        const spec = { ...entry } as AgentSlideItemSpecType;
        const changeCount = keyList.filter((key) => {
            return key !== 'id' && key !== 'remove';
        }).length;
        if (spec.id === undefined) {
            if (spec.remove !== undefined) {
                return refuse(
                    `${label}: \`remove\` needs the \`id\` of the box to ` +
                        'take off.',
                );
            }
            if (changeCount === 0) {
                return refuse(
                    `${label} is empty -- a new text box needs at least ` +
                        'one field, such as its `text`.',
                );
            }
        } else if (action === 'add-slide') {
            return refuse(
                `${label} has an \`id\`, but a new slide has no boxes yet: ` +
                    'add-slide takes new text boxes only, and update-slide ' +
                    'changes a box that is there.',
            );
        } else if (seenIdSet.has(spec.id)) {
            return refuse(
                `${label} names box ${spec.id} a second time -- give each ` +
                    'box one entry.',
            );
        } else if (spec.remove === true && changeCount > 0) {
            return refuse(
                `${label} both removes box ${spec.id} and changes it -- to ` +
                    'take it off, send only its `id` and `remove`.',
            );
        } else if (spec.remove !== true && changeCount === 0) {
            return refuse(
                `${label} names box ${spec.id} but gives nothing to change.`,
            );
        }
        if (spec.id !== undefined) {
            seenIdSet.add(spec.id);
        }
        specs.push(spec);
    }
    return { specs };
}

/**
 * Everything about a request that can be judged without the document, so a
 * malformed one is refused before anything is read off the disk.
 */
export function readAgentSlideRequest(
    action: AgentSlideActionType,
    request: AgentSlideRequestType | null | undefined,
):
    | AgentSlideRefusalType
    | ({ isError?: false } & AgentCheckedSlideRequestType) {
    const { slide, to, items } = request ?? ({} as AgentSlideRequestType);
    if (slide === undefined) {
        if (action !== 'slides' && action !== 'add-slide') {
            return refuse(
                `${action} needs \`slide\`: the number of the slide, ` +
                    'counting from 1.',
            );
        }
    } else if (!checkIsCountingNumber(slide)) {
        return refuse(
            '`slide` is the number of a slide, counting from 1 -- like 3.',
        );
    }
    if (action === 'move-slide') {
        if (to === undefined) {
            return refuse(
                'move-slide needs `to`: the position to move the slide to, ' +
                    'counting from 1.',
            );
        }
        if (!checkIsCountingNumber(to)) {
            return refuse('`to` is a position, counting from 1 -- like 2.');
        }
    } else if (to !== undefined) {
        return refuse(
            action === 'add-slide'
                ? '`to` is for move-slide -- add-slide takes the position ' +
                      'for the new slide as `slide`.'
                : `\`to\` is for move-slide; ${action} does not take it.`,
        );
    }
    const specsRead = readItemSpecs(action, items);
    if (specsRead.isError === true) {
        return specsRead;
    }
    return {
        ...(slide === undefined ? {} : { slide: slide as number }),
        ...(to === undefined ? {} : { to: to as number }),
        specs: specsRead.specs,
    };
}

// --- reading a document ---------------------------------------------------

function readSlideList(json: unknown): JsonObjectType[] {
    const items = checkIsPlainObject(json) ? json.items : undefined;
    return Array.isArray(items) ? items : [];
}

function readSlideDim(slide: unknown): DimType | null {
    if (!checkIsPlainObject(slide)) {
        return null;
    }
    const width = slide.metadata?.width;
    const height = slide.metadata?.height;
    if (
        checkIsFiniteNumber(width) &&
        checkIsFiniteNumber(height) &&
        width > 0 &&
        height > 0
    ) {
        return { width, height };
    }
    return null;
}

function toMaxId(list: unknown[]) {
    let maxId = 0;
    for (const one of list) {
        if (
            checkIsPlainObject(one) &&
            checkIsFiniteNumber(one.id) &&
            one.id > maxId
        ) {
            maxId = one.id;
        }
    }
    return Math.floor(maxId);
}

function cutText(text: string, limit: number) {
    if (text.length <= limit) {
        return { text, isCut: false };
    }
    let end = limit;
    const lastCode = text.charCodeAt(end - 1);
    // Never half of a surrogate pair: an emoji cut in two is not a character.
    if (lastCode >= 0xd800 && lastCode <= 0xdbff) {
        end -= 1;
    }
    return { text: `${text.slice(0, end)}…`, isCut: true };
}

function toShownNumber(value: unknown) {
    // Two decimals are more than a pixel needs, and `279.33333333333337` is
    // eighteen characters a model reads once per box per slide.
    return checkIsFiniteNumber(value) ? Math.round(value * 100) / 100 : null;
}

function toFileName(source: string) {
    const isFileLink = /^file:/i.test(source);
    const path = isFileLink ? source.replace(/[?#].*$/, '') : source;
    const name =
        path
            .split(/[\\/]/)
            .filter((part) => {
                return part !== '';
            })
            .pop() ?? '';
    if (!isFileLink) {
        return cutText(name, AGENT_SLIDE_LIMITS.shownUrlChars).text;
    }
    try {
        return cutText(
            decodeURIComponent(name),
            AGENT_SLIDE_LIMITS.shownUrlChars,
        ).text;
    } catch (_error) {
        return cutText(name, AGENT_SLIDE_LIMITS.shownUrlChars).text;
    }
}

/**
 * What a box shows, in as few characters as say it: a web address as it is,
 * and a file on this computer by its NAME only -- the rest of a path carries
 * the user's account name, which has no business in a model's context (the
 * reason `owa_app_state` stopped sending the data directory). A picture
 * embedded in the document says nothing: its data is megabytes of base64.
 */
function toShownSource(item: JsonObjectType): { url?: string; file?: string } {
    let source: unknown;
    if (item.type === 'image') {
        source = item.srcData;
    } else if (item.type === 'video' || item.type === 'audio') {
        source = item.filePath;
    } else if (item.type === 'youtube' || item.type === 'website') {
        source = item.url;
    }
    if (
        typeof source !== 'string' ||
        source === '' ||
        source.startsWith('data:')
    ) {
        return {};
    }
    if (REMOTE_URL_PATTERN.test(source)) {
        return { url: cutText(source, AGENT_SLIDE_LIMITS.shownUrlChars).text };
    }
    return { file: toFileName(source) };
}

function summarizeItem(item: JsonObjectType) {
    const lockField = item.locked === true ? { locked: true } : {};
    const boxFields = {
        left: toShownNumber(item.left),
        top: toShownNumber(item.top),
        width: toShownNumber(item.width),
        height: toShownNumber(item.height),
    };
    if (item.type !== 'text') {
        return {
            id: item.id,
            type: item.type,
            ...boxFields,
            ...toShownSource(item),
            ...lockField,
        };
    }
    const shown = cutText(
        typeof item.text === 'string' ? item.text : '',
        AGENT_SLIDE_LIMITS.shownTextChars,
    );
    return {
        id: item.id,
        type: 'text',
        text: shown.text,
        // Said, because the cut text is not the box's text: written back as
        // `text` it would throw the rest of the words away.
        ...(shown.isCut ? { isTextCut: true } : {}),
        ...boxFields,
        fontSize: toShownNumber(item.fontSize),
        fontFamily:
            typeof item.fontFamily === 'string' ? item.fontFamily : null,
        fontWeight:
            typeof item.fontWeight === 'string' ? item.fontWeight : null,
        color: typeof item.color === 'string' ? item.color : null,
        backgroundColor:
            typeof item.backgroundColor === 'string'
                ? item.backgroundColor
                : null,
        align: toShownAlign(item.textHorizontalAlignment),
        valign: toShownValign(item.textVerticalAlignment),
        rotate: toShownNumber(item.rotate ?? 0),
        ...lockField,
    };
}

function summarizeItems(items: unknown) {
    const list = Array.isArray(items) ? items.filter(checkIsPlainObject) : [];
    return {
        items: list.slice(0, AGENT_SLIDE_LIMITS.listedItems).map((item) => {
            return summarizeItem(item);
        }),
        ...(list.length > AGENT_SLIDE_LIMITS.listedItems
            ? { itemCount: list.length }
            : {}),
    };
}

function summarizeSlide(
    slide: JsonObjectType,
    slideNumber: number,
    documentDim: DimType | null,
) {
    const dim = readSlideDim(slide);
    // Only a slide that differs from the first says its size: positions are
    // pixels on the slide, and the document's size is said once above.
    const isOwnSize =
        dim !== null &&
        (documentDim === null ||
            dim.width !== documentDim.width ||
            dim.height !== documentDim.height);
    return {
        number: slideNumber,
        id: slide.id,
        ...(typeof slide.name === 'string' && slide.name !== ''
            ? { name: cutText(slide.name, 100).text }
            : {}),
        ...(slide.isDisabled === true ? { isDisabled: true } : {}),
        ...(dim !== null && isOwnSize
            ? { width: dim.width, height: dim.height }
            : {}),
        ...summarizeItems(slide.canvasItems),
    };
}

function genNoSuchSlideReason(
    name: string,
    slideNumber: number,
    slideCount: number,
) {
    if (slideCount === 0) {
        return (
            `"${name}" has no slides yet, so there is no slide ` +
            `${slideNumber} -- add one with action "add-slide".`
        );
    }
    const counted =
        slideCount === 1
            ? '1 slide, numbered 1'
            : `${slideCount} slides, numbered 1 to ${slideCount}`;
    return `There is no slide ${slideNumber} in "${name}": it has ${counted}.`;
}

/**
 * The answer to `slides`: every slide with its boxes, from `slide` when the
 * request gives one. Paged by count and by size, never below one slide, and
 * the note says where the next page starts -- a list that silently stopped
 * would read as the whole document.
 */
export function readAgentSlideDocument(
    json: unknown,
    name: string,
    request: AgentCheckedSlideRequestType,
):
    | AgentSlideRefusalType
    | { isError?: false; slideDocument: AgentSlideDocumentType } {
    const slides = readSlideList(json);
    if (request.slide !== undefined && request.slide > slides.length) {
        return refuse(genNoSuchSlideReason(name, request.slide, slides.length));
    }
    const documentDim = readSlideDim(slides[0]);
    const startIndex = (request.slide ?? 1) - 1;
    const listed: JsonObjectType[] = [];
    let listedChars = 0;
    for (
        let index = startIndex;
        index < slides.length &&
        listed.length < AGENT_SLIDE_LIMITS.listedSlides;
        index += 1
    ) {
        const slide = slides[index];
        const summary = checkIsPlainObject(slide)
            ? summarizeSlide(slide, index + 1, documentDim)
            : { number: index + 1, items: [] };
        listedChars += JSON.stringify(summary, null, 2).length;
        if (listed.length > 0 && listedChars > AGENT_SLIDE_LIMITS.listedChars) {
            break;
        }
        listed.push(summary);
    }
    const lastNumber = startIndex + listed.length;
    const hasMore = lastNumber < slides.length;
    const slideDocument: AgentSlideDocumentType = {
        name,
        slideCount: slides.length,
        width: documentDim?.width ?? null,
        height: documentDim?.height ?? null,
        slides: listed,
    };
    if (hasMore) {
        slideDocument.isTruncated = true;
    }
    if (listed.length > 0 && (hasMore || startIndex > 0)) {
        slideDocument.note =
            `Slides ${startIndex + 1} to ${lastNumber} of ${slides.length} ` +
            'are listed.' +
            (hasMore
                ? ` Ask again with slide: ${lastNumber + 1} for the ones after.`
                : '');
    }
    return { slideDocument };
}

// --- changing a document --------------------------------------------------

function describeBoxIds(items: unknown[]) {
    const idList = items
        .filter(checkIsPlainObject)
        .map((item) => {
            return item.id;
        })
        .filter((id) => {
            return id !== undefined;
        });
    if (idList.length === 0) {
        return (
            'It has no boxes -- one without an `id` is added as a new text ' +
            'box.'
        );
    }
    const shownList = idList.slice(0, AGENT_SLIDE_LIMITS.listedItems);
    return (
        `Its boxes are ${shownList.join(', ')}` +
        (idList.length > shownList.length ? ', …' : '') +
        ' -- action "slides" says which is which.'
    );
}

function toBoxKindPhrase(type: unknown) {
    const word =
        typeof type === 'string' && type !== '' ? type.slice(0, 20) : 'unknown';
    return `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word} box`;
}

/**
 * Whether `text` is the cut text `slides` showed rather than words anybody
 * chose: written back, it would keep the first 300 characters of the box and
 * throw the rest away. Models echo what they read into a change they were
 * asked to make to something else, so this is the case to catch.
 */
function checkIsShortenedTextEcho(currentText: unknown, text: string) {
    const limit = AGENT_SLIDE_LIMITS.shownTextChars;
    if (typeof currentText !== 'string' || currentText.length <= limit) {
        return false;
    }
    const bareText = text.endsWith('…') ? text.slice(0, -1) : text;
    return (
        bareText.length >= limit - 1 &&
        bareText.length <= limit &&
        currentText.startsWith(bareText)
    );
}

// The request's words for a field, and the field the editor reads it from.
function toAppFieldName(key: string) {
    if (key === 'align') {
        return 'textHorizontalAlignment';
    }
    return key === 'valign' ? 'textVerticalAlignment' : key;
}

/** Writes what a spec gives onto a box, in the fields the editor reads. */
function writeSpecFields(item: JsonObjectType, spec: AgentSlideItemSpecType) {
    for (const key of BOX_FIELD_LIST) {
        if (spec[key] !== undefined) {
            item[key] = spec[key];
        }
    }
    if (spec.text !== undefined) {
        item.text = spec.text;
    }
    if (spec.fontSize !== undefined) {
        item.fontSize = spec.fontSize;
    }
    if (spec.color !== undefined) {
        item.color = spec.color;
    }
    // "" is the editor's own "--": no font of its own, the slide's default.
    if (spec.fontFamily !== undefined) {
        item.fontFamily = spec.fontFamily === '' ? null : spec.fontFamily;
    }
    if (spec.fontWeight !== undefined) {
        item.fontWeight = spec.fontWeight === '' ? null : spec.fontWeight;
    }
    if (spec.align !== undefined) {
        item.textHorizontalAlignment = spec.align;
    }
    if (spec.valign !== undefined) {
        item.textVerticalAlignment = toAppValign(spec.valign);
    }
    // Box alignment is a one-off instruction to the editor's layout tool,
    // stripped by `cleanupProps` whenever a box is loaded; it is never data.
    delete item.horizontalAlignment;
    delete item.verticalAlignment;
    return item;
}

function checkIsSpecChanging(
    before: JsonObjectType,
    after: JsonObjectType,
    spec: AgentSlideItemSpecType,
) {
    return Object.keys(spec).some((key) => {
        if (key === 'id' || key === 'remove') {
            return false;
        }
        const fieldName = toAppFieldName(key);
        return before[fieldName] !== after[fieldName];
    });
}

/**
 * A new text box: the app's own default box (`CanvasItemText.genDefaultItem`)
 * for everything the request does not say, but centred on THIS slide, and
 * with no words nobody wrote -- the app's default text is its own name, which
 * has no place on a congregation's screen.
 */
export function genAgentTextItem(
    defaults: JsonObjectType,
    spec: AgentSlideItemSpecType,
    id: number,
    dim: DimType,
) {
    const width = spec.width ?? Math.round(dim.width * NEW_BOX_WIDTH_RATIO);
    const height = spec.height ?? Math.round(dim.height * NEW_BOX_HEIGHT_RATIO);
    const item: JsonObjectType = {
        ...defaults,
        id,
        type: 'text',
        text: '',
        fontSize: NEW_BOX_FONT_SIZE,
        left: Math.round((dim.width - width) / 2),
        top: Math.round((dim.height - height) / 2),
        width,
        height,
        rotate: checkIsFiniteNumber(defaults.rotate) ? defaults.rotate : 0,
    };
    // A default is never a locked box.
    delete item.locked;
    return writeSpecFields(item, spec);
}

function applyAddSlide(
    json: JsonObjectType,
    slides: JsonObjectType[],
    request: AgentCheckedSlideRequestType,
    context: AgentSlideContextType,
): AgentSlideChangeType {
    const position = Math.min(
        request.slide ?? slides.length + 1,
        slides.length + 1,
    );
    // The size of the slides already there, so the new one is not the one
    // slide that warns about the wrong dimension on the projector.
    const dim = readSlideDim(slides[0]) ?? context.getDefaultDim();
    const defaults =
        request.specs.length === 0 ? {} : context.genTextDefaults();
    const canvasItems = request.specs.map((spec, index) => {
        return genAgentTextItem(defaults, spec, index + 1, dim);
    });
    const id = toMaxId(slides) + 1;
    const newSlides = [...slides];
    newSlides.splice(position - 1, 0, {
        id,
        metadata: { width: dim.width, height: dim.height },
        canvasItems,
        type: 'slide',
    });
    return {
        didChange: true,
        json: { ...json, items: newSlides },
        summary: `Added a slide to “${context.name}”`,
        checkItems: canvasItems.map((item) => {
            return { item };
        }),
        result: { added: position, id, slideCount: newSlides.length },
    };
}

function applyUpdateSlide(
    json: JsonObjectType,
    slides: JsonObjectType[],
    slideNumber: number,
    request: AgentCheckedSlideRequestType,
    context: AgentSlideContextType,
): AgentSlideRefusalType | AgentSlideChangeType {
    if (request.specs.length === 0) {
        return refuse('update-slide needs at least one box in `items`.');
    }
    const slide = slides[slideNumber - 1];
    const items: JsonObjectType[] = Array.isArray(slide.canvasItems)
        ? [...slide.canvasItems]
        : [];
    const checkItems: AgentCheckedItemType[] = [];
    let nextId = toMaxId(items) + 1;
    let defaults: JsonObjectType | null = null;
    let didChange = false;
    for (const [index, spec] of request.specs.entries()) {
        const label = `Box ${index + 1} of \`items\``;
        if (spec.id === undefined) {
            defaults ??= context.genTextDefaults();
            const dim =
                readSlideDim(slide) ??
                readSlideDim(slides[0]) ??
                context.getDefaultDim();
            const item = genAgentTextItem(defaults, spec, nextId, dim);
            nextId += 1;
            items.push(item);
            checkItems.push({ item });
            didChange = true;
            continue;
        }
        const itemIndex = items.findIndex((item) => {
            return checkIsPlainObject(item) && item.id === spec.id;
        });
        if (itemIndex === -1) {
            return refuse(
                `${label}: slide ${slideNumber} has no box with id ` +
                    `${spec.id}. ${describeBoxIds(items)}`,
            );
        }
        const current = items[itemIndex];
        if (current.locked === true) {
            return refuse(
                `${label}: box ${spec.id} is locked in the slide editor, so ` +
                    'it cannot be changed or removed until someone unlocks it ' +
                    'there.',
            );
        }
        if (spec.remove === true) {
            items.splice(itemIndex, 1);
            didChange = true;
            continue;
        }
        if (current.type !== 'text') {
            const kindPhrase = toBoxKindPhrase(current.type);
            if (spec.text !== undefined) {
                return refuse(
                    `${label}: box ${spec.id} is ${kindPhrase}, which has no ` +
                        'text to change.',
                );
            }
            const styleKeyList = TEXT_FIELD_LIST.filter((key) => {
                return spec[key] !== undefined;
            });
            if (styleKeyList.length > 0) {
                return refuse(
                    `${label}: box ${spec.id} is ${kindPhrase}, and ` +
                        `${styleKeyList.join(', ')} only apply to a text ` +
                        'box -- its left, top, width, height, rotate and ' +
                        'backgroundColor can change.',
                );
            }
        } else if (
            spec.text !== undefined &&
            checkIsShortenedTextEcho(current.text, spec.text)
        ) {
            return refuse(
                `${label}: that is the shortened text action "slides" showed, ` +
                    `not box ${spec.id}'s whole text -- leave \`text\` out to ` +
                    'keep its words as they are.',
            );
        }
        const merged = writeSpecFields({ ...current }, spec);
        if (checkIsSpecChanging(current, merged, spec)) {
            items[itemIndex] = merged;
            checkItems.push({ item: merged, before: current });
            didChange = true;
        }
    }
    const newSlides = [...slides];
    newSlides[slideNumber - 1] = { ...slide, canvasItems: items };
    return {
        didChange,
        json: { ...json, items: newSlides },
        summary: `Changed slide ${slideNumber} of “${context.name}”`,
        checkItems,
        result: { updated: slideNumber, ...summarizeItems(items) },
        ...(didChange
            ? {}
            : {
                  note:
                      'Those were already its values, so nothing was ' +
                      'changed.',
              }),
    };
}

function applyDeleteSlide(
    json: JsonObjectType,
    slides: JsonObjectType[],
    slideNumber: number,
    context: AgentSlideContextType,
): AgentSlideChangeType {
    // The editor's own Delete takes the last slide too (`deleteSlides` keeps
    // no minimum), and an empty document is one the app opens -- so this does
    // the same rather than invent a rule the app does not have.
    const newSlides = slides.filter((_slide, index) => {
        return index !== slideNumber - 1;
    });
    return {
        didChange: true,
        json: { ...json, items: newSlides },
        summary: `Removed slide ${slideNumber} from “${context.name}”`,
        checkItems: [],
        result: { removed: slideNumber, slideCount: newSlides.length },
        ...(newSlides.length === 0
            ? {
                  note:
                      `"${context.name}" has no slides left -- add-slide ` +
                      'adds one.',
              }
            : {}),
    };
}

function applyMoveSlide(
    json: JsonObjectType,
    slides: JsonObjectType[],
    slideNumber: number,
    request: AgentCheckedSlideRequestType,
    context: AgentSlideContextType,
): AgentSlideRefusalType | AgentSlideChangeType {
    if (request.to === undefined) {
        return refuse(
            'move-slide needs `to`: the position to move the slide to, ' +
                'counting from 1.',
        );
    }
    const to = Math.min(request.to, slides.length);
    const summary = `Moved slide ${slideNumber} of “${context.name}” to ${to}`;
    const result = { moved: slideNumber, to, slideCount: slides.length };
    if (to === slideNumber) {
        return {
            didChange: false,
            json,
            summary,
            checkItems: [],
            result,
            note:
                `Slide ${slideNumber} is already at position ${to}, so ` +
                'nothing was moved.',
        };
    }
    const newSlides = [...slides];
    const [movingSlide] = newSlides.splice(slideNumber - 1, 1);
    newSlides.splice(to - 1, 0, movingSlide);
    return {
        didChange: true,
        json: { ...json, items: newSlides },
        summary,
        checkItems: [],
        result,
    };
}

function applyDuplicateSlide(
    json: JsonObjectType,
    slides: JsonObjectType[],
    slideNumber: number,
    context: AgentSlideContextType,
): AgentSlideChangeType {
    // A deep copy, name and all, like the editor's own Duplicate. Its boxes
    // are not re-checked: they are the document's own boxes byte for byte,
    // so the copy cannot be less readable than what it copies.
    const copy = structuredClone(slides[slideNumber - 1]);
    const id = toMaxId(slides) + 1;
    copy.id = id;
    const newSlides = [...slides];
    newSlides.splice(slideNumber, 0, copy);
    return {
        didChange: true,
        json: { ...json, items: newSlides },
        summary: `Copied slide ${slideNumber} of “${context.name}”`,
        checkItems: [],
        result: {
            copied: slideNumber,
            added: slideNumber + 1,
            id,
            slideCount: newSlides.length,
        },
    };
}

/**
 * One change to one slide, as the new document JSON plus what to say about
 * it. The caller validates `json` with the app's own validators, backs up and
 * writes it as ONE history entry; nothing here touches anything but the
 * returned object.
 */
export function applyAgentSlideAction(
    action: AgentSlideChangeActionType,
    json: JsonObjectType,
    request: AgentCheckedSlideRequestType,
    context: AgentSlideContextType,
): AgentSlideRefusalType | AgentSlideChangeType {
    const slides = readSlideList(json);
    if (action === 'add-slide') {
        return applyAddSlide(json, slides, request, context);
    }
    const slideNumber = request.slide;
    if (slideNumber === undefined) {
        return refuse(
            `${action} needs \`slide\`: the number of the slide, counting ` +
                'from 1.',
        );
    }
    if (slideNumber > slides.length) {
        return refuse(
            genNoSuchSlideReason(context.name, slideNumber, slides.length),
        );
    }
    if (!checkIsPlainObject(slides[slideNumber - 1])) {
        return refuse(
            `Slide ${slideNumber} of "${context.name}" could not be read, so ` +
                'it was not changed.',
        );
    }
    if (action === 'update-slide') {
        return applyUpdateSlide(json, slides, slideNumber, request, context);
    }
    if (action === 'delete-slide') {
        return applyDeleteSlide(json, slides, slideNumber, context);
    }
    if (action === 'move-slide') {
        return applyMoveSlide(json, slides, slideNumber, request, context);
    }
    return applyDuplicateSlide(json, slides, slideNumber, context);
}
