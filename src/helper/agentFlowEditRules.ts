/**
 * A presenting flow changed by the help window's assistant: MANY changes in
 * ONE write (2026-11-07, the user, with a presenting flow's row menu open:
 * _add `Open in Chatbot` … follow what working for appdocument. goal: chatbot
 * can help the presenting flow modification_; then, for what it may change,
 * _Lines, Timing & marks, CC elements, Foreground presets_).
 *
 * What a run sheet asked for in words needs many changes at once -- a clear
 * after each of twelve songs, a timeout on every song, the order of service
 * typed out -- and one call a change was a round each, past every round cap,
 * a write and a history entry each on a church's old laptop. So a batch is
 * applied here to the sheet's json in ONE locked read-modify-write
 * (`PresentingFlow.updateItemsJson`), any refusal refusing the lot, and the
 * worker (`agentPresentingFlowEditHelpers.ts`) backs it up once.
 *
 * The rules are the panel's own: a line is added as a drop adds it, a
 * shortcut names one line, a copy is re-keyed and loses its shortcut,
 * removing a line drops what follows it, a CC always points at a line of the
 * sheet, a `Jump to` names one line, an interval never follows a line.
 *
 * Every line is named by its number AS READ before the call (`lines`), and a
 * number means that line however the changes before it moved things: the
 * model never has to work out where a line went.
 *
 * Pure: no store, no file. The worker prepares what needs the disk (a
 * document by its name, a passage, a document's slide ids) beforehand.
 */
import colorList from '../others/color-list.json';
import { toForegroundDragLabel } from '../presenter-foreground/foregroundDragHelpers';
import {
    findPresentingFlowAction,
    PRESENTING_FLOW_ACTION_TYPE,
    type PresentingFlowActionArmingType,
    type PresentingFlowActionType,
} from '../presenting-flow/presentingFlowActionHelpers';
import { checkIsValidPresentingFlowActionKey } from '../presenting-flow/presentingFlowActionKeyHelpers';
import { checkIsValidPresentingFlowActionTime } from '../presenting-flow/presentingFlowActionTimeHelpers';
import type { PresentingFlowCcItemType } from '../presenting-flow/presentingFlowCcHelpers';
import {
    checkIsPresentingFlowActionKeyTaken,
    dropPresentingFlowCcItemsOfUuid,
    duplicatePresentingFlowItemJson,
    ensurePresentingFlowItemUuid,
} from '../presenting-flow/presentingFlowItemJsonHelpers';
import type { PresentingFlowItemType } from '../presenting-flow/PresentingFlowItem';
import PresentingFlowItem, {
    applyPresentingFlowActionArming,
} from '../presenting-flow/PresentingFlowItem';
import { toPresentingFlowMediaControl } from '../presenting-flow/presentingFlowMediaControlHelpers';
import {
    AGENT_FLOW_FOREGROUND_WIDGETS,
    genAgentForegroundData,
} from './agentFlowForegroundRules';

/** The most changes one call may carry: a long service, every line touched. */
export const MAX_AGENT_FLOW_CHANGES = 120;

const FOREGROUND_TYPE = 'foreground';
const APP_DOCUMENT_TYPE = 'appDocument';
const ERROR_TYPE = 'error';

// --- small readers ----------------------------------------------------------

const NAMED_COLOR_MAP: Record<string, string> = {
    ...Object.fromEntries(
        Object.entries(colorList.extension).map(([name, hex]) => {
            return [name, hex.toUpperCase()];
        }),
    ),
    ...colorList.main,
};

/**
 * A colour note as the assistant says it -- a colour name of the menu's list
 * (`blue`, `lime`, `crimson`), `#RRGGBB`, or nothing to take it off -- as the
 * entry stores it, or a reason.
 */
export function toAgentFlowColorNote(
    value: unknown,
): { colorNote: string | null } | { reason: string } {
    if (value === null || value === '' || value === 'none') {
        return { colorNote: null };
    }
    if (typeof value !== 'string') {
        return { reason: '`color` is a colour name, "#RRGGBB", or "none".' };
    }
    const text = value.trim().toLowerCase().replace(/\s+/g, '');
    if (/^#[0-9a-f]{6}$/.test(text)) {
        return { colorNote: text.toUpperCase() };
    }
    const hex = NAMED_COLOR_MAP[text];
    if (hex === undefined) {
        return {
            reason:
                `"${value}" is not a colour the colour menu has -- say a ` +
                'name such as red, blue, green, yellow, purple, orange, ' +
                'or "#RRGGBB".',
        };
    }
    return { colorNote: hex };
}

/** A colour note read back as a name when the menu's main list has one. */
export function toAgentFlowColorName(colorNote: unknown) {
    if (typeof colorNote !== 'string' || colorNote === '') {
        return null;
    }
    const upper = colorNote.toUpperCase();
    const named = Object.entries(colorList.main).find(([, hex]) => {
        return hex.toUpperCase() === upper;
    });
    return named === undefined ? colorNote : named[0];
}

const KEY_NAME_MAP: Record<string, string> = {
    ctrl: 'Ctrl',
    control: 'Ctrl',
    cmd: 'Ctrl',
    command: 'Ctrl',
    shift: 'Shift',
};

/**
 * A shortcut as the assistant writes it (`ctrl+shift+a`, `Shift + F5`) in the
 * one spelling a run sheet stores (`Ctrl+Shift+A`), or null when it is not
 * one: Ctrl and/or Shift, then one key.
 */
