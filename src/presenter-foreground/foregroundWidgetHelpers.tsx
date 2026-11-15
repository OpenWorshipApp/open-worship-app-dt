import { lazy } from 'react';
import type { LazyExoticComponent } from 'react';

import type { ForegroundDataType } from '../_screen/screenTypeHelpers';
import ScreenLongTextManager from '../_screen/managers/ScreenLongTextManager';
import { getForegroundShowingScreenIdDataList } from './foregroundHelpers';
import { getRunningAutoPlayKeys } from '../slide-auto-play/autoPlayRunnerHelpers';
import { toForegroundAutoPlayPrefix } from './foregroundAutoPlayPrefix';

/**
 * Every foreground component, as its own thing to open.
 *
 * They used to live stacked in one panel, which meant scrolling past nine
 * collapsed cards to reach the tenth and no way to watch two at once. Each one
 * now opens in ITS OWN floating panel -- the launcher below is the grid you
 * pick from -- and every panel remembers its size and place across a reload
 * through `FloatingWidgetComp`'s `persistKey`.
 *
 * `labelKey` is an English dictionary key. The lookup is dynamic, so
 * `tranKeyCoverage.test.ts` reads this list as source text: keep every one a
 * plain literal on a `labelKey:` line of its own.
 */
export type ForegroundWidgetType = {
    key: string;
    labelKey: string;
    iconName: string;
    checkIsOnScreen: (foregroundData: ForegroundDataType) => boolean;
    /**
     * For a component that is NOT drawn by the foreground manager: the
     * screens it is on, asked of whatever does draw it. `checkIsOnScreen`
     * is then never the answer -- nothing of it is in the foreground data.
     */
    getShowingScreenIds?: () => number[];
    /**
     * No whole-component transition button on its panel: its layer has no
     * transition to give it, and the button would write a setting nothing
     * reads.
     */
    isNoTransition?: true;
    Comp: LazyExoticComponent<() => any>;
};

