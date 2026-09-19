import type { AISecretKeyNameType } from './aiHelpers';
import { getSettingForce, removeSetting, setSetting } from '../settingHelpers';

/**
 * "Open Settings with the cursor in THIS key's box."
 *
 * Asked by one window -- the help window, when a provider with no key is picked
 * or a refused key needs replacing -- and answered by another, the Settings
 * window, which may not exist yet or may have been open behind the app the
 * whole time. Neither can reach the other directly, and the obvious carrier is
 * the wrong one: Settings is a SINGLE window, found again by its URL
 * (`getPopupWindowData` in `electron/electronHelpers.ts` focuses the one that
 * is open instead of opening another), so a query parameter naming the box is
 * a URL no open window has, and it opens a second Settings window.
 *
 * So the request is a setting, written just before the window is raised: a
 * Settings window that is mounting reads it on mount, and one that was already
 * open reads it when the raise gives it focus. The TAB still rides the
 * `setting-tabs` setting beside it, exactly as before.
 *
 * It carries the moment it was made, and a stale one is ignored: a request
 * whose window never came up must not put the cursor in a key box the next
 * time somebody opens Settings for something else. Half a minute is long for a
 * window to open on a slow machine and short for a person to wander back.
 */
const AI_KEY_FOCUS_SETTING_NAME = 'setting-ai-key-focus';
export const AI_KEY_FOCUS_MAX_AGE_MILLISECONDS = 30_000;

// Every box a request may name. A `Record` over the union, so a key added to
// `AISecretKeyNameType` and forgotten here is a build failure rather than a
// request that is quietly thrown away.
const AI_KEY_NAME_MAP: Record<AISecretKeyNameType, true> = {
    openAIAPIKey: true,
    anthropicAPIKey: true,
    kimiAPIKey: true,
};

export type AIKeyFocusRequestType = {
    // null asks for the AI panel itself, no box in particular.
    keyName: AISecretKeyNameType | null;
};

export function requestAIKeyFocus(keyName: AISecretKeyNameType | null) {
    setSetting(
        AI_KEY_FOCUS_SETTING_NAME,
        JSON.stringify({ keyName, requestedAt: Date.now() }),
    );
}

/**
 * The stored text as a request, or null for anything that is not a fresh one.
 * Read as untrusted: it is a file on disk, and a name that is not one of the
 * boxes must not reach a lookup by name.
 */
export function toAIKeyFocusRequest(
    text: string | null,
    now: number,
): AIKeyFocusRequestType | null {
    if (!text) {
        return null;
    }
    let data: any;
    try {
        data = JSON.parse(text);
    } catch (_error) {
        return null;
    }
    const requestedAt = data?.requestedAt;
    // Either way round: a clock moved back since is no reason to honour a
    // request for ever.
    if (
        typeof requestedAt !== 'number' ||
        Math.abs(now - requestedAt) > AI_KEY_FOCUS_MAX_AGE_MILLISECONDS
    ) {
        return null;
    }
    const keyName = data.keyName;
    if (keyName === null) {
        return { keyName: null };
    }
    if (
        typeof keyName !== 'string' ||
        !Object.hasOwn(AI_KEY_NAME_MAP, keyName)
    ) {
        return null;
    }
    return { keyName: keyName as AISecretKeyNameType };
}

/**
 * The waiting request, left where it is. The Settings window asks this to pick
 * its TAB and leaves the request for the panel that holds the box.
 *
 * Read past this window's own setting cache: the request was written by
 * ANOTHER window, and the cache answers with what this one read up to ten
 * seconds ago.
 */
export function getAIKeyFocusRequest() {
    return toAIKeyFocusRequest(
        getSettingForce(AI_KEY_FOCUS_SETTING_NAME),
        Date.now(),
    );
}

/** Read once and forgotten -- a stale one too, so it is not read again. */
export function takeAIKeyFocusRequest() {
    const text = getSettingForce(AI_KEY_FOCUS_SETTING_NAME);
    if (!text) {
        return null;
    }
    removeSetting(AI_KEY_FOCUS_SETTING_NAME);
    return toAIKeyFocusRequest(text, Date.now());
}