export function toAgentFlowActionKey(value: unknown) {
    if (typeof value !== 'string') {
        return null;
    }
    const parts = value
        .split('+')
        .map((part) => {
            return part.trim();
        })
        .filter((part) => {
            return part !== '';
        });
    const key = parts.pop();
    if (key === undefined) {
        return null;
    }
    const modifierSet = new Set<string>();
    for (const part of parts) {
        const modifier = KEY_NAME_MAP[part.toLowerCase()];
        if (modifier === undefined) {
            return null;
        }
        modifierSet.add(modifier);
    }
    const canonicalKey =
        key.length === 1
            ? key.toUpperCase()
            : key.charAt(0).toUpperCase() + key.slice(1);
    const text = [
        ...['Ctrl', 'Shift'].filter((one) => {
            return modifierSet.has(one);
        }),
        canonicalKey,
    ].join('+');
    return checkIsValidPresentingFlowActionKey(text) ? text : null;
}

function checkIsLineNumber(value: unknown): value is number {
    return Number.isInteger(value) && (value as number) >= 1;
}

function toSecondCount(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
        ? Math.max(1, Math.round(value))
        : null;
}

function toScreenIdList(value: unknown) {
    if (!Array.isArray(value)) {
        return null;
    }
    const list = value.filter((one) => {
        return Number.isInteger(one) && one >= 0;
    });
    return list.length === value.length ? Array.from(new Set(list)) : null;
}

/** The arming a request carries: seconds, a time of day, or a shortcut. */
function readArming(
    request: Record<string, any>,
): { arming: PresentingFlowActionArmingType | null } | { reason: string } {
    const given = ['seconds', 'time', 'key'].filter((one) => {
        return request[one] !== undefined;
    });
    if (given.length === 0) {
        return { arming: null };
    }
    if (given.length > 1) {
        return {
            reason:
                'A line is armed with ONE of `seconds`, `time` or `key`, ' +
                'never two.',
        };
    }
    if (request.seconds !== undefined) {
        const seconds = toSecondCount(request.seconds);
        return seconds === null
            ? { reason: '`seconds` is a number of seconds above 0.' }
            : { arming: { actionNumber: seconds } };
    }
    if (request.time !== undefined) {
        const time = String(request.time).trim();
        const padded = /^\d:\d\d$/.test(time) ? `0${time}` : time;
        return checkIsValidPresentingFlowActionTime(padded)
            ? { arming: { actionTime: padded } }
            : {
                  reason:
                      '`time` is a time of day in 24-hour form, "HH:mm" -- ' +
                      '"19:05".',
              };
    }
    const actionKey = toAgentFlowActionKey(request.key);
    return actionKey === null
        ? {
              reason:
                  '`key` is a shortcut of Ctrl and/or Shift and one key -- ' +
                  '"Ctrl+Shift+A", "Shift+F5".',
          }
        : { arming: { actionKey } };
}

/** Whether `arming` is one this action may be armed with, or why not. */
function checkArmingFits(
    action: PresentingFlowActionType | null,
    arming: PresentingFlowActionArmingType,
): string | null {
    const label = action?.label ?? 'This line';
    if (action === null || action.target !== 'run') {
        return `${label} is not armed with anything.`;
    }
    if (arming.actionKey !== undefined && !action.canBeKeyArmed) {
        return `${label} is not armed with a shortcut.`;
    }
    if (arming.actionTime !== undefined && !action.canBeTimeArmed) {
        return `${label} cannot be armed with a time of day.`;
    }
    if (arming.actionNumber !== undefined && action.number === null) {
        return `${label} is not armed with seconds.`;
    }
    return null;
}

function describeArming(arming: PresentingFlowActionArmingType) {
    if (arming.actionKey !== undefined) {
        return `shortcut ${arming.actionKey}`;
    }
    if (arming.actionTime !== undefined) {
        return `at ${arming.actionTime}`;
    }
    return `${arming.actionNumber} seconds`;
}

// --- the batch ---------------------------------------------------------------

export type AgentFlowPreparedType = {
    /** Each line's title as read, by line number - 1. */
    titles: readonly string[];
    /** The json of each `add` of a document or a passage, by change index. */
    addedItemJsonMap: ReadonlyMap<number, PresentingFlowItemType>;
    /** A document line's slide ids in order, by line number. */
    slideIdListMap: ReadonlyMap<number, readonly number[]>;
    /** The screens there are, when known: a pin naming another is refused. */
    screenIdList: readonly number[] | null;
    /** Makes a uuid (a clock's id). */
    genId: () => string;
};

/** What the worker has to read before the batch can be applied. */
export type AgentFlowNeedsType = {
    /** `add`s of a document by its name, by change index. */
    documentMap: Map<number, string>;
    /** `add`s of a passage, by change index. */
    referenceMap: Map<number, { reference: string; version: string | null }>;
    /** Lines whose slides are named by number. */
    slideLineSet: Set<number>;
};

type ResultType = { changed: string[] } | { reason: string };

function fail(reason: string): { reason: string } {
    return { reason };
}

function toText(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
}

/**
 * The batch read for its shape before anything is read off the disk: a list
 * of change objects, each naming lines that exist. Answers what the worker
 * has to prepare, or why the batch is refused.
 */