export const FOREGROUND_WIDGET_LIST: ForegroundWidgetType[] = [
    {
        // First in the launcher on purpose: it is the one opened in a hurry,
        // and a list is read from the top.
        key: 'message',
        labelKey: 'Messages',
        iconName: 'chat-left-text',
        checkIsOnScreen: (data) => {
            return (data.messageDataList ?? []).length > 0;
        },
        Comp: lazy(() => {
            return import('./ForegroundMessageComp');
        }),
    },
    {
        key: 'marquee-top',
        labelKey: 'Marquee Top',
        iconName: 'chevron-bar-up',
        checkIsOnScreen: (data) => {
            return (data.marqueeTopDataList ?? []).length > 0;
        },
        Comp: lazy(() => {
            return import('./ForegroundMarqueeTopComp');
        }),
    },
    {
        key: 'marquee-bottom',
        labelKey: 'Marquee Bottom',
        iconName: 'chevron-bar-down',
        checkIsOnScreen: (data) => {
            return (data.marqueeBottomDataList ?? []).length > 0;
        },
        Comp: lazy(() => {
            return import('./ForegroundMarqueeBottomComp');
        }),
    },
    {
        key: 'quick-text',
        labelKey: 'Quick Text',
        iconName: 'chat-square-text',
        checkIsOnScreen: (data) => {
            return (data.quickTextDataList ?? []).length > 0;
        },
        Comp: lazy(() => {
            return import('./ForegroundQuickTextComp');
        }),
    },
    {
        // Beside the other text components, though it is drawn by the
        // long-text layer (the one a Bible passage is drawn in) and not
        // by the foreground manager: it has to scroll, which nothing in
        // the foreground does.
        key: 'long-text',
        labelKey: 'Long Text Show',
        iconName: 'body-text',
        checkIsOnScreen: () => {
            return false;
        },
        getShowingScreenIds: () => {
            return ScreenLongTextManager.getLongTextShowingList().map(
                ([screenId]) => {
                    return screenId;
                },
            );
        },
        isNoTransition: true,
        Comp: lazy(() => {
            return import('./ForegroundLongTextComp');
        }),
    },
    {
        key: 'countdown',
        labelKey: 'Countdown',
        iconName: 'hourglass-split',
        checkIsOnScreen: (data) => {
            return (data.countdownDataList ?? []).length > 0;
        },
        Comp: lazy(() => {
            return import('./ForegroundCountDownComp');
        }),
    },
    {
        key: 'stopwatch',
        labelKey: 'Stopwatch',
        iconName: 'stopwatch',
        checkIsOnScreen: (data) => {
            return (data.stopwatchDataList ?? []).length > 0;
        },
        Comp: lazy(() => {
            return import('./ForegroundStopwatchComp');
        }),
    },
    {
        key: 'time',
        labelKey: 'Time',
        iconName: 'clock',
        checkIsOnScreen: (data) => {
            return (data.timeDataList ?? []).length > 0;
        },
        Comp: lazy(() => {
            return import('./ForegroundTimeComp');
        }),
    },
    {
        key: 'video',
        labelKey: 'Video Show',
        iconName: 'camera-reels',
        checkIsOnScreen: (data) => {
            return (data.videoDataList ?? []).length > 0;
        },
        Comp: lazy(() => {
            return import('./ForegroundVideoComp');
        }),
    },
    {
        key: 'image',
        labelKey: 'Image Show',
        iconName: 'images',
        checkIsOnScreen: (data) => {
            return (data.imageDataList ?? []).length > 0;
        },
        Comp: lazy(() => {
            return import('./ForegroundImageComp');
        }),
    },
    {
        // The Background panel's Fills and Animations, put OVER the slide
        // the way Image Show puts a picture there (2026-11-15).
        key: 'fill',
        labelKey: 'Fill Show',
        iconName: 'palette',
        checkIsOnScreen: (data) => {
            return (data.fillDataList ?? []).length > 0;
        },
        Comp: lazy(() => {
            return import('./ForegroundFillComp');
        }),
    },
    {
        key: 'animation',
        labelKey: 'Animation Show',
        iconName: 'magic',
        checkIsOnScreen: (data) => {
            return (data.animationDataList ?? []).length > 0;
        },
        Comp: lazy(() => {
            return import('./ForegroundAnimationComp');
        }),
    },
    {
        key: 'camera',
        labelKey: 'Camera Show',
        iconName: 'camera-video',
        checkIsOnScreen: (data) => {
            return (data.cameraDataList ?? []).length > 0;
        },
        Comp: lazy(() => {
            return import('./ForegroundCameraComp');
        }),
    },
    {
        key: 'screen',
        labelKey: 'Screen Show',
        iconName: 'display',
        checkIsOnScreen: (data) => {
            return (data.screenDataList ?? []).length > 0;
        },
        Comp: lazy(() => {
            return import('./ForegroundScreenComp');
        }),
    },
    {
        key: 'web',
        labelKey: 'Web Show',
        iconName: 'globe2',
        checkIsOnScreen: (data) => {
            return (data.webDataList ?? []).length > 0;
        },
        Comp: lazy(() => {
            return import('./ForegroundWebComp');
        }),
    },
];

/**
 * The screens a component has something on, lowest first -- the one answer
 * behind the launcher's badges, a panel's on-screen mark and whatever else
 * asks, whichever manager draws the component.
 */
export function getForegroundWidgetShowingScreenIds(
    widget: ForegroundWidgetType,
) {
    const screenIds =
        widget.getShowingScreenIds?.() ??
        getForegroundShowingScreenIdDataList(widget.checkIsOnScreen).map(
            ([screenId]) => {
                return screenId;
            },
        );
    return Array.from(new Set(screenIds)).sort((a, b) => {
        return a - b;
    });
}

/**
 * Which panels are open, as one comma-separated setting. ONE key rather than
 * one per component because the chooser and the panels have to agree the
 * moment either changes -- a `setSetting` behind a mounted panel's own state
 * would not reach it.
 */
export const FOREGROUND_OPEN_PANELS_SETTING_NAME = 'foreground-open-panels';

export function toOpenPanelKeys(raw: string): string[] {
    return raw
        .split(',')
        .map((key) => {
            return key.trim();
        })
        .filter((key) => {
            return FOREGROUND_WIDGET_LIST.some((widget) => {
                return widget.key === key;
            });
        });
}

/** The open panels with `key` among them, opened if it was not. */
export function toOpenedPanelKeys(raw: string, key: string) {
    const keys = toOpenPanelKeys(raw);
    return (keys.includes(key) ? keys : [...keys, key]).join(',');
}

// The launcher mounted in this window, for a panel opened from somewhere
// else -- a lyric's `Long Text Show`. A launcher holds the open panels in its
// own state, so a bare `setSetting` behind it would not open anything.
const panelOpenerSet = new Set<(key: string) => void>();

