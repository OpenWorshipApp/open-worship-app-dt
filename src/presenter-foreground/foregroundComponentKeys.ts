/**
 * The thirteen foreground components by key and by their English label, with
 * nothing else: no React, no screen manager, no panel. The help window names
 * a component on a chip and reads one out of a question with this list, and
 * the agent worker checks a key against it -- neither may pull the launcher
 * (`foregroundWidgetHelpers.tsx`), which lazy-loads every panel and the
 * long-text layer.
 *
 * Held in step with `FOREGROUND_WIDGET_LIST` by a test: the same keys, the
 * same labels, the same order. `labelKey` is an English dictionary key, so
 * keep each a plain literal on a `labelKey:` line of its own
 * (`tranKeyCoverage.test.ts` reads them as source text).
 */
export const FOREGROUND_COMPONENT_LIST = [
    { key: 'message', labelKey: 'Messages' },
    { key: 'marquee-top', labelKey: 'Marquee Top' },
    { key: 'marquee-bottom', labelKey: 'Marquee Bottom' },
    { key: 'quick-text', labelKey: 'Quick Text' },
    { key: 'long-text', labelKey: 'Long Text Show' },
    { key: 'countdown', labelKey: 'Countdown' },
    { key: 'stopwatch', labelKey: 'Stopwatch' },
    { key: 'time', labelKey: 'Time' },
    { key: 'video', labelKey: 'Video Show' },
    { key: 'image', labelKey: 'Image Show' },
    { key: 'camera', labelKey: 'Camera Show' },
    { key: 'screen', labelKey: 'Screen Show' },
    { key: 'web', labelKey: 'Web Show' },
] as const;

export type ForegroundComponentKeyType =
    (typeof FOREGROUND_COMPONENT_LIST)[number]['key'];

export const FOREGROUND_COMPONENT_KEYS = FOREGROUND_COMPONENT_LIST.map(
    (component) => {
        return component.key;
    },
) as ForegroundComponentKeyType[];

export function checkIsForegroundComponentKey(
    value: unknown,
): value is ForegroundComponentKeyType {
    return (
        typeof value === 'string' &&
        (FOREGROUND_COMPONENT_KEYS as string[]).includes(value)
    );
}

/** The component's English label (`Quick Text`), a dictionary key. */
export function toForegroundComponentLabel(key: ForegroundComponentKeyType) {
    return (
        FOREGROUND_COMPONENT_LIST.find((component) => {
            return component.key === key;
        })?.labelKey ?? key
    );
}