export function readAgentFlowChangeNeeds(
    changes: unknown,
    lineCount: number,
): AgentFlowNeedsType | { reason: string } {
    if (!Array.isArray(changes) || changes.length === 0) {
        return fail(
            '`changes` is a list of changes, each one object: an `add`, ' +
                'or a `line` with what changes on it.',
        );
    }
    if (changes.length > MAX_AGENT_FLOW_CHANGES) {
        return fail(
            `At most ${MAX_AGENT_FLOW_CHANGES} changes go in one call.`,
        );
    }
    const needs: AgentFlowNeedsType = {
        documentMap: new Map(),
        referenceMap: new Map(),
        slideLineSet: new Set(),
    };
    const checkLine = (value: unknown, what: string) => {
        if (!checkIsLineNumber(value) || value > lineCount) {
            return (
                `${what} is a line number as the sheet reads now, 1 to ` +
                `${lineCount}.`
            );
        }
        return null;
    };
    for (const [index, change] of changes.entries()) {
        const at = `Change ${index + 1}`;
        if (change === null || typeof change !== 'object') {
            return fail(`${at} is not an object.`);
        }
        const { add, line, after } = change as Record<string, any>;
        if (after !== undefined && after !== 0) {
            const reason = checkLine(after, `${at}: \`after\``);
            if (reason !== null) {
                return fail(reason);
            }
        }
        if (add !== undefined) {
            if (line !== undefined) {
                return fail(
                    `${at} has both \`add\` and \`line\` -- an add is a ` +
                        'change of its own.',
                );
            }
            if (add === null || typeof add !== 'object') {
                return fail(`${at}: \`add\` is an object.`);
            }
            const given = [
                'document',
                'reference',
                'actionId',
                'foreground',
            ].filter((key) => {
                return add[key] !== undefined;
            });
            if (given.length !== 1) {
                return fail(
                    `${at}: \`add\` is ONE of a \`document\` (a Documents ` +
                        'name), a `reference` (a Bible passage), an ' +
                        '`actionId`, or a `foreground` ({widget, …}).',
                );
            }
            if (add.document !== undefined) {
                const name = toText(add.document);
                if (name === '') {
                    return fail(`${at}: \`document\` is a Documents name.`);
                }
                needs.documentMap.set(index, name);
            }
            if (add.reference !== undefined) {
                const reference = toText(add.reference);
                if (reference === '') {
                    return fail(
                        `${at}: \`reference\` is a passage such as ` +
                            '"John 3:16".',
                    );
                }
                const version = toText(add.version);
                needs.referenceMap.set(index, {
                    reference,
                    version: version === '' ? null : version,
                });
            }
            if (add.target !== undefined) {
                const reason = checkLine(add.target, `${at}: \`target\``);
                if (reason !== null) {
                    return fail(reason);
                }
            }
            continue;
        }
        const reason = checkLine(line, `${at}: \`line\``);
        if (reason !== null) {
            return fail(
                reason +
                    ' A change names the `line` it changes, or `add`s one.',
            );
        }
        const { slides, cc } = change as Record<string, any>;
        if (slides !== undefined) {
            needs.slideLineSet.add(line);
        }
        if (cc !== null && typeof cc === 'object') {
            if (cc.slide !== undefined) {
                needs.slideLineSet.add(line);
            }
            const target = cc.add?.line;
            if (target !== undefined) {
                const ccReason = checkLine(target, `${at}: \`cc.add.line\``);
                if (ccReason !== null) {
                    return fail(ccReason);
                }
            }
        }
    }
    return needs;
}

type PlacementType = {
    /** Insert `itemJson` right after `anchor` (null: the top; END: last). */
    place: (
        itemJsonList: PresentingFlowItemType[],
        itemJson: PresentingFlowItemType,
        anchor: PresentingFlowItemType | null | typeof END,
    ) => void;
};

const END = Symbol('end');

/**
 * Where a line goes. Several put after the same line keep the order they
 * were given in, the second after the first -- "a clear after line 3, then a
 * countdown after line 3" reads down the sheet the way it was said.
 */
function genPlacement(): PlacementType {
    const lastPlacedMap = new Map<
        PresentingFlowItemType | null,
        PresentingFlowItemType
    >();
    return {
        place: (itemJsonList, itemJson, anchor) => {
            if (anchor === END) {
                itemJsonList.push(itemJson);
                return;
            }
            const last = lastPlacedMap.get(anchor);
            const after = last ?? anchor;
            const index = after === null ? -1 : itemJsonList.indexOf(after);
            itemJsonList.splice(index + 1, 0, itemJson);
            lastPlacedMap.set(anchor, itemJson);
        },
    };
}

function toActionLabel(itemJson: PresentingFlowItemType) {
    return (
        findPresentingFlowAction(itemJson.data)?.label ?? String(itemJson.data)
    );
}

function toNewLineTitle(itemJson: PresentingFlowItemType) {
    if (itemJson.type === PRESENTING_FLOW_ACTION_TYPE) {
        return toActionLabel(itemJson);
    }
    return itemJson.title ?? String(itemJson.type);
}

/** What a CC of an action line follows, armed as asked -- reused or new. */
function findReusableActionLine(
    itemJsonList: PresentingFlowItemType[],
    actionId: string,
    arming: PresentingFlowActionArmingType,
    host: PresentingFlowItemType,
) {
    return (
        itemJsonList.find((itemJson) => {
            return (
                itemJson !== host &&
                itemJson.type === PRESENTING_FLOW_ACTION_TYPE &&
                itemJson.data === actionId &&
                itemJson.actionNumber === arming.actionNumber &&
                itemJson.actionTime === arming.actionTime &&
                itemJson.actionKey === undefined
            );
        }) ?? null
    );
}

