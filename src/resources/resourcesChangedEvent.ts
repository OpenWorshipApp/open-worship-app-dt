/**
 * Told by whatever put a file into a Resources folder from outside the panel
 * -- the help window's study file (EC-464) -- so a panel open in this window
 * reloads the way its own Reload does. A nudge, not a watcher: the panel
 * still watches nothing (`resourcesScanHelpers.ts`), and another window's
 * panel sees the file on its next Reload or after the ten-second cache.
 *
 * A leaf module, so the worker that writes the file does not pull the panel.
 */
export const RESOURCES_CHANGED_EVENT = 'owa-resources-changed';

export function announceResourcesChanged() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(RESOURCES_CHANGED_EVENT));
    }
}
