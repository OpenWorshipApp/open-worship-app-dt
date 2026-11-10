/**
 * The app side of `owa_foreground` and `owa_foreground_edit`: put up, take
 * down, read and CHANGE any foreground component -- a countdown, a
 * stopwatch, a clock, a marquee, a quick text, messages, a Long Text Show,
 * a clip, a picture, a camera, another screen, a web page -- the way its own
 * panel does, and answer with what each screen holds afterwards.
 *
 * ## Why the tool needed the app for this
 *
 * "Start a 5 minute countdown on the screen" is a pre-service ask in nearly
 * every church, and measured 2026-09-11 on Claude Sonnet 5 it was the worst
 * answer of the day: the Foreground tab is a toggle the model shut, and the
 * widget is a form written for a person. So this takes the ask as words.
 *
 * ## Through the component, not around it (2026-11-09)
 *
 * The first cut wrote the SCREEN and nothing else: an overlay with no style
 * of its own, no session, no layer, and a panel that never showed what went
 * up -- a countdown the operator's Pause did not belong to, in a size and a
 * place the panel was not set to. The user asked for more: _chatbot can help
 * modify any foreground component_, a quick text _for a given bible verse_,
 * and a session of an open panel attached to the chat as its context. So now:
 *
 * - the words go into a SESSION of the panel, the panel's own keys
 *   (`agentForegroundContentHelpers.ts`) -- a new one named after them, or
 *   the one the person attached or named -- and its open panel is told to
 *   read them (`notifyForegroundPanel`);
 * - what goes up is built from that session exactly as its Show button
 *   builds it (`agentForegroundComponentHelpers.ts`), so it wears the
 *   session's look;
 * - a look is set in words (`agentForegroundLookRules.ts`) into the very
 *   keys the Properties panel writes, and whatever of that session is up is
 *   dressed again on the spot;
 * - every change is backed up first (`runWithAgentBackup`), so the answer
 *   carries an `undoId` and the help window's **Undo this change** puts the
 *   panel and the look on the wall back.
 *
 * ## The rules it keeps
 *
 * - Reached the way `owa_present_bible` is: a page expression fires a DOM
 *   event and `domHelpers.ts` relays it here with a LAZY import -- the screen
 *   managers must not load in every window because somebody might ask.
 * - Only the Presenter page has the screens; anywhere else is refused in a
 *   sentence for a PERSON (`/countdown` and the offline bot print it).
 * - A locked screen refuses, as it refuses a click, and the answer says so.
 * - Whether to put anything UP is decided before this is called: the model
 *   is told to do it when the user asked, offer it otherwise; reads touch no
 *   screen and no setting.
 */
import { getAllScreenManagers } from '../_screen/managers/screenManagerHelpers';
import type ScreenManager from '../_screen/managers/ScreenManager';
import appProvider from '../server/appProvider';
import { toForegroundSummary } from './agentScreenHelpers';
import { getSetting } from './settingHelpers';
import {
    applyForegroundColorMode,
    applyForegroundPreset,
    getForegroundPresetList,
    readForegroundPresetAsk,
    readForegroundSessionColors,
} from '../presenter-foreground/foregroundPresetHelpers';
import {
    type ForegroundColorModeType,
    toForegroundColorMode,
} from '../presenter-foreground/foregroundContrastHelpers';
import { getForegroundDefaultColors } from '../presenter-foreground/foregroundThemeColorHelpers';
import {
    type ForegroundSavedPresetType,
    applyForegroundSavedPreset,
    findForegroundSavedPreset,
    getForegroundSavedPresets,
} from '../presenter-foreground/foregroundSavedPresetHelpers';
import {
    FOREGROUND_COMPONENT_LIST,
    type ForegroundComponentKeyType,
    checkIsForegroundComponentKey,
    toForegroundComponentLabel,
} from '../presenter-foreground/foregroundComponentKeys';
import {
    FOREGROUND_COMPONENT_RULE_MAP,
    genClockOwnSettingNames,
} from '../presenter-foreground/foregroundComponentRules';
import {
    genCommonStyleSettingNames,
    genDecorationSettingName,
    genPropsSettingNames,
} from '../presenter-foreground/foregroundStyleSettingNames';
import {
    type ForegroundSettingWriteType,
    planForegroundLook,
    toForegroundHexColor,
    toForegroundPlaceWords,
} from './agentForegroundLookRules';
import {
    AGENT_FOREGROUND_TIMER_DOS,
    type AgentForegroundContextType,
    type AgentForegroundReasonType,
    type AgentForegroundTimerDoType,
    applyTimerOnScreen,
    checkIsOnScreen,
    checkIsReason,
    hideOnScreen,
    planShow,
    readClockIdList,
    restyleOnScreen,
    toLookPrefix,
} from './agentForegroundComponentHelpers';
import {
    type AgentForegroundContentPlanType,
    type AgentForegroundContentRequestType,
    checkIsSameContent,
    parseClockTimeToday as parseClockTimeTodayOf,
    planForegroundContent,
    readForegroundContent,
    readForegroundVerse,
} from './agentForegroundContentHelpers';
import {
    type AgentForegroundSessionType,
    activateForegroundSession,
    addForegroundSession,
    applySettingWrites,
    findForegroundSession,
    genLookCopyWrites,
    genNewForegroundSession,
    genSessionStripKeys,
    getActiveForegroundSession,
    readForegroundSessions,
} from './agentForegroundSessionHelpers';

export type AgentForegroundRequestType = AgentForegroundContentRequestType & {
    action?: unknown;
    widget?: unknown;
    /** A session by its id (an attached chip's) or its name. */
    session?: unknown;
    /** Video / Image / Web Show: a file of the session's folder, by name. */
    file?: unknown;
    /** Camera Show: the camera, by its name. */
    camera?: unknown;
    /** Screen Show: the number of the screen to show. */
    source?: unknown;
    /** Video Show: sound on or off, and how loud (0-100). */
    sound?: unknown;
    volume?: unknown;
    /** Quick Text: one of the panel's looks made for a job. */
    preset?: unknown;
    look?: unknown;
    timer?: unknown;
    screens?: unknown;
    /** `read`: the panels open in the Presenter and their sessions. */
    open?: unknown;
    /** `session`: what a new session is called. */
    name?: unknown;
};

export type AgentForegroundScreenType = {
    screenId: number;
    isShowing: boolean;
    isLocked: boolean;
    foreground: string[];
};

export type AgentForegroundRefusalType = {
    isError: true;
    reason: string;
};

export type AgentForegroundDidType =
    | 'started'
    | 'stopped'
    | 'checked'
    | 'read'
    | 'changed'
    | 'shown'
    | 'hidden'
    | 'timer'
    | 'created';

export type AgentForegroundResultType =
    | AgentForegroundRefusalType
    | ({
          isError?: false;
          did: AgentForegroundDidType;
          widget: string | null;
          detail: string;
          screens?: AgentForegroundScreenType[];
          isAnyShowing?: boolean;
          note?: string;
      } & Record<string, unknown>);

// Held in step with `AGENT_FOREGROUND_WIDGETS` / `AGENT_FOREGROUND_ACTIONS`
// in `tools/owa-devtools-mcp/agentForeground.mjs`, which the tool's schema
// reads; a test holds the two together. `clock` is what people call the
// Time component, so the tool says `clock` and this reads it as `time`.
export const AGENT_FOREGROUND_WIDGETS = [
    'countdown',
    'stopwatch',
    'clock',
    'marquee-top',
    'marquee-bottom',
    'quick-text',
    'message',
    'long-text',
    'video',
    'image',
    'camera',
    'screen',
    'web',
    'all',
] as const;
export const AGENT_FOREGROUND_ACTIONS = ['start', 'stop', 'check'] as const;
// `owa_foreground_edit`'s, held in step with `agentForegroundEdit.mjs`.
export const AGENT_FOREGROUND_EDIT_ACTIONS = [
    'read',
    'set',
    'show',
    'hide',
    'timer',
    'session',
] as const;
export type AgentForegroundWidgetType =
    (typeof AGENT_FOREGROUND_WIDGETS)[number];

export const parseClockTimeToday = parseClockTimeTodayOf;

const ALL_ACTION_LIST: readonly string[] = [
    ...AGENT_FOREGROUND_ACTIONS,
    ...AGENT_FOREGROUND_EDIT_ACTIONS,
];

// What each component is called in a sentence to a person.
const WIDGET_NOUN_MAP: Record<ForegroundComponentKeyType, string> = {
    countdown: 'countdown',
    stopwatch: 'stopwatch',
    time: 'clock',
    'marquee-top': 'scrolling message along the top',
    'marquee-bottom': 'scrolling message along the bottom',
    'quick-text': 'line of text',
    message: 'message',
    'long-text': 'long text',
    video: 'video',
    image: 'picture',
    camera: 'camera',
    screen: 'picture of another screen',
    web: 'web page',
};

