/**
 * The SESSIONS of a foreground component, as the help window's assistant
 * finds, makes and changes them (2026-11-09, the user: _chatbot can help
 * modify any foreground component_, then, with the strip _Default · Session
 * 2 · +_ circled: _sessions of opening foreground component should be able
 * to attached to the chatbot for the chat context_).
 *
 * A session is one saved set-up of a panel -- its words or numbers AND its
 * look -- and its strip is the same one the media widgets have always had
 * (`mediaSessionData.ts`). Three rules hold here, all the user's:
 *
 * - **New words go into a NEW session**, named after them (`John 3:16`,
 *   `5:00`), so nothing a person typed into the session they are on, or the
 *   one on the wall, is ever written over; a session already called that is
 *   reused rather than a `(2)` made beside it.
 * - **A session the person NAMED -- attached in the help window, or asked for
 *   by name -- is changed in place**: it is the one they pointed at.
 * - **A new session looks like the one the panel is on**: a panel's own `+`
 *   starts on the defaults, which put the assistant's verse up in a 100px
 *   white box beside the operator's 40px blue band. The active session's
 *   Properties are copied -- only the keys it HAS, so no file is made for a
 *   value nobody chose.
 */
import { getSetting, removeSetting, setSetting } from './settingHelpers';
import {
    DEFAULT_SESSION_ID,
    addMediaSession,
    genMediaSessionId,
    notifyMediaSessionStrips,
    readSessions,
    resolveActiveSessionId,
    toActiveSettingName,
    toListSettingName,
    toSessionSuffix,
    type MediaSessionType,
} from '../media-sessions/mediaSessionData';
import type { ForegroundComponentKeyType } from '../presenter-foreground/foregroundComponentKeys';
import {
    FOREGROUND_COMPONENT_RULE_MAP,
    toClockIdListSettingName,
    toForegroundSessionsTarget,
} from '../presenter-foreground/foregroundComponentRules';
import {
    genCommonStyleSettingNames,
    genDecorationSettingName,
    genPropsSettingNames,
} from '../presenter-foreground/foregroundStyleSettingNames';
import type { ForegroundSettingWriteType } from './agentForegroundLookRules';

export type AgentForegroundSessionType = {
    id: string;
    name: string;
    suffix: string;
    isActive: boolean;
};

/** The longest name a session is given from its words. */
const MAX_SESSION_NAME_LENGTH = 40;

export function readForegroundSessions(
    widget: ForegroundComponentKeyType,
): AgentForegroundSessionType[] {
    const target = toForegroundSessionsTarget(widget);
    const activeId = resolveActiveSessionId(target);
    return readSessions(target).map((session) => {
        return {
            id: session.id,
            name: session.name,
            suffix: toSessionSuffix(session.id),
            isActive: session.id === activeId,
        };
    });
}

/**
 * A session by its id (what an attached chip carries) or by its name as the
 * strip shows it, case and spacing aside. Null when there is none.
 */
export function findForegroundSession(
    widget: ForegroundComponentKeyType,
    wanted: unknown,
) {
    if (typeof wanted !== 'string') {
        return null;
    }
    const text = wanted.trim();
    const sessions = readForegroundSessions(widget);
    const byId = sessions.find((session) => {
        return session.id === text;
    });
    if (byId !== undefined) {
        return byId;
    }
    const key = toNameKey(text);
    if (key === '') {
        return null;
    }
    return (
        sessions.find((session) => {
            return toNameKey(session.name) === key;
        }) ?? null
    );
}

export function getActiveForegroundSession(widget: ForegroundComponentKeyType) {
    const sessions = readForegroundSessions(widget);
    return (
        sessions.find((session) => {
            return session.isActive;
        }) ?? sessions[0]
    );
}