function readCcHostList(
    host: PresentingFlowItemType,
    slideId: number | null,
): PresentingFlowCcItemType[] {
    const stored =
        slideId === null ? host.ccItems : host.slideCcItems?.[`${slideId}`];
    return Array.isArray(stored) ? [...stored] : [];
}

function writeCcHostList(
    host: PresentingFlowItemType,
    slideId: number | null,
    list: PresentingFlowCcItemType[],
) {
    if (slideId === null) {
        if (list.length === 0) {
            delete host.ccItems;
        } else {
            host.ccItems = list;
        }
        return;
    }
    const slideCcItems = { ...(host.slideCcItems ?? {}) };
    if (list.length === 0) {
        delete slideCcItems[`${slideId}`];
    } else {
        slideCcItems[`${slideId}`] = list;
    }
    if (Object.keys(slideCcItems).length === 0) {
        delete host.slideCcItems;
    } else {
        host.slideCcItems = slideCcItems;
    }
}

function checkIsPinnable(itemJson: PresentingFlowItemType) {
    try {
        return new PresentingFlowItem('', itemJson).isScreenPinnable;
    } catch (_error) {
        return false;
    }
}

/**
 * Apply a batch to the sheet's json, in place -- the handler of ONE
 * `PresentingFlow.updateItemsJson`. Answers what changed, a sentence each,
 * or why NOTHING was changed: a refusal anywhere refuses the lot, and the
 * caller writes nothing.
 */
