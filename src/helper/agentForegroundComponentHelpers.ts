/**
 * Each foreground component as the help window's assistant drives it: what a
 * session of it holds, how it is put up, taken down and restyled on a
 * screen -- every one of them the panel's own way (2026-11-09, the user:
 * _chatbot can help modify any foreground component_).
 *
 * The panels build each overlay from SETTINGS, never from React state
 * (`genForegroundExtraStyle` reads its keys itself, the transition and the
 * layer are read the same way), which is what makes this possible at all:
 * write the keys a person's hands would have written, then build the datum
 * exactly as that panel's Show button builds it. So a quick text the
 * assistant puts up is the size, the colour and the place its session is
 * set to, and the panel -- told by `notifyForegroundPanel` -- shows the words
 * that went up.
 *
 * Loaded lazily, by the worker alone, in the Presenter window: it pulls the
 * screen managers and two of the panels' own modules (messages, long text).
 */
import type { CSSProperties } from 'react';

import type ScreenForegroundManager from '../_screen/managers/ScreenForegroundManager';
import type { ForegroundSessionListKeyType } from '../_screen/managers/ScreenForegroundManager';
import ScreenLongTextManager from '../_screen/managers/ScreenLongTextManager';
import type ScreenManager from '../_screen/managers/ScreenManager';
import {
    DEFAULT_MARQUEE_SPEED_PERCENTAGE,
    type ForegroundCameraDataType,
    type ForegroundCountdownDataType,
    type ForegroundDataType,
    type ForegroundImageDataType,
    type ForegroundMarqueeDataType,
    type ForegroundMessageDataType,
    type ForegroundQuickTextDataType,
    type ForegroundScreenDataType,
    type ForegroundStopwatchDataType,
    type ForegroundTimeDataType,
    type ForegroundVideoDataType,
    type ForegroundWebDataType,
    toQuickTextInfinitePart,
    withForegroundLayer,
} from '../_screen/screenTypeHelpers';
import { toTransitionPart } from '../_screen/transitionOverrideHelpers';
import {
    genCountdownTiming,
    genStopwatchTiming,
    toPausedCountdownData,
    toPausedStopwatchData,
    toResetCountdownData,
    toResetStopwatchData,
    toStartedCountdownData,
    toStartedStopwatchData,
} from '../_screen/managers/timerStateHelpers';
import type { ForegroundComponentKeyType } from '../presenter-foreground/foregroundComponentKeys';
import {
    FOREGROUND_COMPONENT_RULE_MAP,
    QUICK_TEXT_DEFAULT_DELAY_SECOND,
    QUICK_TEXT_DEFAULT_LIVE_SECOND,
    genClockOwnSettingNames,
    genQuickTextOwnSettingNames,
} from '../presenter-foreground/foregroundComponentRules';
import {
    genForegroundExtraStyle,
    getForegroundIsBehind,
    getForegroundWidthScale,
} from '../presenter-foreground/propertiesSettingHelpers';
import { resolveForegroundTransition } from '../presenter-foreground/foregroundTransitionHelpers';
import { checkIsSessionData } from '../presenter-foreground/foregroundSessionHelpers';
import { getForegroundSoundData } from '../presenter-foreground/ForegroundSoundControlComp';
import { getSetting } from './settingHelpers';
import { readClockIdList } from './agentForegroundSessionHelpers';
import type { ForegroundSettingWriteType } from './agentForegroundLookRules';

export type AgentForegroundContextType = {
    widget: ForegroundComponentKeyType;
    sessionId: string;
    suffix: string;
    sessionIds: string[];
    /**
     * Camera Show and Screen Show have no sessions: one device, one source
     * screen. Also one clock of a Time session, when the ask named it.
     */
    itemId?: string;
};

/** Why something could not be done, in a sentence for the model or a person. */
export type AgentForegroundReasonType = { reason: string };

export function checkIsReason(
    value: unknown,
): value is AgentForegroundReasonType {
    return (
        value !== null &&
        typeof value === 'object' &&
        typeof (value as any).reason === 'string'
    );
}

// --- the look a session builds -----------------------------------------

/** The Properties prefix a datum of this context is styled from. */
export function toLookPrefix(context: AgentForegroundContextType) {
    const rule = FOREGROUND_COMPONENT_RULE_MAP[context.widget];
    if (rule.toSessionPrefix !== undefined) {
        return rule.toSessionPrefix(context.suffix);
    }
    if (rule.toItemPrefix !== undefined && context.itemId !== undefined) {
        return rule.toItemPrefix(context.itemId);
    }
    return null;
}