const MAX_LISTED_NAMES = 30;

function toReason(reason: string): AgentForegroundRefusalType {
    return { isError: true, reason };
}

function fromReason(value: AgentForegroundReasonType) {
    return toReason(value.reason);
}

function toWidgetKey(value: unknown): ForegroundComponentKeyType | null {
    if (typeof value !== 'string') {
        return null;
    }
    const text = value.trim().toLowerCase();
    if (text === 'clock' || text === 'time' || text === 'clocks') {
        return 'time';
    }
    if (text === 'messages') {
        return 'message';
    }
    return checkIsForegroundComponentKey(text) ? text : null;
}

function toScreenState(
    screenManager: ScreenManager,
): AgentForegroundScreenType {
    return {
        screenId: screenManager.screenId,
        isShowing: screenManager.isShowing,
        isLocked: screenManager.isLocked,
        foreground: toForegroundSummary(
            screenManager.screenForegroundManager.foregroundData,
        ),
    };
}

function getLiveManagers() {
    return getAllScreenManagers().filter((screenManager) => {
        return !screenManager.isDeleted;
    });
}

function readScreenIdList(value: unknown) {
    if (!Array.isArray(value)) {
        return null;
    }
    const list = value
        .map((one) => {
            return typeof one === 'number' ? one : Number.parseInt(`${one}`);
        })
        .filter((one) => {
            return Number.isInteger(one);
        });
    return list.length > 0 ? list : null;
}

function genListedNames(names: string[]) {
    return names
        .slice(0, MAX_LISTED_NAMES)
        .map((name) => {
            return `"${name}"`;
        })
        .join(', ');
}

// --- the colour words a model writes -------------------------------------

/** Any CSS colour Chromium knows, as `#rrggbb(aa)`, or null. */
function resolveCssColor(value: string) {
    try {
        const context = document.createElement('canvas').getContext('2d');
        if (context === null) {
            return null;
        }
        context.fillStyle = '#010203';
        context.fillStyle = value;
        const resolved = String(context.fillStyle);
        if (resolved === '#010203') {
            return null;
        }
        if (resolved.startsWith('#')) {
            return resolved;
        }
        const match =
            /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(
                resolved,
            );
        if (match === null) {
            return null;
        }
        const toHex = (part: number) => {
            return Math.round(part).toString(16).padStart(2, '0');
        };
        const alpha =
            match[4] === undefined ? '' : toHex(Number(match[4]) * 255);
        return `#${toHex(Number(match[1]))}${toHex(Number(match[2]))}${toHex(Number(match[3]))}${alpha}`;
    } catch {
        return null;
    }
}

// --- who it is about ---------------------------------------------------

type TargetType = {
    context: AgentForegroundContextType;
    session: AgentForegroundSessionType | null;
    isNewSession: boolean;
    /** For a camera, what the answer and the datum call it. */
    itemLabel?: string;
};

/**
 * Camera Show and Screen Show have no sessions: the camera named, the screen
 * named, else (to stop or read) every one.
 */
async function resolveItem(
    widget: ForegroundComponentKeyType,
    request: AgentForegroundRequestType,
    isNeeded: boolean,
): Promise<
    { itemId?: string; itemLabel?: string } | AgentForegroundRefusalType
> {
    if (widget === 'camera') {
        const wanted =
            typeof request.camera === 'string' ? request.camera.trim() : '';
        if (wanted === '') {
            return isNeeded
                ? toReason(
                      'Say which camera to show: camera, by its name. ' +
                          'Action "read" lists them.',
                  )
                : {};
        }
        const { getAllCameraDevices } = await import('./cameraHelpers');
        const cameraList = await getAllCameraDevices();
        const lower = wanted.toLowerCase();
        const found =
            cameraList.find((camera) => {
                return camera.label.toLowerCase() === lower;
            }) ??
            cameraList.find((camera) => {
                return camera.label.toLowerCase().includes(lower);
            });
        if (found === undefined) {
            return toReason(
                `There is no camera called "${wanted}". ` +
                    (cameraList.length === 0
                        ? 'No camera is connected to this computer.'
                        : `The cameras are ${genListedNames(
                              cameraList.map((camera) => {
                                  return camera.label;
                              }),
                          )}.`),
            );
        }
        return { itemId: found.deviceId, itemLabel: found.label };
    }
    if (widget === 'screen') {
        const source = Number.parseInt(`${request.source ?? ''}`);
        if (!Number.isInteger(source)) {
            return isNeeded
                ? toReason(
                      'Say which screen to show: source, its number (the ' +
                          'Mini Screen card says it).',
                  )
                : {};
        }
        const isThere = getLiveManagers().some((screenManager) => {
            return screenManager.screenId === source;
        });
        if (!isThere) {
            return toReason(`There is no screen ${source}.`);
        }
        return { itemId: `${source}` };
    }
    return {};
}

function toContext(
    widget: ForegroundComponentKeyType,
    session: AgentForegroundSessionType | null,
    itemId?: string,
): AgentForegroundContextType {
    const sessions = FOREGROUND_COMPONENT_RULE_MAP[widget].hasSessions
        ? readForegroundSessions(widget)
        : [];
    return {
        widget,
        sessionId: session?.id ?? '',
        suffix: session?.suffix ?? '',
        sessionIds: sessions.map((one) => {
            return one.id;
        }),
        ...(itemId === undefined ? {} : { itemId }),
    };
}

/**
 * The session an ask is about: the one it NAMES (changed in place), else --
 * when it brings words -- the active one if it already holds them, a
 * session already called after them, or a new one; else the active one.
 */
async function resolveTarget(
    widget: ForegroundComponentKeyType,
    request: AgentForegroundRequestType,
    now: Date,
    isItemNeeded: boolean,
): Promise<
    | {
          target: TargetType;
          plan: AgentForegroundContentPlanType | null;
      }
    | AgentForegroundRefusalType
> {
    const rule = FOREGROUND_COMPONENT_RULE_MAP[widget];
    const item = await resolveItem(widget, request, isItemNeeded);
    if ('isError' in item) {
        return item;
    }
    if (!rule.hasSessions) {
        return {
            target: {
                context: toContext(widget, null, item.itemId),
                session: null,
                isNewSession: false,
                ...(item.itemLabel ? { itemLabel: item.itemLabel } : {}),
            },
            plan: null,
        };
    }
    const named =
        request.session === undefined || request.session === ''
            ? null
            : findForegroundSession(widget, request.session);
    if (
        request.session !== undefined &&
        request.session !== '' &&
        named === null
    ) {
        return toReason(
            `There is no ${toForegroundComponentLabel(widget)} session called ` +
                `"${String(request.session)}". The sessions are ` +
                `${genListedNames(
                    readForegroundSessions(widget).map((one) => {
                        return one.name;
                    }),
                )}.`,
        );
    }
    const planFor = async (suffix: string) => {
        return planForegroundContent(widget, request, suffix, now);
    };
    const active = getActiveForegroundSession(widget);
    const base = named ?? active;
    const basePlan = await planFor(base.suffix);
    if (checkIsReason(basePlan)) {
        return fromReason(basePlan);
    }
    if (named !== null || basePlan === null || basePlan.name === '') {
        return {
            target: {
                context: toContext(widget, base),
                session: base,
                isNewSession: false,
            },
            plan: basePlan,
        };
    }
    // New words, no session named: never over what the active one holds.
    if (checkIsSameContent(basePlan)) {
        return {
            target: {
                context: toContext(widget, active),
                session: active,
                isNewSession: false,
            },
            plan: basePlan,
        };
    }
    const byName = findForegroundSession(widget, basePlan.name);
    if (byName !== null) {
        const plan = await planFor(byName.suffix);
        if (checkIsReason(plan)) {
            return fromReason(plan);
        }
        return {
            target: {
                context: toContext(widget, byName),
                session: byName,
                isNewSession: false,
            },
            plan,
        };
    }
    const fresh = genNewForegroundSession(basePlan.name);
    const plan = await planFor(fresh.suffix);
    if (checkIsReason(plan) || plan === null) {
        return plan === null
            ? toReason('Nothing to put in the new session.')
            : fromReason(plan);
    }
    const session: AgentForegroundSessionType = { ...fresh, isActive: true };
    const context = toContext(widget, session);
    return {
        target: {
            // Not on the strip yet: it is added once its keys are written.
            context: {
                ...context,
                sessionIds: [...context.sessionIds, fresh.id],
            },
            session,
            isNewSession: true,
        },
        plan,
    };
}

// --- the keys a change touches, for its backup ---------------------------

function genLookKeys(prefix: string) {
    return [
        ...Object.values(genPropsSettingNames(prefix)),
        ...Object.values(genCommonStyleSettingNames(prefix)),
        genDecorationSettingName(prefix),
    ];
}

