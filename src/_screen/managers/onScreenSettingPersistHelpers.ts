import appProvider from '../../server/appProvider';
import { getSetting, setSetting } from '../../helper/settingHelpers';
import { unlocking } from '../../server/unlockingHelpers';
import { handleError } from '../../helper/errorHelpers';

/**
 * A projector window never writes the screens' persisted state.
 *
 * Every screen layer keeps a map of all screens in one settings file (what
 * slide, background, verse, foreground each screen holds) and saves it by
 * read → set own key → write the whole map back. The projector window
 * (`screen.html`) runs the same setters when it receives a sync, and the lock
 * around that save (`unlocking`) is per process, so the Presenter and every
 * projector rewrote the same file for every present: a stale or half-written
 * read there dropped the other screens' entries, and after the next reload
 * those screens came up blank mid-service. What a projector shows arrived in
 * the sync message; the window that sent it has already saved it.
 */
export function checkIsOnScreenSettingWriter() {
    return !appProvider.isPageScreen;
}

type OnScreenMapType<T> = { [key: string]: T };

/**
 * Save one screen's entry of an on-screen map, never from a projector window.
 *
 * A map that reads back EMPTY while the file holds more than `{}` was not
 * read — broken JSON, or entries the reader dropped — and saving it plus one
 * key would delete every other screen. The Presenter's live managers were
 * loaded from that file (their constructors) and kept current since, so there
 * the map is rebuilt from them (`collectLive`); any other window holds no
 * such copy and skips the save rather than erase what it cannot read. No
 * second parse: the check is on the string the reader already memoized.
 */
export function persistOnScreenEntry<T>({
    lockKey,
    settingName,
    key,
    value,
    readMap,
    collectLive,
    onDone,
}: {
    lockKey: string;
    settingName: string;
    key: string;
    value: T | null;
    readMap: () => OnScreenMapType<T>;
    collectLive: () => OnScreenMapType<T>;
    onDone?: () => void;
}) {
    return unlocking(lockKey, () => {
        const map = checkIsOnScreenSettingWriter()
            ? readWritableMap(settingName, readMap, collectLive)
            : null;
        if (map !== null) {
            if (value === null) {
                delete map[key];
            } else {
                map[key] = value;
            }
            setSetting(settingName, JSON.stringify(map));
        }
        onDone?.();
    });
}

function readWritableMap<T>(
    settingName: string,
    readMap: () => OnScreenMapType<T>,
    collectLive: () => OnScreenMapType<T>,
) {
    const map = readMap();
    if (Object.keys(map).length > 0) {
        return map;
    }
    const raw = getSetting(settingName) ?? '';
    if (raw.trim().length <= 2) {
        return map;
    }
    const isRebuilt = appProvider.isPagePresenter;
    handleError(
        new Error(
            `On-screen setting "${settingName}" could not be read; ` +
                (isRebuilt
                    ? 'rebuilding it from the screens in memory.'
                    : 'not saving over it.'),
        ),
    );
    return isRebuilt ? collectLive() : null;
}

/** `{ [instance.key]: value }` for the live instances holding something. */
export function collectLiveOnScreenMap<I extends { key: string }, T>(
    instances: I[],
    getValue: (instance: I) => T | null,
): OnScreenMapType<T> {
    const map: OnScreenMapType<T> = {};
    for (const instance of instances) {
        const value = getValue(instance);
        if (value !== null && value !== undefined) {
            map[instance.key] = value;
        }
    }
    return map;
}