/** The style the panel's Show button would send for this prefix. */
function genStyle(widget: ForegroundComponentKeyType, prefix: string) {
    const flags = FOREGROUND_COMPONENT_RULE_MAP[widget].flags;
    if (flags === undefined) {
        return {};
    }
    return genForegroundExtraStyle(prefix, flags);
}

/** A marquee's own Font Size row rides on top of its Properties style. */
function genMarqueeStyle(
    widget: 'marquee-top' | 'marquee-bottom',
    suffix: string,
): CSSProperties {
    const style = genStyle(widget, `${widget}${suffix}`);
    const fontSize = Number.parseInt(
        getSetting(`foreground-${widget}-font-size${suffix}`) ?? '',
    );
    return Number.isFinite(fontSize) && fontSize > 0
        ? { ...style, fontSize: `${fontSize}px` }
        : style;
}

function readMarqueeSpeed(widget: string, suffix: string) {
    const speed = Number.parseInt(
        getSetting(`foreground-${widget}-speed-percentage${suffix}`) ?? '',
    );
    return Number.isFinite(speed) && speed > 0
        ? speed
        : DEFAULT_MARQUEE_SPEED_PERCENTAGE;
}

function toSessionIdPart(sessionId: string) {
    // A datum with no id belongs to the Default session (`toOwnerSessionId`),
    // exactly as one the Default panel puts up does.
    return sessionId === '' ? {} : { id: sessionId };
}

function genLayerPart(widget: ForegroundComponentKeyType, prefix: string) {
    return {
        transition: resolveForegroundTransition(widget, prefix),
        isBehind: getForegroundIsBehind(prefix),
    };
}

// --- what a session has on one screen -----------------------------------

// The widgets each SESSION of which owns its own entry on a screen.
const SESSION_LIST_KEY_MAP: Partial<
    Record<ForegroundComponentKeyType, ForegroundSessionListKeyType>
> = {
    countdown: 'countdownDataList',
    stopwatch: 'stopwatchDataList',
    'marquee-top': 'marqueeTopDataList',
    'marquee-bottom': 'marqueeBottomDataList',
    'quick-text': 'quickTextDataList',
};

function pickSessionList(
    widget: ForegroundComponentKeyType,
    data: ForegroundDataType,
): any[] {
    const key = SESSION_LIST_KEY_MAP[widget];
    return key === undefined ? [] : (data[key] ?? []);
}

/** Puts this session's entry up, replacing only its own (`putSessionData`). */
function setSingle(
    widget: ForegroundComponentKeyType,
    manager: ScreenForegroundManager,
    data: any,
) {
    const key = SESSION_LIST_KEY_MAP[widget];
    if (key !== undefined) {
        manager.putSessionData(key, data);
    }
}

/** Takes this session's entry, and only it, off the screen. */
function removeSingle(
    widget: ForegroundComponentKeyType,
    manager: ScreenForegroundManager,
    data: { id?: unknown },
) {
    const key = SESSION_LIST_KEY_MAP[widget];
    if (key !== undefined) {
        manager.removeSessionData(key, data);
    }
}

const MESSAGE_ID_REGEX = /^message-(?:\d+|all)(?:-(.+))?$/;

/** The session a message id carries (`message-2-s5k1` → `s5k1`). */
export function toMessageOwnerId(id: string) {
    return MESSAGE_ID_REGEX.exec(id)?.[1] ?? '';
}

export { readClockIdList };

const MEDIA_LIST_KEY_MAP = {
    video: 'videoDataList',
    image: 'imageDataList',
    web: 'webDataList',
} as const;

/**
 * What THIS session (or item) has up on one screen. A datum whose session is
 * gone counts for the first one, the way the panel's own Hide row counts it.
 */