/** Every key of a session (or item), so an undo puts all of it back. */
function genTargetKeys(
    target: TargetType,
    plan: AgentForegroundContentPlanType | null,
) {
    const { widget, suffix, itemId } = target.context;
    const rule = FOREGROUND_COMPONENT_RULE_MAP[widget];
    const keys = new Set<string>();
    if (rule.hasSessions) {
        for (const key of genSessionStripKeys(widget)) {
            keys.add(key);
        }
        for (const key of rule.toOwnSettingNames(suffix)) {
            keys.add(key);
        }
    }
    const lookPrefix = toLookPrefix(target.context);
    if (lookPrefix !== null) {
        for (const key of genLookKeys(lookPrefix)) {
            keys.add(key);
        }
    }
    if (widget === 'time') {
        const clockIdList = [
            ...readClockIdList(suffix),
            ...(plan?.newClockIdList ?? []),
        ];
        for (const clockId of itemId === undefined ? clockIdList : [itemId]) {
            for (const key of Object.values(genClockOwnSettingNames(clockId))) {
                keys.add(key);
            }
            for (const key of genLookKeys(`time-${clockId}`)) {
                keys.add(key);
            }
        }
    }
    if (widget === 'video') {
        const prefix = `video-show${suffix}`;
        keys.add(`${prefix}-sound-on`);
        keys.add(`${prefix}-sound-volume`);
    }
    if (widget === 'marquee-top' || widget === 'marquee-bottom') {
        keys.add(`foreground-${widget}-font-size${suffix}`);
        keys.add(`foreground-${widget}-speed-percentage${suffix}`);
    }
    return [...keys];
}

async function runBackedUp<T>(
    summary: string,
    widget: ForegroundComponentKeyType,
    keys: string[],
    change: () => Promise<T>,
) {
    const { runWithAgentBackup, genUndoField } =
        await import('./agentBackupHelpers');
    const restores = keys.map((key) => {
        return {
            type: 'app-setting' as const,
            key,
            text: getSetting(key),
            foreground: widget,
        };
    });
    const { meta, value } = await runWithAgentBackup(summary, restores, change);
    return { value, undo: genUndoField(meta) };
}

// --- the look --------------------------------------------------------------

/** The writes for a `look`, onto every prefix it dresses. */
function planLookWrites(
    target: TargetType,
    look: unknown,
):
    | { writes: ForegroundSettingWriteType[]; said: string[] }
    | AgentForegroundRefusalType {
    const { widget, suffix, itemId } = target.context;
    const flags = FOREGROUND_COMPONENT_RULE_MAP[widget].flags;
    if (widget === 'long-text') {
        return toReason(
            'A Long Text Show language is styled in its own card of the ' +
                'panel (its font and size). Open its panel to change it.',
        );
    }
    if (flags === undefined) {
        return toReason(`The ${widget} has no look to change.`);
    }
    let prefixList: string[];
    if (widget === 'time') {
        prefixList = (
            itemId === undefined ? readClockIdList(suffix) : [itemId]
        ).map((clockId) => {
            return `time-${clockId}`;
        });
    } else {
        const prefix = toLookPrefix(target.context);
        prefixList = prefix === null ? [] : [prefix];
    }
    if (prefixList.length === 0) {
        return toReason(
            widget === 'camera'
                ? 'Say which camera: camera, by its name.'
                : widget === 'screen'
                  ? 'Say which screen: source, its number.'
                  : 'That session has nothing whose look can be changed yet.',
        );
    }
    const writes: ForegroundSettingWriteType[] = [];
    let said: string[] = [];
    for (const prefix of prefixList) {
        const plan = planForegroundLook(look, {
            widget,
            prefix,
            suffix,
            flags,
            read: getSetting,
            toHexColor: resolveCssColor,
        });
        if ('reason' in plan) {
            return toReason(plan.reason);
        }
        writes.push(...plan.writes);
        said = plan.said;
    }
    return { writes, said };
}

/** A session's look in words, for `read`: what its Properties are set to. */
function readLookWords(target: TargetType) {
    const prefix =
        target.context.widget === 'time'
            ? (() => {
                  const [first] = readClockIdList(target.context.suffix);
                  return first === undefined ? null : `time-${first}`;
              })()
            : toLookPrefix(target.context);
    if (prefix === null) {
        return null;
    }
    const names = genPropsSettingNames(prefix);
    const commonNames = genCommonStyleSettingNames(prefix);
    const flags = FOREGROUND_COMPONENT_RULE_MAP[target.context.widget].flags;
    const look: Record<string, unknown> = {};
    const read = (key: string) => {
        const value = getSetting(key);
        return value === null || value === '' ? undefined : value;
    };
    if (flags?.isFontSize) {
        look.size = `${read(names.fontSize) ?? 100}px`;
    }
    if (flags?.isGeometry) {
        look.position = toForegroundPlaceWords(read(names.alignment) ?? null);
        look.width = `${read(names.widthPercentage) ?? 50}%`;
        look.scale = Number(read(names.scale) ?? 1);
        look.opacity = `${read(names.opacityPercentage) ?? 100}%`;
    }
    if (flags?.isCommonStyle) {
        look.color = read(commonNames.color) ?? '#FFFFFF';
        look.background = read(commonNames.backgroundColor) ?? '#000080AA';
        look.blur = `${read(commonNames.backdropFilter) ?? 5}px`;
        const font = read(commonNames.fontFamily);
        if (font) {
            look.font = font;
        }
        if (read(commonNames.fontWeight) === '700') {
            look.bold = true;
        }
    }
    if (flags?.isBlendMode) {
        look.blend = read(names.blendMode) ?? 'normal';
    }
    if (read(names.isBehind) === 'true') {
        look.behind = true;
    }
    if (read(names.isAlwaysOnTop) === 'true') {
        look.onTop = true;
    }
    const transition = read(names.transitionEffect);
    if (transition) {
        look.transition = transition;
    }
    const decoration = read(genDecorationSettingName(prefix));
    if (decoration) {
        try {
            const parsed = JSON.parse(decoration);
            for (const key of ['borderStyle', 'shadow', 'textAlign']) {
                if (typeof parsed?.[key] === 'string') {
                    look[key === 'borderStyle' ? 'border' : key] = parsed[key];
                }
            }
        } catch {
            // A broken Effects value reads as the defaults on the screen too.
        }
    }
    const { widget, suffix } = target.context;
    if (widget === 'marquee-top' || widget === 'marquee-bottom') {
        const fontSize = Number(
            read(`foreground-${widget}-font-size${suffix}`) ?? 0,
        );
        look.size = fontSize > 0 ? `${fontSize}px` : 'auto';
        look.speed = `${read(`foreground-${widget}-speed-percentage${suffix}`) ?? 100}%`;
    }
    return look;
}

// --- media -------------------------------------------------------------------

const MEDIA_DIR_SETTING_MAP = {
    video: 'select-dir-video-fg',
    image: 'select-dir-image-fg',
    web: 'select-dir-web-bg',
} as const;

async function listSessionFileNames(
    widget: 'video' | 'image' | 'web',
    suffix: string,
) {
    const { default: DirSource } = await import('./DirSource');
    const dirPath = DirSource.getDirPathBySettingName(
        `${MEDIA_DIR_SETTING_MAP[widget]}${suffix}`,
    );
    if (dirPath === null) {
        return null;
    }
    const { listAgentFiles } = await import('./agentBackupHelpers');
    const files = await listAgentFiles(dirPath, widget, '');
    return files;
}

async function resolveMediaFile(
    target: TargetType,
    fileValue: unknown,
): Promise<
    { filePath: string; fullName: string } | AgentForegroundRefusalType
> {
    const widget = target.context.widget as 'video' | 'image' | 'web';
    const asked = typeof fileValue === 'string' ? fileValue.trim() : '';
    if (asked === '') {
        return toReason(
            `Say which ${WIDGET_NOUN_MAP[widget]} to show: file, by its name.`,
        );
    }
    const files = await listSessionFileNames(widget, target.context.suffix);
    if (files === null) {
        return toReason(
            `That ${toForegroundComponentLabel(widget)} session has no folder ` +
                'set yet. Its panel is where one is chosen.',
        );
    }
    const names = files.map((file) => {
        return file.fullName;
    });
    const { findBackgroundCandidates, findBackgroundFileName } =
        await import('./agentSlideBackgroundRules');
    const exact = findBackgroundFileName(names, asked);
    const candidates =
        exact === null ? findBackgroundCandidates(names, asked) : [exact];
    if (candidates.length === 1) {
        const found = files.find((file) => {
            return file.fullName === candidates[0];
        });
        if (found !== undefined) {
            return { filePath: found.filePath, fullName: found.fullName };
        }
    }
    if (candidates.length > 1) {
        return toReason(
            `Several files fit "${asked}": ${genListedNames(candidates)}. Say ` +
                'which one.',
        );
    }
    return toReason(
        `There is no file called "${asked}" in that session's folder. ` +
            (names.length === 0
                ? 'The folder is empty.'
                : `The files are ${genListedNames(names)}` +
                  (names.length > MAX_LISTED_NAMES ? ' (and more).' : '.')),
    );
}

