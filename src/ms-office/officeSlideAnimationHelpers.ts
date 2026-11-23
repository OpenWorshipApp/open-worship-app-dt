// How the boxes of a PowerPoint slide COME IN: a box that appears, fades,
// flies, wipes or zooms in on a click, with the one before it or after it,
// whole or one line at a time -- read and written for `owa_office_edit`
// (2026-11-20, the goal _chatbot can change do everything on a given pptx_:
// _make the verses come in one line at a time_).
//
// Written as PowerPoint writes it (ECMA-376 Part 1, PresentationML
// animation): `p:timing` > `p:tnLst` > the root time node > the MAIN
// SEQUENCE, in it one group per click, in a group one step per "after the
// previous", in a step the effects that start together. Each effect names
// its preset (`presetID`, `presetClass="entr"`) so PowerPoint shows it by
// its name, and a text box is listed in `p:bldLst` -- by paragraph when its
// lines come in one by one.
//
// Only the main sequence is changed; a trigger's sequence, a video's node
// and the other boxes' effects are kept as they were, and a time node's id
// is renumbered in document order (a condition naming one follows it).
//
// Pure, strings in and out, the same tag scanner as the words.

import {
    type ElementType,
    listChildElements,
    scanTags,
    unescapeXml,
} from './officeXmlEditHelpers';
import { listSlideBoxes } from './officeSlideBoxHelpers';

export const OFFICE_ANIMATION_LIST = [
    'appear',
    'fade',
    'fly',
    'wipe',
    'zoom',
] as const;

export type OfficeAnimationEffectType = (typeof OFFICE_ANIMATION_LIST)[number];

export type OfficeAnimationStartType = 'click' | 'with' | 'after';

export type OfficeAnimationType = {
    effect: OfficeAnimationEffectType;
    // each paragraph of the box comes in on its own step
    byLine: boolean;
    // on a click / with the previous / after the previous
    start: OfficeAnimationStartType;
    // the effect's duration
    seconds: number;
};

export type SlideAnimationType = {
    shapeId: string;
    effect: OfficeAnimationEffectType | 'other';
    byLine: boolean;
};

export const DEFAULT_ANIMATION_SECONDS = 0.5;

// PowerPoint's own presets: "Fly In" and "Wipe" from the bottom, "Zoom"
// from the object's center -- the direction each starts with.
const PRESET_MAP: Record<
    OfficeAnimationEffectType,
    { id: number; subtype: number }
> = {
    appear: { id: 1, subtype: 0 },
    fly: { id: 2, subtype: 4 },
    fade: { id: 10, subtype: 0 },
    wipe: { id: 22, subtype: 4 },
    zoom: { id: 53, subtype: 16 },
};

const ANIMATION_WORD_MAP: Record<string, OfficeAnimationEffectType | 'none'> = {
    appear: 'appear',
    fade: 'fade',
    fly: 'fly',
    wipe: 'wipe',
    zoom: 'zoom',
    none: 'none',
    off: 'none',
};

/** An animation as a model names it ("Fade In", "fly-in", "off"), or null. */
export function toOfficeAnimation(
    value: unknown,
): OfficeAnimationEffectType | 'none' | null {
    if (typeof value !== 'string') {
        return null;
    }
    const text = value
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, ' ')
        .replace(/ in$/, '');
    return Object.hasOwn(ANIMATION_WORD_MAP, text)
        ? ANIMATION_WORD_MAP[text]
        : null;
}

// in ms; PowerPoint's longest is 59 seconds
function toDuration(seconds: unknown) {
    const value =
        typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0
            ? Math.min(seconds, 59)
            : DEFAULT_ANIMATION_SECONDS;
    return Math.max(1, Math.round(value * 1000));
}

// --- reading the tree ----------------------------------------------------

// A new time node's id until the tree is numbered; the main sequence made
// here has its own, so a group's "when it begins" can name it.
const NEW_ID = 'new';
const NEW_MAIN_ID = 'new-main';