export function listOwnedData(
    context: AgentForegroundContextType,
    data: ForegroundDataType,
): any[] {
    const { widget, sessionId, sessionIds, itemId } = context;
    const isOwned = (item: { id?: any }) => {
        return checkIsSessionData(
            { id: typeof item.id === 'string' ? item.id : undefined },
            sessionId,
            sessionIds,
        );
    };
    switch (widget) {
        case 'countdown':
        case 'stopwatch':
        case 'marquee-top':
        case 'marquee-bottom':
        case 'quick-text': {
            return pickSessionList(widget, data).filter(isOwned);
        }
        case 'message':
            return (data.messageDataList ?? []).filter((item) => {
                return checkIsSessionData(
                    { id: toMessageOwnerId(item.id) || undefined },
                    sessionId,
                    sessionIds,
                );
            });
        case 'time': {
            const idSet = new Set(
                itemId === undefined
                    ? readClockIdList(context.suffix)
                    : [itemId],
            );
            return (data.timeDataList ?? []).filter((item) => {
                return idSet.has(item.id);
            });
        }
        case 'video':
        case 'image':
        case 'web':
            return ((data as any)[MEDIA_LIST_KEY_MAP[widget]] ?? []).filter(
                isOwned,
            );
        case 'camera':
            return (data.cameraDataList ?? []).filter((item) => {
                return itemId === undefined || item.id === itemId;
            });
        case 'screen':
            return (data.screenDataList ?? []).filter((item) => {
                return itemId === undefined || `${item.id}` === itemId;
            });
        default:
            return [];
    }
}

// --- show ---------------------------------------------------------------

export type AgentForegroundShowPlanType = {
    /** What went up, said so a person can check it against the wall. */
    detail: string;
    apply: (screenManager: ScreenManager) => void;
};

export type AgentForegroundShowOptionsType = {
    now: Date;
    /** Counting from the press (`start`) rather than waiting for Start. */
    isRunning: boolean;
    /** The countdown form the ask used: to a time, or for a length. */
    countdownMode: 'duration' | 'date';
};

function toTimeLabel(date: Date) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function readNumberSetting(key: string, fallback: number) {
    const parsed = Number.parseFloat(getSetting(key) ?? '');
    return Number.isFinite(parsed) ? parsed : fallback;
}

/** The length of a duration countdown as its panel's three boxes hold it. */
export function readCountdownSeconds(suffix: string) {
    const toWhole = (key: string, fallback: number) => {
        const value = Math.floor(readNumberSetting(key, fallback));
        return value > 0 ? value : 0;
    };
    return (
        toWhole(`foreground-seconds-setting${suffix}`, 0) +
        60 * toWhole(`foreground-minutes-setting${suffix}`, 5) +
        3600 * toWhole(`foreground-hours-setting${suffix}`, 0)
    );
}

export function readCountdownTarget(suffix: string) {
    const date = getSetting(`foreground-date-setting${suffix}`);
    const time = getSetting(`foreground-time-setting${suffix}`);
    if (!date || !time) {
        return null;
    }
    const target = new Date(`${date} ${time}`);
    return Number.isFinite(target.getTime()) ? target : null;
}

export function toMinutesLabel(seconds: number) {
    const minutes = Math.round((seconds / 60) * 100) / 100;
    return minutes === 1 ? '1 minute' : `${minutes} minute`;
}

async function planMessageShow(
    context: AgentForegroundContextType,
): Promise<AgentForegroundShowPlanType | AgentForegroundReasonType> {
    const {
        genAllInPlaceOfSessionMessages,
        genStackedMessageDataList,
        toMessageAllId,
        toMessageList,
    } = await import('../presenter-foreground/ForegroundMessageComp');
    const { suffix } = context;
    const prefix = `message${suffix}`;
    const messageList = toMessageList(
        getSetting(`foreground-message-setting${suffix}`) ?? '',
        suffix,
    ).filter((message) => {
        return message.text.trim() !== '';
    });
    if (messageList.length === 0) {
        return {
            reason:
                'That Messages session has no words to show. Give the words ' +
                '(text, or texts for several).',
        };
    }
    const isRotating =
        getSetting(`foreground-message-is-rotating${suffix}`) === 'true' &&
        messageList.length > 1;
    const intervalSecond = readNumberSetting(
        `foreground-message-interval${suffix}`,
        8,
    );
    const { transition, isBehind } = genLayerPart('message', prefix);
    const extraStyle = genStyle('message', prefix);
    const ownIdList = messageList.map((message) => {
        return message.id;
    });
    if (isRotating) {
        const allData: ForegroundMessageDataType = withForegroundLayer(
            {
                id: toMessageAllId(suffix),
                ...toTransitionPart(transition),
                textList: messageList.map((message) => {
                    return message.text.trim();
                }),
                intervalSecond,
                extraStyle,
            },
            isBehind,
        );
        return {
            detail:
                `${messageList.length} messages shown in turn, ` +
                `${intervalSecond} seconds each`,
            apply: (screenManager) => {
                const manager = screenManager.screenForegroundManager;
                manager.setMessageDataList(
                    genAllInPlaceOfSessionMessages(
                        manager.foregroundData.messageDataList,
                        ownIdList,
                        allData,
                    ),
                );
            },
        };
    }
    const stackedList = genStackedMessageDataList(
        messageList,
        ownIdList,
        extraStyle,
        prefix,
        isBehind,
        transition,
    );
    return {
        detail:
            messageList.length === 1
                ? `a message: "${messageList[0].text.trim()}"`
                : `${messageList.length} messages, one under another`,
        apply: (screenManager) => {
            const manager = screenManager.screenForegroundManager;
            // Every other session's messages stay exactly as they are; this
            // session's own (its "all" box included) are replaced.
            const ownedSet = new Set(
                listOwnedData(context, manager.foregroundData),
            );
            const keptList = manager.foregroundData.messageDataList.filter(
                (item) => {
                    return !ownedSet.has(item);
                },
            );
            manager.setMessageDataList([...keptList, ...stackedList]);
        },
    };
}