function planSoundWrites(
    target: TargetType,
    request: AgentForegroundRequestType,
): ForegroundSettingWriteType[] | AgentForegroundRefusalType {
    if (request.sound === undefined && request.volume === undefined) {
        return [];
    }
    if (target.context.widget !== 'video') {
        return toReason('Only a Video Show clip has sound.');
    }
    const prefix = `video-show${target.context.suffix}`;
    const writes: ForegroundSettingWriteType[] = [];
    if (request.sound !== undefined) {
        const isOn =
            request.sound === true ||
            (typeof request.sound === 'string' &&
                /^(?:true|on|yes)$/i.test(request.sound.trim()));
        writes.push({ key: `${prefix}-sound-on`, value: `${isOn}` });
    }
    if (request.volume !== undefined) {
        const volume = Number(request.volume);
        if (!Number.isFinite(volume) || volume < 0 || volume > 100) {
            return toReason('volume is 0-100.');
        }
        writes.push({
            key: `${prefix}-sound-volume`,
            value: `${Math.round(volume)}`,
        });
    }
    return writes;
}

// --- the screens -------------------------------------------------------------

/** Ticked screens to put something up on, or the ones asked for. */
function pickShowScreens(request: AgentForegroundRequestType) {
    const asked = readScreenIdList(request.screens);
    return getLiveManagers().filter((screenManager) => {
        return asked === null
            ? screenManager.isSelected
            : asked.includes(screenManager.screenId);
    });
}

function genLockedNote(lockedIds: number[]) {
    return lockedIds.length === 0
        ? null
        : `Screen ${lockedIds.join(' and ')} is locked and was left as it was.`;
}

function genOffNote(screenList: ScreenManager[]) {
    const offIds = screenList
        .filter((screenManager) => {
            return !screenManager.isLocked && !screenManager.isShowing;
        })
        .map((screenManager) => {
            return screenManager.screenId;
        });
    return offIds.length === 0
        ? null
        : `Screen ${offIds.join(' and ')} holds it but is OFF, so the ` +
              'projector shows nothing until its show button is pressed ' +
              '(owa_list_screens names it under controls.showHide) -- ' +
              'offer that, do not press it unasked.';
}

/** Opens the component's panel (or brings it forward) once its keys are in. */
async function openPanel(widget: ForegroundComponentKeyType) {
    try {
        const {
            FOREGROUND_OPEN_PANELS_SETTING_NAME,
            requestForegroundPanelOpening,
            toOpenedPanelKeys,
        } = await import('../presenter-foreground/foregroundWidgetHelpers');
        if (!requestForegroundPanelOpening(widget)) {
            const { setSetting } = await import('./settingHelpers');
            setSetting(
                FOREGROUND_OPEN_PANELS_SETTING_NAME,
                toOpenedPanelKeys(
                    getSetting(FOREGROUND_OPEN_PANELS_SETTING_NAME) ?? '',
                    widget,
                ),
            );
        }
    } catch {
        // The panel opens on the next press of the Foreground tab instead.
    }
}

async function notifyPanel(widget: ForegroundComponentKeyType) {
    const { notifyForegroundPanel } =
        await import('../presenter-foreground/foregroundPanelRevisionHelpers');
    notifyForegroundPanel(widget);
}

/** `Quick Text › John 3:16`: what the help window calls the change. */
function toTargetName(target: TargetType) {
    const label = toForegroundComponentLabel(target.context.widget);
    if (target.session !== null) {
        return `${label} › ${target.session.name}`;
    }
    return target.itemLabel
        ? `${label} › ${target.itemLabel}`
        : target.context.itemId
          ? `${label} › ${target.context.itemId}`
          : label;
}

function toSessionField(target: TargetType) {
    return target.session === null
        ? null
        : {
              id: target.session.id,
              name: target.session.name,
              isNew: target.isNewSession,
          };
}

// --- the actions -------------------------------------------------------------

async function handleCheck(
    widget: ForegroundComponentKeyType | null,
): Promise<AgentForegroundResultType> {
    const allManagers = getLiveManagers();
    const screens = allManagers.map(toScreenState);
    const held = screens.filter((screen) => {
        return screen.foreground.length > 0;
    });
    const detail =
        held.length === 0
            ? 'No foreground extra is on any screen.'
            : held
                  .map((screen) => {
                      return (
                          `Screen ${screen.screenId} holds ` +
                          `${screen.foreground.join(', ')}` +
                          (screen.isShowing ? '' : ' (off)')
                      );
                  })
                  .join('. ') + '.';
    return {
        did: 'checked',
        widget,
        detail,
        screens,
        isAnyShowing: allManagers.some((screenManager) => {
            return screenManager.isShowing;
        }),
        note: 'Nothing was changed: this only read the screens.',
    };
}

/** Every item of a component on one screen, whatever session put it up. */
function hideWholeComponent(
    widget: ForegroundComponentKeyType,
    screenManager: ScreenManager,
) {
    const context: AgentForegroundContextType = {
        widget,
        sessionId: '',
        suffix: '',
        sessionIds: [],
    };
    const manager = screenManager.screenForegroundManager;
    switch (widget) {
        case 'message':
            manager.setMessageDataList([]);
            return;
        case 'time':
            manager.setTimeDataList([]);
            return;
        case 'long-text': {
            for (const session of readForegroundSessions('long-text')) {
                hideOnScreen(
                    { ...context, suffix: session.suffix },
                    screenManager,
                );
            }
            return;
        }
        case 'video':
            manager.setVideoDataList([]);
            return;
        case 'image':
            manager.setImageDataList([]);
            return;
        case 'web':
            manager.setWebDataList([]);
            return;
        case 'camera':
            manager.setCameraDataList([]);
            return;
        case 'screen':
            manager.setScreenDataList([]);
            return;
        default:
            // A single-slot widget: whatever session put it up.
            hideOnScreen({ ...context, sessionIds: [] }, screenManager);
            if (widget === 'countdown') {
                manager.removeSessionData('countdownDataList', null);
            } else if (widget === 'stopwatch') {
                manager.removeSessionData('stopwatchDataList', null);
            } else if (widget === 'marquee-top') {
                manager.removeSessionData('marqueeTopDataList', null);
            } else if (widget === 'marquee-bottom') {
                manager.removeSessionData('marqueeBottomDataList', null);
            } else if (widget === 'quick-text') {
                manager.removeSessionData('quickTextDataList', null);
            }
    }
}

function checkHasComponent(
    widget: ForegroundComponentKeyType,
    screenManager: ScreenManager,
) {
    const component = FOREGROUND_COMPONENT_LIST.find((one) => {
        return one.key === widget;
    });
    if (component === undefined) {
        return false;
    }
    if (widget === 'long-text') {
        return readForegroundSessions('long-text').some((session) => {
            return checkIsOnScreen(
                {
                    widget,
                    sessionId: session.id,
                    suffix: session.suffix,
                    sessionIds: [],
                },
                screenManager,
            );
        });
    }
    const data = screenManager.screenForegroundManager.foregroundData;
    switch (widget) {
        case 'countdown':
            return (data.countdownDataList ?? []).length > 0;
        case 'stopwatch':
            return (data.stopwatchDataList ?? []).length > 0;
        case 'time':
            return (data.timeDataList ?? []).length > 0;
        case 'marquee-top':
            return (data.marqueeTopDataList ?? []).length > 0;
        case 'marquee-bottom':
            return (data.marqueeBottomDataList ?? []).length > 0;
        case 'quick-text':
            return (data.quickTextDataList ?? []).length > 0;
        case 'message':
            return (data.messageDataList ?? []).length > 0;
        case 'video':
            return (data.videoDataList ?? []).length > 0;
        case 'image':
            return (data.imageDataList ?? []).length > 0;
        case 'web':
            return (data.webDataList ?? []).length > 0;
        case 'camera':
            return (data.cameraDataList ?? []).length > 0;
        case 'screen':
            return (data.screenDataList ?? []).length > 0;
        default:
            return false;
    }
}

/**
 * Take a component off. A session named takes off only that session's; no
 * session takes off the whole component -- from every screen holding it,
 * ticked or not, because "take the countdown off" means the one on the wall.
 */