export function applyAgentFlowChanges(
    itemJsonList: PresentingFlowItemType[],
    changes: readonly Record<string, any>[],
    prepared: AgentFlowPreparedType,
): ResultType {
    // Each line as read, by number: an object, so a line is found wherever
    // the changes before it put it.
    const lineList = itemJsonList.slice();
    const placement = genPlacement();
    const changed: string[] = [];
    const removedSet = new Set<PresentingFlowItemType>();
    const getLine = (line: number) => {
        return lineList[line - 1];
    };
    const titleOf = (line: number) => {
        return `line ${line} "${prepared.titles[line - 1] ?? ''}"`;
    };
    const toAnchor = (after: unknown) => {
        if (after === undefined) {
            return END;
        }
        if (after === 0) {
            return null;
        }
        return getLine(after as number);
    };
    const checkScreens = (screenIds: number[]) => {
        const known = prepared.screenIdList;
        if (known === null || known.length === 0) {
            return null;
        }
        const unknown = screenIds.filter((one) => {
            return !known.includes(one);
        });
        return unknown.length === 0
            ? null
            : `There is no screen ${unknown.join(', ')}; the screens are ` +
                  `${known.join(', ')}.`;
    };
    const describeAfter = (after: unknown) => {
        if (after === undefined) {
            return 'at the end';
        }
        if (after === 0) {
            return 'at the top';
        }
        return `after ${titleOf(after as number)}`;
    };
    for (const [index, change] of changes.entries()) {
        const at = `Change ${index + 1}`;
        if (change.add !== undefined) {
            const { add } = change;
            let newItemJson: PresentingFlowItemType;
            if (add.document !== undefined || add.reference !== undefined) {
                const prepared_ = prepared.addedItemJsonMap.get(index);
                if (prepared_ === undefined) {
                    return fail(`${at}: what it adds could not be read.`);
                }
                newItemJson = { ...prepared_ };
            } else if (add.foreground !== undefined) {
                const foreground = add.foreground;
                if (foreground === null || typeof foreground !== 'object') {
                    return fail(
                        `${at}: \`foreground\` is {widget, …} -- ` +
                            `widget one of ${AGENT_FLOW_FOREGROUND_WIDGETS.join(', ')}.`,
                    );
                }
                const { widget, ...fields } = foreground;
                // A new one looks like the newest line of its widget.
                const lookLine = [...itemJsonList].reverse().find((one) => {
                    return (
                        one.type === FOREGROUND_TYPE &&
                        one.data?.target === widget
                    );
                });
                const built = genAgentForegroundData(
                    widget,
                    fields,
                    { lookFrom: lookLine?.data?.data ?? null },
                    prepared.genId,
                );
                if ('reason' in built) {
                    return fail(`${at}: ${built.reason}`);
                }
                const payload = { target: widget, data: built.data };
                newItemJson = {
                    type: FOREGROUND_TYPE as any,
                    uuid: prepared.genId(),
                    data: payload,
                    title: toForegroundDragLabel(payload as any),
                    extraStyle: {},
                };
            } else {
                const actionId = toText(add.actionId);
                const action = findPresentingFlowAction(actionId);
                if (action === null) {
                    return fail(
                        `${at}: "${actionId}" is not an action -- the ` +
                            '`actions` the sheet read lists them.',
                    );
                }
                const armingRead = readArming(add);
                if ('reason' in armingRead) {
                    return fail(`${at}: ${armingRead.reason}`);
                }
                let arming = armingRead.arming ?? {};
                if (armingRead.arming !== null) {
                    const misfit = checkArmingFits(action, armingRead.arming);
                    if (misfit !== null) {
                        return fail(`${at}: ${misfit}`);
                    }
                } else if (action.target === 'run' && action.number !== null) {
                    // The question's own default, as the menu offers it.
                    arming = { actionNumber: action.number.defaultValue };
                }
                const screenIds =
                    add.screenIds === undefined
                        ? []
                        : toScreenIdList(add.screenIds);
                if (screenIds === null) {
                    return fail(
                        `${at}: \`screenIds\` is a list of screen numbers.`,
                    );
                }
                if (
                    action.target === 'screen' &&
                    action.requiresScreenIds &&
                    screenIds.length === 0
                ) {
                    return fail(
                        `${at}: ${action.label} has to name the screens it ` +
                            'runs on (`screenIds`).',
                    );
                }
                const screenReason = checkScreens(screenIds);
                if (screenReason !== null) {
                    return fail(`${at}: ${screenReason}`);
                }
                if (
                    arming.actionKey !== undefined &&
                    checkIsPresentingFlowActionKeyTaken(
                        itemJsonList,
                        arming.actionKey,
                        -1,
                    )
                ) {
                    return fail(
                        `${at}: the shortcut ${arming.actionKey} is already ` +
                            'used in this presenting flow -- one shortcut ' +
                            'names one line.',
                    );
                }
                if (action.id === 'slide-media-control') {
                    return fail(
                        `${at}: Slide: Media Control exists only as a CC of ` +
                            'a slide or a document -- attach it with `cc`.',
                    );
                }
                newItemJson = PresentingFlowItem.fromActionId(
                    action.id,
                    arming,
                    screenIds,
                );
                if (add.target !== undefined) {
                    if (!(
                        action.target === 'run' && action.ccItemsAreTargets
                    )) {
                        return fail(
                            `${at}: only a Jump to takes a \`target\`.`,
                        );
                    }
                    const target = getLine(add.target);
                    if (removedSet.has(target) || target.type === ERROR_TYPE) {
                        return fail(
                            `${at}: line ${add.target} cannot be gone to.`,
                        );
                    }
                    newItemJson.ccItems = [
                        { uuid: ensurePresentingFlowItemUuid(target) },
                    ];
                }
            }
            if (newItemJson.uuid === undefined) {
                newItemJson.uuid = prepared.genId();
            }
            if (add.color !== undefined) {
                const color = toAgentFlowColorNote(add.color);
                if ('reason' in color) {
                    return fail(`${at}: ${color.reason}`);
                }
                if (color.colorNote !== null) {
                    newItemJson.colorNote = color.colorNote;
                }
            }
            placement.place(itemJsonList, newItemJson, toAnchor(change.after));
            changed.push(
                `added "${toNewLineTitle(newItemJson)}" ` +
                    describeAfter(change.after),
            );
            continue;
        }
        const lineNumber = change.line as number;
        const itemJson = getLine(lineNumber);
        if (itemJson === undefined || removedSet.has(itemJson)) {
            return fail(`${at}: line ${lineNumber} is not there.`);
        }
        const name = titleOf(lineNumber);
        const isError = itemJson.type === ERROR_TYPE;
        const onlyMoving = Object.keys(change).every((key) => {
            return key === 'line' || key === 'after';
        });
        if (isError && !onlyMoving) {
            return fail(
                `${at}: ${name} is an invalid line -- it can only be moved ` +
                    'or removed.',
            );
        }
        const action =
            itemJson.type === PRESENTING_FLOW_ACTION_TYPE
                ? findPresentingFlowAction(itemJson.data)
                : null;
        if (change.copy === true) {
            const copy = duplicatePresentingFlowItemJson(itemJson);
            placement.place(itemJsonList, copy, itemJson);
            changed.push(`copied ${name}`);
        }
        if (change.park !== undefined) {
            if (change.park === true) {
                itemJson.isDisabled = true;
            } else {
                delete itemJson.isDisabled;
            }
            changed.push(
                `${change.park === true ? 'parked' : 'put back in play'} ${name}`,
            );
        }
        const armingRead = readArming(change);
        if ('reason' in armingRead) {
            return fail(`${at}: ${armingRead.reason}`);
        }
        if (armingRead.arming !== null) {
            const misfit = checkArmingFits(action, armingRead.arming);
            if (misfit !== null) {
                return fail(`${at}: ${name}: ${misfit}`);
            }
            if (
                checkIsPresentingFlowActionKeyTaken(
                    itemJsonList,
                    armingRead.arming.actionKey,
                    itemJsonList.indexOf(itemJson),
                )
            ) {
                return fail(
                    `${at}: the shortcut ${armingRead.arming.actionKey} is ` +
                        'already used in this presenting flow -- one ' +
                        'shortcut names one line.',
                );
            }
            applyPresentingFlowActionArming(itemJson, armingRead.arming);
            changed.push(`${name}: ${describeArming(armingRead.arming)}`);
        } else if (change.clearArming === true) {
            if (action?.target !== 'run' || !action.canBeKeyArmed) {
                return fail(
                    `${at}: ${name} must keep what it is armed with; give ` +
                        'it new `seconds` or a `time` instead.',
                );
            }
            applyPresentingFlowActionArming(itemJson, {});
            changed.push(`${name}: no shortcut`);
        }
        if (change.color !== undefined) {
            const color = toAgentFlowColorNote(change.color);
            if ('reason' in color) {
                return fail(`${at}: ${color.reason}`);
            }
            if (color.colorNote === null) {
                delete itemJson.colorNote;
            } else {
                itemJson.colorNote = color.colorNote;
            }
            changed.push(
                `${name}: colour ${toAgentFlowColorName(color.colorNote) ?? 'none'}`,
            );
        }
        if (change.screenIds !== undefined) {
            const screenIds = toScreenIdList(change.screenIds);
            if (screenIds === null) {
                return fail(
                    `${at}: \`screenIds\` is a list of screen numbers, [] ` +
                        'for none.',
                );
            }
            if (!checkIsPinnable(itemJson)) {
                return fail(`${at}: ${name} cannot be pinned to a screen.`);
            }
            if (
                screenIds.length === 0 &&
                action?.target === 'screen' &&
                action.requiresScreenIds
            ) {
                return fail(
                    `${at}: ${name} has to name the screens it runs on.`,
                );
            }
            const screenReason = checkScreens(screenIds);
            if (screenReason !== null) {
                return fail(`${at}: ${screenReason}`);
            }
            if (screenIds.length === 0) {
                delete itemJson.screenIds;
            } else {
                itemJson.screenIds = screenIds;
            }
            changed.push(
                screenIds.length === 0
                    ? `${name}: no specific screen`
                    : `${name}: pinned to screen ${screenIds.join(', ')}`,
            );
        }
        if (change.slides !== undefined) {
            const slideIdList = prepared.slideIdListMap.get(lineNumber);
            if (itemJson.type !== APP_DOCUMENT_TYPE || !slideIdList) {
                return fail(
                    `${at}: ${name} is not a document whose slides could be ` +
                        'read.',
                );
            }
            if (!Array.isArray(change.slides) || change.slides.length === 0) {
                return fail(
                    `${at}: \`slides\` is a list of {slide, park, screenIds}.`,
                );
            }
            for (const slideChange of change.slides) {
                const slideNumber = slideChange?.slide;
                const slideId =
                    checkIsLineNumber(slideNumber) &&
                    slideNumber <= slideIdList.length
                        ? slideIdList[slideNumber - 1]
                        : undefined;
                if (slideId === undefined) {
                    return fail(
                        `${at}: \`slide\` is a slide number of ${name}, 1 ` +
                            `to ${slideIdList.length}.`,
                    );
                }
                if (slideChange.park !== undefined) {
                    const kept = (itemJson.disabledSlideIds ?? []).filter(
                        (one) => {
                            return one !== slideId;
                        },
                    );
                    if (slideChange.park === true) {
                        kept.push(slideId);
                    }
                    if (kept.length === 0) {
                        delete itemJson.disabledSlideIds;
                    } else {
                        itemJson.disabledSlideIds = kept;
                    }
                    changed.push(
                        `${name}, slide ${slideNumber}: ` +
                            (slideChange.park === true ? 'parked' : 'in play'),
                    );
                }
                if (slideChange.screenIds !== undefined) {
                    const screenIds = toScreenIdList(slideChange.screenIds);
                    if (screenIds === null) {
                        return fail(
                            `${at}: \`screenIds\` is a list of screen numbers.`,
                        );
                    }
                    const screenReason = checkScreens(screenIds);
                    if (screenReason !== null) {
                        return fail(`${at}: ${screenReason}`);
                    }
                    const slideScreenIds = {
                        ...(itemJson.slideScreenIds ?? {}),
                    };
                    if (screenIds.length === 0) {
                        delete slideScreenIds[`${slideId}`];
                    } else {
                        slideScreenIds[`${slideId}`] = screenIds;
                    }
                    if (Object.keys(slideScreenIds).length === 0) {
                        delete itemJson.slideScreenIds;
                    } else {
                        itemJson.slideScreenIds = slideScreenIds;
                    }
                    changed.push(
                        `${name}, slide ${slideNumber}: ` +
                            (screenIds.length === 0
                                ? 'follows the document'
                                : `screen ${screenIds.join(', ')}`),
                    );
                }
            }
        }
        if (change.foreground !== undefined) {
            const target = itemJson.data?.target;
            if (
                itemJson.type !== FOREGROUND_TYPE ||
                typeof change.foreground !== 'object' ||
                change.foreground === null
            ) {
                return fail(`${at}: ${name} is not a foreground line.`);
            }
            const { widget: _widget, ...fields } = change.foreground;
            const built = genAgentForegroundData(
                target,
                fields,
                { existing: itemJson.data?.data ?? {} },
                prepared.genId,
            );
            if ('reason' in built) {
                return fail(`${at}: ${name}: ${built.reason}`);
            }
            const payload = { target, data: built.data };
            itemJson.data = payload;
            itemJson.title = toForegroundDragLabel(payload as any);
            changed.push(`${name} is now "${itemJson.title}"`);
        }
        if (change.cc !== undefined) {
            const reason = applyCcChange(
                itemJsonList,
                itemJson,
                change.cc,
                lineNumber,
                { getLine, removedSet, prepared, name, changed, checkScreens },
            );
            if (reason !== null) {
                return fail(`${at}: ${reason}`);
            }
        }
        if (change.after !== undefined) {
            const anchor = toAnchor(change.after);
            if (anchor === itemJson) {
                continue;
            }
            if (anchor !== END && anchor !== null && removedSet.has(anchor)) {
                return fail(`${at}: line ${change.after} is not there.`);
            }
            itemJsonList.splice(itemJsonList.indexOf(itemJson), 1);
            placement.place(itemJsonList, itemJson, anchor);
            changed.push(`moved ${name} ${describeAfter(change.after)}`);
        }
    }
    if (changed.length === 0) {
        return fail(
            'Nothing in `changes` changes anything: give an `add`, or a ' +
                '`line` with what changes on it.',
        );
    }
    return { changed };
}

