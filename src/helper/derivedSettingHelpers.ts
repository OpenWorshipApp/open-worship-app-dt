import { registerDerivedSettingRelease } from './derivedSettingRegistry';
import { getSetting } from './settingHelpers';

// Long enough that one burst of renders shares a single derivation, short
// enough that nothing stays parsed once the screen stops asking. The app data
// behind these settings can be large — a presented lyric slide is ~92 KB of
// inline-style HTML per screen — so it must not sit in memory through a service
// it is no longer part of.
const IDLE_RELEASE_MILLISECONDS = 5000;

export { releaseAllDerivedSettings } from './derivedSettingRegistry';

/**
 * A synchronous reader for a setting whose PARSED form is read far more often
 * than the setting is written.
 *
 * Why the raw strings are the cache key: they ARE the source of truth, so the
 * comparison is an exact invalidation test. There is no event wiring to forget,
 * a write made by the other window is picked up as soon as `getSetting` returns
 * the new string, and the reader can never be more stale than `getSetting`
 * itself. (String `===` compares by value and short-circuits on the identical
 * instance, which is what `appLocalStorage`'s own cache hands back.)
 *
 * `settingNames` takes EVERY setting the derivation reads, not just the obvious
 * one — the on-screen maps are filtered against the list of live screens, so a
 * screen being added or deleted has to invalidate them even though their own
 * setting string did not change.
 *
 * The derived value is deliberately not handed to callers by this module: every
 * caller-facing getter copies what it returns, because the persist paths do a
 * read-modify-write on the map.
 */
export function genDerivedSettingReader<T>(
    settingNames: string[],
    derive: (settingStrings: string[]) => T,
) {
    let cachedSources: string[] | null = null;
    let cachedValue: T | null = null;
    let lastReadTime = 0;
    let releaseTimeoutId: ReturnType<typeof setTimeout> | null = null;
    const release = () => {
        if (releaseTimeoutId !== null) {
            clearTimeout(releaseTimeoutId);
            releaseTimeoutId = null;
        }
        cachedSources = null;
        cachedValue = null;
    };
    // A stamp plus ONE armed timer, deliberately not `genTimeoutAttempt`: that
    // re-arms by clearTimeout+setTimeout on every call, and this runs on the
    // hottest read in the app (four times per slide preview per render pass).
    // The debounce belongs on writes that race — a scroll frame persisting the
    // whole map — not on a read that must stay free.
    const armRelease = () => {
        if (releaseTimeoutId !== null) {
            return;
        }
        releaseTimeoutId = setTimeout(function checkIdle() {
            const idleMilliseconds = Date.now() - lastReadTime;
            if (idleMilliseconds < IDLE_RELEASE_MILLISECONDS) {
                // Read again while waiting — sleep out the remainder instead of
                // dropping an entry that is still in use.
                releaseTimeoutId = setTimeout(
                    checkIdle,
                    IDLE_RELEASE_MILLISECONDS - idleMilliseconds,
                );
                return;
            }
            releaseTimeoutId = null;
            release();
        }, IDLE_RELEASE_MILLISECONDS);
    };
    registerDerivedSettingRelease(release);
    // Filled and compared in place, so a cache HIT — the normal outcome on a
    // read this hot — allocates nothing. Each setting is still read exactly
    // once per call: reading twice would both double the work and break
    // `mockReturnValueOnce`-style test doubles.
    const scratchSources: string[] = new Array(settingNames.length);
    return function readDerivedSetting(): T {
        const previousSources = cachedSources;
        let isCached = previousSources !== null;
        for (let index = 0; index < settingNames.length; index += 1) {
            const source = getSetting(settingNames[index]) ?? '';
            scratchSources[index] = source;
            if (isCached && source !== (previousSources as string[])[index]) {
                isCached = false;
            }
        }
        // Held in a local, never read back off the cache after this point: the
        // release can drop the entry, and a reader that returned the field
        // instead would hand back null the moment the two happen in the same
        // tick.
        let value: T;
        if (isCached) {
            value = cachedValue as T;
        } else {
            // Copied on the MISS path only — `scratchSources` is overwritten by
            // the next read, so the cache may never hold it directly.
            const sources = scratchSources.slice();
            value = derive(sources);
            cachedValue = value;
            cachedSources = sources;
        }
        lastReadTime = Date.now();
        armRelease();
        return value;
    };
}
