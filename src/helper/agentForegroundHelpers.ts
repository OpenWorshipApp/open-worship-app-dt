/**
 * The app side of `owa_foreground`: start or stop a foreground extra -- a
 * countdown, a stopwatch, a clock, a scrolling message along the top or the
 * bottom, a quick line of text -- on the screens the user has ticked, and
 * answer with what each screen holds afterwards.
 *
 * ## Why the tool needed the app for this
 *
 * "Start a 5 minute countdown on the screen" is a pre-service ask in nearly
 * every church, and measured 2026-09-11 on Claude Sonnet 5 it was the worst
 * answer of the day. The first reply took 8 rounds and $0.08 to write four
 * steps, opening the Foreground tab itself on the way; the "Yes, start it
 * now" under it ran to the ten-round cap, started nothing, and ended on the
 * half-sentence *"Now Foreground is active. Let me look for the countdown
 * controls."* Two things did that. The Foreground tab is a TOGGLE, so the
 * model's press closed the panel it had opened a minute before, and
 * `owa_click` -- reading a tab's state off nothing, because a tab keeps it in
 * a class -- reported `didChange: false`. And the widget itself is a form
 * written for a person: an hours box, a minutes box reading `m`, a Start
 * button, a properties row. The verse had the same shape a day earlier and
 * got `owa_present_bible`; this is the foreground's door.
 *
 * So this takes the ask as words -- `minutes`, or a clock time `at`, or the
 * `text` to scroll -- and does exactly what the widget's own Start button
 * does (`ScreenForegroundManager.setCountdownData` and its siblings, on the
 * ticked screens, with the widget's defaults), then reads the screens back
 * so the tool answers what is on them rather than what was pressed.
 *
 * ## The rules it keeps
 *
 * - It reaches the tool the way `owa_present_bible` does: a dependency-free
 *   page expression fires a DOM event, `domHelpers.ts` relays it here, and
 *   the import there is LAZY -- the screen managers must not load in every
 *   window because somebody might ask.
 * - A locked screen refuses the extra, as it refuses a click, and the answer
 *   says so instead of pretending.
 * - Whether to start at all is decided BEFORE this is called -- the model is
 *   told to do it only when the user asked for the extra to go up, and to
 *   offer it otherwise; `check` reads what is on without touching a screen.
 * - Nothing here is saved beyond what the widget's own button saves: the
 *   extra rides the screen's foreground setting exactly as a pressed Start
 *   does, and Clear Foreground (F10) undoes the whole effect.
 */
import { getAllScreenManagers } from '../_screen/managers/screenManagerHelpers';
import type ScreenManager from '../_screen/managers/ScreenManager';
import { DEFAULT_MARQUEE_SPEED_PERCENTAGE } from '../_screen/screenTypeHelpers';
import appProvider from '../server/appProvider';
import { toForegroundSummary } from './agentScreenHelpers';