type CcContextType = {
    getLine: (line: number) => PresentingFlowItemType | undefined;
    removedSet: Set<PresentingFlowItemType>;
    prepared: AgentFlowPreparedType;
    name: string;
    changed: string[];
    checkScreens: (screenIds: number[]) => string | null;
};

/** One `cc` change on a host line -- attach a follower, or change one. */
function applyCcChange(
    itemJsonList: PresentingFlowItemType[],
    host: PresentingFlowItemType,
    cc: any,
    lineNumber: number,
    context: CcContextType,
): string | null {
    const { getLine, removedSet, prepared, name, changed } = context;
    if (cc === null || typeof cc !== 'object') {
        return '`cc` is an object: {add} to attach, or {index, …} to change one.';
    }
    let slideId: number | null = null;
    let where = name;
    if (cc.slide !== undefined) {
        const slideIdList = prepared.slideIdListMap.get(lineNumber);
        if (host.type !== APP_DOCUMENT_TYPE || !slideIdList) {
            return `${name} has no slides to attach to.`;
        }
        if (!checkIsLineNumber(cc.slide) || cc.slide > slideIdList.length) {
            return (
                `\`cc.slide\` is a slide number of ${name}, 1 to ` +
                `${slideIdList.length}.`
            );
        }
        slideId = slideIdList[cc.slide - 1];
        where = `${name}, slide ${cc.slide}`;
    }
    const list = readCcHostList(host, slideId);
    const screenIds =
        cc.screenIds === undefined ? undefined : toScreenIdList(cc.screenIds);
    if (screenIds === null) {
        return '`cc.screenIds` is a list of screen numbers, [] for none.';
    }
    if (screenIds !== undefined) {
        const screenReason = context.checkScreens(screenIds);
        if (screenReason !== null) {
            return screenReason;
        }
    }
    let mediaControl:
        ReturnType<typeof toPresentingFlowMediaControl> | undefined;
    if (cc.mediaControl !== undefined) {
        mediaControl = toPresentingFlowMediaControl(cc.mediaControl);
        if (mediaControl === null) {
            return (
                '`cc.mediaControl` is {mode: "play"|"pause"|"stop", ' +
                'delaySecond, startAtSecond, pauseAfterSecond or ' +
                'pauseAtSecond, volume 0-100, speed}.'
            );
        }
    }
    if (cc.add !== undefined) {
        const add = cc.add;
        if (add === null || typeof add !== 'object') {
            return '`cc.add` is {line} (a line of the sheet) or {actionId, …}.';
        }
        if (slideId === null) {
            const maxCount = PresentingFlowItem.getMaxCcItemCount(host);
            if (list.length >= maxCount) {
                return maxCount === 0
                    ? `${name} takes no CC element.`
                    : `${name} takes only one CC element -- change or ` +
                          'remove the one it has.';
            }
        }
        const isTarget =
            slideId === null && PresentingFlowItem.checkIsCcTargetHost(host);
        let source: PresentingFlowItemType | null = null;
        let isNewSource = false;
        let armingText = '';
        if (add.line !== undefined) {
            source = getLine(add.line) ?? null;
            if (source === null || removedSet.has(source)) {
                return `line ${add.line} is not there.`;
            }
        } else {
            const actionId = toText(add.actionId);
            const action = findPresentingFlowAction(actionId);
            if (action === null) {
                return (
                    '`cc.add` names a `line` of the sheet, or an ' +
                    '`actionId` (next-timeout, slide-media-control, a clear).'
                );
            }
            const armingRead = readArming(add);
            if ('reason' in armingRead) {
                return armingRead.reason;
            }
            let arming = armingRead.arming ?? {};
            if (armingRead.arming !== null) {
                const misfit = checkArmingFits(action, armingRead.arming);
                if (misfit !== null) {
                    return misfit;
                }
            } else if (action.target === 'run' && action.number !== null) {
                arming = { actionNumber: action.number.defaultValue };
            }
            if (action.id === 'slide-media-control') {
                if (mediaControl === undefined) {
                    return (
                        'A Slide: Media Control needs `cc.mediaControl` -- ' +
                        '{mode: "play"} at least.'
                    );
                }
            } else {
                source = findReusableActionLine(
                    itemJsonList,
                    action.id,
                    arming,
                    host,
                );
            }
            if (source === null) {
                source = PresentingFlowItem.fromActionId(action.id, arming);
                isNewSource = true;
            }
            if (
                arming.actionNumber !== undefined ||
                arming.actionTime !== undefined
            ) {
                armingText = ` (${describeArming(arming)})`;
            }
        }
        if (source === host) {
            return 'a line cannot follow itself.';
        }
        // A line goes on by itself ONCE: a second timeout under it is two
        // clocks racing on one line. Seen live (gemma4:cloud, "Move on by
        // itself"): a song that already had one was given a second.
        if (source.data === 'next-timeout') {
            const timeoutIndex = list.findIndex((ccRecord) => {
                const element = itemJsonList.find((one) => {
                    return one.uuid === ccRecord?.uuid;
                });
                return element?.data === 'next-timeout';
            });
            if (timeoutIndex !== -1) {
                return (
                    `${where} already goes on by itself (its CC ` +
                    `${timeoutIndex + 1}): change that one's time with ` +
                    `cc {index: ${timeoutIndex + 1}, seconds} instead of ` +
                    'adding a second.'
                );
            }
        }
        if (PresentingFlowItem.resolveCcItemJson(source, isTarget) === null) {
            return (
                `"${toNewLineTitle(source)}" cannot ride along with a line ` +
                '(a document, audio, a Next: Interval, a Jump to and a ' +
                'Keyboard Event never follow one).'
            );
        }
        if (
            mediaControl !== undefined &&
            source.data !== 'slide-media-control'
        ) {
            return '`cc.mediaControl` is only for a Slide: Media Control.';
        }
        if (isNewSource) {
            itemJsonList.push(source);
        }
        const uuid = ensurePresentingFlowItemUuid(source);
        if (
            list.some((one) => {
                return one?.uuid === uuid;
            })
        ) {
            return `${where} already has that CC element.`;
        }
        const record: PresentingFlowCcItemType = { uuid };
        if (screenIds !== undefined && screenIds.length > 0) {
            record.screenIds = screenIds;
        }
        if (mediaControl !== undefined && mediaControl !== null) {
            record.mediaControl = mediaControl;
        }
        list.push(record);
        writeCcHostList(host, slideId, list);
        changed.push(
            isTarget
                ? `${where} goes to "${toNewLineTitle(source)}"`
                : `${where} now brings "${toNewLineTitle(source)}${armingText}" ` +
                      'with it' +
                      (isNewSource ? ' (a new line at the end)' : ''),
        );
        return null;
    }
    if (!checkIsLineNumber(cc.index) || cc.index > list.length) {
        return list.length === 0
            ? `${where} has no CC element; \`cc.add\` attaches one.`
            : `\`cc.index\` is 1 to ${list.length}, a CC of ${where} as read.`;
    }
    const ccIndex = cc.index - 1;
    const ccRecord = { ...list[ccIndex] };
    const source =
        itemJsonList.find((one) => {
            return one.uuid === ccRecord.uuid;
        }) ?? null;
    const sourceTitle =
        source === null ? 'a line that is gone' : toNewLineTitle(source);
    if (cc.remove === true) {
        list.splice(ccIndex, 1);
        writeCcHostList(host, slideId, list);
        changed.push(`${where} no longer brings "${sourceTitle}"`);
        return null;
    }
    let didChange = false;
    if (screenIds !== undefined) {
        if (screenIds.length === 0) {
            delete ccRecord.screenIds;
        } else {
            ccRecord.screenIds = screenIds;
        }
        changed.push(
            `${where}'s "${sourceTitle}": ` +
                (screenIds.length === 0
                    ? 'follows its line'
                    : `screen ${screenIds.join(', ')}`),
        );
        didChange = true;
    }
    const armingRead = readArming(cc);
    if ('reason' in armingRead) {
        return armingRead.reason;
    }
    if (armingRead.arming !== null || cc.clearArming === true) {
        if (source === null || !PresentingFlowItem.checkCanBeCcArmed(source)) {
            return `"${sourceTitle}" is not armed on its own under a line.`;
        }
        if (armingRead.arming?.actionKey !== undefined) {
            return 'a CC element is never armed with a shortcut.';
        }
        if (armingRead.arming === null) {
            delete ccRecord.actionArming;
            changed.push(`${where}'s "${sourceTitle}": its own line's time`);
        } else {
            const misfit = checkArmingFits(
                findPresentingFlowAction(source.data),
                armingRead.arming,
            );
            if (misfit !== null) {
                return misfit;
            }
            ccRecord.actionArming = armingRead.arming;
            changed.push(
                `${where}'s "${sourceTitle}": ${describeArming(armingRead.arming)}`,
            );
        }
        didChange = true;
    }
    if (mediaControl !== undefined) {
        if (source?.data !== 'slide-media-control') {
            return '`cc.mediaControl` is only for a Slide: Media Control.';
        }
        if (mediaControl !== null) {
            ccRecord.mediaControl = mediaControl;
        }
        changed.push(`${where}'s media control: ${mediaControl?.mode}`);
        didChange = true;
    }
    if (!didChange) {
        return (
            '`cc` with an `index` changes that CC: `remove`, `screenIds`, ' +
            '`seconds` / `time` / `clearArming`, or `mediaControl`.'
        );
    }
    list[ccIndex] = ccRecord;
    writeCcHostList(host, slideId, list);
    return null;
}

/**
 * Lines taken out of the sheet, by their numbers as read -- `remove-lines`,
 * one call and one undo. Whatever followed a removed line goes with it.
 */
export function applyAgentFlowRemoval(
    itemJsonList: PresentingFlowItemType[],
    lines: unknown,
    titles: readonly string[],
): ResultType {
    if (!Array.isArray(lines) || lines.length === 0) {
        return fail('`lines` is a list of line numbers as read.');
    }
    const lineList = itemJsonList.slice();
    for (const line of lines) {
        if (!checkIsLineNumber(line) || line > lineList.length) {
            return fail(
                `\`lines\` are line numbers as the sheet reads now, 1 to ` +
                    `${lineList.length}.`,
            );
        }
    }
    const changed: string[] = [];
    for (const line of [...new Set(lines as number[])].sort((a, b) => {
        return a - b;
    })) {
        const itemJson = lineList[line - 1];
        itemJsonList.splice(itemJsonList.indexOf(itemJson), 1);
        dropPresentingFlowCcItemsOfUuid(
            itemJsonList,
            typeof itemJson.uuid === 'string' ? itemJson.uuid : null,
        );
        changed.push(`removed line ${line} "${titles[line - 1] ?? ''}"`);
    }
    return { changed };
}