function toNameKey(name: string) {
    return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * A session's name from its words: the first line, mark-up off, cut at a
 * whole word. `## John 3:16` names itself `John 3:16`.
 */
export function toForegroundSessionName(text: string) {
    const line =
        text
            .split('\n')
            .map((one) => {
                return one
                    .replace(/^\s*#+\s*/, '')
                    .replace(/[*_`>]/g, '')
                    .trim();
            })
            .find((one) => {
                return one !== '';
            }) ?? '';
    if (line.length <= MAX_SESSION_NAME_LENGTH) {
        return line;
    }
    const cut = line.slice(0, MAX_SESSION_NAME_LENGTH);
    const lastSpace = cut.lastIndexOf(' ');
    return `${(lastSpace > 12 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

/** Every Properties key under a prefix, the Effects JSON included. */
function genLookSettingNames(prefix: string) {
    return [
        ...Object.values(genPropsSettingNames(prefix)),
        ...Object.values(genCommonStyleSettingNames(prefix)),
        genDecorationSettingName(prefix),
    ];
}

/**
 * The writes that give `toSuffix`'s session the look `fromSuffix`'s has --
 * only the keys that exist, so a value nobody chose stays the default.
 */
export function genLookCopyWrites(
    widget: ForegroundComponentKeyType,
    fromSuffix: string,
    toSuffix: string,
): ForegroundSettingWriteType[] {
    const rule = FOREGROUND_COMPONENT_RULE_MAP[widget];
    const toPrefix = rule.toSessionPrefix;
    if (toPrefix === undefined) {
        return [];
    }
    const fromNames = genLookSettingNames(toPrefix(fromSuffix));
    const toNames = genLookSettingNames(toPrefix(toSuffix));
    const writes: ForegroundSettingWriteType[] = [];
    fromNames.forEach((name, index) => {
        const value = getSetting(name);
        if (value !== null && value !== '') {
            writes.push({ key: toNames[index], value });
        }
    });
    // A marquee keeps its size and speed outside its Properties.
    if (widget === 'marquee-top' || widget === 'marquee-bottom') {
        for (const part of ['font-size', 'speed-percentage']) {
            const value = getSetting(
                `foreground-${widget}-${part}${fromSuffix}`,
            );
            if (value !== null && value !== '') {
                writes.push({
                    key: `foreground-${widget}-${part}${toSuffix}`,
                    value,
                });
            }
        }
    }
    return writes;
}

/** The clocks a Time session holds, by id, as its panel lists them. */
export function readClockIdList(suffix: string) {
    try {
        const parsed = JSON.parse(
            getSetting(toClockIdListSettingName(suffix)) ?? '[]',
        );
        return Array.isArray(parsed)
            ? parsed.filter((one): one is string => {
                  return typeof one === 'string';
              })
            : [];
    } catch {
        return [];
    }
}

/** A new session's id and suffix, made before anything is written. */
export function genNewForegroundSession(name: string) {
    const id = genMediaSessionId();
    return { id, name, suffix: toSessionSuffix(id) };
}

/** The keys a new session adds to its strip, for the backup. */
export function genSessionStripKeys(widget: ForegroundComponentKeyType) {
    const target = toForegroundSessionsTarget(widget);
    return [toListSettingName(target), toActiveSettingName(target)];
}

/** Puts the session on its strip and makes it the one the panel is on. */
export function addForegroundSession(
    widget: ForegroundComponentKeyType,
    session: MediaSessionType,
) {
    addMediaSession(toForegroundSessionsTarget(widget), session);
}

/** Makes an existing session the one its panel is on. */
export function activateForegroundSession(
    widget: ForegroundComponentKeyType,
    sessionId: string,
) {
    const target = toForegroundSessionsTarget(widget);
    if (resolveActiveSessionId(target) === sessionId) {
        return;
    }
    setSetting(toActiveSettingName(target), sessionId);
    notifyMediaSessionStrips(target);
}

/** The value a write is about to replace, `null` when the key is absent. */
export function readSettingForBackup(key: string) {
    const value = getSetting(key);
    return value === null ? null : value;
}

export function applySettingWrites(writes: ForegroundSettingWriteType[]) {
    for (const write of writes) {
        if (write.value === null) {
            removeSetting(write.key);
        } else {
            setSetting(write.key, write.value);
        }
    }
}

export { DEFAULT_SESSION_ID, toSessionSuffix };