function readAttribute(attributes: string, name: string) {
    const matched = new RegExp(
        `\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
    ).exec(attributes);
    if (matched === null) {
        return null;
    }
    return unescapeXml(matched[1] ?? matched[2] ?? '');
}

function checkIsSelfClosing(element: ElementType) {
    return element.openEnd === element.end;
}

function listChildren(xml: string, parent: ElementType) {
    return checkIsSelfClosing(parent)
        ? []
        : listChildElements(xml, parent.openEnd, parent.closeStart);
}

function findChild(xml: string, parent: ElementType | null, name: string) {
    if (parent === null) {
        return null;
    }
    return (
        listChildren(xml, parent).find((child) => {
            return child.name === name;
        }) ?? null
    );
}

function readOpenTag(xml: string, element: ElementType) {
    return xml.slice(element.start, element.openEnd);
}

/**
 * `childXml` put into `parent`: before its first child named in `before`
 * (null: before every child), else last. A parent closing itself is opened.
 */
function insertChildXml(
    xml: string,
    parent: ElementType,
    childXml: string,
    before: string[] | null,
) {
    if (checkIsSelfClosing(parent)) {
        const tag = readOpenTag(xml, parent).replace(/\s*\/>$/, '>');
        return (
            xml.slice(0, parent.start) +
            tag +
            childXml +
            `</${parent.name}>` +
            xml.slice(parent.end)
        );
    }
    const children = listChildren(xml, parent);
    const next =
        before === null
            ? children[0]
            : children.find((child) => {
                  return before.includes(child.name);
              });
    const at = next?.start ?? parent.closeStart;
    return xml.slice(0, at) + childXml + xml.slice(at);
}

type EffectRecordType = {
    presetClass: string;
    presetId: number | null;
    nodeType: string | null;
    grpId: string | null;
    // the box it plays on
    spid: string | null;
    // on some of its paragraphs, not the whole box
    isParagraph: boolean;
};

/** Every effect (a time node naming its preset) in `[from, to)`, in order. */
function listEffectRecords(xml: string, from = 0, to = xml.length) {
    const out: EffectRecordType[] = [];
    let depth = 0;
    let current: EffectRecordType | null = null;
    let currentDepth = 0;
    for (const tag of scanTags(xml, from, to)) {
        if (tag.name === 'p:cTn') {
            if (tag.isClose) {
                depth--;
                if (current !== null && depth < currentDepth) {
                    current = null;
                }
                continue;
            }
            const presetClass = readAttribute(tag.attributes, 'presetClass');
            if (!tag.isSelfClosing) {
                depth++;
            }
            if (presetClass === null) {
                continue;
            }
            const presetId = Number(readAttribute(tag.attributes, 'presetID'));
            const record: EffectRecordType = {
                presetClass,
                presetId: Number.isInteger(presetId) ? presetId : null,
                nodeType: readAttribute(tag.attributes, 'nodeType'),
                grpId: readAttribute(tag.attributes, 'grpId'),
                spid: null,
                isParagraph: false,
            };
            out.push(record);
            if (!tag.isSelfClosing) {
                current = record;
                currentDepth = depth;
            }
            continue;
        }
        if (current === null || tag.isClose) {
            continue;
        }
        if (tag.name === 'p:spTgt' && current.spid === null) {
            current.spid = readAttribute(tag.attributes, 'spid');
        } else if (tag.name === 'p:txEl') {
            current.isParagraph = true;
        }
    }
    return out;
}

// The delay of the first start condition right after `from`, in ms.
function readCondDelay(xml: string, from: number) {
    const pattern = /\s*<p:stCondLst>\s*<p:cond\b[^>]*?\sdelay="(\d+)"/y;
    pattern.lastIndex = from;
    const matched = pattern.exec(xml);
    return matched === null ? 0 : Number(matched[1]);
}

// How long an effect runs from the start of its step, in ms: its own
// delay and its longest behaviour. Null when no behaviour says.
function readEffectLength(effectXml: string) {
    let own: number | null = null;
    let longest: number | null = null;
    for (const tag of scanTags(effectXml)) {
        if (tag.name !== 'p:cTn' || tag.isClose) {
            continue;
        }
        const delay = tag.isSelfClosing ? 0 : readCondDelay(effectXml, tag.end);
        if (own === null) {
            own = delay;
            continue;
        }
        const durText = readAttribute(tag.attributes, 'dur');
        const dur = durText === null ? NaN : Number(durText);
        if (!Number.isFinite(dur)) {
            continue;
        }
        const repeat = Number(readAttribute(tag.attributes, 'repeatCount'));
        const autoReverse = readAttribute(tag.attributes, 'autoRev');
        const times =
            (Number.isFinite(repeat) && repeat > 0 ? repeat / 1000 : 1) *
            (autoReverse === '1' || autoReverse === 'true' ? 2 : 1);
        longest = Math.max(longest ?? 0, delay + dur * times);
    }
    return own === null || longest === null ? null : own + longest;
}

type TimingFrameType = {
    timing: ElementType | null;
    tnLst: ElementType | null;
    root: ElementType | null;
    rootTn: ElementType | null;
    rootList: ElementType | null;
};

// `timingXml` is one `p:timing` element.
function readTimingFrame(timingXml: string): TimingFrameType {
    const timing =
        listChildElements(timingXml, 0, timingXml.length).find((child) => {
            return child.name === 'p:timing';
        }) ?? null;
    const tnLst = findChild(timingXml, timing, 'p:tnLst');
    const root = findChild(timingXml, tnLst, 'p:par');
    const rootTn = findChild(timingXml, root, 'p:cTn');
    const rootList = findChild(timingXml, rootTn, 'p:childTnLst');
    return { timing, tnLst, root, rootTn, rootList };
}

type MainSeqType = {
    seq: ElementType;
    cTn: ElementType;
    list: ElementType | null;
    id: string;
};

function findMainSeq(timingXml: string): MainSeqType | null {
    const { rootList } = readTimingFrame(timingXml);
    if (rootList === null) {
        return null;
    }
    for (const child of listChildren(timingXml, rootList)) {
        if (child.name !== 'p:seq') {
            continue;
        }
        const cTn = findChild(timingXml, child, 'p:cTn');
        const tag = cTn === null ? '' : readOpenTag(timingXml, cTn);
        if (cTn !== null && readAttribute(tag, 'nodeType') === 'mainSeq') {
            return {
                seq: child,
                cTn,
                list: findChild(timingXml, cTn, 'p:childTnLst'),
                id: readAttribute(tag, 'id') ?? '',
            };
        }
    }
    return null;
}

function genMainSeqXml() {
    const slideCond = (event: string) => {
        return (
            `<p:cond evt="${event}" delay="0"><p:tgtEl><p:sldTgt/>` +
            '</p:tgtEl></p:cond>'
        );
    };
    return (
        '<p:seq concurrent="1" nextAc="seek">' +
        `<p:cTn id="${NEW_MAIN_ID}" dur="indefinite" nodeType="mainSeq"/>` +
        `<p:prevCondLst>${slideCond('onPrev')}</p:prevCondLst>` +
        `<p:nextCondLst>${slideCond('onNext')}</p:nextCondLst></p:seq>`
    );
}

function genRootXml(inner: string) {
    return (
        `<p:par><p:cTn id="${NEW_ID}" dur="indefinite" restart="never" ` +
        `nodeType="tmRoot"><p:childTnLst>${inner}</p:childTnLst></p:cTn>` +
        '</p:par>'
    );
}

/** The timing with a main sequence -- made where it has none -- or null. */
function ensureMainSeq(timingXml: string) {
    if (findMainSeq(timingXml) !== null) {
        return timingXml;
    }
    const frame = readTimingFrame(timingXml);
    if (frame.timing === null) {
        return null;
    }
    if (frame.tnLst === null) {
        return insertChildXml(
            timingXml,
            frame.timing,
            `<p:tnLst>${genRootXml(genMainSeqXml())}</p:tnLst>`,
            null,
        );
    }
    if (frame.root === null) {
        return insertChildXml(
            timingXml,
            frame.tnLst,
            genRootXml(genMainSeqXml()),
            null,
        );
    }
    if (frame.rootTn === null) {
        return null;
    }
    if (frame.rootList === null) {
        return insertChildXml(
            timingXml,
            frame.rootTn,
            `<p:childTnLst>${genMainSeqXml()}</p:childTnLst>`,
            ['p:subTnLst'],
        );
    }
    // the main sequence goes first, a trigger's after it
    return insertChildXml(timingXml, frame.rootList, genMainSeqXml(), null);
}

// --- the main sequence as clicks, steps and effects ----------------------

type EffectNodeType = {
    xml: string;
    record: EffectRecordType | null;
    length: number | null;
};

type StepNodeType = {
    // the step's own `p:par` up to and with its `<p:childTnLst>`
    head: string;
    tail: string;
    delay: number;
    effects: EffectNodeType[];
};

type GroupNodeType = {
    // as read, written back as it was while nothing in it changed
    raw: string;
    head: string;
    tail: string;
    // the group that starts with the slide, not on a click
    isAuto: boolean;
    // null: a group not laid out as PowerPoint lays one out, kept whole
    steps: StepNodeType[] | null;
    isChanged: boolean;
};

const PAR_TAIL = '</p:childTnLst></p:cTn></p:par>';

function readTimePar(xml: string, par: ElementType) {
    if (par.name !== 'p:par') {
        return null;
    }
    const cTn = findChild(xml, par, 'p:cTn');
    const list = findChild(xml, cTn, 'p:childTnLst');
    if (list === null || checkIsSelfClosing(list)) {
        return null;
    }
    return {
        head: xml.slice(par.start, list.openEnd),
        tail: xml.slice(list.closeStart, par.end),
        children: listChildren(xml, list),
    };
}

function readStepDelay(head: string) {
    const matched = /<p:stCondLst>\s*<p:cond\b[^>]*?\sdelay="(\d+)"/.exec(head);
    return matched === null ? 0 : Number(matched[1]);
}

function writeStepDelay(head: string, delay: number) {
    return head.replace(
        /(<p:stCondLst>\s*<p:cond\b[^>]*?\sdelay=")\d+(")/,
        (_whole, before: string, after: string) => {
            return `${before}${delay}${after}`;
        },
    );
}

function toEffectNode(xml: string): EffectNodeType {
    return {
        xml,
        record: listEffectRecords(xml)[0] ?? null,
        length: readEffectLength(xml),
    };
}

function readGroups(xml: string, list: ElementType | null): GroupNodeType[] {
    if (list === null) {
        return [];
    }
    return listChildren(xml, list).map((child) => {
        const raw = xml.slice(child.start, child.end);
        const group = readTimePar(xml, child);
        const steps: StepNodeType[] = [];
        let isLaidOut = group !== null && group.children.length > 0;
        for (const stepElement of group?.children ?? []) {
            const step = readTimePar(xml, stepElement);
            if (step === null) {
                isLaidOut = false;
                break;
            }
            steps.push({
                head: step.head,
                tail: step.tail,
                delay: readStepDelay(step.head),
                effects: step.children.map((effect) => {
                    return toEffectNode(xml.slice(effect.start, effect.end));
                }),
            });
        }
        return {
            raw,
            head: group?.head ?? '',
            tail: group?.tail ?? '',
            isAuto: /\sevt="onBegin"/.test(group?.head ?? ''),
            steps: isLaidOut ? steps : null,
            isChanged: false,
        };
    });
}

function readStepLength(step: StepNodeType) {
    return Math.max(
        0,
        ...step.effects.map((effect) => {
            return effect.length ?? 0;
        }),
    );
}

function setNodeType(effect: EffectNodeType, nodeType: string) {
    if (effect.record === null || effect.record.nodeType === nodeType) {
        return;
    }
    effect.xml = effect.xml.replace(
        /<p:cTn\b(?:[^>"']|"[^"]*"|'[^']*')*?\/?>/,
        (tag) => {
            return /\snodeType="[^"]*"/.test(tag)
                ? tag.replace(/\snodeType="[^"]*"/, ` nodeType="${nodeType}"`)
                : tag.replace(/\s*(\/?)>$/, ` nodeType="${nodeType}"$1>`);
        },
    );
    effect.record = { ...effect.record, nodeType };
}

/**
 * The groups with the box's entrance effects taken out, and how many were.
 * A step left empty goes and the steps after it move up by its time; a
 * click's group whose first effect went starts with the next one on that
 * click, so every other box still comes in on the click it came in on.
 */
function takeShapeEffects(groups: GroupNodeType[], spid: string) {
    let count = 0;
    for (const group of groups) {
        const steps = group.steps;
        if (steps === null) {
            continue;
        }
        let shift = 0;
        let isChanged = false;
        const settled: StepNodeType[] = [];
        steps.forEach((step, index) => {
            const kept = step.effects.filter((effect) => {
                return !(
                    effect.record?.presetClass === 'entr' &&
                    effect.record.spid === spid
                );
            });
            const span =
                index + 1 < steps.length
                    ? Math.max(0, steps[index + 1].delay - step.delay)
                    : null;
            const delay = Math.max(0, step.delay - shift);
            if (kept.length === step.effects.length) {
                settled.push({ ...step, delay });
                return;
            }
            isChanged = true;
            count += step.effects.length - kept.length;
            if (kept.length === 0) {
                shift += span ?? 0;
                return;
            }
            const lengths = kept.map((effect) => {
                return effect.length;
            });
            if (span !== null && !lengths.includes(null)) {
                const longest = Math.max(...(lengths as number[]));
                shift += Math.max(0, span - longest);
            }
            settled.push({ ...step, delay, effects: kept });
        });
        if (!isChanged) {
            continue;
        }
        group.isChanged = true;
        group.steps = settled;
        const first = settled[0]?.effects[0];
        if (first !== undefined && !group.isAuto) {
            setNodeType(first, 'clickEffect');
        }
    }
    return {
        groups: groups.filter((group) => {
            return group.steps === null || group.steps.length > 0;
        }),
        count,
    };
}

function genStepHead(delay: number) {
    return (
        `<p:par><p:cTn id="${NEW_ID}" fill="hold"><p:stCondLst>` +
        `<p:cond delay="${delay}"/></p:stCondLst><p:childTnLst>`
    );
}

function genGroup(
    isAuto: boolean,
    mainSeqId: string,
    effect: EffectNodeType,
): GroupNodeType {
    const head =
        `<p:par><p:cTn id="${NEW_ID}" fill="hold"><p:stCondLst>` +
        '<p:cond delay="indefinite"/>' +
        (isAuto
            ? `<p:cond evt="onBegin" delay="0"><p:tn val="${mainSeqId}"/></p:cond>`
            : '') +
        '</p:stCondLst><p:childTnLst>';
    return {
        raw: '',
        head,
        tail: PAR_TAIL,
        isAuto,
        steps: [
            {
                head: genStepHead(0),
                tail: PAR_TAIL,
                delay: 0,
                effects: [effect],
            },
        ],
        isChanged: true,
    };
}

/** One effect put at the end of the main sequence, starting as `start` says. */
function appendEffect(
    groups: GroupNodeType[],
    start: OfficeAnimationStartType,
    mainSeqId: string,
    genXml: (nodeType: string) => string,
) {
    const last = groups.length > 0 ? groups[groups.length - 1] : null;
    const lastSteps = last?.steps ?? null;
    // a last group not laid out as PowerPoint lays one out cannot be
    // joined: the effect comes on a click of its own
    if (
        start === 'click' ||
        (last !== null && (lastSteps === null || lastSteps.length === 0))
    ) {
        groups.push(
            genGroup(false, mainSeqId, toEffectNode(genXml('clickEffect'))),
        );
        return;
    }
    const effect = toEffectNode(
        genXml(start === 'with' ? 'withEffect' : 'afterEffect'),
    );
    if (last === null || lastSteps === null) {
        // the first: it starts with the slide
        groups.push(genGroup(true, mainSeqId, effect));
        return;
    }
    last.isChanged = true;
    const step = lastSteps[lastSteps.length - 1];
    if (start === 'with') {
        step.effects.push(effect);
        return;
    }
    const delay = step.delay + readStepLength(step);
    lastSteps.push({
        head: genStepHead(delay),
        tail: PAR_TAIL,
        delay,
        effects: [effect],
    });
}

function writeGroups(groups: GroupNodeType[]) {
    return groups
        .map((group) => {
            if (!group.isChanged || group.steps === null) {
                return group.raw;
            }
            const steps = group.steps
                .map((step) => {
                    return (
                        writeStepDelay(step.head, step.delay) +
                        step.effects
                            .map((effect) => {
                                return effect.xml;
                            })
                            .join('') +
                        step.tail
                    );
                })
                .join('');
            return group.head + steps + group.tail;
        })
        .join('');
}

/** The main sequence's time node holding `inner`; none, an empty shell. */
function writeMainSeq(xml: string, main: MainSeqType, inner: string) {
    const list = inner === '' ? '' : `<p:childTnLst>${inner}</p:childTnLst>`;
    const { cTn } = main;
    let before = '';
    let after = '';
    if (!checkIsSelfClosing(cTn)) {
        if (main.list !== null) {
            before = xml.slice(cTn.openEnd, main.list.start);
            after = xml.slice(main.list.end, cTn.closeStart);
        } else {
            const sub = findChild(xml, cTn, 'p:subTnLst');
            const at = sub?.start ?? cTn.closeStart;
            before = xml.slice(cTn.openEnd, at);
            after = xml.slice(at, cTn.closeStart);
        }
    }
    const content = before + list + after;
    const tag = readOpenTag(xml, cTn).replace(/\s*\/>$/, '>');
    const cTnXml =
        content === '' ? tag.replace(/>$/, '/>') : `${tag}${content}</p:cTn>`;
    return xml.slice(0, cTn.start) + cTnXml + xml.slice(cTn.end);
}

/**
 * The build list without the box's entries no effect still uses, and with
 * `added`; gone when nothing is left in it.
 */
function writeBuildList(
    xml: string,
    spid: string,
    keptGroupIds: Set<string>,
    added: string,
) {
    const { timing } = readTimingFrame(xml);
    if (timing === null) {
        return xml;
    }
    const buildList = findChild(xml, timing, 'p:bldLst');
    if (buildList === null) {
        return added === ''
            ? xml
            : insertChildXml(xml, timing, `<p:bldLst>${added}</p:bldLst>`, [
                  'p:extLst',
              ]);
    }
    const children = listChildren(xml, buildList);
    const kept = children.filter((child) => {
        const tag = readOpenTag(xml, child);
        return (
            readAttribute(tag, 'spid') !== spid ||
            keptGroupIds.has(readAttribute(tag, 'grpId') ?? '')
        );
    });
    if (kept.length === children.length && added === '') {
        return xml;
    }
    const inner =
        kept
            .map((child) => {
                return xml.slice(child.start, child.end);
            })
            .join('') + added;
    return (
        xml.slice(0, buildList.start) +
        (inner === '' ? '' : `<p:bldLst>${inner}</p:bldLst>`) +
        xml.slice(buildList.end)
    );
}

/** Nothing left but an empty main sequence: the timing can go. */
function checkIsEmptyTiming(xml: string) {
    const frame = readTimingFrame(xml);
    if (frame.timing === null) {
        return false;
    }
    const children = listChildren(xml, frame.timing);
    if (
        children.some((child) => {
            return child.name !== 'p:tnLst';
        })
    ) {
        return false;
    }
    if (frame.tnLst === null) {
        return true;
    }
    const pars = listChildren(xml, frame.tnLst);
    if (pars.length !== 1 || frame.rootTn === null) {
        return pars.length === 0;
    }
    const nodes =
        frame.rootList === null ? [] : listChildren(xml, frame.rootList);
    const main = findMainSeq(xml);
    return (
        nodes.length === 0 ||
        (nodes.length === 1 &&
            main !== null &&
            main.seq.start === nodes[0].start &&
            main.list === null)
    );
}

/** Every time node numbered 1, 2, 3 in document order; a reference follows. */
function renumberTimeNodes(timingXml: string) {
    const idMap = new Map<string, string>();
    let count = 0;
    const numbered = timingXml.replace(
        /<p:cTn\b((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g,
        (_whole, attributes: string, slash: string) => {
            count++;
            const id = String(count);
            const old = readAttribute(attributes, 'id');
            if (old !== null && old !== NEW_ID && !idMap.has(old)) {
                idMap.set(old, id);
            }
            const written = /\sid\s*=\s*"[^"]*"/.test(attributes)
                ? attributes.replace(/\sid\s*=\s*"[^"]*"/, ` id="${id}"`)
                : ` id="${id}"${attributes}`;
            return `<p:cTn${written}${slash}>`;
        },
    );
    return numbered.replace(
        /(<p:tn\b[^>]*?\sval=")([^"]*)(")/g,
        (whole, before: string, value: string, after: string) => {
            const mapped = idMap.get(value);
            return mapped === undefined ? whole : before + mapped + after;
        },
    );
}

// --- the box and its effects ---------------------------------------------

type AnimatedBoxType = {
    tagName: string;
    // the index, among all of the box's paragraphs, of each with words
    lines: number[];
};

function checkHasWords(paragraphXml: string) {
    for (const matched of paragraphXml.matchAll(
        /<a:t\b[^>]*>([^<]*)<\/a:t>/g,
    )) {
        if (unescapeXml(matched[1]).trim() !== '') {
            return true;
        }
    }
    return false;
}

// A box of the slide by its `p:cNvPr id`; one inside a group comes in
// with its group, as PowerPoint animates it.
function findAnimatedBox(
    slideXml: string,
    shapeId: string,
): AnimatedBoxType | null {
    for (const box of listSlideBoxes(slideXml)) {
        if (box.isGrouped) {
            continue;
        }
        const element = listChildElements(slideXml, box.start, box.end)[0];
        let id: string | null = null;
        for (const tag of scanTags(slideXml, box.start, box.end)) {
            if (tag.name === 'p:cNvPr' && !tag.isClose) {
                id = readAttribute(tag.attributes, 'id');
                break;
            }
        }
        if (element === undefined || id !== shapeId) {
            continue;
        }
        const body = findChild(slideXml, element, 'p:txBody');
        const lines: number[] = [];
        (body === null ? [] : listChildren(slideXml, body))
            .filter((child) => {
                return child.name === 'a:p';
            })
            .forEach((paragraph, index) => {
                if (
                    checkHasWords(
                        slideXml.slice(paragraph.start, paragraph.end),
                    )
                ) {
                    lines.push(index);
                }
            });
        return { tagName: element.name, lines };
    }
    return null;
}

function genTargetXml(spid: string, line: number | null) {
    return line === null
        ? `<p:spTgt spid="${spid}"/>`
        : `<p:spTgt spid="${spid}"><p:txEl><p:pRg st="${line}" ` +
              `end="${line}"/></p:txEl></p:spTgt>`;
}

/** One entrance effect's `p:par`, as PowerPoint writes that preset. */
function genEffectXml(
    effect: OfficeAnimationEffectType,
    target: string,
    duration: number,
    groupId: string,
    nodeType: string,
) {
    const preset = PRESET_MAP[effect];
    const show =
        `<p:set><p:cBhvr><p:cTn id="${NEW_ID}" dur="1" fill="hold">` +
        '<p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>' +
        `<p:tgtEl>${target}</p:tgtEl><p:attrNameLst>` +
        '<p:attrName>style.visibility</p:attrName></p:attrNameLst>' +
        '</p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>';
    const filter = (name: string) => {
        return (
            `<p:animEffect transition="in" filter="${name}"><p:cBhvr>` +
            `<p:cTn id="${NEW_ID}" dur="${duration}"/>` +
            `<p:tgtEl>${target}</p:tgtEl></p:cBhvr></p:animEffect>`
        );
    };
    const text = (value: string) => {
        return `<p:strVal val="${value}"/>`;
    };
    const move = (
        attribute: string,
        from: string,
        to: string,
        isAdditive: boolean,
    ) => {
        return (
            '<p:anim calcmode="lin" valueType="num">' +
            `<p:cBhvr${isAdditive ? ' additive="base"' : ''}>` +
            `<p:cTn id="${NEW_ID}" dur="${duration}" fill="hold"/>` +
            `<p:tgtEl>${target}</p:tgtEl><p:attrNameLst>` +
            `<p:attrName>${attribute}</p:attrName></p:attrNameLst>` +
            '</p:cBhvr><p:tavLst><p:tav tm="0"><p:val>' +
            `${from}</p:val></p:tav><p:tav tm="100000"><p:val>${to}` +
            '</p:val></p:tav></p:tavLst></p:anim>'
        );
    };
    const behaviorMap: Record<OfficeAnimationEffectType, string> = {
        appear: show,
        fade: show + filter('fade'),
        fly:
            show +
            move('ppt_x', text('#ppt_x'), text('#ppt_x'), true) +
            move('ppt_y', text('1+#ppt_h/2'), text('#ppt_y'), true),
        wipe: show + filter('wipe(down)'),
        zoom:
            show +
            move('ppt_w', '<p:fltVal val="0"/>', text('#ppt_w'), false) +
            move('ppt_h', '<p:fltVal val="0"/>', text('#ppt_h'), false) +
            filter('fade'),
    };
    return (
        `<p:par><p:cTn id="${NEW_ID}" presetID="${preset.id}" ` +
        `presetClass="entr" presetSubtype="${preset.subtype}" fill="hold" ` +
        `grpId="${groupId}" nodeType="${nodeType}"><p:stCondLst>` +
        '<p:cond delay="0"/></p:stCondLst>' +
        `<p:childTnLst>${behaviorMap[effect]}</p:childTnLst></p:cTn></p:par>`
    );
}

type ChangeType = {
    spid: string;
    box: AnimatedBoxType;
    animation: OfficeAnimationType | null;
};

// The box's build entry: by paragraph when its lines come in one by one,
// a shape with no words animating its background; a picture has none.
function genBuildXml(change: ChangeType, groupId: string) {
    const { box, animation, spid } = change;
    if (animation === null || box.tagName !== 'p:sp') {
        return '';
    }
    if (animation.byLine && box.lines.length > 0) {
        return `<p:bldP spid="${spid}" grpId="${groupId}" build="p"/>`;
    }
    return (
        `<p:bldP spid="${spid}" grpId="${groupId}"` +
        (box.lines.length === 0 ? ' animBg="1"' : '') +
        '/>'
    );
}

/**
 * One `p:timing` with the change made: '' when nothing is left in it (and
 * `canRemove`), null when its tree cannot be read.
 */
function editTimingXml(
    timingXml: string,
    change: ChangeType,
    canRemove: boolean,
) {
    const { spid, animation } = change;
    let xml = timingXml;
    let isChanged = false;
    const main = findMainSeq(xml);
    if (main !== null) {
        const taken = takeShapeEffects(readGroups(xml, main.list), spid);
        if (taken.count > 0) {
            xml = writeMainSeq(xml, main, writeGroups(taken.groups));
            isChanged = true;
        }
    }
    let groupId: string | null = null;
    if (animation !== null) {
        const ensured = ensureMainSeq(xml);
        const ensuredMain = ensured === null ? null : findMainSeq(ensured);
        if (ensured === null || ensuredMain === null) {
            return null;
        }
        xml = ensured;
        const usedSet = new Set(
            listEffectRecords(xml)
                .filter((record) => {
                    return record.spid === spid;
                })
                .map((record) => {
                    return record.grpId;
                }),
        );
        let free = 0;
        while (usedSet.has(String(free))) {
            free++;
        }
        const newGroupId = String(free);
        groupId = newGroupId;
        const groups = readGroups(xml, ensuredMain.list);
        const lines =
            animation.byLine && change.box.lines.length > 0
                ? change.box.lines
                : [null];
        const firstStart: OfficeAnimationStartType =
            animation.start === 'with' || animation.start === 'after'
                ? animation.start
                : 'click';
        const duration = toDuration(animation.seconds);
        lines.forEach((line, index) => {
            const start =
                index === 0
                    ? firstStart
                    : firstStart === 'click'
                      ? 'click'
                      : 'after';
            appendEffect(groups, start, ensuredMain.id, (nodeType) => {
                return genEffectXml(
                    animation.effect,
                    genTargetXml(spid, line),
                    duration,
                    newGroupId,
                    nodeType,
                );
            });
        });
        xml = writeMainSeq(xml, ensuredMain, writeGroups(groups));
        isChanged = true;
    }
    const keptGroupIds = new Set(
        listEffectRecords(xml)
            .filter((record) => {
                return record.spid === spid && record.grpId !== groupId;
            })
            .map((record) => {
                return record.grpId ?? '';
            }),
    );
    const built = writeBuildList(
        xml,
        spid,
        keptGroupIds,
        groupId === null ? '' : genBuildXml(change, groupId),
    );
    if (built !== xml) {
        xml = built;
        isChanged = true;
    }
    if (!isChanged) {
        return timingXml;
    }
    if (canRemove && checkIsEmptyTiming(xml)) {
        return '';
    }
    return renumberTimeNodes(xml);
}

// --- the slide -----------------------------------------------------------

// `p:sld`'s own children; `p:cSld` holds an `p:extLst` of its own.
function readSlideChildren(slideXml: string) {
    const open = /<p:sld\b(?:[^>"']|"[^"]*"|'[^']*')*?(\/?)>/.exec(slideXml);
    const closeStart = slideXml.lastIndexOf('</p:sld>');
    if (open === null || open[1] === '/' || closeStart < 0) {
        return null;
    }
    return {
        closeStart,
        children: listChildElements(
            slideXml,
            open.index + open[0].length,
            closeStart,
        ),
    };
}

// The slide's `p:timing`, or both copies Office keeps of one in an
// `mc:AlternateContent` (the newer reader's and the fallback, in order).
function listTimingCopies(slideXml: string, children: ElementType[]) {
    const plain = children.find((child) => {
        return child.name === 'p:timing';
    });
    if (plain !== undefined) {
        return { copies: [plain], wrapper: null };
    }
    for (const child of children) {
        if (child.name !== 'mc:AlternateContent') {
            continue;
        }
        const copies = listChildren(slideXml, child)
            .map((choice) => {
                return findChild(slideXml, choice, 'p:timing');
            })
            .filter((timing): timing is ElementType => {
                return timing !== null;
            });
        if (copies.length > 0) {
            return { copies, wrapper: child };
        }
    }
    return { copies: [] as ElementType[], wrapper: null };
}

function toEffectName(
    presetId: number | null,
): OfficeAnimationEffectType | 'other' {
    return (
        OFFICE_ANIMATION_LIST.find((effect) => {
            return PRESET_MAP[effect].id === presetId;
        }) ?? 'other'
    );
}

/**
 * The entrance animations of the slide's main sequence, in play order, by
 * the shape id (`p:cNvPr id`) each plays on. A box's lines coming in one
 * by one are one animation, `byLine`.
 */
export function readSlideAnimations(slideXml: string): SlideAnimationType[] {
    const slide = readSlideChildren(slideXml);
    if (slide === null) {
        return [];
    }
    const { copies } = listTimingCopies(slideXml, slide.children);
    // of Office's two copies, the fallback every reader reads
    const copy = copies[copies.length - 1];
    if (copy === undefined) {
        return [];
    }
    const timingXml = slideXml.slice(copy.start, copy.end);
    const main = findMainSeq(timingXml);
    if (main === null) {
        return [];
    }
    const out: (SlideAnimationType & { grpId: string | null })[] = [];
    for (const record of listEffectRecords(
        timingXml,
        main.seq.start,
        main.seq.end,
    )) {
        if (record.presetClass !== 'entr' || record.spid === null) {
            continue;
        }
        const effect = toEffectName(record.presetId);
        const last = out[out.length - 1];
        if (
            record.isParagraph &&
            last !== undefined &&
            last.byLine &&
            last.shapeId === record.spid &&
            last.effect === effect &&
            last.grpId === record.grpId
        ) {
            continue;
        }
        out.push({
            shapeId: record.spid,
            effect,
            byLine: record.isParagraph,
            grpId: record.grpId,
        });
    }
    return out.map(({ shapeId, effect, byLine }) => {
        return { shapeId, effect, byLine };
    });
}

/**
 * The slide with the entrance animations of the box whose `p:cNvPr id` is
 * `shapeId` replaced by `animation` -- put at the END of the main sequence
 * -- or taken off when `animation` is null. Every other box's animations
 * are kept as they were, in order. Null when the slide has no `p:spTree`,
 * no such box (one inside a group comes in with its group), an effect not
 * of `OFFICE_ANIMATION_LIST`, or a timing whose tree cannot be read.
 */
export function setShapeAnimationXml(
    slideXml: string,
    shapeId: string,
    animation: OfficeAnimationType | null,
): string | null {
    const spid = String(shapeId).trim();
    if (
        !/^\d+$/.test(spid) ||
        (animation !== null && !Object.hasOwn(PRESET_MAP, animation.effect))
    ) {
        return null;
    }
    const slide = readSlideChildren(slideXml);
    const box = slide === null ? null : findAnimatedBox(slideXml, spid);
    if (slide === null || box === null) {
        return null;
    }
    const change: ChangeType = { spid, box, animation };
    const { copies, wrapper } = listTimingCopies(slideXml, slide.children);
    if (copies.length === 0) {
        if (animation === null) {
            return slideXml;
        }
        const made = editTimingXml('<p:timing/>', change, false);
        if (made === null) {
            return null;
        }
        // before the slide's own extension list: after its colour map and
        // its transition, as the schema orders them
        const at =
            slide.children.find((child) => {
                return child.name === 'p:extLst';
            })?.start ?? slide.closeStart;
        return slideXml.slice(0, at) + made + slideXml.slice(at);
    }
    const sources = copies.map((copy) => {
        return slideXml.slice(copy.start, copy.end);
    });
    // a copy inside Office's wrapper is kept as a shell; the wrapper goes
    // when every copy is left empty
    const edited: string[] = [];
    for (const source of sources) {
        const one = editTimingXml(source, change, wrapper === null);
        if (one === null) {
            return null;
        }
        edited.push(one);
    }
    if (
        edited.every((one, index) => {
            return one === sources[index];
        })
    ) {
        return slideXml;
    }
    if (
        wrapper !== null &&
        edited.every((one) => {
            return checkIsEmptyTiming(one);
        })
    ) {
        return slideXml.slice(0, wrapper.start) + slideXml.slice(wrapper.end);
    }
    let xml = slideXml;
    for (let index = copies.length - 1; index >= 0; index--) {
        xml =
            xml.slice(0, copies[index].start) +
            edited[index] +
            xml.slice(copies[index].end);
    }
    return xml;
}