export type AgentForegroundRequestType = {
    action?: unknown;
    widget?: unknown;
    minutes?: unknown;
    at?: unknown;
    text?: unknown;
    seconds?: unknown;
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

export type AgentForegroundDidType = 'started' | 'stopped' | 'checked';

export type AgentForegroundResultType =
    | AgentForegroundRefusalType
    | {
          isError?: false;
          did: AgentForegroundDidType;
          widget: string | null;
          // What went up, in a sentence a person can check against the
          // wall: "a 5 minute countdown, ending at 11:45 AM".
          detail: string;
          screens: AgentForegroundScreenType[];
          isAnyShowing: boolean;
          note?: string;
      };

// Held in step with `AGENT_FOREGROUND_WIDGETS` / `AGENT_FOREGROUND_ACTIONS`
// in `tools/owa-devtools-mcp/agentForeground.mjs`, which the tool's schema
// reads; a test holds the two together.
export const AGENT_FOREGROUND_WIDGETS = [
    'countdown',
    'stopwatch',
    'clock',
    'marquee-top',
    'marquee-bottom',
    'quick-text',
    'all',
] as const;
export const AGENT_FOREGROUND_ACTIONS = ['start', 'stop', 'check'] as const;
export type AgentForegroundWidgetType =
    (typeof AGENT_FOREGROUND_WIDGETS)[number];

// A countdown of a quarter of a minute to a day; a message of a sentence or
// two, not a sermon; a quick text that stays a moment to ten minutes.
const MIN_COUNTDOWN_MINUTES = 0.25;
const MAX_COUNTDOWN_MINUTES = 24 * 60;
const MAX_TEXT_LENGTH = 300;
const DEFAULT_QUICK_TEXT_SECONDS = 10;
const MAX_QUICK_TEXT_SECONDS = 600;

function toReason(reason: string): AgentForegroundRefusalType {
    return { isError: true, reason };
}

function toTimeLabel(date: Date) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function toMinutesLabel(minutes: number) {
    const rounded = Math.round(minutes * 100) / 100;
    return rounded === 1 ? '1 minute' : `${rounded} minute`;
}

/**
 * A clock time today, as a person says it: "10:30", "18:30", "6:45 pm",
 * "7pm", "10.30". Null when it is not one; a refusal when it has already
 * passed, because a countdown to a time gone by shows nothing useful.
 */
export function parseClockTimeToday(
    text: string,
    now: Date = new Date(),
): Date | null | AgentForegroundRefusalType {
    const match =
        /^\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\s*$/i.exec(
            text,
        );
    if (match === null) {
        return null;
    }
    let hours = Number.parseInt(match[1], 10);
    const minutes = match[2] === undefined ? 0 : Number.parseInt(match[2], 10);
    const meridiem = match[3]?.toLowerCase().replace(/\./g, '') ?? null;
    if (meridiem === null && match[2] === undefined) {
        // A bare "10" is a number of minutes, not ten o'clock.
        return null;
    }
    if (
        minutes > 59 ||
        hours > 23 ||
        (meridiem !== null && (hours < 1 || hours > 12))
    ) {
        return toReason(
            `"${text.trim()}" is not a time of day. Write it as "10:30", ` +
                '"18:30" or "6:45 pm".',
        );
    }
    if (meridiem === 'pm' && hours < 12) {
        hours += 12;
    } else if (meridiem === 'am' && hours === 12) {
        hours = 0;
    }
    const target = new Date(now);
    target.setHours(hours, minutes, 0, 0);
    if (target.getTime() <= now.getTime()) {
        return toReason(
            `${toTimeLabel(target)} has already passed today, so there is ` +
                'nothing to count down to. Give a later time, or say how ' +
                'many minutes.',
        );
    }
    return target;
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

function readText(request: AgentForegroundRequestType) {
    return typeof request.text === 'string'
        ? request.text.replace(/\s+/g, ' ').trim()
        : '';
}

/**
 * What the widget's own Start button would put on this screen, worked out
 * ONCE from the request so every ticked screen gets the same thing (a
 * duration countdown must end at the same moment on all of them), and said
 * back as `detail`. A refusal here is about the words, never the screens.
 */
async function planStart(
    widget: AgentForegroundWidgetType,
    request: AgentForegroundRequestType,
    now: Date,
): Promise<
    | AgentForegroundRefusalType
    | {
          detail: string;
          apply: (screenManager: ScreenManager) => void;
      }
> {
    switch (widget) {
        case 'countdown': {
            const hasMinutes =
                typeof request.minutes === 'number' &&
                Number.isFinite(request.minutes);
            const at = typeof request.at === 'string' ? request.at.trim() : '';
            if (!hasMinutes && at === '') {
                return toReason(
                    'Say how long the countdown is (minutes, e.g. 5) or the ' +
                        'time it counts down to (at, e.g. "10:30").',
                );
            }
            let target: Date;
            let detail: string;
            if (hasMinutes) {
                const minutes = request.minutes as number;
                if (
                    minutes < MIN_COUNTDOWN_MINUTES ||
                    minutes > MAX_COUNTDOWN_MINUTES
                ) {
                    return toReason(
                        'A countdown runs from a quarter of a minute to 24 ' +
                            `hours; ${minutes} minutes is outside that.`,
                    );
                }
                // The widget's own arithmetic: one second on top so the
                // display starts on the whole minute rather than one below.
                target = new Date(
                    now.getTime() + (Math.round(minutes * 60) + 1) * 1000,
                );
                detail = `a ${toMinutesLabel(minutes)} countdown, ending at ${toTimeLabel(target)}`;
            } else {
                const parsed = parseClockTimeToday(at, now);
                if (parsed === null) {
                    return toReason(
                        `"${at}" is not a time of day. Write it as "10:30", ` +
                            '"18:30" or "6:45 pm" -- or give a number of minutes.',
                    );
                }
                if (!(parsed instanceof Date)) {
                    return parsed;
                }
                target = parsed;
                detail = `a countdown to ${toTimeLabel(target)}`;
            }
            return {
                detail,
                apply: (screenManager) => {
                    screenManager.screenForegroundManager.setCountdownData({
                        dateTime: target,
                        extraStyle: {},
                    });
                },
            };
        }
        case 'stopwatch':
            return {
                detail: `a stopwatch, started at ${toTimeLabel(now)}`,
                apply: (screenManager) => {
                    screenManager.screenForegroundManager.setStopwatchData({
                        dateTime: now,
                        extraStyle: {},
                    });
                },
            };
        case 'clock':
            return {
                detail: 'a clock showing the current time',
                apply: (screenManager) => {
                    // The widget's own defaults: this machine's time zone
                    // (the field is named minutes and holds HOURS, as the
                    // widget writes it), no city title, 12-hour.
                    screenManager.screenForegroundManager.addTimeData({
                        id: `agent-clock-${Date.now().toString(36)}`,
                        timezoneMinuteOffset: -now.getTimezoneOffset() / 60,
                        title: null,
                        is24HourFormat: false,
                        extraStyle: {},
                    });
                },
            };
        case 'marquee-top':
        case 'marquee-bottom': {
            const text = readText(request);
            if (text === '') {
                return toReason(
                    'Say the words to scroll: text, e.g. "Please silence ' +
                        'your phones".',
                );
            }
            if (text.length > MAX_TEXT_LENGTH) {
                return toReason(
                    `That is ${text.length} characters; a scrolling message ` +
                        `is at most ${MAX_TEXT_LENGTH}. Shorten it.`,
                );
            }
            const where = widget === 'marquee-top' ? 'top' : 'bottom';
            return {
                detail: `a message scrolling along the ${where}: "${text}"`,
                apply: (screenManager) => {
                    const data = {
                        text,
                        speedPercentage: DEFAULT_MARQUEE_SPEED_PERCENTAGE,
                        extraStyle: {},
                    };
                    if (widget === 'marquee-top') {
                        screenManager.screenForegroundManager.setMarqueeTopData(
                            data,
                        );
                    } else {
                        screenManager.screenForegroundManager.setMarqueeBottomData(
                            data,
                        );
                    }
                },
            };
        }
        case 'quick-text': {
            const text = readText(request);
            if (text === '') {
                return toReason(
                    'Say the words to show: text, e.g. "Please stay for ' +
                        'coffee after the service".',
                );
            }
            if (text.length > MAX_TEXT_LENGTH) {
                return toReason(
                    `That is ${text.length} characters; a quick text is at ` +
                        `most ${MAX_TEXT_LENGTH}. Shorten it.`,
                );
            }
            const seconds =
                typeof request.seconds === 'number' &&
                Number.isFinite(request.seconds) &&
                request.seconds >= 1
                    ? Math.min(
                          MAX_QUICK_TEXT_SECONDS,
                          Math.round(request.seconds),
                      )
                    : DEFAULT_QUICK_TEXT_SECONDS;
            // The widget types Markdown and renders it; plain words go
            // through the same renderer so they come out as the same
            // paragraph, and the screen sanitises the HTML on render.
            const { renderMarkdown } =
                await import('../lyric-list/markdownHelpers');
            const { html } = await renderMarkdown(text);
            return {
                detail: `a line of text for ${seconds} seconds: "${text}"`,
                apply: (screenManager) => {
                    screenManager.screenForegroundManager.setQuickTextData({
                        htmlText: html,
                        timeSecondDelay: 0,
                        timeSecondToLive: seconds,
                        extraStyle: {},
                    });
                },
            };
        }
        default:
            return toReason(
                'Say which extra to start: countdown, stopwatch, clock, ' +
                    'marquee-top, marquee-bottom or quick-text.',
            );
    }
}

function checkHasWidget(
    screenManager: ScreenManager,
    widget: AgentForegroundWidgetType,
) {
    const data = screenManager.screenForegroundManager.foregroundData;
    switch (widget) {
        case 'countdown':
            return data.countdownData !== null;
        case 'stopwatch':
            return data.stopwatchData !== null;
        case 'clock':
            return (data.timeDataList ?? []).length > 0;
        case 'marquee-top':
            return data.marqueeTopData !== null;
        case 'marquee-bottom':
            return data.marqueeBottomData !== null;
        case 'quick-text':
            return data.quickTextData !== null;
        default:
            return toForegroundSummary(data).length > 0;
    }
}

function stopWidget(
    screenManager: ScreenManager,
    widget: AgentForegroundWidgetType,
) {
    const manager = screenManager.screenForegroundManager;
    switch (widget) {
        case 'countdown':
            manager.setCountdownData(null);
            break;
        case 'stopwatch':
            manager.setStopwatchData(null);
            break;
        case 'clock':
            manager.setTimeDataList([]);
            break;
        case 'marquee-top':
            manager.setMarqueeTopData(null);
            break;
        case 'marquee-bottom':
            manager.setMarqueeBottomData(null);
            break;
        case 'quick-text':
            manager.setQuickTextData(null);
            break;
        default:
            manager.clear();
    }
}

const WIDGET_NOUN_MAP: Record<AgentForegroundWidgetType, string> = {
    countdown: 'countdown',
    stopwatch: 'stopwatch',
    clock: 'clock',
    'marquee-top': 'scrolling message along the top',
    'marquee-bottom': 'scrolling message along the bottom',
    'quick-text': 'line of text',
    all: 'foreground extras',
};

export async function handleAgentForegroundRequest(
    request: AgentForegroundRequestType,
    now: Date = new Date(),
): Promise<AgentForegroundResultType> {
    const action =
        typeof request.action === 'string' && request.action.length > 0
            ? request.action
            : 'start';
    if (!(AGENT_FOREGROUND_ACTIONS as readonly string[]).includes(action)) {
        return toReason(
            `Unknown action "${action}". Use start, stop or check.`,
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
    const widget = (AGENT_FOREGROUND_WIDGETS as readonly string[]).includes(
        widgetText,
    )
        ? (widgetText as AgentForegroundWidgetType)
        : null;
    if (widgetText !== '' && widget === null) {
        return toReason(
            `There is no extra called "${widgetText}". The extras are: ` +
                'countdown, stopwatch, clock, marquee-top, marquee-bottom, ' +
                'quick-text -- or all, to stop every one.',
        );
    }
    const allManagers = getAllScreenManagers().filter((screenManager) => {
        return !screenManager.isDeleted;
    });
    const isAnyShowing = allManagers.some((screenManager) => {
        return screenManager.isShowing;
    });
    const targetScreens = allManagers.filter((screenManager) => {
        return screenManager.isSelected;
    });
    if (action === 'check') {
        const screens = allManagers.map(toScreenState);
        const held = screens.filter((screen) => screen.foreground.length > 0);
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
            isAnyShowing,
            note: 'Nothing was changed: this only read the screens.',
        };
    }
    if (widget === null) {
        return toReason(
            action === 'stop'
                ? 'Say which extra to stop: countdown, stopwatch, clock, ' +
                      'marquee-top, marquee-bottom, quick-text, or all.'
                : 'Say which extra to start: countdown, stopwatch, clock, ' +
                      'marquee-top, marquee-bottom or quick-text.',
        );
    }
    if (action === 'start' && widget === 'all') {
        return toReason(
            '"all" only stops. Start one extra at a time: countdown, ' +
                'stopwatch, clock, marquee-top, marquee-bottom or quick-text.',
        );
    }
    if (targetScreens.length === 0) {
        return toReason(
            'No screen is chosen to present to. In the Mini Screen panel, ' +
                'tick the screen the extra should go to, then ask again.',
        );
    }
    const unlocked = targetScreens.filter((screenManager) => {
        return !screenManager.isLocked;
    });
    if (unlocked.length === 0) {
        return toReason(
            `Screen ${targetScreens
                .map((one) => one.screenId)
                .join(' and ')} is locked, so it refuses a change. The lock ` +
                'button is on its Mini Screen card; unlock it, then ask again.',
        );
    }
    const notes: string[] = [];
    const lockedIds = targetScreens
        .filter((screenManager) => screenManager.isLocked)
        .map((screenManager) => screenManager.screenId);
    if (lockedIds.length > 0) {
        notes.push(
            `Screen ${lockedIds.join(' and ')} is locked and was left as it ` +
                'was.',
        );
    }
    if (action === 'stop') {
        const hadIt = unlocked.some((screenManager) => {
            return checkHasWidget(screenManager, widget);
        });
        for (const screenManager of unlocked) {
            stopWidget(screenManager, widget);
        }
        if (!hadIt) {
            notes.push(
                `There was no ${WIDGET_NOUN_MAP[widget]} on the screen, so ` +
                    'nothing changed.',
            );
        }
        return {
            did: 'stopped',
            widget,
            detail:
                widget === 'all'
                    ? 'Every foreground extra is off the screen now.'
                    : `The ${WIDGET_NOUN_MAP[widget]} is off the screen now.`,
            screens: targetScreens.map(toScreenState),
            isAnyShowing,
            ...(notes.length > 0 ? { note: notes.join(' ') } : {}),
        };
    }
    const plan = await planStart(widget, request, now);
    if ('isError' in plan) {
        return plan;
    }
    // The same path as the widget's own Start button, minus the mouse event
    // that chooses screens: the ticked screens are the target, as a click
    // with nothing held down would use too. The manager itself steps over a
    // locked screen with a toast, so only the unlocked ones change.
    for (const screenManager of unlocked) {
        plan.apply(screenManager);
    }
    const after = targetScreens.map(toScreenState);
    const offIds = after
        .filter((screen) => !screen.isLocked && !screen.isShowing)
        .map((screen) => screen.screenId);
    if (offIds.length > 0) {
        notes.push(
            `Screen ${offIds.join(' and ')} holds it but is OFF, so the ` +
                'projector shows nothing until its show button is pressed ' +
                '(owa_list_screens names it under controls.showHide) -- ' +
                'offer that, do not press it unasked.',
        );
    }
    return {
        did: 'started',
        widget,
        detail: plan.detail,
        screens: after,
        isAnyShowing,
        ...(notes.length > 0 ? { note: notes.join(' ') } : {}),
    };
}