export function registerForegroundPanelOpener(opener: (key: string) => void) {
    panelOpenerSet.add(opener);
    return () => {
        panelOpenerSet.delete(opener);
    };
}

/**
 * Opens a component's panel -- and brings it to the front if it is open
 * already. False when no launcher is mounted to do it: the caller then writes
 * the setting the launcher reads when it mounts.
 */
export function requestForegroundPanelOpening(key: string) {
    for (const opener of panelOpenerSet) {
        opener(key);
    }
    return panelOpenerSet.size > 0;
}

export function toToggledPanelKeys(raw: string, key: string) {
    const keys = toOpenPanelKeys(raw);
    return (
        keys.includes(key)
            ? keys.filter((item) => {
                  return item !== key;
              })
            : [...keys, key]
    ).join(',');
}

/**
 * The chooser. A context menu rather than a panel of its own: it opens AT THE
 * CURSOR, costs no screen space, and closes the moment a component is picked.
 */
export function genForegroundPanelMenuItems(
    openKeysRaw: string,
    onToggle: (key: string) => void,
    translate: (labelKey: string) => string,
) {
    const openKeys = toOpenPanelKeys(openKeysRaw);
    const runningKeys = getRunningAutoPlayKeys();
    return FOREGROUND_WIDGET_LIST.map((widget) => {
        const isOpened = openKeys.includes(widget.key);
        // The same two things the Foreground tab itself says: a tick for a
        // panel that is open, and the on-screen dot for a component that has
        // something on a screen RIGHT NOW -- which is the one a volunteer
        // scanning this menu mid-service is looking for.
        // WHICH screens, not just whether: with several screens up, "it is
        // showing" is not enough to know where to go and take it off.
        const screenIds = getForegroundWidgetShowingScreenIds(widget);
        const isOnScreen = screenIds.length > 0;
        // A slide show runs whether or not its panel is open -- the timers
        // live outside React -- so this menu is the one place that can say
        // WHERE one is running. A runner is keyed by the show's own settings
        // prefix, which is the widget's key with the session's suffix after
        // it; the exact match is the DEFAULT session, which carries none.
        const autoPlayKey = toForegroundAutoPlayPrefix(widget.key, '');
        const isAutoPlaying = runningKeys.some((runningKey) => {
            return (
                runningKey === autoPlayKey ||
                runningKey.startsWith(`${autoPlayKey}-`)
            );
        });
        return {
            // EXACTLY the component's name, nothing else. The row's own text
            // is the name with the screen-id badges glued onto it -- the menu
            // read as "Video Show1", which is not what is written on it and
            // is not a name anything can press by. The badges keep their own
            // titles; this is the row's.
            title: translate(widget.labelKey),
            childBefore: (
                <i
                    className={
                        'bi bi-' +
                        (isOpened ? 'check2-square' : widget.iconName)
                    }
                />
            ),
            // The name alone is the label, which the menu ellipsises at its
            // 210px cap. The badges and the slide show mark ride AFTER it, out
            // of the label: inside it, "Animation Show [0] ▶" did not fit and
            // the ▶ -- the one place a show running behind a closed panel is
            // said -- was cut off at the edge, while the label's scrolling
            // second line read "Animation Show0" (Afrikaans
            // "Animasievertoning" overflowed with a badge alone).
            menuElement: (
                <span className={isOnScreen ? 'app-on-screen' : ''}>
                    {translate(widget.labelKey)}
                </span>
            ),
            childAfter:
                isOnScreen || isAutoPlaying ? (
                    <span className="d-flex align-items-center align-self-center gap-1 flex-shrink-0 ms-1">
                        {screenIds.map((screenId) => {
                            return (
                                <span
                                    key={screenId}
                                    className="badge bg-info text-dark"
                                    title={`${translate('Screen')}: ${screenId}`}
                                >
                                    {screenId}
                                </span>
                            );
                        })}
                        {isAutoPlaying ? (
                            <i
                                className="bi bi-play-circle-fill text-info"
                                title={translate('Slide show is running')}
                            />
                        ) : null}
                    </span>
                ) : undefined,
            onSelect: () => {
                onToggle(widget.key);
            },
        };
    });
}

/** Where `FloatingWidgetComp` remembers that panel's size and place. */
export function toForegroundPanelPersistKey(key: string) {
    return `floating-widget-rect-foreground-${key}`;
}