async function handleStop(
    widgetText: string,
    request: AgentForegroundRequestType,
    did: 'stopped' | 'hidden',
): Promise<AgentForegroundResultType> {
    const allManagers = getLiveManagers();
    const isAnyShowing = allManagers.some((screenManager) => {
        return screenManager.isShowing;
    });
    const askedIds = readScreenIdList(request.screens);
    const inScope = allManagers.filter((screenManager) => {
        return askedIds === null || askedIds.includes(screenManager.screenId);
    });
    if (widgetText === 'all') {
        // Clear Foreground (F10), on every screen: a Long Text Show -- one of
        // the foreground extras to an operator -- comes off as well.
        const lockedIds: number[] = [];
        for (const screenManager of inScope) {
            if (screenManager.isLocked) {
                lockedIds.push(screenManager.screenId);
                continue;
            }
            screenManager.clearForeground();
        }
        const note = genLockedNote(lockedIds);
        return {
            did,
            widget: 'all',
            detail: 'Every foreground extra is off the screen now.',
            screens: inScope.map(toScreenState),
            isAnyShowing,
            ...(note === null ? {} : { note }),
        };
    }
    const widget = toWidgetKey(widgetText);
    if (widget === null) {
        return toReason(genUnknownWidgetReason(widgetText));
    }
    const isSessionNamed =
        (request.session !== undefined && request.session !== '') ||
        request.camera !== undefined ||
        request.source !== undefined;
    let target: TargetType | null = null;
    if (isSessionNamed) {
        const resolved = await resolveTarget(
            widget,
            {
                session: request.session,
                camera: request.camera,
                source: request.source,
            },
            new Date(),
            false,
        );
        if ('isError' in resolved) {
            return resolved;
        }
        target = resolved.target;
    }
    const holding = inScope.filter((screenManager) => {
        return target === null
            ? checkHasComponent(widget, screenManager)
            : checkIsOnScreen(target.context, screenManager);
    });
    const lockedIds: number[] = [];
    for (const screenManager of holding) {
        if (screenManager.isLocked) {
            lockedIds.push(screenManager.screenId);
            continue;
        }
        if (target === null) {
            hideWholeComponent(widget, screenManager);
        } else {
            hideOnScreen(target.context, screenManager);
        }
    }
    const notes: string[] = [];
    if (holding.length === 0) {
        notes.push(
            `There was no ${WIDGET_NOUN_MAP[widget]} on the screen, so ` +
                'nothing changed.',
        );
    }
    const lockedNote = genLockedNote(lockedIds);
    if (lockedNote !== null) {
        notes.push(lockedNote);
    }
    return {
        did,
        widget,
        component: toForegroundComponentLabel(widget),
        ...(target?.session ? { session: toSessionField(target) } : {}),
        detail: `The ${WIDGET_NOUN_MAP[widget]} is off the screen now.`,
        screens: (holding.length > 0 ? holding : inScope).map(toScreenState),
        isAnyShowing,
        ...(notes.length > 0 ? { note: notes.join(' ') } : {}),
    };
}

function genUnknownWidgetReason(widgetText: string) {
    return (
        `There is no foreground component called "${widgetText}". They ` +
        'are: countdown, stopwatch, clock, marquee-top, marquee-bottom, ' +
        'quick-text, message, long-text, video, image, camera, screen, web ' +
        '-- or all, to stop every one.'
    );
}

/**
 * Put a session up on the screens -- the ticked ones, or the ones asked
 * for -- exactly as its Show button would, and say what each holds after.
 */
async function showTarget(
    target: TargetType,
    request: AgentForegroundRequestType,
    now: Date,
    options: {
        isRunning: boolean;
        countdownMode: 'duration' | 'date';
        filePath?: string;
    },
) {
    const screenList = pickShowScreens(request);
    if (screenList.length === 0) {
        return {
            reason:
                'No screen is chosen to present to. In the Mini Screen ' +
                'panel, tick the screen it should go to, then ask again.',
        };
    }
    const unlocked = screenList.filter((screenManager) => {
        return !screenManager.isLocked;
    });
    if (unlocked.length === 0) {
        return {
            reason:
                `Screen ${screenList
                    .map((one) => {
                        return one.screenId;
                    })
                    .join(' and ')} is locked, so it refuses a change. ` +
                'The lock button is on its Mini Screen card; unlock it, then ' +
                'ask again.',
        };
    }
    const plan = await planShow(target.context, {
        now,
        isRunning: options.isRunning,
        countdownMode: options.countdownMode,
        ...(options.filePath === undefined
            ? {}
            : { filePath: options.filePath }),
        ...(target.itemLabel === undefined
            ? {}
            : { cameraLabel: target.itemLabel }),
    });
    if (checkIsReason(plan)) {
        return plan;
    }
    for (const screenManager of unlocked) {
        plan.apply(screenManager);
    }
    const notes = [
        genLockedNote(
            screenList
                .filter((screenManager) => {
                    return screenManager.isLocked;
                })
                .map((screenManager) => {
                    return screenManager.screenId;
                }),
        ),
        genOffNote(unlocked),
    ].filter((note): note is string => {
        return note !== null;
    });
    return {
        detail: plan.detail,
        screens: screenList.map(toScreenState),
        notes,
    };
}

/** The countdown form a show uses: the ask's, else the length one. */
function pickCountdownMode(
    plan: AgentForegroundContentPlanType | null,
    request: AgentForegroundRequestType,
): 'duration' | 'date' {
    if (plan?.countdownMode !== undefined) {
        return plan.countdownMode;
    }
    return typeof request.at === 'string' && request.at.trim() !== ''
        ? 'date'
        : 'duration';
}

// The panel's own Live is 5 seconds, too short to read an announcement out:
// the assistant's quick text stayed 10 from the first day, and still does
// when the session it is made beside has never been given one.
const DEFAULT_NEW_QUICK_TEXT_SECONDS = 10;

/**
 * A new quick text waits and stays as long as the one the panel was on --
 * unless the ask said how long (its own writes win, they come first).
 */
function genQuickTextTimingWrites(
    fromSuffix: string,
    toSuffix: string,
    plan: AgentForegroundContentPlanType | null,
): ForegroundSettingWriteType[] {
    const writtenKeySet = new Set(
        (plan?.writes ?? []).map((write) => {
            return write.key;
        }),
    );
    const writes: ForegroundSettingWriteType[] = [];
    const delayKey = `foreground-quick-text-time-delay${toSuffix}`;
    const liveKey = `foreground-quick-text-time-to-live${toSuffix}`;
    const delay = getSetting(`foreground-quick-text-time-delay${fromSuffix}`);
    if (!writtenKeySet.has(delayKey) && delay) {
        writes.push({ key: delayKey, value: delay });
    }
    if (!writtenKeySet.has(liveKey)) {
        const live = getSetting(
            `foreground-quick-text-time-to-live${fromSuffix}`,
        );
        writes.push({
            key: liveKey,
            value: live || `${DEFAULT_NEW_QUICK_TEXT_SECONDS}`,
        });
        // Until hidden goes with the length it replaces; seconds the ask
        // said are how long it stays.
        if (
            getSetting(`foreground-quick-text-is-infinite${fromSuffix}`) ===
            'true'
        ) {
            writes.push({
                key: `foreground-quick-text-is-infinite${toSuffix}`,
                value: 'true',
            });
        }
    }
    return writes;
}

/**
 * Writes a session's words (and a new session's look), puts it on its strip
 * and opens the panel on it. Returns the writes made.
 */
async function writeTarget(
    target: TargetType,
    plan: AgentForegroundContentPlanType | null,
    extraWrites: ForegroundSettingWriteType[],
    request: AgentForegroundRequestType,
) {
    const { widget } = target.context;
    const writes: ForegroundSettingWriteType[] = [...(plan?.writes ?? [])];
    if (target.isNewSession && target.session !== null) {
        const active = getActiveForegroundSession(widget);
        writes.push(
            ...genLookCopyWrites(widget, active.suffix, target.session.suffix),
        );
        if (widget === 'quick-text') {
            writes.push(
                ...genQuickTextTimingWrites(
                    active.suffix,
                    target.session.suffix,
                    plan,
                ),
            );
        }
    }
    writes.push(...extraWrites);
    applySettingWrites(writes);
    // A verse in a NEW quick text wears the look the Bibles list's own Open
    // in Quick Text gives one; a preset asked for, on any session, on the
    // side asked for (`checkPreset` has read the words already).
    const presetText =
        typeof request.preset === 'string' ? request.preset.trim() : '';
    const ask =
        presetText === '' ? null : readForegroundPresetAsk(widget, presetText);
    // Not one of the app's: one somebody saved, by its name.
    const savedPreset =
        presetText !== '' && ask === null
            ? findForegroundSavedPreset(widget, presetText)
            : null;
    const presetId =
        ask?.preset?.id ??
        (presetText === '' &&
        widget === 'quick-text' &&
        target.isNewSession &&
        plan?.verseTitle !== undefined
            ? 'bible-verse'
            : null);
    const mode = ask?.mode ?? undefined;
    if (savedPreset !== null) {
        applyPresetToTarget(target, null, undefined, savedPreset);
    } else if (presetId !== null && widget === 'quick-text') {
        const { applyQuickTextPreset } =
            await import('../presenter-foreground/quickTextPresetHelpers');
        applyQuickTextPreset(
            target.context.suffix,
            presetId as any,
            mode,
            getForegroundDefaultColors(),
        );
    } else if (presetId !== null || mode !== undefined) {
        applyPresetToTarget(target, presetId, mode);
    }
    // ...and the Bible's own font, as that menu item sets it: Bible text is
    // drawn in its language's face.
    if (
        widget === 'quick-text' &&
        target.isNewSession &&
        plan?.verseFontFamily !== undefined
    ) {
        const { applyBibleVerseFont } =
            await import('../presenter-foreground/foregroundQuickTextOpenHelpers');
        applyBibleVerseFont(target.context.suffix, plan.verseFontFamily);
    }
    if (target.session !== null) {
        if (target.isNewSession) {
            addForegroundSession(widget, {
                id: target.session.id,
                name: target.session.name,
            });
        } else {
            activateForegroundSession(widget, target.session.id);
        }
    }
    await notifyPanel(widget);
    await openPanel(widget);
    return writes;
}