async function planMediaShow(
    context: AgentForegroundContextType,
    filePath: string,
): Promise<AgentForegroundShowPlanType> {
    const widget = context.widget as 'video' | 'image' | 'web';
    const prefix = `${widget}-show${context.suffix}`;
    const { transition, isBehind } = genLayerPart(widget, prefix);
    const widthScale = getForegroundWidthScale(prefix) / 100;
    const data = withForegroundLayer(
        {
            filePath,
            ...toSessionIdPart(context.sessionId),
            extraStyle: genStyle(widget, prefix),
            ...toTransitionPart(transition),
            ...(widget === 'video' ? getForegroundSoundData(prefix) : {}),
            // A web overlay is drawn at a fraction of the SCREEN, the page
            // scaled into it, so its width travels on the datum.
            ...(widget === 'web'
                ? { widthScale, heightScale: (widthScale * 9) / 16 }
                : {}),
        },
        isBehind,
    );
    const name = filePath.split(/[\\/]/).pop() ?? filePath;
    return {
        detail: `"${name}"`,
        apply: (screenManager) => {
            const manager = screenManager.screenForegroundManager;
            const key = MEDIA_LIST_KEY_MAP[widget];
            // One item per session: the session's previous file steps aside.
            const list = (manager.foregroundData as any)[key].filter(
                (item: any) => {
                    return (item.id ?? '') !== (data.id ?? '');
                },
            );
            const newList = [...list, data];
            if (widget === 'video') {
                manager.setVideoDataList(newList as ForegroundVideoDataType[]);
            } else if (widget === 'image') {
                manager.setImageDataList(newList as ForegroundImageDataType[]);
            } else {
                manager.setWebDataList(newList as ForegroundWebDataType[]);
            }
        },
    };
}

function genClockData(clockId: string): ForegroundTimeDataType {
    const prefix = `time-${clockId}`;
    const names = genClockOwnSettingNames(clockId);
    const { transition, isBehind } = genLayerPart('time', prefix);
    return withForegroundLayer(
        {
            id: clockId,
            ...toTransitionPart(transition),
            timezoneMinuteOffset: readNumberSetting(
                names.hourOffset,
                -new Date().getTimezoneOffset() / 60,
            ),
            title: getSetting(names.cityName) || null,
            is24HourFormat: getSetting(names.is24HourFormat) === 'true',
            extraStyle: genStyle('time', prefix),
        },
        isBehind,
    );
}

/**
 * What the session's Show button would put up, worked out ONCE so every
 * screen gets the same thing (a countdown ends at the same moment on all of
 * them). A reason is about the session's words, never the screens.
 */