async function handleStart(
    widget: ForegroundComponentKeyType,
    request: AgentForegroundRequestType,
    now: Date,
    did: 'started' | 'shown',
): Promise<AgentForegroundResultType> {
    if (widget === 'stopwatch' || widget === 'countdown') {
        // A plain "start" counts from the press, as it always has.
    }
    const preset = checkPreset(widget, request);
    if (preset !== null) {
        return preset;
    }
    const verse = await readVerseFor(widget, request);
    if (verse !== null && 'isError' in verse) {
        return verse;
    }
    const contentRequest = verse === null ? request : { ...request, verse };
    const resolved = await resolveTarget(widget, contentRequest, now, true);
    if ('isError' in resolved) {
        return resolved;
    }
    const { target, plan } = resolved;
    const soundWrites = planSoundWrites(target, request);
    if ('isError' in soundWrites) {
        return soundWrites;
    }
    let filePath: string | undefined;
    if (widget === 'video' || widget === 'image' || widget === 'web') {
        const file = await resolveMediaFile(target, request.file);
        if ('isError' in file) {
            return file;
        }
        filePath = file.filePath;
    }
    const lookPlan =
        request.look === undefined
            ? null
            : planLookWrites(target, request.look);
    if (lookPlan !== null && 'isError' in lookPlan) {
        return lookPlan;
    }
    const isRunning =
        did === 'started'
            ? request.autoStart !== false
            : widget === 'countdown'
              ? getSetting(
                    `foreground-countdown-auto-start-setting${target.context.suffix}`,
                ) === 'true'
              : widget === 'stopwatch'
                ? getSetting(
                      `foreground-stopwatch-auto-start-setting${target.context.suffix}`,
                  ) === 'true'
                : true;
    const name = toTargetName(target);
    const keys = genTargetKeys(target, plan);
    let shown: Awaited<ReturnType<typeof showTarget>>;
    let undoField: Record<string, unknown>;
    try {
        const { value, undo } = await runBackedUp(
            `Put up the ${toForegroundComponentLabel(widget)} "${target.session?.name ?? name}"`,
            widget,
            keys,
            async () => {
                await writeTarget(
                    target,
                    plan,
                    [...soundWrites, ...(lookPlan?.writes ?? [])],
                    request,
                );
                return showTarget(target, request, now, {
                    isRunning,
                    countdownMode: pickCountdownMode(plan, request),
                    ...(filePath === undefined ? {} : { filePath }),
                });
            },
        );
        shown = value;
        undoField = undo;
    } catch (error: any) {
        return toReason(String(error?.message ?? error));
    }
    if (checkIsReason(shown)) {
        return {
            ...toReason(
                `${shown.reason} The panel's session was still set (` +
                    `${name}); owa_undo with id "${undoField.undoId}" puts it back.`,
            ),
        };
    }
    const allManagers = getLiveManagers();
    return {
        did,
        widget,
        component: toForegroundComponentLabel(widget),
        session: toSessionField(target),
        name,
        isChanged: true,
        detail: shown.detail,
        screens: shown.screens,
        isAnyShowing: allManagers.some((screenManager) => {
            return screenManager.isShowing;
        }),
        ...(lookPlan === null ? {} : { changed: lookPlan.said }),
        ...undoField,
        ...(shown.notes.length > 0 ? { note: shown.notes.join(' ') } : {}),
    };
}

/**
 * A preset is the panel's own (`foregroundPresetHelpers`): every component
 * with Properties has its looks, and each answers by the ids of ITS list --
 * with its Dark / Light side where the component has words and a box
 * (`speaker light`), or a side alone to turn the session's colours to it.
 */
function checkPreset(
    widget: ForegroundComponentKeyType,
    request: AgentForegroundRequestType,
): AgentForegroundRefusalType | null {
    if (request.preset === undefined || request.preset === '') {
        return null;
    }
    const presetIdList = getForegroundPresetList(widget).map((preset) => {
        return preset.id as string;
    });
    if (presetIdList.length === 0) {
        return toReason(`The ${widget} has no presets.`);
    }
    const hasColors =
        FOREGROUND_COMPONENT_RULE_MAP[widget].flags?.isCommonStyle === true;
    const ask = readForegroundPresetAsk(widget, String(request.preset));
    if (
        ask === null &&
        findForegroundSavedPreset(widget, String(request.preset)) === null
    ) {
        const savedNameList = getForegroundSavedPresets(widget).map(
            (preset) => {
                return `"${preset.name}"`;
            },
        );
        return toReason(
            `preset is one of: ${presetIdList.join(', ')}.` +
                (savedNameList.length > 0
                    ? ` Or one saved here, by its name: ${savedNameList.join(', ')}.`
                    : '') +
                (hasColors
                    ? ' Each goes on dark or light with the word after it ' +
                      `("${presetIdList[0]} light"); "dark" or "light" ` +
                      "alone turns the session's own colours."
                    : ''),
        );
    }
    if (ask !== null && ask.mode !== null && !hasColors) {
        return toReason(
            `The ${widget} has no words or box to turn dark or light: ` +
                `preset is one of: ${presetIdList.join(', ')}.`,
        );
    }
    return null;
}

/** What a `preset` did, said as the answer's `changed` says it. */
function toPresetChangeWords(widget: ForegroundComponentKeyType, text: string) {
    const ask = readForegroundPresetAsk(widget, text);
    if (ask?.preset === null || ask?.preset === undefined) {
        if (ask?.mode) {
            return `its words and box turned ${ask.mode}`;
        }
        const saved = findForegroundSavedPreset(widget, text);
        return saved === null
            ? `the ${text} look`
            : `the saved look "${saved.name}"`;
    }
    return ask.mode === null
        ? `the ${ask.preset.id} look`
        : `the ${ask.preset.id} look, ${ask.mode}`;
}

/**
 * A component's preset onto every prefix a `look` would dress -- the
 * session's, or each clock of a Time session -- written as the panel's own
 * Presets row writes it, with the flags that component's panel has; or, a
 * side alone, the Dark / Light switch pressed on each.
 */
function applyPresetToTarget(
    target: TargetType,
    presetId: string | null,
    mode: ForegroundColorModeType | undefined,
    savedPreset: ForegroundSavedPresetType | null = null,
) {
    const { widget, suffix, itemId } = target.context;
    const flags = FOREGROUND_COMPONENT_RULE_MAP[widget].flags;
    const preset =
        presetId === null
            ? null
            : getForegroundPresetList(widget).find((one) => {
                  return one.id === presetId;
              });
    if (flags === undefined || preset === undefined) {
        return;
    }
    // An unset colour is the app theme's side, as the panel reads it.
    const defaultColors = getForegroundDefaultColors();
    let prefixList: string[];
    if (widget === 'time') {
        prefixList = (
            itemId === undefined ? readClockIdList(suffix) : [itemId]
        ).map((clockId) => {
            return `time-${clockId}`;
        });
    } else {
        const prefix = toLookPrefix(target.context);
        prefixList = prefix === null ? [] : [prefix];
    }
    for (const prefix of prefixList) {
        if (savedPreset !== null) {
            applyForegroundSavedPreset(widget, prefix, savedPreset);
        } else if (preset !== null) {
            applyForegroundPreset({
                widgetKey: widget,
                prefix,
                flags,
                preset,
                mode,
                defaultColors,
            });
        } else if (mode !== undefined && flags.isCommonStyle) {
            applyForegroundColorMode(prefix, mode, defaultColors);
        }
    }
}

async function readVerseFor(
    widget: ForegroundComponentKeyType,
    request: AgentForegroundRequestType,
) {
    const ref = typeof request.ref === 'string' ? request.ref.trim() : '';
    if (ref === '') {
        return null;
    }
    if (
        !['quick-text', 'marquee-top', 'marquee-bottom', 'message'].includes(
            widget,
        )
    ) {
        return toReason(
            'A verse goes into a quick text, a marquee or a message. For ' +
                'the passage itself on the screen, use owa_present_bible.',
        );
    }
    if (ref.length > 120) {
        return toReason('ref is a reference, e.g. "John 3:16".');
    }
    const verse = await readForegroundVerse(ref, request.version);
    return 'reason' in verse ? toReason(verse.reason) : verse;
}

/**
 * Change a session -- its words, its numbers, its look -- and whatever of it
 * is on a screen at once: a look dressed again, new words put up again on
 * the screens that hold it.
 */
async function handleSet(
    widget: ForegroundComponentKeyType,
    request: AgentForegroundRequestType,
    now: Date,
): Promise<AgentForegroundResultType> {
    const preset = checkPreset(widget, request);
    if (preset !== null) {
        return preset;
    }
    const verse = await readVerseFor(widget, request);
    if (verse !== null && 'isError' in verse) {
        return verse;
    }
    const contentRequest = verse === null ? request : { ...request, verse };
    const resolved = await resolveTarget(widget, contentRequest, now, false);
    if ('isError' in resolved) {
        return resolved;
    }
    const { target, plan } = resolved;
    const soundWrites = planSoundWrites(target, request);
    if ('isError' in soundWrites) {
        return soundWrites;
    }
    const lookPlan =
        request.look === undefined
            ? null
            : planLookWrites(target, request.look);
    if (lookPlan !== null && 'isError' in lookPlan) {
        return lookPlan;
    }
    if (
        plan === null &&
        lookPlan === null &&
        soundWrites.length === 0 &&
        (request.preset === undefined || request.preset === '')
    ) {
        return toReason(
            'Nothing to change: give the words or numbers (text, minutes, ' +
                'ref, …), a look, or a preset.',
        );
    }
    const name = toTargetName(target);
    const holding = getLiveManagers().filter((screenManager) => {
        return (
            !screenManager.isLocked &&
            checkIsOnScreen(target.context, screenManager)
        );
    });
    let undoField: Record<string, unknown>;
    try {
        const { undo } = await runBackedUp(
            `Changed the ${toForegroundComponentLabel(widget)} "${target.session?.name ?? name}"`,
            widget,
            genTargetKeys(target, plan),
            async () => {
                await writeTarget(
                    target,
                    plan,
                    [...soundWrites, ...(lookPlan?.writes ?? [])],
                    request,
                );
                if (holding.length === 0) {
                    return;
                }
                if (
                    plan !== null &&
                    plan.writes.length > 0 &&
                    !target.isNewSession
                ) {
                    // New words on the wall: put up again, on the same screens.
                    const shownPlan = await planShow(target.context, {
                        now,
                        isRunning: true,
                        countdownMode: pickCountdownMode(plan, request),
                    });
                    if (!checkIsReason(shownPlan)) {
                        for (const screenManager of holding) {
                            shownPlan.apply(screenManager);
                        }
                    }
                    return;
                }
                for (const screenManager of holding) {
                    await restyleOnScreen(target.context, screenManager);
                }
            },
        );
        undoField = undo;
    } catch (error: any) {
        return toReason(String(error?.message ?? error));
    }
    const changed = [
        ...(plan?.said ? [plan.said] : []),
        ...(lookPlan?.said ?? []),
        ...(request.preset
            ? [toPresetChangeWords(widget, String(request.preset))]
            : []),
    ];
    return {
        did: 'changed',
        widget,
        component: toForegroundComponentLabel(widget),
        session: toSessionField(target),
        name,
        isChanged: true,
        detail:
            `${name}: ${changed.join(', ') || 'changed'}.` +
            (holding.length > 0
                ? ` Screen ${holding
                      .map((one) => {
                          return one.screenId;
                      })
                      .join(' and ')} shows the change now.`
                : ' It is not on a screen; the panel holds the change.'),
        changed,
        screens: getLiveManagers().map(toScreenState),
        ...undoField,
    };
}

async function handleTimer(
    widget: ForegroundComponentKeyType,
    request: AgentForegroundRequestType,
): Promise<AgentForegroundResultType> {
    if (widget !== 'countdown' && widget !== 'stopwatch') {
        return toReason('Only a countdown or a stopwatch has Start and Pause.');
    }
    const timerDo = String(request.timer ?? '') as AgentForegroundTimerDoType;
    if (!(AGENT_FOREGROUND_TIMER_DOS as readonly string[]).includes(timerDo)) {
        return toReason('timer is start, pause, resume or reset.');
    }
    const resolved = await resolveTarget(
        widget,
        { session: request.session },
        new Date(),
        false,
    );
    if ('isError' in resolved) {
        return resolved;
    }
    const { target } = resolved;
    const now = Date.now();
    const changedIds: number[] = [];
    for (const screenManager of getLiveManagers()) {
        if (screenManager.isLocked) {
            continue;
        }
        if (applyTimerOnScreen(target.context, screenManager, timerDo, now)) {
            changedIds.push(screenManager.screenId);
        }
    }
    if (changedIds.length === 0) {
        return toReason(
            `That ${WIDGET_NOUN_MAP[widget]} is not on a screen, so there is ` +
                'nothing to ' +
                `${timerDo}. Put it up first (action "show").`,
        );
    }
    return {
        did: 'timer',
        widget,
        component: toForegroundComponentLabel(widget),
        session: toSessionField(target),
        detail:
            `The ${WIDGET_NOUN_MAP[widget]} on screen ${changedIds.join(' and ')} ` +
            `is ${timerDo === 'pause' ? 'paused' : timerDo === 'reset' ? 'back at its start, stopped' : 'running'}.`,
        screens: getLiveManagers().map(toScreenState),
    };
}

/** `read` with `open`: the panels open in the Presenter, with their sessions. */
function readOpenPanels(): AgentForegroundResultType {
    const openKeyList = (getSetting('foreground-open-panels') ?? '')
        .split(',')
        .map((one) => {
            return one.trim();
        })
        .filter(checkIsForegroundComponentKey);
    const managers = getLiveManagers();
    const panels = openKeyList.map((widget) => {
        const rule = FOREGROUND_COMPONENT_RULE_MAP[widget];
        if (!rule.hasSessions) {
            return {
                widget,
                component: toForegroundComponentLabel(widget),
                sessions: [],
                isOnScreen: managers.some((screenManager) => {
                    return checkHasComponent(widget, screenManager);
                }),
            };
        }
        const sessions = readForegroundSessions(widget);
        return {
            widget,
            component: toForegroundComponentLabel(widget),
            sessions: sessions.map((session) => {
                const context: AgentForegroundContextType = {
                    widget,
                    sessionId: session.id,
                    suffix: session.suffix,
                    sessionIds: sessions.map((one) => {
                        return one.id;
                    }),
                };
                return {
                    id: session.id,
                    name: session.name,
                    isActive: session.isActive,
                    onScreens: managers
                        .filter((screenManager) => {
                            return checkIsOnScreen(context, screenManager);
                        })
                        .map((screenManager) => {
                            return screenManager.screenId;
                        }),
                };
            }),
        };
    });
    return {
        did: 'read',
        widget: null,
        detail:
            panels.length === 0
                ? 'No foreground panel is open in the Presenter.'
                : `${panels.length} foreground panel${panels.length === 1 ? ' is' : 's are'} open.`,
        panels,
    };
}