export async function planShow(
    context: AgentForegroundContextType,
    options: AgentForegroundShowOptionsType & {
        filePath?: string;
        cameraLabel?: string;
    },
): Promise<AgentForegroundShowPlanType | AgentForegroundReasonType> {
    const { widget, suffix, sessionId } = context;
    switch (widget) {
        case 'countdown': {
            const prefix = `countdown${suffix}`;
            const { transition, isBehind } = genLayerPart(widget, prefix);
            let timing: Partial<ForegroundCountdownDataType>;
            let detail: string;
            if (options.countdownMode === 'date') {
                const target = readCountdownTarget(suffix);
                if (
                    target === null ||
                    target.getTime() <= options.now.getTime()
                ) {
                    return {
                        reason:
                            'That countdown counts to a time that has already ' +
                            'passed. Give a later time (at), or minutes.',
                    };
                }
                timing = { dateTime: target };
                detail = `a countdown to ${toTimeLabel(target)}`;
            } else {
                const seconds = readCountdownSeconds(suffix);
                if (seconds <= 0) {
                    return {
                        reason:
                            'That countdown is 0 minutes long. Say how long ' +
                            '(minutes).',
                    };
                }
                const countdownTiming = genCountdownTiming(
                    seconds,
                    options.isRunning,
                    options.now.getTime(),
                );
                timing = countdownTiming;
                detail = options.isRunning
                    ? `a ${toMinutesLabel(seconds)} countdown, ending at ` +
                      `${toTimeLabel(countdownTiming.dateTime)}`
                    : `a ${toMinutesLabel(seconds)} countdown, waiting for Start`;
            }
            return {
                detail,
                apply: (screenManager) => {
                    screenManager.screenForegroundManager.setCountdownData(
                        withForegroundLayer(
                            {
                                ...toSessionIdPart(sessionId),
                                ...toTransitionPart(transition),
                                ...(timing as ForegroundCountdownDataType),
                                extraStyle: genStyle(widget, prefix),
                            },
                            isBehind,
                        ),
                    );
                },
            };
        }
        case 'stopwatch': {
            const prefix = `stopwatch${suffix}`;
            const { transition, isBehind } = genLayerPart(widget, prefix);
            const timing = genStopwatchTiming(
                options.isRunning,
                options.now.getTime(),
            );
            return {
                detail: options.isRunning
                    ? `a stopwatch, started at ${toTimeLabel(options.now)}`
                    : 'a stopwatch at zero, waiting for Start',
                apply: (screenManager) => {
                    screenManager.screenForegroundManager.setStopwatchData(
                        withForegroundLayer(
                            {
                                ...toSessionIdPart(sessionId),
                                ...toTransitionPart(transition),
                                ...(timing as ForegroundStopwatchDataType),
                                extraStyle: genStyle(widget, prefix),
                            },
                            isBehind,
                        ),
                    );
                },
            };
        }
        case 'marquee-top':
        case 'marquee-bottom': {
            const text = (
                getSetting(`foreground-${widget}-setting${suffix}`) ?? ''
            ).trim();
            if (text === '') {
                return {
                    reason: 'That marquee has no words. Give the words (text).',
                };
            }
            const prefix = `${widget}${suffix}`;
            const { transition, isBehind } = genLayerPart(widget, prefix);
            const data: ForegroundMarqueeDataType = withForegroundLayer(
                {
                    ...toSessionIdPart(sessionId),
                    ...toTransitionPart(transition),
                    text,
                    speedPercentage: readMarqueeSpeed(widget, suffix),
                    extraStyle: genMarqueeStyle(widget, suffix),
                },
                isBehind,
            );
            const where = widget === 'marquee-top' ? 'top' : 'bottom';
            return {
                detail: `a message scrolling along the ${where}: "${text}"`,
                apply: (screenManager) => {
                    setSingle(
                        widget,
                        screenManager.screenForegroundManager,
                        data,
                    );
                },
            };
        }
        case 'quick-text': {
            const markdown = (
                getSetting(`foreground-quick-text-setting${suffix}`) ?? ''
            ).trim();
            if (markdown === '') {
                return {
                    reason: 'That quick text has no words. Give the words (text).',
                };
            }
            const prefix = `quick-text${suffix}`;
            const { transition, isBehind } = genLayerPart(widget, prefix);
            // The widget types Markdown and renders it; the screen sanitises
            // the HTML on render.
            const { renderMarkdown } =
                await import('../lyric-list/markdownHelpers');
            const { html } = await renderMarkdown(markdown);
            const names = genQuickTextOwnSettingNames(suffix);
            const delay = Math.max(
                0,
                readNumberSetting(names.delay, QUICK_TEXT_DEFAULT_DELAY_SECOND),
            );
            const live = Math.max(
                1,
                readNumberSetting(names.live, QUICK_TEXT_DEFAULT_LIVE_SECOND),
            );
            const isInfinite = getSetting(names.isInfinite) === 'true';
            const data: ForegroundQuickTextDataType = withForegroundLayer(
                {
                    ...toSessionIdPart(sessionId),
                    ...toTransitionPart(transition),
                    htmlText: html,
                    timeSecondDelay: delay,
                    timeSecondToLive: live,
                    ...toQuickTextInfinitePart(isInfinite),
                    extraStyle: genStyle(widget, prefix),
                },
                isBehind,
            );
            const firstLine =
                markdown
                    .split('\n')
                    .map((line) => {
                        return line.replace(/[#*_`>\\]/g, '').trim();
                    })
                    .find((line) => {
                        return line !== '';
                    }) ?? '';
            return {
                detail:
                    (isInfinite
                        ? 'a line of text until it is hidden'
                        : `a line of text for ${live} seconds`) +
                    (delay > 0 ? ` after ${delay} seconds` : '') +
                    `: "${firstLine}"`,
                apply: (screenManager) => {
                    setSingle(
                        widget,
                        screenManager.screenForegroundManager,
                        data,
                    );
                },
            };
        }
        case 'message':
            return planMessageShow(context);
        case 'time': {
            const clockIdList =
                context.itemId === undefined
                    ? readClockIdList(suffix)
                    : [context.itemId];
            if (clockIdList.length === 0) {
                return {
                    reason:
                        'That Time session has no clock yet. Open its panel ' +
                        'once, or give a clock (utcOffset, title).',
                };
            }
            const dataList = clockIdList.map(genClockData);
            return {
                detail:
                    dataList.length === 1
                        ? `a clock${dataList[0].title ? ` for ${dataList[0].title}` : ''}`
                        : `${dataList.length} clocks`,
                apply: (screenManager) => {
                    for (const data of dataList) {
                        screenManager.screenForegroundManager.addTimeData(data);
                    }
                },
            };
        }
        case 'video':
        case 'image':
        case 'web': {
            if (options.filePath === undefined) {
                return {
                    reason: `Say which ${widget} to show: file, by its name.`,
                };
            }
            return planMediaShow(context, options.filePath);
        }
        case 'camera': {
            if (context.itemId === undefined) {
                return {
                    reason: 'Say which camera to show: camera, by its name.',
                };
            }
            const prefix = `camera-${context.itemId}`;
            const { transition, isBehind } = genLayerPart(widget, prefix);
            const data: ForegroundCameraDataType = withForegroundLayer(
                {
                    id: context.itemId,
                    label: options.cameraLabel ?? '',
                    extraStyle: genStyle(widget, prefix),
                    ...toTransitionPart(transition),
                },
                isBehind,
            );
            return {
                detail: `the camera "${options.cameraLabel ?? context.itemId}"`,
                apply: (screenManager) => {
                    screenManager.screenForegroundManager.addCameraData(data);
                },
            };
        }
        case 'screen': {
            const sourceId = Number.parseInt(context.itemId ?? '');
            if (!Number.isFinite(sourceId)) {
                return {
                    reason: 'Say which screen to show: source, its number.',
                };
            }
            const prefix = `screen-show-${sourceId}`;
            const { transition, isBehind } = genLayerPart(widget, prefix);
            const data: ForegroundScreenDataType = withForegroundLayer(
                {
                    id: sourceId,
                    extraStyle: genStyle(widget, prefix),
                    ...toTransitionPart(transition),
                },
                isBehind,
            );
            return {
                detail: `what screen ${sourceId} shows`,
                apply: (screenManager) => {
                    // A screen never shows itself (the manager refuses a loop).
                    if (screenManager.screenId === sourceId) {
                        return;
                    }
                    screenManager.screenForegroundManager.addScreenData(data);
                },
            };
        }
        case 'long-text':
            return planLongTextShow(context);
        default:
            return { reason: `There is no component called "${widget}".` };
    }
}

async function planLongTextShow(
    context: AgentForegroundContextType,
): Promise<AgentForegroundShowPlanType | AgentForegroundReasonType> {
    const [
        {
            genLongTextItemData,
            parseLongTextSession,
            toLongTextOutline,
            toLongTextSettingName,
            toLongTextSourceId: toLongTextSourceIdOf,
            verifyLongText,
        },
        { genLongTextColumnInput },
        { resolveLongTextLanguage },
        { cloneJson },
    ] = await Promise.all([
        import('../presenter-foreground/foregroundLongTextHelpers'),
        import('../presenter-foreground/foregroundLongTextLangHelpers'),
        import('../presenter-foreground/foregroundLongTextLyricHelpers'),
        import('./helpers'),
    ]);
    const session = parseLongTextSession(
        getSetting(toLongTextSettingName(context.suffix)),
    );
    if (session.languages.length === 0) {
        return {
            reason:
                'That Long Text Show session holds no text yet. Its panel is ' +
                'where a song or words are put into it.',
        };
    }
    const resolvedList = await Promise.all(
        session.languages.map(resolveLongTextLanguage),
    );
    const outlines = resolvedList.map(toLongTextOutline);
    const result = verifyLongText(outlines, session.isAtomMode === true);
    if (result.problem !== null) {
        return {
            reason:
                'That Long Text Show session cannot go up as it is: its ' +
                'languages do not line up, or a song it holds cannot be read. ' +
                'Its panel says what is wrong.',
        };
    }
    const columns = await Promise.all(
        session.languages.map((language, index) => {
            return genLongTextColumnInput(
                language,
                resolvedList[index],
                result.rowIndexes,
                result.screenRows,
            );
        }),
    );
    const itemData = genLongTextItemData(
        toLongTextSourceIdOf(context.suffix),
        columns,
        {
            isStacked:
                session.isStacked === true && session.languages.length > 1,
            isNumberHidden: session.isNumberHidden === true,
        },
    );
    const titleList = session.languages
        .map((language) => {
            return language.title;
        })
        .filter(Boolean);
    return {
        detail: `the long text${titleList.length > 0 ? ` "${titleList[0]}"` : ''}`,
        apply: (screenManager) => {
            ScreenLongTextManager.getInstance(
                screenManager.screenId,
            )?.applyFullDataSrcWithSyncGroup(cloneJson(itemData));
        },
    };
}

// --- hide, restyle, timers ---------------------------------------------

/** Takes this session's (or item's) overlays off one screen. */
export function hideOnScreen(
    context: AgentForegroundContextType,
    screenManager: ScreenManager,
) {
    const { widget } = context;
    const manager = screenManager.screenForegroundManager;
    if (widget === 'long-text') {
        ScreenLongTextManager.hideLongText(
            toLongTextSourceId(context.suffix),
            screenManager.screenId,
        );
        return;
    }
    const ownedList = listOwnedData(context, manager.foregroundData);
    if (ownedList.length === 0) {
        return;
    }
    switch (widget) {
        case 'countdown':
        case 'stopwatch':
        case 'marquee-top':
        case 'marquee-bottom':
        case 'quick-text':
            for (const data of ownedList) {
                removeSingle(widget, manager, data);
            }
            break;
        case 'message': {
            const ownedSet = new Set(ownedList);
            manager.setMessageDataList(
                manager.foregroundData.messageDataList.filter((item) => {
                    return !ownedSet.has(item);
                }),
            );
            break;
        }
        case 'time':
            for (const data of ownedList) {
                manager.removeTimeData(data);
            }
            break;
        case 'video':
            manager.setVideoDataList(
                manager.foregroundData.videoDataList.filter((item) => {
                    return !ownedList.includes(item);
                }),
            );
            break;
        case 'image':
            manager.setImageDataList(
                manager.foregroundData.imageDataList.filter((item) => {
                    return !ownedList.includes(item);
                }),
            );
            break;
        case 'web':
            manager.setWebDataList(
                manager.foregroundData.webDataList.filter((item) => {
                    return !ownedList.includes(item);
                }),
            );
            break;
        case 'camera':
            for (const data of ownedList) {
                manager.removeCameraData(data);
            }
            break;
        case 'screen':
            for (const data of ownedList) {
                manager.removeScreenData(data);
            }
            break;
    }
}

/**
 * What a Long Text Show session's text is known by on a screen --
 * `toLongTextSourceId`, spelt here so a synchronous check needs no import.
 */
function toLongTextSourceId(suffix: string) {
    return `long-text${suffix}`;
}

/** Whether this session (or item) has anything on that screen. */
export function checkIsOnScreen(
    context: AgentForegroundContextType,
    screenManager: ScreenManager,
) {
    if (context.widget === 'long-text') {
        return ScreenLongTextManager.getLongTextShowingList(
            toLongTextSourceId(context.suffix),
        ).some(([screenId]) => {
            return screenId === screenManager.screenId;
        });
    }
    return (
        listOwnedData(
            context,
            screenManager.screenForegroundManager.foregroundData,
        ).length > 0
    );
}

/**
 * The overlays this session has up, dressed again from its settings -- a
 * look just changed, put on the wall the way its panel's own refresh puts
 * it: new datum objects (memory `foreground-sync-shared-refs`), the layer on
 * the datum, never in the style.
 */
export async function restyleOnScreen(
    context: AgentForegroundContextType,
    screenManager: ScreenManager,
) {
    const { widget, suffix } = context;
    const manager = screenManager.screenForegroundManager;
    if (widget === 'long-text') {
        const {
            genLongTextStyleByCode,
            parseLongTextSession,
            toLongTextSettingName,
        } = await import('../presenter-foreground/foregroundLongTextHelpers');
        ScreenLongTextManager.restyleLongText(
            toLongTextSourceId(suffix),
            genLongTextStyleByCode(
                parseLongTextSession(getSetting(toLongTextSettingName(suffix))),
            ),
        );
        return;
    }
    const ownedList = listOwnedData(context, manager.foregroundData);
    if (ownedList.length === 0) {
        return;
    }
    switch (widget) {
        case 'countdown':
        case 'stopwatch':
        case 'quick-text': {
            const prefix = toLookPrefix(context) ?? '';
            const old = ownedList[0];
            // The panel takes it off first, so the overlay is drawn afresh.
            removeSingle(widget, manager, old);
            setSingle(
                widget,
                manager,
                withForegroundLayer(
                    { ...old, extraStyle: genStyle(widget, prefix) },
                    getForegroundIsBehind(prefix),
                ),
            );
            break;
        }
        case 'marquee-top':
        case 'marquee-bottom': {
            const prefix = `${widget}${suffix}`;
            setSingle(
                widget,
                manager,
                withForegroundLayer(
                    {
                        ...ownedList[0],
                        speedPercentage: readMarqueeSpeed(widget, suffix),
                        extraStyle: genMarqueeStyle(widget, suffix),
                    },
                    getForegroundIsBehind(prefix),
                ),
            );
            break;
        }
        case 'message': {
            const plan = await planMessageShow(context);
            if (!checkIsReason(plan)) {
                plan.apply(screenManager);
            }
            break;
        }
        case 'time':
            for (const data of ownedList as ForegroundTimeDataType[]) {
                manager.removeTimeData(data);
                manager.addTimeData(genClockData(data.id));
            }
            break;
        case 'video':
        case 'image':
        case 'web':
            for (const data of ownedList) {
                const plan = await planMediaShow(context, data.filePath);
                plan.apply(screenManager);
            }
            break;
        case 'camera':
            for (const data of ownedList as ForegroundCameraDataType[]) {
                const prefix = `camera-${data.id}`;
                manager.removeCameraData(data);
                manager.addCameraData(
                    withForegroundLayer(
                        { ...data, extraStyle: genStyle(widget, prefix) },
                        getForegroundIsBehind(prefix),
                    ),
                );
            }
            break;
        case 'screen':
            for (const data of ownedList as ForegroundScreenDataType[]) {
                const prefix = `screen-show-${data.id}`;
                manager.addScreenData(
                    withForegroundLayer(
                        { ...data, extraStyle: genStyle(widget, prefix) },
                        getForegroundIsBehind(prefix),
                    ),
                );
            }
            break;
    }
}

export const AGENT_FOREGROUND_TIMER_DOS = [
    'start',
    'pause',
    'resume',
    'reset',
] as const;
export type AgentForegroundTimerDoType =
    (typeof AGENT_FOREGROUND_TIMER_DOS)[number];

/**
 * Start / Pause / Resume / Reset on a countdown or stopwatch that is up,
 * in place: only its timing changes, so the clock is not faded out and back
 * in on the wall (memory `foreground-timer-state-in-datum`).
 */
export function applyTimerOnScreen(
    context: AgentForegroundContextType,
    screenManager: ScreenManager,
    timerDo: AgentForegroundTimerDoType,
    now: number,
) {
    const manager = screenManager.screenForegroundManager;
    const [owned] = listOwnedData(context, manager.foregroundData);
    if (owned === undefined) {
        return false;
    }
    if (context.widget === 'countdown') {
        const data = owned as ForegroundCountdownDataType;
        manager.setCountdownData(
            timerDo === 'pause'
                ? toPausedCountdownData(data, now)
                : timerDo === 'reset'
                  ? toResetCountdownData(data)
                  : toStartedCountdownData(data, now),
        );
        return true;
    }
    if (context.widget === 'stopwatch') {
        const data = owned as ForegroundStopwatchDataType;
        manager.setStopwatchData(
            timerDo === 'pause'
                ? toPausedStopwatchData(data, now)
                : timerDo === 'reset'
                  ? toResetStopwatchData(data)
                  : toStartedStopwatchData(data, now),
        );
        return true;
    }
    return false;
}

export type { ForegroundSettingWriteType };