async function handleRead(
    widget: ForegroundComponentKeyType,
    request: AgentForegroundRequestType,
): Promise<AgentForegroundResultType> {
    const rule = FOREGROUND_COMPONENT_RULE_MAP[widget];
    const managers = getLiveManagers();
    if (!rule.hasSessions) {
        const item = await resolveItem(widget, request, false);
        if ('isError' in item) {
            return item;
        }
        const extra: Record<string, unknown> = {};
        if (widget === 'camera') {
            const { getAllCameraDevices } = await import('./cameraHelpers');
            extra.cameras = (await getAllCameraDevices()).map((camera) => {
                return camera.label;
            });
        } else {
            extra.sources = managers.map((screenManager) => {
                return screenManager.screenId;
            });
        }
        const target: TargetType = {
            context: toContext(widget, null, item.itemId),
            session: null,
            isNewSession: false,
        };
        return {
            did: 'read',
            widget,
            component: toForegroundComponentLabel(widget),
            detail: `The ${toForegroundComponentLabel(widget)} component.`,
            ...extra,
            ...(item.itemId === undefined
                ? {}
                : { look: readLookWords(target) }),
            onScreens: managers
                .filter((screenManager) => {
                    return checkHasComponent(widget, screenManager);
                })
                .map((screenManager) => {
                    return screenManager.screenId;
                }),
        };
    }
    const sessions = readForegroundSessions(widget);
    const wanted =
        request.session === undefined || request.session === ''
            ? getActiveForegroundSession(widget)
            : findForegroundSession(widget, request.session);
    if (wanted === null) {
        return toReason(
            `There is no ${toForegroundComponentLabel(widget)} session called ` +
                `"${String(request.session)}". The sessions are ` +
                `${genListedNames(
                    sessions.map((one) => {
                        return one.name;
                    }),
                )}.`,
        );
    }
    const target: TargetType = {
        context: toContext(widget, wanted),
        session: wanted,
        isNewSession: false,
    };
    const extra: Record<string, unknown> = {};
    if (widget === 'video' || widget === 'image' || widget === 'web') {
        const files = await listSessionFileNames(widget, wanted.suffix);
        extra.files =
            files === null
                ? null
                : files.slice(0, MAX_LISTED_NAMES).map((file) => {
                      return file.fullName;
                  });
        if (files !== null && files.length > MAX_LISTED_NAMES) {
            extra.isFileListCut = true;
        }
    }
    return {
        did: 'read',
        widget,
        component: toForegroundComponentLabel(widget),
        detail: `${toTargetName(target)}.`,
        session: toSessionField(target),
        sessions: sessions.map((one) => {
            return { id: one.id, name: one.name, isActive: one.isActive };
        }),
        content: readForegroundContent(widget, wanted.suffix),
        look: readLookWords(target),
        // The looks `set` takes as `preset`, by id: each component's own --
        // and, with words and a box, the side they are on now (`preset`
        // "light" / "dark" turns it, "speaker light" puts one on that side).
        ...(getForegroundPresetList(widget).length > 0
            ? {
                  presets: getForegroundPresetList(widget).map((preset) => {
                      return preset.id;
                  }),
              }
            : {}),
        // And the looks saved from this component's Properties, by name.
        ...(getForegroundSavedPresets(widget).length > 0
            ? {
                  savedPresets: getForegroundSavedPresets(widget).map(
                      (preset) => {
                          return preset.name;
                      },
                  ),
              }
            : {}),
        ...(FOREGROUND_COMPONENT_RULE_MAP[widget].flags?.isCommonStyle &&
        toLookPrefix(target.context) !== null
            ? {
                  presetSide: toForegroundColorMode(
                      readForegroundSessionColors(
                          toLookPrefix(target.context)!,
                          getForegroundDefaultColors(),
                      ).color,
                  ),
              }
            : {}),
        onScreens: managers
            .filter((screenManager) => {
                return checkIsOnScreen(target.context, screenManager);
            })
            .map((screenManager) => {
                return screenManager.screenId;
            }),
        ...extra,
        note: 'Nothing was changed: this only read the component.',
    };
}

async function handleNewSession(
    widget: ForegroundComponentKeyType,
    request: AgentForegroundRequestType,
): Promise<AgentForegroundResultType> {
    if (!FOREGROUND_COMPONENT_RULE_MAP[widget].hasSessions) {
        return toReason(
            `The ${toForegroundComponentLabel(widget)} has no sessions.`,
        );
    }
    const name = typeof request.name === 'string' ? request.name.trim() : '';
    if (name === '' || name.length > 40) {
        return toReason(
            'name is what the new session is called (40 letters at most).',
        );
    }
    const existing = findForegroundSession(widget, name);
    if (existing !== null) {
        return toReason(
            `A session called "${existing.name}" is already there; change it ` +
                'with action "set" and session, or pick another name.',
        );
    }
    const fresh = genNewForegroundSession(name);
    const session: AgentForegroundSessionType = { ...fresh, isActive: true };
    const target: TargetType = {
        context: toContext(widget, session),
        session,
        isNewSession: true,
    };
    try {
        const { undo } = await runBackedUp(
            `Made the ${toForegroundComponentLabel(widget)} session "${name}"`,
            widget,
            genTargetKeys(target, null),
            async () => {
                await writeTarget(target, null, [], request);
            },
        );
        return {
            did: 'created',
            widget,
            component: toForegroundComponentLabel(widget),
            session: toSessionField(target),
            name: toTargetName(target),
            isChanged: true,
            detail:
                `A new ${toForegroundComponentLabel(widget)} session "${name}", ` +
                'dressed like the one the panel was on, and the panel open on it.',
            ...undo,
        };
    } catch (error: any) {
        return toReason(String(error?.message ?? error));
    }
}

/**
 * After an undo put a component's settings back: its open panel reads them
 * again, and every session of it that is on a screen is dressed again.
 * Words already shown stay until Hide -- the answer to the undo says so.
 */
export async function refreshForegroundAfterUndo(widgetText: string) {
    const widget = toWidgetKey(widgetText);
    if (widget === null) {
        return;
    }
    await notifyPanel(widget);
    if (!appProvider.isPagePresenter) {
        return;
    }
    const managers = getLiveManagers();
    const rule = FOREGROUND_COMPONENT_RULE_MAP[widget];
    const sessions = rule.hasSessions ? readForegroundSessions(widget) : [];
    const contextList: AgentForegroundContextType[] = rule.hasSessions
        ? sessions.map((session) => {
              return {
                  widget,
                  sessionId: session.id,
                  suffix: session.suffix,
                  sessionIds: sessions.map((one) => {
                      return one.id;
                  }),
              };
          })
        : [{ widget, sessionId: '', suffix: '', sessionIds: [] }];
    for (const context of contextList) {
        for (const screenManager of managers) {
            if (
                !screenManager.isLocked &&
                checkIsOnScreen(context, screenManager)
            ) {
                await restyleOnScreen(context, screenManager);
            }
        }
    }
}

export async function handleAgentForegroundRequest(
    request: AgentForegroundRequestType,
    now: Date = new Date(),
): Promise<AgentForegroundResultType> {
    try {
        return await handleRequest(request ?? {}, now);
    } catch (error: any) {
        return toReason(String(error?.message ?? error));
    }
}

async function handleRequest(
    request: AgentForegroundRequestType,
    now: Date,
): Promise<AgentForegroundResultType> {
    const action =
        typeof request.action === 'string' && request.action.length > 0
            ? request.action
            : 'start';
    if (!ALL_ACTION_LIST.includes(action)) {
        return toReason(
            `Unknown action "${action}". Use ${ALL_ACTION_LIST.join(', ')}.`,
        );
    }
    if (!appProvider.isPagePresenter) {
        // Written for a person as much as for a model: the `/countdown`
        // command and the offline bot print this sentence, so no tool name.
        return toReason(
            'A foreground extra is started from the Presenter page, and the ' +
                'main window is not on it. Switch it to the Presenter first, ' +
                'then ask again.',
        );
    }
    const widgetText =
        typeof request.widget === 'string' ? request.widget.trim() : '';
    if (action === 'check') {
        return handleCheck(widgetText === '' ? null : toWidgetKey(widgetText));
    }
    if (action === 'read' && (request.open === true || widgetText === '')) {
        return readOpenPanels();
    }
    if (action === 'stop' || action === 'hide') {
        if (widgetText === '') {
            return toReason(
                'Say which extra to stop: countdown, stopwatch, clock, ' +
                    'marquee-top, marquee-bottom, quick-text, message, ' +
                    'long-text, video, image, camera, screen, web, or all.',
            );
        }
        return handleStop(
            widgetText,
            request,
            action === 'stop' ? 'stopped' : 'hidden',
        );
    }
    if (widgetText === 'all') {
        return toReason(
            '"all" only stops. Start one extra at a time: countdown, ' +
                'stopwatch, clock, marquee-top, marquee-bottom, quick-text, ' +
                'message, long-text, video, image, camera, screen or web.',
        );
    }
    const widget = toWidgetKey(widgetText);
    if (widget === null) {
        return toReason(
            widgetText === ''
                ? 'Say which extra: countdown, stopwatch, clock, marquee-top, ' +
                      'marquee-bottom, quick-text, message, long-text, video, ' +
                      'image, camera, screen or web.'
                : genUnknownWidgetReason(widgetText),
        );
    }
    switch (action) {
        case 'start':
            return handleStart(widget, request, now, 'started');
        case 'show':
            return handleStart(widget, request, now, 'shown');
        case 'set':
            return handleSet(widget, request, now);
        case 'read':
            return handleRead(widget, request);
        case 'timer':
            return handleTimer(widget, request);
        case 'session':
            return handleNewSession(widget, request);
        default:
            return toReason(`Unknown action "${action}".`);
    }
}

export { toForegroundHexColor };
